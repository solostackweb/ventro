-- Migration: Evidence Foundation (Checkpoint 1)
-- Date: 2026-10-06
-- Description: Adds the canonical evidence spine — source documents, immutable versions,
-- model/extraction runs, claims, evidence spans, field bindings, entity aliases,
-- and resolution decisions. Also adds connector trust fields and compatibility links.
-- This is an incremental migration after the baseline 20261006010000.

-- ============================================
-- EXTENSIONS
-- ============================================
-- UUID generation uses built-in gen_random_uuid() (pgcrypto)

-- ============================================
-- CONNECTOR TRUST FIELDS
-- ============================================
ALTER TABLE public.source_connectors
ADD COLUMN IF NOT EXISTS trust_tier TEXT DEFAULT 'standard' CHECK (trust_tier IN ('official', 'approved', 'standard', 'unverified')),
ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS independence_group TEXT;

COMMENT ON COLUMN public.source_connectors.trust_tier IS 'Trust tier for publication policy: official, approved, standard, unverified';
COMMENT ON COLUMN public.source_connectors.is_official IS 'Whether this connector is an official primary source (company blog, SEC filing, investor site)';
COMMENT ON COLUMN public.source_connectors.independence_group IS 'Explicit independence group for source-independence calculation; multiple URLs from same group count once';

-- ============================================
-- SOURCE DOCUMENTS (Canonical identity per connector + URL)
-- ============================================
CREATE TABLE public.source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL REFERENCES public.source_connectors(source_id),
  canonical_url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  domain TEXT,
  title TEXT,
  publisher TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_fetched_at TIMESTAMPTZ DEFAULT NOW(),
  latest_version_id UUID, -- FK added after document_versions exists
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_id, url_hash)
);

COMMENT ON TABLE public.source_documents IS 'Canonical source document identity — one row per connector + canonical URL';
COMMENT ON COLUMN public.source_documents.url_hash IS 'Stable SHA-256 hash of canonical URL for fast lookup';
COMMENT ON COLUMN public.source_documents.latest_version_id IS 'Pointer to the latest document_versions row';

-- ============================================
-- DOCUMENT VERSIONS (Immutable content snapshots)
-- ============================================
CREATE TABLE public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id UUID NOT NULL REFERENCES public.source_documents(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  normalization_version INTEGER NOT NULL DEFAULT 1,
  normalized_text TEXT NOT NULL,
  normalized_text_checksum TEXT NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  r2_key TEXT,
  r2_url TEXT,
  rights_snapshot JSONB,
  metadata JSONB DEFAULT '{}',
  supersedes_version_id UUID REFERENCES public.document_versions(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_document_id, content_hash)
);

COMMENT ON TABLE public.document_versions IS 'Immutable document content snapshots — never overwritten, only appended';
COMMENT ON COLUMN public.document_versions.content_hash IS 'SHA-256 of raw content (before normalization)';
COMMENT ON COLUMN public.document_versions.normalized_text IS 'Versioned normalized text — offsets refer to this';
COMMENT ON COLUMN public.document_versions.normalized_text_checksum IS 'SHA-256 of normalized_text for integrity validation';
COMMENT ON COLUMN public.document_versions.supersedes_version_id IS 'Previous version this one replaces';
COMMENT ON COLUMN public.document_versions.rights_snapshot IS 'Rights snapshot at time of storage: {can_store_raw, can_store_full_text, max_retention_days, attribution_required}';

-- Add FK from source_documents to document_versions
ALTER TABLE public.source_documents
ADD CONSTRAINT source_documents_latest_version_fkey
FOREIGN KEY (latest_version_id) REFERENCES public.document_versions(id);

-- ============================================
-- MODEL/EXTRACTION RUNS
-- ============================================
CREATE TYPE public.model_run_kind AS ENUM (
  'deterministic_extraction',
  'model_extraction',
  'classification',
  'resolution',
  'narration'
);

CREATE TABLE public.model_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_kind public.model_run_kind NOT NULL,
  provider TEXT,
  model TEXT,
  prompt_version TEXT,
  schema_version TEXT,
  implementation_version TEXT,
  input_checksum TEXT,
  document_version_id UUID REFERENCES public.document_versions(id),
  tokens_input INTEGER,
  tokens_output INTEGER,
  latency_ms INTEGER,
  cost_usd NUMERIC(10, 6),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
  failure_reason TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.model_runs IS 'Records of every extraction, classification, resolution, and narration run';
COMMENT ON COLUMN public.model_runs.run_kind IS 'Type of run: deterministic_extraction for rule-based, model_extraction for LLM';
COMMENT ON COLUMN public.model_runs.implementation_version IS 'Version of deterministic code (e.g., funding-extractor v1.2.3)';
COMMENT ON COLUMN public.model_runs.input_checksum IS 'Checksum of inputs for reproducibility';

-- ============================================
-- CLAIMS
-- ============================================
CREATE TYPE public.claim_type AS ENUM (
  'funding_amount',
  'funding_stage',
  'announced_date',
  'investor_participation',
  'investor_role',
  'thesis_statement',
  'company_stage',
  'yc_batch',
  'other'
);

CREATE TYPE public.publication_status AS ENUM (
  'candidate',
  'published',
  'corrected',
  'retracted',
  'rejected'
);

CREATE TABLE public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('funding_round', 'round_participant', 'company', 'fund', 'thesis', 'pattern')),
  subject_id UUID NOT NULL,
  claim_type public.claim_type NOT NULL,
  predicate TEXT NOT NULL,
  value_json JSONB NOT NULL,
  effective_at TIMESTAMPTZ,
  extraction_confidence NUMERIC(3,2) NOT NULL CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
  resolution_confidence NUMERIC(3,2) NOT NULL CHECK (resolution_confidence >= 0 AND resolution_confidence <= 1),
  publication_status public.publication_status NOT NULL DEFAULT 'candidate',
  model_run_id UUID NOT NULL REFERENCES public.model_runs(id),
  superseded_by_claim_id UUID REFERENCES public.claims(id),
  publication_reason TEXT,
  published_at TIMESTAMPTZ,
  corrected_at TIMESTAMPTZ,
  retracted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.claims IS 'Extracted claims with confidence, publication state, and traceability to model runs';
COMMENT ON COLUMN public.claims.value_json IS 'Typed JSON value: amount_usd, stage, date, role, etc. Never represents undisclosed as 0';
COMMENT ON COLUMN public.claims.superseded_by_claim_id IS 'Links to correction/retraction — never silently mutate published claims';

-- ============================================
-- CLAIM EVIDENCE (Exact spans against normalized text)
-- ============================================
CREATE TYPE public.evidence_stance AS ENUM ('supports', 'contradicts', 'context');

CREATE TABLE public.claim_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  document_version_id UUID NOT NULL REFERENCES public.document_versions(id),
  stance public.evidence_stance NOT NULL DEFAULT 'supports',
  span_start INTEGER NOT NULL CHECK (span_start >= 0),
  span_end INTEGER NOT NULL CHECK (span_end > span_start),
  excerpt TEXT NOT NULL,
  excerpt_checksum TEXT NOT NULL,
  extractor_confidence NUMERIC(3,2) NOT NULL CHECK (extractor_confidence >= 0 AND extractor_confidence <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (claim_id, document_version_id, span_start, span_end)
);

COMMENT ON TABLE public.claim_evidence IS 'Exact evidence spans linking claims to immutable document versions';
COMMENT ON COLUMN public.claim_evidence.span_start IS 'Zero-based start-inclusive character offset in document_versions.normalized_text';
COMMENT ON COLUMN public.claim_evidence.span_end IS 'Zero-based end-exclusive character offset in document_versions.normalized_text';
COMMENT ON COLUMN public.claim_evidence.excerpt_checksum IS 'SHA-256 of excerpt for integrity validation against normalized_text';

-- ============================================
-- CLAIM BINDINGS (Which claim supports which field)
-- ============================================
CREATE TABLE public.claim_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN ('funding_round', 'round_participant')),
  record_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (record_type, record_id, field_name, claim_id)
);

COMMENT ON TABLE public.claim_bindings IS 'Proves which claim supports a specific field (amount_usd, round_stage, announced_date, role)';
COMMENT ON COLUMN public.claim_bindings.record_type IS 'Target table: funding_round or round_participant';
COMMENT ON COLUMN public.claim_bindings.field_name IS 'Field being supported: amount_usd, round_stage, announced_date, role';

-- ============================================
-- ENTITY ALIASES (Deterministic name resolution)
-- ============================================
CREATE TABLE public.entity_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company', 'fund')),
  entity_id UUID NOT NULL,
  original_alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  provenance_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, normalized_alias)
);

COMMENT ON TABLE public.entity_aliases IS 'Known aliases for companies and funds with provenance — supports deterministic resolution';
COMMENT ON COLUMN public.entity_aliases.provenance_source IS 'Where this alias was observed (source_id, URL, or manual)';

-- ============================================
-- RESOLUTION DECISIONS (Auditable entity matching)
-- ============================================
CREATE TYPE public.resolution_method AS ENUM ('deterministic', 'model', 'manual');
CREATE TYPE public.resolution_status AS ENUM ('accepted', 'rejected', 'overridden');

CREATE TABLE public.resolution_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_text TEXT NOT NULL,
  normalized_input TEXT NOT NULL,
  target_entity_type TEXT NOT NULL CHECK (target_entity_type IN ('company', 'fund')),
  resolved_entity_id UUID,
  method public.resolution_method NOT NULL,
  confidence NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  model_run_id UUID REFERENCES public.model_runs(id),
  evidence_claim_id UUID REFERENCES public.claims(id),
  status public.resolution_status NOT NULL DEFAULT 'accepted',
  reason TEXT,
  decided_at TIMESTAMPTZ DEFAULT NOW(),
  overridden_at TIMESTAMPTZ,
  overridden_by UUID REFERENCES public.user_profiles(id)
);

COMMENT ON TABLE public.resolution_decisions IS 'Auditable entity resolution decisions with method, confidence, and override trail';

-- ============================================
-- COMPATIBILITY: document_version_id on source_archive
-- ============================================
ALTER TABLE public.source_archive
ADD COLUMN IF NOT EXISTS document_version_id UUID REFERENCES public.document_versions(id);

-- ============================================
-- INDEXES
-- ============================================

-- Source documents
CREATE INDEX idx_source_documents_source_id ON public.source_documents(source_id);
CREATE INDEX idx_source_documents_url_hash ON public.source_documents(url_hash);
CREATE INDEX idx_source_documents_canonical_url ON public.source_documents(canonical_url);
CREATE INDEX idx_source_documents_domain ON public.source_documents(domain);

-- Document versions
CREATE INDEX idx_document_versions_source_doc ON public.document_versions(source_document_id);
CREATE INDEX idx_document_versions_content_hash ON public.document_versions(content_hash);
CREATE INDEX idx_document_versions_fetched_at ON public.document_versions(fetched_at DESC);
CREATE INDEX idx_document_versions_normalized_checksum ON public.document_versions(normalized_text_checksum);

-- Model runs
CREATE INDEX idx_model_runs_document_version ON public.model_runs(document_version_id);
CREATE INDEX idx_model_runs_kind_status ON public.model_runs(run_kind, status);
CREATE INDEX idx_model_runs_started_at ON public.model_runs(started_at DESC);

-- Claims
CREATE INDEX idx_claims_subject ON public.claims(subject_type, subject_id);
CREATE INDEX idx_claims_type_status ON public.claims(claim_type, publication_status);
CREATE INDEX idx_claims_effective_at ON public.claims(effective_at DESC);
CREATE INDEX idx_claims_model_run ON public.claims(model_run_id);
CREATE INDEX idx_claims_superseded ON public.claims(superseded_by_claim_id);

-- Claim evidence
CREATE INDEX idx_claim_evidence_claim ON public.claim_evidence(claim_id);
CREATE INDEX idx_claim_evidence_version ON public.claim_evidence(document_version_id);
CREATE INDEX idx_claim_evidence_stance ON public.claim_evidence(stance);

-- Claim bindings
CREATE INDEX idx_claim_bindings_record ON public.claim_bindings(record_type, record_id);
CREATE INDEX idx_claim_bindings_field ON public.claim_bindings(record_type, record_id, field_name);

-- Entity aliases
CREATE INDEX idx_entity_aliases_lookup ON public.entity_aliases(entity_type, normalized_alias);
CREATE INDEX idx_entity_aliases_entity ON public.entity_aliases(entity_type, entity_id);

-- Resolution decisions
CREATE INDEX idx_resolution_decisions_lookup ON public.resolution_decisions(target_entity_type, normalized_input);
CREATE INDEX idx_resolution_decisions_status ON public.resolution_decisions(status);
CREATE INDEX idx_resolution_decisions_entity ON public.resolution_decisions(target_entity_type, resolved_entity_id);

-- Source archive compatibility
CREATE INDEX idx_source_archive_document_version ON public.source_archive(document_version_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resolution_decisions ENABLE ROW LEVEL SECURITY;

-- Revoke direct writes from anon and authenticated
REVOKE ALL ON public.source_documents FROM anon, authenticated;
REVOKE ALL ON public.document_versions FROM anon, authenticated;
REVOKE ALL ON public.model_runs FROM anon, authenticated;
REVOKE ALL ON public.claims FROM anon, authenticated;
REVOKE ALL ON public.claim_evidence FROM anon, authenticated;
REVOKE ALL ON public.claim_bindings FROM anon, authenticated;
REVOKE ALL ON public.entity_aliases FROM anon, authenticated;
REVOKE ALL ON public.resolution_decisions FROM anon, authenticated;

-- Public read access for published evidence (via evidence read contract only)
-- Direct table access is restricted; use RPC functions

-- ============================================
-- SECURITY DEFINER FUNCTIONS (Service-role only)
-- ============================================

-- Atomic persistence: upsert source_document, document_version, source_archive link, latest pointer
-- All parameters required (no defaults after required params) for explicit RPC signature
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

-- Centralized claim/evidence creation with publication evaluation
-- Derives source authority from database, not caller
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
  p_evidence_items JSONB, -- array of {document_version_id, stance, span_start, span_end, excerpt, excerpt_checksum, extractor_confidence}
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

-- Evidence read contract: bounded lookup for published field evidence
-- Rights stored in document_versions.rights_snapshot, not metadata.permissions
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
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_source_documents_updated_at
  BEFORE UPDATE ON public.source_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION public.persist_document_version IS 'Atomic upsert of source_document, document_version, source_archive link, and latest_version pointer. Service-role only. Retries with same connector/URL/hash return same version.';
COMMENT ON FUNCTION public.create_claim_with_evidence IS 'Centralized claim + evidence creation with automatic publication evaluation per D5 conservative policy. Source authority derived from database, not caller. Service-role only.';
COMMENT ON FUNCTION public.get_field_evidence IS 'Bounded evidence lookup for a record field. Returns only published claims with rights-aware excerpts. Authenticated access.';