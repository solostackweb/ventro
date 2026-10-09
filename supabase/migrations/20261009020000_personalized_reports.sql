-- Personalized, evidence-grounded research reports generated for an authenticated user.

CREATE TABLE public.personalized_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 140),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'generating', 'ready', 'failed')),
  requested_pages INTEGER NOT NULL CHECK (requested_pages BETWEEN 3 AND 15),
  period_days INTEGER NOT NULL CHECK (period_days IN (30, 90, 180, 365)),
  geographies TEXT[] NOT NULL DEFAULT '{}',
  fund_ids UUID[] NOT NULL DEFAULT '{}',
  yc_batch_ids TEXT[] NOT NULL DEFAULT '{}',
  topics TEXT[] NOT NULL DEFAULT '{}',
  included_sections TEXT[] NOT NULL DEFAULT '{}',
  audience TEXT,
  purpose TEXT,
  configuration JSONB NOT NULL DEFAULT '{}'::JSONB,
  report_content JSONB,
  source_manifest JSONB NOT NULL DEFAULT '[]'::JSONB,
  r2_key TEXT,
  file_name TEXT,
  file_size_bytes BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  generation_provider TEXT,
  generation_model TEXT,
  prompt_version TEXT NOT NULL DEFAULT 'personalized-report-v1',
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX personalized_reports_user_created_idx
  ON public.personalized_reports (user_id, created_at DESC);
CREATE INDEX personalized_reports_active_idx
  ON public.personalized_reports (user_id, status)
  WHERE status IN ('queued', 'generating');

CREATE TRIGGER update_personalized_reports_updated_at
  BEFORE UPDATE ON public.personalized_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.personalized_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own personalized reports"
  ON public.personalized_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own personalized reports"
  ON public.personalized_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personalized reports"
  ON public.personalized_reports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own personalized reports"
  ON public.personalized_reports FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personalized_reports TO authenticated;
GRANT ALL ON public.personalized_reports TO service_role;

COMMENT ON TABLE public.personalized_reports IS 'User-owned DOCX research reports grounded in Ventro evidence and stored privately in R2.';
COMMENT ON COLUMN public.personalized_reports.requested_pages IS 'A content-density target. Final pagination can vary by DOCX renderer and user edits.';
COMMENT ON COLUMN public.personalized_reports.source_manifest IS 'Immutable-at-completion citation manifest for the evidence used in the report.';
