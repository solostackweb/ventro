-- ============================================
-- EVIDENCE FOUNDATION (Checkpoint 1)
-- ============================================

-- Model run kind enum
CREATE TYPE public.model_run_kind AS ENUM (
  'embedding',
  'extraction',
  'resolution',
  'verification',
  'clustering',
  'other'
);

-- Model runs table
CREATE TABLE public.model_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_kind public.model_run_kind NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'timeout')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_model_runs_kind ON public.model_runs(run_kind);
CREATE INDEX idx_model_runs_provider_model ON public.model_runs(provider, model);
CREATE INDEX idx_model_runs_created_at ON public.model_runs(created_at DESC);
CREATE INDEX idx_model_runs_cost ON public.model_runs(cost_usd);

-- Source documents table
CREATE TABLE public.source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL REFERENCES public.source_connectors(source_id),
  url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  r2_key TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, url)
);

CREATE INDEX idx_source_documents_source ON public.source_documents(source_id);
CREATE INDEX idx_source_documents_hash ON public.source_documents(content_hash);
CREATE INDEX idx_source_documents_fetched ON public.source_documents(fetched_at DESC);

-- Document versions table
CREATE TABLE public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id UUID NOT NULL REFERENCES public.source_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  content_hash TEXT NOT NULL,
  content_text TEXT,
  r2_key TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_document_id, version_number)
);

CREATE INDEX idx_document_versions_source_doc ON public.document_versions(source_document_id);
CREATE INDEX idx_document_versions_hash ON public.document_versions(content_hash);

-- Source archive table (raw content storage)
CREATE TABLE public.source_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL REFERENCES public.source_connectors(source_id),
  source_document_id UUID REFERENCES public.source_documents(id) ON DELETE SET NULL,
  document_version_id UUID REFERENCES public.document_versions(id) ON DELETE SET NULL,
  content_hash TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_source_archive_source ON public.source_archive(source_id);
CREATE INDEX idx_source_archive_doc ON public.source_archive(source_document_id);
CREATE INDEX idx_source_archive_version ON public.source_archive(document_version_id);

-- Claims table
CREATE TABLE public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('funding_round', 'round_participant', 'company', 'fund', 'thesis', 'pattern')),
  subject_id UUID NOT NULL,
  claim_type TEXT NOT NULL,
  predicate TEXT NOT NULL,
  value_json JSONB NOT NULL,
  extraction_confidence NUMERIC,
  resolution_confidence NUMERIC,
  publication_status TEXT NOT NULL DEFAULT 'candidate' CHECK (publication_status IN ('candidate', 'published', 'rejected', 'superseded')),
  publication_reason TEXT,
  superseded_by_claim_id UUID REFERENCES public.claims(id),
  evidence_spans JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claims_subject ON public.claims(subject_type, subject_id);
CREATE INDEX idx_claims_type ON public.claims(claim_type);
CREATE INDEX idx_claims_publication ON public.claims(publication_status);
CREATE INDEX idx_claims_extraction_conf ON public.claims(extraction_confidence);
CREATE INDEX idx_claims_resolution_conf ON public.claims(resolution_confidence);
CREATE INDEX idx_claims_superseded ON public.claims(superseded_by_claim_id);

-- Resolution decisions table
CREATE TABLE public.resolution_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_text TEXT NOT NULL,
  normalized_input TEXT NOT NULL,
  target_entity_type TEXT NOT NULL CHECK (target_entity_type IN ('company', 'fund', 'person')),
  resolved_entity_id UUID,
  method TEXT NOT NULL CHECK (method IN ('deterministic', 'llm', 'human', 'hybrid')),
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  evidence_claim_id UUID REFERENCES public.claims(id),
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'rejected', 'pending')),
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (input_text, target_entity_type, resolved_entity_id)
);

CREATE INDEX idx_resolution_decisions_input ON public.resolution_decisions(normalized_input);
CREATE INDEX idx_resolution_decisions_entity ON public.resolution_decisions(target_entity_type, resolved_entity_id);
CREATE INDEX idx_resolution_decisions_claim ON public.resolution_decisions(evidence_claim_id);

-- Claim bindings table
CREATE TABLE public.claim_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN ('funding_round', 'round_participant', 'company', 'fund', 'thesis', 'pattern')),
  record_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE (claim_id, record_type, record_id, field_name)
);

CREATE INDEX idx_claim_bindings_claim ON public.claim_bindings(claim_id);
CREATE INDEX idx_claim_bindings_record ON public.claim_bindings(record_type, record_id);

-- Publication status enum (if not exists)
DO $$ BEGIN
  CREATE TYPE public.publication_status AS ENUM (
    'candidate',
    'published',
    'rejected',
    'superseded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Claim type enum (if not exists)
DO $$ BEGIN
  CREATE TYPE public.claim_type AS ENUM (
    'investor_participation',
    'funding_amount',
    'valuation',
    'round_stage',
    'company_name',
    'fund_name',
    'thesis_theme',
    'pattern_theme',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Triggers for updated_at on evidence tables
CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grants for evidence tables
GRANT ALL ON public.model_runs TO service_role;
GRANT ALL ON public.source_documents TO service_role;
GRANT ALL ON public.document_versions TO service_role;
GRANT ALL ON public.source_archive TO service_role;
GRANT ALL ON public.claims TO service_role;
GRANT ALL ON public.resolution_decisions TO service_role;
GRANT ALL ON public.claim_bindings TO service_role;

-- RLS for evidence tables (service-role only)
ALTER TABLE public.model_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resolution_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_bindings ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated/anon - evidence is service-role only