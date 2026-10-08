-- Migration: Pipeline Orchestration (Checkpoint 2)
-- Date: 2026-10-07
-- Description: Durable pipeline orchestration with leases, retries, idempotency, and replay
-- Depends on: 20261007020808 (Checkpoint 1 lint fixes)

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE public.pipeline_type AS ENUM (
  'news_ingestion',
  'funding_extraction',
  'thesis_extraction',
  'pattern_detection',
  'full_refresh'
);

CREATE TYPE public.pipeline_trigger AS ENUM (
  'scheduled',
  'manual',
  'webhook',
  'retry'
);

CREATE TYPE public.pipeline_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'partial',
  'cancelled'
);

CREATE TYPE public.stage_name AS ENUM (
  'discover',
  'fetch',
  'archive',
  'normalize',
  'extract',
  'resolve',
  'verify',
  'publish'
);

CREATE TYPE public.stage_status AS ENUM (
  'pending',
  'leased',
  'running',
  'completed',
  'retry_wait',
  'failed',
  'dead_letter',
  'skipped'
);

CREATE TYPE public.retryability AS ENUM (
  'retryable',
  'non_retryable'
);

-- ============================================
-- PIPELINE_RUNS TABLE
-- ============================================

CREATE TABLE public.pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_type public.pipeline_type NOT NULL,
  trigger public.pipeline_trigger NOT NULL DEFAULT 'scheduled',
  status public.pipeline_status NOT NULL DEFAULT 'pending',
  parameters JSONB NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_items BIGINT NOT NULL DEFAULT 0,
  completed_items BIGINT NOT NULL DEFAULT 0,
  failed_items BIGINT NOT NULL DEFAULT 0,
  total_latency_ms BIGINT NOT NULL DEFAULT 0,
  failure_summary JSONB,
  crash_budget INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idempotency_key)
);

CREATE INDEX idx_pipeline_runs_type_status ON public.pipeline_runs(pipeline_type, status);
CREATE INDEX idx_pipeline_runs_requested_at ON public.pipeline_runs(requested_at DESC);
CREATE INDEX idx_pipeline_runs_heartbeat ON public.pipeline_runs(heartbeat_at) WHERE status = 'running';
CREATE INDEX idx_pipeline_runs_stale ON public.pipeline_runs(id, heartbeat_at) WHERE status = 'running';

-- ============================================
-- STAGE_ATTEMPTS TABLE
-- ============================================

CREATE TABLE public.stage_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id UUID NOT NULL REFERENCES public.pipeline_runs(id) ON DELETE CASCADE,
  stage_name public.stage_name NOT NULL,
  status public.stage_status NOT NULL DEFAULT 'pending',
  attempt_number INTEGER NOT NULL DEFAULT 1,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  idempotency_key TEXT NOT NULL,
  lease_owner TEXT,
  lease_token TEXT,
  leased_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  retry_after TIMESTAMPTZ,
  input_ref JSONB NOT NULL DEFAULT '{}',
  output_ref JSONB,
  model_run_id UUID REFERENCES public.model_runs(id),
  error_code TEXT,
  error_message TEXT,
  error_metadata JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  latency_ms BIGINT,
  items_processed BIGINT NOT NULL DEFAULT 0,
  items_succeeded BIGINT NOT NULL DEFAULT 0,
  items_failed BIGINT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  crash_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pipeline_run_id, stage_name, idempotency_key)
);

-- Indexes for lease acquisition and queue polling (no NOW() in predicates)
CREATE INDEX idx_stage_attempts_run_stage ON public.stage_attempts(pipeline_run_id, stage_name);
CREATE INDEX idx_stage_attempts_lease_acquire ON public.stage_attempts(status, retry_after, lease_expires_at, pipeline_run_id)
  WHERE status IN ('pending', 'retry_wait', 'leased');
CREATE INDEX idx_stage_attempts_expired_lease ON public.stage_attempts(id, lease_expires_at)
  WHERE status = 'leased';
CREATE INDEX idx_stage_attempts_retry_ready ON public.stage_attempts(id, retry_after)
  WHERE status = 'retry_wait';
CREATE INDEX idx_stage_attempts_dead_letter ON public.stage_attempts(pipeline_run_id, stage_name)
  WHERE status = 'dead_letter';

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_pipeline_runs_updated_at
  BEFORE UPDATE ON public.pipeline_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stage_attempts_updated_at
  BEFORE UPDATE ON public.stage_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SERVICE-ROLE ONLY ORCHESTRATION FUNCTIONS
-- ============================================

-- create_or_get_pipeline_run: Creates a new run or returns existing one by idempotency_key
CREATE OR REPLACE FUNCTION public.create_or_get_pipeline_run(
  p_pipeline_type public.pipeline_type,
  p_trigger public.pipeline_trigger,
  p_idempotency_key TEXT,
  p_parameters JSONB DEFAULT '{}'
)
RETURNS TABLE (
  run_id UUID,
  is_new BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run_id UUID;
  v_is_new BOOLEAN := FALSE;
BEGIN
  INSERT INTO public.pipeline_runs (pipeline_type, trigger, idempotency_key, parameters, status, requested_at)
  VALUES (p_pipeline_type, p_trigger, p_idempotency_key, p_parameters, 'pending', NOW())
  ON CONFLICT (idempotency_key) DO UPDATE SET
    trigger = CASE WHEN EXCLUDED.trigger = 'retry' THEN 'retry' ELSE public.pipeline_runs.trigger END,
    parameters = EXCLUDED.parameters,
    updated_at = NOW()
  RETURNING id, (xmax = 0) INTO v_run_id, v_is_new;

  IF NOT v_is_new AND p_trigger = 'retry' THEN
    UPDATE public.pipeline_runs
    SET status = 'pending',
        started_at = NULL,
        heartbeat_at = NULL,
        completed_at = NULL,
        failure_summary = NULL,
        updated_at = NOW()
    WHERE id = v_run_id
      AND status IN ('completed', 'failed', 'partial', 'cancelled');
  END IF;

  RETURN QUERY SELECT v_run_id, v_is_new;
END;
$$;

REVOKE ALL ON FUNCTION public.create_or_get_pipeline_run(public.pipeline_type, public.pipeline_trigger, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_or_get_pipeline_run(public.pipeline_type, public.pipeline_trigger, TEXT, JSONB) TO service_role;

-- enqueue_stage_attempt: Creates or gets a stage attempt with idempotency
-- Atomic concurrency-safe idempotency: INSERT ... ON CONFLICT DO NOTHING followed by SELECT of the canonical row.
-- Re-enqueue of same terminal key returns existing attempt UNCHANGED (no mutation of input_ref, model_run_id, max_attempts, counters, audit).
-- Only replay_dead_letter creates new work from terminal state.
CREATE OR REPLACE FUNCTION public.enqueue_stage_attempt(
  p_pipeline_run_id UUID,
  p_stage_name public.stage_name,
  p_idempotency_key TEXT,
  p_input_ref JSONB DEFAULT '{}',
  p_max_attempts INTEGER DEFAULT 3,
  p_model_run_id UUID DEFAULT NULL
)
RETURNS TABLE (
  attempt_id UUID,
  is_new BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_attempt_id UUID;
  v_is_new BOOLEAN := FALSE;
  v_run_status public.pipeline_status;
BEGIN
  SELECT status INTO v_run_status
  FROM public.pipeline_runs
  WHERE id = p_pipeline_run_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pipeline run not found: %', p_pipeline_run_id USING ERRCODE = 'P0001';
  END IF;

  IF v_run_status IN ('completed', 'failed', 'partial', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot enqueue stage for terminal pipeline run: %', v_run_status USING ERRCODE = '55000';
  END IF;

  -- Atomic upsert: try to insert, on conflict do nothing and select existing
  INSERT INTO public.stage_attempts (
    pipeline_run_id, stage_name, idempotency_key, input_ref,
    max_attempts, model_run_id, status
  ) VALUES (
    p_pipeline_run_id, p_stage_name, p_idempotency_key, p_input_ref,
    p_max_attempts, p_model_run_id, 'pending'
  )
  ON CONFLICT (pipeline_run_id, stage_name, idempotency_key) DO NOTHING
  RETURNING id, TRUE INTO v_attempt_id, v_is_new;

  IF v_is_new THEN
    RETURN QUERY SELECT v_attempt_id, TRUE;
  ELSE
    -- Conflict occurred, select the existing row unchanged
    RETURN QUERY SELECT id, FALSE FROM public.stage_attempts
    WHERE pipeline_run_id = p_pipeline_run_id
      AND stage_name = p_stage_name
      AND idempotency_key = p_idempotency_key;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_stage_attempt(UUID, public.stage_name, TEXT, JSONB, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_stage_attempt(UUID, public.stage_name, TEXT, JSONB, INTEGER, UUID) TO service_role;

-- acquire_stage_lease: Claims a pending/retry_wait/expired attempt for processing
-- Returns zero rows (not a null row) when no work available.
-- Requires p_pipeline_run_id to scope to a specific run; omit for global queue polling.
-- Crash budget is a run-wide gate: each expired-lease recovery atomically decrements it.
-- When exhausted, the recovered attempt is dead-lettered without returning a lease.
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
  v_lease_token TEXT := encode(gen_random_bytes(32), 'hex');
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

  -- Compute new crash_count if this is an expired lease recovery
  v_new_crash_count := v_attempt.crash_count;
  IF v_attempt.status = 'leased' AND v_attempt.lease_expires_at <= v_now THEN
    v_new_crash_count := v_attempt.crash_count + 1;
  END IF;

  -- Atomically check and decrement crash_budget for expired lease recoveries
  IF v_attempt.status = 'leased' AND v_attempt.lease_expires_at <= v_now THEN
    UPDATE public.pipeline_runs
    SET crash_budget = GREATEST(0, crash_budget - 1),
        updated_at = v_now
    WHERE id = v_attempt.pipeline_run_id
      AND crash_budget > 0
    RETURNING crash_budget INTO v_crash_budget;

    -- If crash_budget exhausted (was 0 or decremented to 0), dead-letter without lease
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

  -- Also enforce per-attempt crash threshold (3)
  -- Dead-letter without consuming run crash_budget (already consumed for expiry recovery above)
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

-- heartbeat_stage_lease: Extends lease TTL for long-running work
-- Returns FALSE if lease expired or token invalid; does not emit error.
CREATE OR REPLACE FUNCTION public.heartbeat_stage_lease(
  p_attempt_id UUID,
  p_lease_token TEXT,
  p_lease_seconds INTEGER DEFAULT 300
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_lease_expires_at TIMESTAMPTZ := v_now + (p_lease_seconds || ' seconds')::INTERVAL;
  v_updated INTEGER;
BEGIN
  UPDATE public.stage_attempts
  SET heartbeat_at = v_now,
      lease_expires_at = v_lease_expires_at,
      updated_at = v_now
  WHERE id = p_attempt_id
    AND lease_token = p_lease_token
    AND status = 'leased'
    AND lease_expires_at > v_now;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    UPDATE public.pipeline_runs
    SET heartbeat_at = v_now,
        updated_at = v_now
    WHERE id IN (SELECT pipeline_run_id FROM public.stage_attempts WHERE id = p_attempt_id)
      AND status = 'running';
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.heartbeat_stage_lease(UUID, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.heartbeat_stage_lease(UUID, TEXT, INTEGER) TO service_role;

-- complete_stage_attempt: Marks attempt as completed with output and counters
-- Uses explicit TIMESTAMPTZ variable for started_at; computes latency_ms with numeric cast.
CREATE OR REPLACE FUNCTION public.complete_stage_attempt(
  p_attempt_id UUID,
  p_lease_token TEXT,
  p_output_ref JSONB,
  p_items_processed BIGINT DEFAULT 0,
  p_items_succeeded BIGINT DEFAULT 0,
  p_items_failed BIGINT DEFAULT 0,
  p_cost_usd NUMERIC DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_started_at TIMESTAMPTZ;
  v_latency_ms BIGINT;
  v_pipeline_run_id UUID;
  v_updated INTEGER;
BEGIN
  SELECT pipeline_run_id, started_at INTO v_pipeline_run_id, v_started_at
  FROM public.stage_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found: %', p_attempt_id USING ERRCODE = 'P0001';
  END IF;

  v_latency_ms := EXTRACT(EPOCH FROM (v_now - v_started_at)) * 1000;

  UPDATE public.stage_attempts
  SET status = 'completed',
      output_ref = p_output_ref,
      items_processed = p_items_processed,
      items_succeeded = p_items_succeeded,
      items_failed = p_items_failed,
      cost_usd = p_cost_usd,
      completed_at = v_now,
      latency_ms = v_latency_ms,
      lease_owner = NULL,
      lease_token = NULL,
      lease_expires_at = NULL,
      heartbeat_at = NULL,
      updated_at = v_now
  WHERE id = p_attempt_id
    AND lease_token = p_lease_token
    AND status = 'leased';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.pipeline_runs
  SET total_items = total_items + p_items_processed,
      completed_items = completed_items + p_items_succeeded,
      failed_items = failed_items + p_items_failed,
      total_latency_ms = total_latency_ms + v_latency_ms,
      heartbeat_at = v_now,
      updated_at = v_now
  WHERE id = v_pipeline_run_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_stage_attempt(UUID, TEXT, JSONB, BIGINT, BIGINT, BIGINT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_stage_attempt(UUID, TEXT, JSONB, BIGINT, BIGINT, BIGINT, NUMERIC) TO service_role;

-- fail_stage_attempt: Marks attempt as failed with error info and schedules retry or dead_letter
-- Retry increments attempt_number ON FAILURE SCHEDULING (not on reacquisition).
-- Bounded exponential backoff: ~1, 5, 15 minutes. After max_attempts -> dead_letter.
CREATE OR REPLACE FUNCTION public.fail_stage_attempt(
  p_attempt_id UUID,
  p_lease_token TEXT,
  p_error_code TEXT,
  p_error_message TEXT,
  p_retryability public.retryability DEFAULT 'retryable',
  p_error_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE (
  attempt_id UUID,
  next_status public.stage_status,
  retry_after TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_attempt RECORD;
  v_next_status public.stage_status;
  v_retry_after TIMESTAMPTZ;
  v_backoff_minutes INTEGER;
BEGIN
  SELECT pipeline_run_id, attempt_number, max_attempts, started_at
  INTO v_attempt
  FROM public.stage_attempts
  WHERE id = p_attempt_id
    AND lease_token = p_lease_token
    AND status = 'leased'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found or invalid lease: %', p_attempt_id USING ERRCODE = 'P0001';
  END IF;

  IF p_retryability = 'non_retryable' OR v_attempt.attempt_number >= v_attempt.max_attempts THEN
    v_next_status := 'dead_letter';
    v_retry_after := NULL;
  ELSE
    v_next_status := 'retry_wait';
    v_backoff_minutes := CASE v_attempt.attempt_number
      WHEN 1 THEN 1
      WHEN 2 THEN 5
      ELSE 15
    END;
    v_retry_after := v_now + (v_backoff_minutes || ' minutes')::INTERVAL;
  END IF;

  UPDATE public.stage_attempts
  SET status = v_next_status,
      error_code = p_error_code,
      error_message = p_error_message,
      error_metadata = p_error_metadata,
      retry_after = v_retry_after,
      completed_at = CASE WHEN v_next_status = 'dead_letter' THEN v_now ELSE NULL END,
      latency_ms = EXTRACT(EPOCH FROM (v_now - v_attempt.started_at)) * 1000,
      lease_owner = NULL,
      lease_token = NULL,
      lease_expires_at = NULL,
      heartbeat_at = NULL,
      attempt_number = v_attempt.attempt_number + 1,
      updated_at = v_now
  WHERE id = p_attempt_id;

  IF v_next_status = 'dead_letter' THEN
    UPDATE public.pipeline_runs
    SET failed_items = failed_items + 1,
        updated_at = v_now
    WHERE id = v_attempt.pipeline_run_id;
  END IF;

  RETURN QUERY SELECT p_attempt_id, v_next_status, v_retry_after;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_stage_attempt(UUID, TEXT, TEXT, TEXT, public.retryability, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_stage_attempt(UUID, TEXT, TEXT, TEXT, public.retryability, JSONB) TO service_role;

-- replay_dead_letter: Creates a new auditable attempt from a dead-lettered item
-- New attempt has attempt_number = 1 (bounded), fresh leaseable status, replayed_from metadata.
-- Original dead letter preserved with replayed_to link.
-- If parent run is terminal (completed/failed/partial/cancelled), reopen it to 'running':
-- status running, completed_at NULL, failure_summary NULL, heartbeat refreshed, original dead letter retained.
CREATE OR REPLACE FUNCTION public.replay_dead_letter(
  p_attempt_id UUID,
  p_reason TEXT
)
RETURNS TABLE (
  new_attempt_id UUID,
  old_attempt_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_attempt RECORD;
  v_new_attempt_id UUID;
  v_run_status public.pipeline_status;
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

  -- If parent run is terminal, reopen it to running
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
    max_attempts, model_run_id, attempt_number, status,
    error_metadata
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
  SET error_metadata = error_metadata || jsonb_build_object('replayed_to', v_new_attempt_id, 'replay_reason', p_reason),
      updated_at = NOW()
  WHERE id = p_attempt_id;

  RETURN QUERY SELECT v_new_attempt_id, p_attempt_id;
END;
$$;

REVOKE ALL ON FUNCTION public.replay_dead_letter(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replay_dead_letter(UUID, TEXT) TO service_role;

-- finalize_pipeline_run: Marks pipeline run as completed/partial/failed based on stage outcomes
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
  v_run RECORD;
  v_pending_stages INTEGER;
  v_failed_stages INTEGER;
BEGIN
  SELECT status, completed_items, failed_items INTO v_run
  FROM public.pipeline_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pipeline run not found: %', p_run_id USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) FILTER (WHERE status NOT IN ('completed', 'skipped', 'dead_letter')) INTO v_pending_stages
  FROM public.stage_attempts
  WHERE pipeline_run_id = p_run_id;

  SELECT COUNT(*) FILTER (WHERE status = 'dead_letter') INTO v_failed_stages
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
      failure_summary = COALESCE(p_failure_summary,
        CASE WHEN v_failed_stages > 0 THEN jsonb_build_object(
          'failed_stages', v_failed_stages,
          'message', 'Some stages ended in dead_letter'
        ) ELSE NULL END),
      updated_at = NOW()
  WHERE id = p_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_pipeline_run(UUID, public.pipeline_status, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_pipeline_run(UUID, public.pipeline_status, JSONB) TO service_role;

-- ============================================
-- DIAGNOSTIC READ FUNCTIONS (service-role only)
-- ============================================

-- Get recent pipeline runs with statuses
CREATE OR REPLACE FUNCTION public.get_recent_pipeline_runs(
  p_limit INTEGER DEFAULT 50,
  p_pipeline_type public.pipeline_type DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  pipeline_type public.pipeline_type,
  trigger public.pipeline_trigger,
  status public.pipeline_status,
  requested_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_items BIGINT,
  completed_items BIGINT,
  failed_items BIGINT,
  total_latency_ms BIGINT,
  failure_summary JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT pr.id, pr.pipeline_type, pr.trigger, pr.status,
         pr.requested_at, pr.started_at, pr.completed_at,
         pr.total_items, pr.completed_items, pr.failed_items,
         pr.total_latency_ms, pr.failure_summary
  FROM public.pipeline_runs pr
  WHERE p_pipeline_type IS NULL OR pr.pipeline_type = p_pipeline_type
  ORDER BY pr.requested_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_recent_pipeline_runs(INTEGER, public.pipeline_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recent_pipeline_runs(INTEGER, public.pipeline_type) TO service_role;

-- Get stage waterfall for a pipeline run
CREATE OR REPLACE FUNCTION public.get_pipeline_run_stages(p_run_id UUID)
RETURNS TABLE (
  id UUID,
  stage_name public.stage_name,
  status public.stage_status,
  attempt_number INTEGER,
  max_attempts INTEGER,
  idempotency_key TEXT,
  lease_owner TEXT,
  leased_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  retry_after TIMESTAMPTZ,
  input_ref JSONB,
  output_ref JSONB,
  model_run_id UUID,
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  latency_ms BIGINT,
  items_processed BIGINT,
  items_succeeded BIGINT,
  items_failed BIGINT,
  cost_usd NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT sa.id, sa.stage_name, sa.status, sa.attempt_number, sa.max_attempts,
         sa.idempotency_key, sa.lease_owner, sa.leased_at, sa.lease_expires_at,
         sa.retry_after, sa.input_ref, sa.output_ref, sa.model_run_id,
         sa.error_code, sa.error_message, sa.started_at, sa.completed_at,
         sa.latency_ms, sa.items_processed, sa.items_succeeded, sa.items_failed,
         sa.cost_usd
  FROM public.stage_attempts sa
  WHERE sa.pipeline_run_id = p_run_id
  ORDER BY
    CASE sa.stage_name
      WHEN 'discover' THEN 1
      WHEN 'fetch' THEN 2
      WHEN 'archive' THEN 3
      WHEN 'normalize' THEN 4
      WHEN 'extract' THEN 5
      WHEN 'resolve' THEN 6
      WHEN 'verify' THEN 7
      WHEN 'publish' THEN 8
      ELSE 99
    END,
    sa.attempt_number;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pipeline_run_stages(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pipeline_run_stages(UUID) TO service_role;

-- Get pending/retry/dead-letter counts by pipeline type
CREATE OR REPLACE FUNCTION public.get_pipeline_queue_counts()
RETURNS TABLE (
  pipeline_type public.pipeline_type,
  pending_count BIGINT,
  running_count BIGINT,
  retry_wait_count BIGINT,
  dead_letter_count BIGINT,
  expired_lease_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT pr.pipeline_type,
         COUNT(*) FILTER (WHERE sa.status = 'pending') AS pending_count,
         COUNT(*) FILTER (WHERE sa.status = 'running' OR (sa.status = 'leased' AND sa.lease_expires_at > NOW())) AS running_count,
         COUNT(*) FILTER (WHERE sa.status = 'retry_wait') AS retry_wait_count,
         COUNT(*) FILTER (WHERE sa.status = 'dead_letter') AS dead_letter_count,
         COUNT(*) FILTER (WHERE sa.status = 'leased' AND sa.lease_expires_at <= NOW()) AS expired_lease_count
  FROM public.pipeline_runs pr
  JOIN public.stage_attempts sa ON sa.pipeline_run_id = pr.id
  WHERE pr.status IN ('pending', 'running')
  GROUP BY pr.pipeline_type;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pipeline_queue_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pipeline_queue_counts() TO service_role;

-- Get stale leases (for monitoring/alerting)
CREATE OR REPLACE FUNCTION public.get_stale_leases(p_threshold_minutes INTEGER DEFAULT 10)
RETURNS TABLE (
  attempt_id UUID,
  pipeline_run_id UUID,
  stage_name public.stage_name,
  lease_owner TEXT,
  leased_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  minutes_stale INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT sa.id, sa.pipeline_run_id, sa.stage_name, sa.lease_owner,
         sa.leased_at, sa.lease_expires_at,
         FLOOR(EXTRACT(EPOCH FROM (NOW() - sa.lease_expires_at)) / 60)::INTEGER AS minutes_stale
  FROM public.stage_attempts sa
  WHERE sa.status = 'leased'
    AND sa.lease_expires_at <= NOW()
    AND sa.lease_expires_at <= NOW() - (p_threshold_minutes || ' minutes')::INTERVAL
  ORDER BY sa.lease_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_stale_leases(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stale_leases(INTEGER) TO service_role;

-- Get source health: aggregates 24h logs independently from latest log row
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
          SELECT COALESCE(MAX(fetched_at), '1970-01-01'::TIMESTAMPTZ)
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
    SELECT * FROM public.source_fetch_logs
    WHERE source_id = sc.source_id
    ORDER BY fetched_at DESC
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

-- Get model run metrics
CREATE OR REPLACE FUNCTION public.get_model_run_metrics(
  p_since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
  p_run_kind public.model_run_kind DEFAULT NULL
)
RETURNS TABLE (
  run_kind public.model_run_kind,
  provider TEXT,
  model TEXT,
  runs_count BIGINT,
  total_tokens_input BIGINT,
  total_tokens_output BIGINT,
  total_latency_ms BIGINT,
  total_cost_usd NUMERIC,
  avg_latency_ms NUMERIC,
  success_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT mr.run_kind, mr.provider, mr.model,
         COUNT(*) AS runs_count,
         SUM(mr.tokens_input) AS total_tokens_input,
         SUM(mr.tokens_output) AS total_tokens_output,
         SUM(mr.latency_ms) AS total_latency_ms,
         SUM(mr.cost_usd) AS total_cost_usd,
         AVG(mr.latency_ms)::NUMERIC AS avg_latency_ms,
         COUNT(*) FILTER (WHERE mr.status = 'success')::NUMERIC / COUNT(*) AS success_rate
  FROM public.model_runs mr
  WHERE mr.started_at >= p_since
    AND (p_run_kind IS NULL OR mr.run_kind = p_run_kind)
  GROUP BY mr.run_kind, mr.provider, mr.model
  ORDER BY total_cost_usd DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_model_run_metrics(TIMESTAMPTZ, public.model_run_kind) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_model_run_metrics(TIMESTAMPTZ, public.model_run_kind) TO service_role;

-- Get publication stats
CREATE OR REPLACE FUNCTION public.get_publication_stats(
  p_since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS TABLE (
  publication_status public.publication_status,
  claim_type public.claim_type,
  count BIGINT,
  avg_extraction_confidence NUMERIC,
  avg_resolution_confidence NUMERIC,
  top_rejection_reasons JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT c.publication_status, c.claim_type,
         COUNT(*) AS count,
         AVG(c.extraction_confidence) AS avg_extraction_confidence,
         AVG(c.resolution_confidence) AS avg_resolution_confidence,
         jsonb_agg(DISTINCT c.publication_reason) FILTER (WHERE c.publication_reason IS NOT NULL) AS top_rejection_reasons
  FROM public.claims c
  WHERE c.created_at >= p_since
  GROUP BY c.publication_status, c.claim_type
  ORDER BY c.publication_status, c.claim_type;
END;
$$;

REVOKE ALL ON FUNCTION public.get_publication_stats(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_publication_stats(TIMESTAMPTZ) TO service_role;

-- ============================================
-- RLS POLICIES (service-role only; no authenticated grants)
-- ============================================

ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_attempts ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.pipeline_runs TO service_role;
GRANT ALL ON public.stage_attempts TO service_role;

-- No policies for authenticated/anon - orchestration is service-role only

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.pipeline_runs IS 'Durable pipeline execution records with idempotent scheduling';
COMMENT ON TABLE public.stage_attempts IS 'Individual stage attempts within a pipeline run with lease-based concurrency control';

COMMENT ON COLUMN public.pipeline_runs.idempotency_key IS 'Deterministic key for idempotent scheduling: pipeline_type:trigger:scope:content_hash:schema_version';
COMMENT ON COLUMN public.stage_attempts.idempotency_key IS 'Deterministic key for idempotent stage execution: pipeline_type:stage:source/input:content_hash:schema_version';
COMMENT ON COLUMN public.stage_attempts.lease_token IS 'Unguessable token proving lease ownership (not just worker name)';
COMMENT ON COLUMN public.stage_attempts.error_metadata IS 'Structured error metadata. NEVER store secrets, raw provider responses, or prohibited source text.';
COMMENT ON FUNCTION public.acquire_stage_lease IS 'Claims work using SELECT FOR UPDATE SKIP LOCKED with unguessable lease token. Default 5-min TTL. Scope to pipeline_run_id when processing a specific run.';
COMMENT ON FUNCTION public.fail_stage_attempt IS 'Handles retry with bounded exponential backoff (1, 5, 15 min). Increments attempt_number on failure scheduling. After max attempts -> dead_letter.';
COMMENT ON FUNCTION public.replay_dead_letter IS 'Creates auditable new attempt with attempt_number=1, preserving history. Does not delete original dead letter.';