-- Repair hosted PL/pgSQL lint findings after Checkpoint 2 deployment.
-- This migration is additive: previously deployed migrations remain immutable.

CREATE OR REPLACE FUNCTION public.activate_student_trial()
RETURNS JSONB LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT;
  v_domain TEXT;
  v_profile RECORD;
  v_issued_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'EMAIL_NOT_FOUND', 'message', 'User email not found');
  END IF;

  v_domain := lower(split_part(v_email, '@', 2));
  IF v_domain <> 'mastersunion.org' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INELIGIBLE_DOMAIN',
      'message', 'Only verified @mastersunion.org emails are eligible for the student trial'
    );
  END IF;

  IF (SELECT email_confirmed_at FROM auth.users WHERE id = v_user_id) IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'EMAIL_UNCONFIRMED',
      'message', 'Email must be confirmed before activating trial'
    );
  END IF;

  SELECT entitlement, trial_issued_at, trial_expires_at, trial_eligibility_domain
  INTO v_profile
  FROM public.user_profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'PROFILE_MISSING',
      'message', 'User profile not found. Please contact support.'
    );
  END IF;

  IF v_profile.entitlement = 'subscribed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'code', 'ALREADY_FULL_ACCESS',
      'message', 'User already has full subscription access',
      'entitlement', 'subscribed',
      'trial_expires_at', v_profile.trial_expires_at,
      'trial_issued_at', v_profile.trial_issued_at
    );
  END IF;

  IF v_profile.trial_issued_at IS NOT NULL THEN
    IF v_profile.trial_expires_at IS NOT NULL AND v_profile.trial_expires_at > NOW() THEN
      RETURN jsonb_build_object(
        'success', true,
        'code', 'TRIAL_ACTIVE',
        'message', 'Trial already active',
        'entitlement', 'student_trial',
        'trial_expires_at', v_profile.trial_expires_at,
        'trial_issued_at', v_profile.trial_issued_at
      );
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'code', 'TRIAL_CONSUMED',
      'message', 'Trial already consumed and expired; cannot be reissued'
    );
  END IF;

  IF v_profile.entitlement = 'student_trial' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'TRIAL_ALREADY_ACTIVE',
      'message', 'Trial already active'
    );
  END IF;

  v_issued_at := NOW();
  v_expires_at := NOW() + INTERVAL '20 days';

  UPDATE public.user_profiles
  SET entitlement = 'student_trial',
      trial_issued_at = v_issued_at,
      trial_expires_at = v_expires_at,
      trial_eligibility_domain = 'mastersunion.org',
      updated_at = v_issued_at
  WHERE id = v_user_id;

  INSERT INTO public.entitlement_audit (user_id, previous_entitlement, new_entitlement, source, metadata)
  VALUES (
    v_user_id,
    v_profile.entitlement,
    'student_trial',
    'student_trial',
    jsonb_build_object('trial_expires_at', v_expires_at, 'trial_issued_at', v_issued_at)
  );

  RETURN jsonb_build_object(
    'success', true,
    'code', 'TRIAL_ACTIVATED',
    'message', '20-day student trial activated',
    'entitlement', 'student_trial',
    'trial_expires_at', v_expires_at,
    'trial_issued_at', v_issued_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_student_trial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_student_trial() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_candidate(
  p_kind TEXT,
  p_id UUID,
  p_expected_status TEXT,
  p_new_status TEXT,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_table TEXT;
  v_column TEXT;
  v_old JSONB;
  v_old_status TEXT;
  v_urls TEXT[] := ARRAY[]::TEXT[];
  v_event_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF p_id IS NULL OR p_expected_status IS NULL OR p_new_status IS NULL
     OR LENGTH(TRIM(COALESCE(p_reason, ''))) < 10
     OR LENGTH(p_reason) > 1000 THEN
    RAISE EXCEPTION 'Review requires an item, expected state, target state, and 10-1000 character reason'
      USING ERRCODE = '22023';
  END IF;

  CASE p_kind
    WHEN 'story' THEN v_table := 'stories'; v_column := 'verification_label';
    WHEN 'funding_round' THEN v_table := 'funding_rounds'; v_column := 'verification_status';
    WHEN 'round_participant' THEN v_table := 'round_participants'; v_column := 'verification_status';
    WHEN 'pattern' THEN v_table := 'patterns'; v_column := 'status';
    ELSE RAISE EXCEPTION 'Unsupported review kind' USING ERRCODE = '22023';
  END CASE;

  EXECUTE FORMAT('SELECT TO_JSONB(t) FROM public.%I t WHERE id = $1 FOR UPDATE', v_table)
    INTO v_old USING p_id;
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'Review item not found' USING ERRCODE = 'P0002';
  END IF;

  v_old_status := v_old ->> v_column;
  IF v_old_status IS DISTINCT FROM p_expected_status THEN
    RAISE EXCEPTION 'Review item changed; refresh the queue' USING ERRCODE = '40001';
  END IF;

  IF p_kind = 'pattern' THEN
    IF NOT ((v_old_status = 'candidate' AND p_new_status IN ('published', 'rejected'))
      OR (v_old_status = 'published' AND p_new_status = 'retired')
      OR (v_old_status = 'corrected' AND p_new_status IN ('published', 'retired'))) THEN
      RAISE EXCEPTION 'Invalid pattern review transition' USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(ARRAY_AGG(VALUE), ARRAY[]::TEXT[]) INTO v_urls
      FROM JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(v_old -> 'source_links', '[]'::JSONB)) VALUE;
    IF p_new_status = 'published' AND (
      CARDINALITY(v_urls) = 0 OR JSONB_ARRAY_LENGTH(COALESCE(v_old -> 'qualifying_events', '[]'::JSONB)) = 0
    ) THEN
      RAISE EXCEPTION 'Pattern needs source links and qualifying events' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_new_status NOT IN ('verified', 'partial', 'unverified', 'conflicted')
       OR p_new_status = v_old_status THEN
      RAISE EXCEPTION 'Invalid verification transition' USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(ARRAY_AGG(VALUE), ARRAY[]::TEXT[]) INTO v_urls
      FROM JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(v_old -> 'source_urls', '[]'::JSONB)) VALUE;
    IF p_kind = 'story' AND CARDINALITY(v_urls) = 0
       AND NULLIF(v_old ->> 'canonical_url', '') IS NOT NULL THEN
      v_urls := ARRAY[v_old ->> 'canonical_url'];
    END IF;
    IF p_new_status IN ('verified', 'partial') AND CARDINALITY(v_urls) = 0 THEN
      RAISE EXCEPTION 'Verified items require original source URLs' USING ERRCODE = '22023';
    END IF;
    IF p_kind = 'round_participant' AND p_new_status IN ('verified', 'partial')
       AND COALESCE(v_old ->> 'role', '') NOT IN ('lead', 'co_lead', 'participant') THEN
      RAISE EXCEPTION 'Investor role must be explicit before verification' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_kind = 'pattern' THEN
    UPDATE public.patterns SET status = p_new_status, reviewed_by = v_actor,
      reviewed_at = NOW() WHERE id = p_id;
  ELSE
    EXECUTE FORMAT('UPDATE public.%I SET %I = $1 WHERE id = $2', v_table, v_column)
      USING p_new_status, p_id;
  END IF;

  INSERT INTO public.admin_review_events
    (item_kind, item_id, reviewer_id, previous_status, new_status, reason, evidence_urls)
  VALUES (p_kind, p_id, v_actor, v_old_status, p_new_status, TRIM(p_reason), v_urls)
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_candidate(TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_candidate(TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.acquire_stage_lease(
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 300,
  p_allowed_stage_names public.stage_name[] DEFAULT NULL,
  p_pipeline_run_id UUID DEFAULT NULL
)
RETURNS TABLE (
  attempt_id UUID,
  pipeline_run_id UUID,
  stage_name public.stage_name,
  idempotency_key TEXT,
  attempt_number INTEGER,
  input_ref JSONB,
  max_attempts INTEGER,
  model_run_id UUID,
  lease_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lease_token TEXT := replace(gen_random_uuid()::TEXT, '-', '') || replace(gen_random_uuid()::TEXT, '-', '');
  v_now TIMESTAMPTZ := NOW();
  v_lease_expires_at TIMESTAMPTZ := v_now + (p_lease_seconds || ' seconds')::INTERVAL;
  v_attempt RECORD;
  v_new_crash_count INTEGER;
  v_crash_budget INTEGER;
BEGIN
  SELECT sa.id, sa.pipeline_run_id, sa.stage_name, sa.idempotency_key,
         sa.attempt_number, sa.input_ref, sa.max_attempts, sa.model_run_id,
         sa.status, sa.lease_expires_at, sa.crash_count, sa.started_at
  INTO v_attempt
  FROM public.stage_attempts sa
  JOIN public.pipeline_runs pr ON pr.id = sa.pipeline_run_id
  WHERE sa.status IN ('pending', 'retry_wait', 'leased')
    AND (sa.retry_after IS NULL OR sa.retry_after <= v_now)
    AND (sa.status <> 'leased' OR sa.lease_expires_at <= v_now)
    AND pr.status IN ('pending', 'running')
    AND (p_allowed_stage_names IS NULL OR sa.stage_name = ANY(p_allowed_stage_names))
    AND (p_pipeline_run_id IS NULL OR sa.pipeline_run_id = p_pipeline_run_id)
    AND sa.attempt_number <= sa.max_attempts
  ORDER BY
    CASE sa.status WHEN 'pending' THEN 0 WHEN 'retry_wait' THEN 1 WHEN 'leased' THEN 2 END,
    sa.created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_new_crash_count := v_attempt.crash_count;
  IF v_attempt.status = 'leased' AND v_attempt.lease_expires_at <= v_now THEN
    v_new_crash_count := v_attempt.crash_count + 1;

    UPDATE public.pipeline_runs
    SET crash_budget = GREATEST(0, crash_budget - 1),
        updated_at = v_now
    WHERE id = v_attempt.pipeline_run_id
      AND crash_budget > 0
    RETURNING crash_budget INTO v_crash_budget;

    IF v_crash_budget IS NULL OR v_crash_budget <= 0 THEN
      UPDATE public.stage_attempts
      SET status = 'dead_letter',
          error_code = 'RUN_CRASH_BUDGET_EXHAUSTED',
          error_message = 'Pipeline run crash budget exhausted on lease recovery',
          error_metadata = jsonb_build_object('crash_count', v_new_crash_count, 'crash_budget', 0),
          completed_at = v_now,
          lease_owner = NULL,
          lease_token = NULL,
          leased_at = NULL,
          lease_expires_at = NULL,
          heartbeat_at = NULL,
          crash_count = v_new_crash_count,
          updated_at = v_now
      WHERE id = v_attempt.id;
      RETURN;
    END IF;
  END IF;

  IF v_new_crash_count >= 3 THEN
    UPDATE public.stage_attempts
    SET status = 'dead_letter',
        error_code = 'CRASH_BUDGET_EXCEEDED',
        error_message = 'Lease expired too many times (crash budget exceeded)',
        error_metadata = jsonb_build_object('crash_count', v_new_crash_count, 'threshold', 3),
        completed_at = v_now,
        lease_owner = NULL,
        lease_token = NULL,
        leased_at = NULL,
        lease_expires_at = NULL,
        heartbeat_at = NULL,
        crash_count = v_new_crash_count,
        updated_at = v_now
    WHERE id = v_attempt.id;
    RETURN;
  END IF;

  UPDATE public.stage_attempts
  SET status = 'leased',
      lease_owner = p_worker_id,
      lease_token = v_lease_token,
      leased_at = v_now,
      lease_expires_at = v_lease_expires_at,
      heartbeat_at = v_now,
      started_at = COALESCE(v_attempt.started_at, v_now),
      crash_count = v_new_crash_count,
      updated_at = v_now
  WHERE id = v_attempt.id;

  UPDATE public.pipeline_runs
  SET status = 'running',
      started_at = COALESCE(started_at, v_now),
      heartbeat_at = v_now,
      updated_at = v_now
  WHERE id = v_attempt.pipeline_run_id
    AND status = 'pending';

  RETURN QUERY SELECT
    v_attempt.id,
    v_attempt.pipeline_run_id,
    v_attempt.stage_name,
    v_attempt.idempotency_key,
    v_attempt.attempt_number,
    v_attempt.input_ref,
    v_attempt.max_attempts,
    v_attempt.model_run_id,
    v_lease_token;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_stage_lease(TEXT, INTEGER, public.stage_name[], UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_stage_lease(TEXT, INTEGER, public.stage_name[], UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.replay_dead_letter(
  p_attempt_id UUID,
  p_reason TEXT
)
RETURNS TABLE (new_attempt_id UUID, old_attempt_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_attempt RECORD;
  v_new_attempt_id UUID;
BEGIN
  SELECT sa.pipeline_run_id, sa.stage_name, sa.idempotency_key, sa.input_ref, sa.max_attempts, sa.model_run_id,
         pr.status
  INTO v_old_attempt
  FROM public.stage_attempts sa
  JOIN public.pipeline_runs pr ON pr.id = sa.pipeline_run_id
  WHERE sa.id = p_attempt_id
    AND sa.status = 'dead_letter'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dead letter attempt not found: %', p_attempt_id USING ERRCODE = 'P0001';
  END IF;

  IF v_old_attempt.status IN ('completed', 'failed', 'partial', 'cancelled') THEN
    UPDATE public.pipeline_runs
    SET status = 'running',
        started_at = COALESCE(started_at, NOW()),
        heartbeat_at = NOW(),
        completed_at = NULL,
        failure_summary = NULL,
        updated_at = NOW()
    WHERE id = v_old_attempt.pipeline_run_id;
  END IF;

  INSERT INTO public.stage_attempts (
    pipeline_run_id, stage_name, idempotency_key, input_ref,
    max_attempts, model_run_id, attempt_number, status, error_metadata
  ) VALUES (
    v_old_attempt.pipeline_run_id,
    v_old_attempt.stage_name,
    v_old_attempt.idempotency_key || ':replay:' || gen_random_uuid()::TEXT,
    v_old_attempt.input_ref,
    v_old_attempt.max_attempts,
    v_old_attempt.model_run_id,
    1,
    'pending',
    jsonb_build_object('replayed_from', p_attempt_id, 'reason', p_reason, 'replayed_at', NOW())
  )
  RETURNING id INTO v_new_attempt_id;

  UPDATE public.stage_attempts
  SET error_metadata = error_metadata || jsonb_build_object(
        'replayed_to', v_new_attempt_id,
        'replay_reason', p_reason
      ),
      updated_at = NOW()
  WHERE id = p_attempt_id;

  RETURN QUERY SELECT v_new_attempt_id, p_attempt_id;
END;
$$;

REVOKE ALL ON FUNCTION public.replay_dead_letter(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replay_dead_letter(UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_pipeline_run(
  p_run_id UUID,
  p_status public.pipeline_status DEFAULT 'completed',
  p_failure_summary JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pending_stages INTEGER;
  v_failed_stages INTEGER;
BEGIN
  PERFORM 1
  FROM public.pipeline_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pipeline run not found: %', p_run_id USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) FILTER (WHERE status NOT IN ('completed', 'skipped', 'dead_letter'))
  INTO v_pending_stages
  FROM public.stage_attempts
  WHERE pipeline_run_id = p_run_id;

  SELECT COUNT(*) FILTER (WHERE status = 'dead_letter')
  INTO v_failed_stages
  FROM public.stage_attempts
  WHERE pipeline_run_id = p_run_id;

  IF p_status = 'completed' THEN
    IF v_failed_stages > 0 AND v_pending_stages = 0 THEN
      p_status := 'partial';
    ELSIF v_failed_stages > 0 OR v_pending_stages > 0 THEN
      p_status := 'failed';
    END IF;
  END IF;

  UPDATE public.pipeline_runs
  SET status = p_status,
      completed_at = NOW(),
      failure_summary = COALESCE(
        p_failure_summary,
        CASE WHEN v_failed_stages > 0 THEN jsonb_build_object(
          'failed_stages', v_failed_stages,
          'message', 'Some stages ended in dead_letter'
        ) ELSE NULL END
      ),
      updated_at = NOW()
  WHERE id = p_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_pipeline_run(UUID, public.pipeline_status, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_pipeline_run(UUID, public.pipeline_status, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.get_source_health(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  source_id TEXT,
  name TEXT,
  status TEXT,
  last_fetch_at TIMESTAMPTZ,
  last_fetch_status TEXT,
  consecutive_failures BIGINT,
  items_fetched_24h BIGINT,
  items_new_24h BIGINT,
  unique_yield_24h NUMERIC,
  health_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.source_id,
    sc.name,
    sc.status,
    latest_log.fetched_at AS last_fetch_at,
    latest_log.status AS last_fetch_status,
    COALESCE((
      SELECT COUNT(*)
      FROM public.source_fetch_logs sfl2
      WHERE sfl2.source_id = sc.source_id
        AND sfl2.status = 'error'
        AND sfl2.fetched_at > (
          SELECT COALESCE(MAX(sfl3.fetched_at), '1970-01-01'::TIMESTAMPTZ)
          FROM public.source_fetch_logs sfl3
          WHERE sfl3.source_id = sc.source_id AND sfl3.status = 'success'
        )
    ), 0) AS consecutive_failures,
    COALESCE(SUM(sfl.items_found) FILTER (WHERE sfl.fetched_at > NOW() - INTERVAL '24 hours'), 0) AS items_fetched_24h,
    COALESCE(SUM(sfl.items_new) FILTER (WHERE sfl.fetched_at > NOW() - INTERVAL '24 hours'), 0) AS items_new_24h,
    CASE WHEN SUM(sfl.items_found) FILTER (WHERE sfl.fetched_at > NOW() - INTERVAL '24 hours') > 0
      THEN SUM(sfl.items_new) FILTER (WHERE sfl.fetched_at > NOW() - INTERVAL '24 hours')::NUMERIC /
           SUM(sfl.items_found) FILTER (WHERE sfl.fetched_at > NOW() - INTERVAL '24 hours')
      ELSE 0 END AS unique_yield_24h,
    CASE
      WHEN sc.status = 'approved' THEN
        LEAST(100, 50 + COALESCE(SUM(sfl.items_new) FILTER (WHERE sfl.fetched_at > NOW() - INTERVAL '24 hours'), 0) * 2)::NUMERIC
      ELSE 0::NUMERIC
    END AS health_score
  FROM public.source_connectors sc
  LEFT JOIN LATERAL (
    SELECT latest_sfl.fetched_at, latest_sfl.status
    FROM public.source_fetch_logs latest_sfl
    WHERE latest_sfl.source_id = sc.source_id
    ORDER BY latest_sfl.fetched_at DESC
    LIMIT 1
  ) latest_log ON TRUE
  LEFT JOIN public.source_fetch_logs sfl ON sfl.source_id = sc.source_id
  GROUP BY sc.source_id, sc.name, sc.status, latest_log.fetched_at, latest_log.status
  ORDER BY health_score DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_source_health(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_source_health(INTEGER) TO service_role;
