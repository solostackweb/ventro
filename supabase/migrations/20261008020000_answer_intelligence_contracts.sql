-- Checkpoint 3: versioned, evidence-backed answer intelligence contracts.
-- This migration is additive and must be pushed only after 20261008010000.

CREATE TYPE public.answer_kind AS ENUM ('investing_now', 'market_demand');
CREATE TYPE public.answer_snapshot_status AS ENUM ('computing', 'published', 'stale', 'failed', 'superseded');
CREATE TYPE public.intelligence_confidence_label AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.thesis_record_kind AS ENUM ('stated', 'observed');
CREATE TYPE public.thesis_record_status AS ENUM ('candidate', 'published', 'corrected', 'retired', 'rejected');
CREATE TYPE public.answer_citation_stance AS ENUM ('supports', 'contradicts', 'context');

CREATE TABLE public.thesis_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  thesis_kind public.thesis_record_kind NOT NULL,
  status public.thesis_record_status NOT NULL DEFAULT 'candidate',
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  methodology_version TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0 CHECK (sample_size >= 0),
  covered_investment_count INTEGER NOT NULL DEFAULT 0 CHECK (covered_investment_count >= 0),
  coverage_ratio NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (coverage_ratio BETWEEN 0 AND 1),
  confidence_score NUMERIC(5,4) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
  confidence_label public.intelligence_confidence_label NOT NULL,
  themes JSONB NOT NULL DEFAULT '[]'::JSONB,
  summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  caveats JSONB NOT NULL DEFAULT '[]'::JSONB,
  counter_evidence JSONB NOT NULL DEFAULT '[]'::JSONB,
  model_run_id UUID REFERENCES public.model_runs(id) ON DELETE SET NULL,
  supersedes_id UUID REFERENCES public.thesis_records(id) ON DELETE SET NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fund_id, thesis_kind, input_fingerprint),
  CHECK (
    (thesis_kind = 'stated' AND sample_size = 0)
    OR
    (thesis_kind = 'observed' AND period_start IS NOT NULL AND period_end IS NOT NULL AND period_end > period_start)
  )
);

CREATE TABLE public.thesis_record_claims (
  thesis_record_id UUID NOT NULL REFERENCES public.thesis_records(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE RESTRICT,
  claim_evidence_id UUID NOT NULL REFERENCES public.claim_evidence(id) ON DELETE RESTRICT,
  stance public.answer_citation_stance NOT NULL DEFAULT 'supports',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thesis_record_id, claim_id, claim_evidence_id, stance)
);

ALTER TABLE public.patterns
  ADD COLUMN IF NOT EXISTS pattern_type TEXT,
  ADD COLUMN IF NOT EXISTS filter_dimensions JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS baseline_window_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS baseline_window_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sample_size INTEGER,
  ADD COLUMN IF NOT EXISTS qualifying_claim_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS independent_source_count INTEGER,
  ADD COLUMN IF NOT EXISTS coverage_metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS sensitivity JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS methodology_version TEXT,
  ADD COLUMN IF NOT EXISTS input_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS publication_reason TEXT;

CREATE TABLE public.pattern_citations (
  pattern_id UUID NOT NULL REFERENCES public.patterns(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE RESTRICT,
  claim_evidence_id UUID NOT NULL REFERENCES public.claim_evidence(id) ON DELETE RESTRICT,
  stance public.answer_citation_stance NOT NULL DEFAULT 'supports',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pattern_id, claim_id, claim_evidence_id, stance)
);

CREATE TABLE public.answer_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_kind public.answer_kind NOT NULL,
  status public.answer_snapshot_status NOT NULL DEFAULT 'computing',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  data_cutoff_at TIMESTAMPTZ NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stale_after TIMESTAMPTZ NOT NULL,
  domains TEXT[] NOT NULL DEFAULT '{}',
  geographies TEXT[] NOT NULL DEFAULT '{}',
  stages TEXT[] NOT NULL DEFAULT '{}',
  fund_id UUID REFERENCES public.funds(id) ON DELETE SET NULL,
  yc_batch_id TEXT REFERENCES public.yc_batches(id) ON DELETE SET NULL,
  normalized_filters JSONB NOT NULL,
  filter_fingerprint TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  methodology_version TEXT NOT NULL,
  narration_model_run_id UUID REFERENCES public.model_runs(id) ON DELETE SET NULL,
  summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  disclosed_amount_usd BIGINT NOT NULL DEFAULT 0 CHECK (disclosed_amount_usd >= 0),
  disclosed_round_count INTEGER NOT NULL DEFAULT 0 CHECK (disclosed_round_count >= 0),
  undisclosed_round_count INTEGER NOT NULL DEFAULT 0 CHECK (undisclosed_round_count >= 0),
  company_count INTEGER NOT NULL DEFAULT 0 CHECK (company_count >= 0),
  fund_count INTEGER NOT NULL DEFAULT 0 CHECK (fund_count >= 0),
  round_count INTEGER NOT NULL DEFAULT 0 CHECK (round_count >= 0),
  thesis_count INTEGER NOT NULL DEFAULT 0 CHECK (thesis_count >= 0),
  pattern_count INTEGER NOT NULL DEFAULT 0 CHECK (pattern_count >= 0),
  coverage_metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
  confidence_score NUMERIC(5,4) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
  confidence_label public.intelligence_confidence_label NOT NULL,
  caveats JSONB NOT NULL DEFAULT '[]'::JSONB,
  counter_evidence JSONB NOT NULL DEFAULT '[]'::JSONB,
  supersedes_id UUID REFERENCES public.answer_snapshots(id) ON DELETE SET NULL,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (answer_kind, input_fingerprint),
  CHECK (period_end > period_start),
  CHECK (stale_after > computed_at),
  CHECK (disclosed_round_count + undisclosed_round_count <= round_count)
);

CREATE TABLE public.answer_snapshot_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES public.answer_snapshots(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  material BOOLEAN NOT NULL DEFAULT TRUE,
  narrative TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
  why_this JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (snapshot_id, section_key),
  UNIQUE (snapshot_id, position)
);

CREATE TABLE public.answer_snapshot_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES public.answer_snapshots(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.answer_snapshot_sections(id) ON DELETE CASCADE,
  stance public.answer_citation_stance NOT NULL DEFAULT 'supports',
  label TEXT,
  claim_id UUID REFERENCES public.claims(id) ON DELETE RESTRICT,
  claim_binding_id UUID REFERENCES public.claim_bindings(id) ON DELETE RESTRICT,
  claim_evidence_id UUID REFERENCES public.claim_evidence(id) ON DELETE RESTRICT,
  funding_round_id UUID REFERENCES public.funding_rounds(id) ON DELETE RESTRICT,
  round_participant_id UUID REFERENCES public.round_participants(id) ON DELETE RESTRICT,
  thesis_record_id UUID REFERENCES public.thesis_records(id) ON DELETE RESTRICT,
  pattern_id UUID REFERENCES public.patterns(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(claim_id, claim_binding_id, claim_evidence_id, funding_round_id, round_participant_id, thesis_record_id, pattern_id) >= 1)
);

CREATE INDEX answer_snapshots_latest_idx ON public.answer_snapshots (answer_kind, filter_fingerprint, computed_at DESC) WHERE status = 'published';
CREATE INDEX answer_snapshots_freshness_idx ON public.answer_snapshots (stale_after) WHERE status = 'published';
CREATE INDEX answer_snapshot_sections_snapshot_idx ON public.answer_snapshot_sections (snapshot_id, position);
CREATE INDEX answer_snapshot_citations_snapshot_idx ON public.answer_snapshot_citations (snapshot_id, section_id);
CREATE INDEX answer_snapshot_citations_claim_idx ON public.answer_snapshot_citations (claim_id) WHERE claim_id IS NOT NULL;
CREATE INDEX thesis_records_latest_idx ON public.thesis_records (fund_id, thesis_kind, computed_at DESC) WHERE status = 'published';
ALTER TABLE public.patterns ADD CONSTRAINT patterns_input_fingerprint_key UNIQUE (input_fingerprint);

CREATE TRIGGER update_answer_snapshots_updated_at
  BEFORE UPDATE ON public.answer_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.thesis_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thesis_record_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pattern_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_snapshot_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_snapshot_citations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.persist_answer_snapshot(p_snapshot JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_snapshot_id UUID;
  v_previous_id UUID;
  v_section_id UUID;
  v_section JSONB;
  v_citation JSONB;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_snapshot->>'input_fingerprint', 0));
  SELECT s.id INTO v_snapshot_id
  FROM public.answer_snapshots s
  WHERE s.answer_kind = (p_snapshot->>'answer_kind')::public.answer_kind
    AND s.input_fingerprint = p_snapshot->>'input_fingerprint';

  IF v_snapshot_id IS NOT NULL THEN
    RETURN v_snapshot_id;
  END IF;

  SELECT s.id INTO v_previous_id
  FROM public.answer_snapshots s
  WHERE s.answer_kind = (p_snapshot->>'answer_kind')::public.answer_kind
    AND s.filter_fingerprint = p_snapshot->>'filter_fingerprint'
    AND s.status = 'published'
  ORDER BY s.computed_at DESC
  LIMIT 1
  FOR UPDATE;

  INSERT INTO public.answer_snapshots (
    answer_kind, status, period_start, period_end, data_cutoff_at, computed_at, stale_after,
    domains, geographies, stages, fund_id, yc_batch_id, normalized_filters,
    filter_fingerprint, input_fingerprint, schema_version, methodology_version,
    summary, disclosed_amount_usd, disclosed_round_count, undisclosed_round_count,
    company_count, fund_count, round_count, thesis_count, pattern_count,
    coverage_metrics, confidence_score, confidence_label, caveats, counter_evidence, supersedes_id
  ) VALUES (
    (p_snapshot->>'answer_kind')::public.answer_kind, 'computing',
    (p_snapshot->>'period_start')::TIMESTAMPTZ, (p_snapshot->>'period_end')::TIMESTAMPTZ,
    (p_snapshot->>'data_cutoff_at')::TIMESTAMPTZ, (p_snapshot->>'computed_at')::TIMESTAMPTZ,
    (p_snapshot->>'stale_after')::TIMESTAMPTZ,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_snapshot->'domains', '[]'::JSONB))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_snapshot->'geographies', '[]'::JSONB))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_snapshot->'stages', '[]'::JSONB))),
    NULLIF(p_snapshot->>'fund_id', '')::UUID, NULLIF(p_snapshot->>'yc_batch_id', ''),
    p_snapshot->'normalized_filters', p_snapshot->>'filter_fingerprint', p_snapshot->>'input_fingerprint',
    p_snapshot->>'schema_version', p_snapshot->>'methodology_version', p_snapshot->'summary',
    COALESCE((p_snapshot->>'disclosed_amount_usd')::BIGINT, 0),
    COALESCE((p_snapshot->>'disclosed_round_count')::INTEGER, 0),
    COALESCE((p_snapshot->>'undisclosed_round_count')::INTEGER, 0),
    COALESCE((p_snapshot->>'company_count')::INTEGER, 0),
    COALESCE((p_snapshot->>'fund_count')::INTEGER, 0),
    COALESCE((p_snapshot->>'round_count')::INTEGER, 0),
    COALESCE((p_snapshot->>'thesis_count')::INTEGER, 0),
    COALESCE((p_snapshot->>'pattern_count')::INTEGER, 0),
    p_snapshot->'coverage_metrics', (p_snapshot->>'confidence_score')::NUMERIC,
    (p_snapshot->>'confidence_label')::public.intelligence_confidence_label,
    COALESCE(p_snapshot->'caveats', '[]'::JSONB), COALESCE(p_snapshot->'counter_evidence', '[]'::JSONB),
    v_previous_id
  ) RETURNING id INTO v_snapshot_id;

  FOR v_section IN SELECT value FROM jsonb_array_elements(COALESCE(p_snapshot->'sections', '[]'::JSONB))
  LOOP
    INSERT INTO public.answer_snapshot_sections (
      snapshot_id, section_key, title, position, material, narrative, metrics, why_this
    ) VALUES (
      v_snapshot_id, v_section->>'section_key', v_section->>'title',
      (v_section->>'position')::INTEGER, COALESCE((v_section->>'material')::BOOLEAN, TRUE),
      v_section->>'narrative', COALESCE(v_section->'metrics', '{}'::JSONB),
      COALESCE(v_section->'why_this', '{}'::JSONB)
    ) RETURNING id INTO v_section_id;

    FOR v_citation IN SELECT value FROM jsonb_array_elements(COALESCE(v_section->'citations', '[]'::JSONB))
    LOOP
      INSERT INTO public.answer_snapshot_citations (
        snapshot_id, section_id, stance, label, claim_id, claim_binding_id, claim_evidence_id,
        funding_round_id, round_participant_id, thesis_record_id, pattern_id
      ) VALUES (
        v_snapshot_id, v_section_id,
        COALESCE((v_citation->>'stance')::public.answer_citation_stance, 'supports'),
        v_citation->>'label', NULLIF(v_citation->>'claim_id', '')::UUID,
        NULLIF(v_citation->>'claim_binding_id', '')::UUID,
        NULLIF(v_citation->>'claim_evidence_id', '')::UUID,
        NULLIF(v_citation->>'funding_round_id', '')::UUID,
        NULLIF(v_citation->>'round_participant_id', '')::UUID,
        NULLIF(v_citation->>'thesis_record_id', '')::UUID,
        NULLIF(v_citation->>'pattern_id', '')::UUID
      );
    END LOOP;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.answer_snapshot_sections s
    WHERE s.snapshot_id = v_snapshot_id AND s.material
      AND NOT EXISTS (SELECT 1 FROM public.answer_snapshot_citations c WHERE c.section_id = s.id)
  ) THEN
    RAISE EXCEPTION 'Every material answer section requires at least one normalized citation';
  END IF;

  IF v_previous_id IS NOT NULL THEN
    UPDATE public.answer_snapshots SET status = 'superseded' WHERE id = v_previous_id;
  END IF;
  UPDATE public.answer_snapshots SET status = 'published' WHERE id = v_snapshot_id;
  RETURN v_snapshot_id;
END;
$$;

REVOKE ALL ON FUNCTION public.persist_answer_snapshot(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_answer_snapshot(JSONB) TO service_role;

REVOKE ALL ON public.thesis_records, public.thesis_record_claims, public.pattern_citations,
  public.answer_snapshots, public.answer_snapshot_sections, public.answer_snapshot_citations
  FROM anon, authenticated;
GRANT ALL ON public.thesis_records, public.thesis_record_claims, public.pattern_citations,
  public.answer_snapshots, public.answer_snapshot_sections, public.answer_snapshot_citations
  TO service_role;

COMMENT ON TABLE public.answer_snapshots IS 'Immutable historical answers to Ventro core questions; new inputs create a superseding snapshot.';
COMMENT ON COLUMN public.answer_snapshots.disclosed_amount_usd IS 'Sum of disclosed amounts only. Undisclosed rounds are counted separately and never represented as zero.';
COMMENT ON TABLE public.thesis_records IS 'Versioned stated and observed thesis records. thesis_kind must remain visible to every consumer.';
COMMENT ON TABLE public.answer_snapshot_citations IS 'Normalized citations to evidence-spine and intelligence records; free-form URLs are intentionally excluded.';
