-- Complete the archive -> story -> evidence contract and populate connector
-- trust metadata used by automatic story verification.

ALTER TABLE public.story_sources
  ADD COLUMN IF NOT EXISTS document_version_id UUID
  REFERENCES public.document_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_story_sources_document_version
  ON public.story_sources(document_version_id);

UPDATE public.source_connectors
SET
  is_official = CASE
    WHEN category IN ('vc_blog', 'company_blog', 'government', 'yc', 'corporate') THEN TRUE
    ELSE is_official
  END,
  trust_tier = CASE
    WHEN category IN ('vc_blog', 'company_blog', 'government', 'yc', 'corporate') THEN 'official'
    WHEN status = 'approved' AND trust_tier = 'standard' THEN 'approved'
    ELSE trust_tier
  END,
  independence_group = COALESCE(
    independence_group,
    NULLIF(LOWER(REGEXP_REPLACE(REGEXP_REPLACE(base_url, '^https?://(www\.)?', ''), '/.*$', '')), ''),
    source_id
  );

COMMENT ON COLUMN public.story_sources.document_version_id IS
  'Immutable archived document version from which this story source was produced.';

NOTIFY pgrst, 'reload schema';
