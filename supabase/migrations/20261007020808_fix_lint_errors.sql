-- Migration: Fix lint errors in Checkpoint 1 functions
-- Date: 2026-10-07
-- Description: Fixes for supabase db lint errors:
-- 1. persist_document_version: ambiguous column reference (source_document_id)
-- 2. get_field_evidence: bigint vs integer mismatch in source_count
-- 3. create_claim_with_evidence: enum/text[] cast warnings, unused variable
-- 4. activate_student_trial: unused variable v_result (in base migration)
-- 5. admin_review_candidate: type cast warnings, unused variable (in base migration)

-- ============================================
-- FIX: persist_document_version
-- ============================================
CREATE OR REPLACE FUNCTION public.persist_document_version(
  p_source_id TEXT,
  p_canonical_url TEXT,
  p_domain TEXT,
  p_title TEXT,
  p_publisher TEXT,
  p_raw_content TEXT,
  p_normalized_text TEXT,
  p_normalization_version INTEGER,
  p_fetched_at TIMESTAMPTZ,
  p_published_at TIMESTAMPTZ,
  p_r2_key TEXT,
  p_r2_url TEXT,
  p_rights_snapshot JSONB,
  p_metadata JSONB,
  p_archive_id UUID
)
RETURNS TABLE (
  source_document_id UUID,
  document_version_id UUID,
  archive_id UUID,
  is_new_version BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url_hash TEXT := encode(sha256(p_canonical_url::bytea), 'hex');
  -- Stable identity rule: for empty/whitespace-only content, use canonical URL hash
  -- This matches TypeScript computeStableContentHash()
  v_content_hash TEXT := CASE 
    WHEN trim(p_raw_content) = '' THEN encode(sha256(p_canonical_url::bytea), 'hex')
    ELSE encode(sha256(p_raw_content::bytea), 'hex')
  END;
  v_normalized_checksum TEXT := encode(sha256(p_normalized_text::bytea), 'hex');
  v_source_doc_id UUID;
  v_doc_version_id UUID;
  v_existing_version_id UUID;
  v_is_new_version BOOLEAN := FALSE;
  v_supersedes_id UUID;
  v_archive_id UUID;
BEGIN
  -- Upsert source_document
  INSERT INTO public.source_documents (source_id, canonical_url, url_hash, domain, title, publisher, first_seen_at, last_fetched_at, latest_version_id)
  VALUES (p_source_id, p_canonical_url, v_url_hash, p_domain, p_title, p_publisher, p_fetched_at, p_fetched_at, NULL)
  ON CONFLICT (source_id, url_hash) DO UPDATE SET
    last_fetched_at = GREATEST(public.source_documents.last_fetched_at, p_fetched_at),
    title = COALESCE(p_title, public.source_documents.title),
    publisher = COALESCE(p_publisher, public.source_documents.publisher),
    domain = COALESCE(p_domain, public.source_documents.domain)
  RETURNING id INTO v_source_doc_id;

  -- Check if this content hash already exists for this source document
  SELECT id INTO v_existing_version_id
  FROM public.document_versions dv
  WHERE dv.source_document_id = v_source_doc_id
    AND dv.content_hash = v_content_hash;

  IF v_existing_version_id IS NOT NULL THEN
    -- Unchanged content: reuse existing version
    v_doc_version_id := v_existing_version_id;
    v_is_new_version := FALSE;
  ELSE
    -- New content: insert new immutable version
    v_is_new_version := TRUE;
    
    -- Get current latest version to supersede
    SELECT latest_version_id INTO v_supersedes_id
    FROM public.source_documents
    WHERE id = v_source_doc_id;

    INSERT INTO public.document_versions (
      source_document_id,
      content_hash,
      normalization_version,
      normalized_text,
      normalized_text_checksum,
      fetched_at,
      published_at,
      r2_key,
      r2_url,
      rights_snapshot,
      metadata,
      supersedes_version_id
    ) VALUES (
      v_source_doc_id,
      v_content_hash,
      p_normalization_version,
      p_normalized_text,
      v_normalized_checksum,
      p_fetched_at,
      p_published_at,
      p_r2_key,
      p_r2_url,
      p_rights_snapshot,
      p_metadata,
      v_supersedes_id
    ) RETURNING id INTO v_doc_version_id;

    -- Update latest_version pointer
    UPDATE public.source_documents
    SET latest_version_id = v_doc_version_id,
        last_fetched_at = p_fetched_at,
        updated_at = NOW()
    WHERE id = v_source_doc_id;
  END IF;

  -- Link to source_archive (upsert to avoid duplicates on retry)
  INSERT INTO public.source_archive (
    id,
    source_id,
    url,
    content_hash,
    fetched_at,
    r2_key,
    r2_url,
    raw_content,
    metadata,
    permissions,
    document_version_id
  ) VALUES (
    p_archive_id,
    p_source_id,
    p_canonical_url,
    v_content_hash,
    p_fetched_at,
    p_r2_key,
    p_r2_url,
    p_raw_content,
    p_metadata,
    p_rights_snapshot,
    v_doc_version_id
  ) ON CONFLICT (source_id, content_hash) DO UPDATE SET
    document_version_id = EXCLUDED.document_version_id,
    r2_key = EXCLUDED.r2_key,
    r2_url = EXCLUDED.r2_url,
    raw_content = EXCLUDED.raw_content,
    metadata = EXCLUDED.metadata,
    permissions = EXCLUDED.permissions
  RETURNING id INTO v_archive_id;

  RETURN QUERY SELECT v_source_doc_id, v_doc_version_id, v_archive_id, v_is_new_version;
END;
$$;

REVOKE ALL ON FUNCTION public.persist_document_version(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, JSONB, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.persist_document_version(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, JSONB, JSONB, UUID) TO service_role;

-- ============================================
-- FIX: get_field_evidence
-- ============================================
CREATE OR REPLACE FUNCTION public.get_field_evidence(
  p_record_type TEXT,
  p_record_id UUID,
  p_field_name TEXT
)
RETURNS TABLE (
  claim_id UUID,
  claim_type public.claim_type,
  value_json JSONB,
  publication_status public.publication_status,
  extraction_confidence NUMERIC,
  resolution_confidence NUMERIC,
  source_title TEXT,
  source_publisher TEXT,
  source_canonical_url TEXT,
  source_fetched_at TIMESTAMPTZ,
  source_published_at TIMESTAMPTZ,
  evidence_excerpt TEXT,
  evidence_span_start INTEGER,
  evidence_span_end INTEGER,
  evidence_checksum TEXT,
  extractor_confidence NUMERIC,
  source_count INTEGER,
  has_contradiction BOOLEAN,
  model_run_id UUID,
  model_run_kind public.model_run_kind,
  model_provider TEXT,
  model_name TEXT,
  implementation_version TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Validate record type
  IF p_record_type NOT IN ('funding_round', 'round_participant') THEN
    RAISE EXCEPTION 'Invalid record type' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    c.id AS claim_id,
    c.claim_type,
    c.value_json,
    c.publication_status,
    c.extraction_confidence,
    c.resolution_confidence,
    dv.metadata->>'title' AS source_title,
    sd.publisher AS source_publisher,
    sd.canonical_url AS source_canonical_url,
    dv.fetched_at AS source_fetched_at,
    dv.published_at AS source_published_at,
    CASE 
      WHEN ce.stance = 'supports' 
           AND (dv.rights_snapshot->>'can_store_full_text')::BOOLEAN
      THEN ce.excerpt
      ELSE NULL
    END AS evidence_excerpt,
    ce.span_start,
    ce.span_end,
    ce.excerpt_checksum,
    ce.extractor_confidence,
    (
      SELECT COUNT(DISTINCT COALESCE(sc.independence_group, sd2.domain))::INTEGER
      FROM public.claim_evidence ce2
      JOIN public.document_versions dv2 ON ce2.document_version_id = dv2.id
      JOIN public.source_documents sd2 ON dv2.source_document_id = sd2.id
      JOIN public.source_connectors sc ON sd2.source_id = sc.source_id
      WHERE ce2.claim_id = c.id AND ce2.stance = 'supports'
    ) AS source_count,
    EXISTS (
      SELECT 1 FROM public.claim_evidence ce3
      WHERE ce3.claim_id = c.id AND ce3.stance = 'contradicts'
    ) AS has_contradiction,
    mr.id AS model_run_id,
    mr.run_kind,
    mr.provider,
    mr.model,
    mr.implementation_version
  FROM public.claim_bindings cb
  JOIN public.claims c ON cb.claim_id = c.id
  JOIN public.claim_evidence ce ON c.id = ce.claim_id
  JOIN public.document_versions dv ON ce.document_version_id = dv.id
  JOIN public.source_documents sd ON dv.source_document_id = sd.id
  JOIN public.model_runs mr ON c.model_run_id = mr.id
  WHERE cb.record_type = p_record_type
    AND cb.record_id = p_record_id
    AND cb.field_name = p_field_name
    AND c.publication_status = 'published'
    AND ce.stance = 'supports'
  ORDER BY c.extraction_confidence DESC, c.resolution_confidence DESC
  LIMIT 10;
END;
$$;

REVOKE ALL ON FUNCTION public.get_field_evidence(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_field_evidence(TEXT, UUID, TEXT) TO authenticated, service_role;

-- ============================================
-- FIX: create_claim_with_evidence
-- ============================================
CREATE OR REPLACE FUNCTION public.create_claim_with_evidence(
  p_subject_type TEXT,
  p_subject_id UUID,
  p_claim_type public.claim_type,
  p_predicate TEXT,
  p_value_json JSONB,
  p_effective_at TIMESTAMPTZ,
  p_extraction_confidence NUMERIC,
  p_resolution_confidence NUMERIC,
  p_model_run_id UUID,
  p_evidence_items JSONB,
  p_binding_record_type TEXT DEFAULT NULL,
  p_binding_record_id UUID DEFAULT NULL,
  p_binding_field_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  claim_id UUID,
  publication_status public.publication_status,
  publication_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claim_id UUID;
  v_publication_status public.publication_status := 'candidate'::public.publication_status;
  v_publication_reason TEXT := '';
  v_official_count INTEGER := 0;
  v_independent_count INTEGER := 0;
  v_has_contradiction BOOLEAN := FALSE;
  v_evidence_item JSONB;
  v_item_index INTEGER := 0;
  v_supporting_evidence_count INTEGER := 0;
BEGIN
  -- Validate confidence ranges
  IF p_extraction_confidence < 0 OR p_extraction_confidence > 1
     OR p_resolution_confidence < 0 OR p_resolution_confidence > 1 THEN
    RAISE EXCEPTION 'Confidence values must be in range [0, 1]' USING ERRCODE = '22023';
  END IF;

  -- Validate at least one supporting evidence item
  IF jsonb_array_length(p_evidence_items) = 0 THEN
    RAISE EXCEPTION 'At least one evidence item required' USING ERRCODE = '22023';
  END IF;

  -- Create claim
  INSERT INTO public.claims (
    subject_type, subject_id, claim_type, predicate, value_json,
    effective_at, extraction_confidence, resolution_confidence,
    publication_status, model_run_id
  ) VALUES (
    p_subject_type, p_subject_id, p_claim_type, p_predicate, p_value_json,
    p_effective_at, p_extraction_confidence, p_resolution_confidence,
    'candidate', p_model_run_id
  ) RETURNING id INTO v_claim_id;

  -- Insert evidence spans with validation
  FOR v_evidence_item IN SELECT * FROM jsonb_array_elements(p_evidence_items)
  LOOP
    v_item_index := v_item_index + 1;
    
    -- Validate span bounds against document version
    DECLARE
      v_doc_text TEXT;
      v_doc_length INTEGER;
      v_excerpt TEXT := v_evidence_item->>'excerpt';
      v_span_start INTEGER := (v_evidence_item->>'span_start')::INTEGER;
      v_span_end INTEGER := (v_evidence_item->>'span_end')::INTEGER;
      v_doc_version_id UUID := (v_evidence_item->>'document_version_id')::UUID;
    BEGIN
      SELECT normalized_text, length(normalized_text) INTO v_doc_text, v_doc_length
      FROM public.document_versions WHERE id = v_doc_version_id;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Document version % not found', v_doc_version_id USING ERRCODE = 'P0002';
      END IF;
      
      IF v_span_start < 0 OR v_span_end > v_doc_length OR v_span_start >= v_span_end THEN
        RAISE EXCEPTION 'Invalid span [% , % ) for document version % (length %)',
          v_span_start, v_span_end, v_doc_version_id, v_doc_length USING ERRCODE = '22023';
      END IF;
      
      -- Validate excerpt matches normalized text at span
      IF substring(v_doc_text FROM v_span_start + 1 FOR v_span_end - v_span_start) <> v_excerpt THEN
        RAISE EXCEPTION 'Excerpt does not match normalized text at span [% , % )', v_span_start, v_span_end USING ERRCODE = '22023';
      END IF;
      
      -- Validate checksum
      IF encode(sha256(v_excerpt::bytea), 'hex') <> (v_evidence_item->>'excerpt_checksum') THEN
        RAISE EXCEPTION 'Excerpt checksum mismatch' USING ERRCODE = '22023';
      END IF;
      
      -- Check for contradiction
      IF (v_evidence_item->>'stance') = 'contradicts' THEN
        v_has_contradiction := TRUE;
      END IF;
    END;

    INSERT INTO public.claim_evidence (
      claim_id, document_version_id, stance, span_start, span_end,
      excerpt, excerpt_checksum, extractor_confidence
    ) VALUES (
      v_claim_id,
      (v_evidence_item->>'document_version_id')::UUID,
      (v_evidence_item->>'stance')::public.evidence_stance,
      (v_evidence_item->>'span_start')::INTEGER,
      (v_evidence_item->>'span_end')::INTEGER,
      v_evidence_item->>'excerpt',
      v_evidence_item->>'excerpt_checksum',
      (v_evidence_item->>'extractor_confidence')::NUMERIC
    );

    -- Count supporting evidence items
    IF (v_evidence_item->>'stance') = 'supports' THEN
      v_supporting_evidence_count := v_supporting_evidence_count + 1;
    END IF;
  END LOOP;

  -- Derive source authority from database for supporting evidence only
  -- Join through: claim_evidence -> document_versions -> source_documents -> source_connectors
  SELECT 
    COUNT(*) FILTER (WHERE sc.is_official) INTO v_official_count
  FROM public.claim_evidence ce
  JOIN public.document_versions dv ON ce.document_version_id = dv.id
  JOIN public.source_documents sd ON dv.source_document_id = sd.id
  JOIN public.source_connectors sc ON sd.source_id = sc.source_id
  WHERE ce.claim_id = v_claim_id AND ce.stance = 'supports';

  SELECT 
    COUNT(DISTINCT COALESCE(sc.independence_group, sd.domain)) INTO v_independent_count
  FROM public.claim_evidence ce
  JOIN public.document_versions dv ON ce.document_version_id = dv.id
  JOIN public.source_documents sd ON dv.source_document_id = sd.id
  JOIN public.source_connectors sc ON sd.source_id = sc.source_id
  WHERE ce.claim_id = v_claim_id AND ce.stance = 'supports';

  -- Check for contradiction from evidence
  v_has_contradiction := EXISTS (
    SELECT 1 FROM public.claim_evidence ce
    WHERE ce.claim_id = v_claim_id AND ce.stance = 'contradicts'
  );

  -- Evaluate automatic publication policy (D5 Conservative)
  IF NOT v_has_contradiction
     AND p_extraction_confidence >= 0.85
     AND p_resolution_confidence >= 0.90
     AND (v_official_count >= 1 OR v_independent_count >= 2)
     AND v_supporting_evidence_count > 0 THEN
    v_publication_status := 'published';
    v_publication_reason := 'Automatic: meets conservative evidence threshold';
    
    UPDATE public.claims
    SET publication_status = 'published',
        publication_reason = v_publication_reason,
        published_at = NOW()
    WHERE id = v_claim_id;
  ELSE
    v_publication_status := 'candidate';
    IF v_has_contradiction THEN
      v_publication_reason := 'Blocked: active contradictory evidence exists';
    ELSIF p_extraction_confidence < 0.85 THEN
      v_publication_reason := 'Blocked: extraction confidence ' || p_extraction_confidence || ' < 0.85';
    ELSIF p_resolution_confidence < 0.90 THEN
      v_publication_reason := 'Blocked: resolution confidence ' || p_resolution_confidence || ' < 0.90';
    ELSIF v_official_count = 0 AND v_independent_count < 2 THEN
      v_publication_reason := 'Blocked: insufficient source support (official=' || v_official_count || ', independent=' || v_independent_count || ')';
    ELSIF v_supporting_evidence_count = 0 THEN
      v_publication_reason := 'Blocked: no supporting evidence items';
    END IF;
  END IF;

  -- Create binding if provided and claim is published
  IF p_binding_record_type IS NOT NULL 
     AND p_binding_record_id IS NOT NULL 
     AND p_binding_field_name IS NOT NULL
     AND v_publication_status = 'published' THEN
    INSERT INTO public.claim_bindings (claim_id, record_type, record_id, field_name)
    VALUES (v_claim_id, p_binding_record_type, p_binding_record_id, p_binding_field_name)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_claim_id, v_publication_status, v_publication_reason;
END;
$$;

REVOKE ALL ON FUNCTION public.create_claim_with_evidence(TEXT, UUID, public.claim_type, TEXT, JSONB, TIMESTAMPTZ, NUMERIC, NUMERIC, UUID, JSONB, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_claim_with_evidence(TEXT, UUID, public.claim_type, TEXT, JSONB, TIMESTAMPTZ, NUMERIC, NUMERIC, UUID, JSONB, TEXT, UUID, TEXT) TO service_role;