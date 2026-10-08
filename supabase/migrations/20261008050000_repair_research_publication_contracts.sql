-- Repair the runtime contracts required to turn archived source material into
-- published stories and downstream intelligence records.

ALTER TABLE public.source_archive
  ADD COLUMN IF NOT EXISTS processed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_source_archive_unprocessed
  ON public.source_archive(fetched_at, id)
  WHERE processed = FALSE;

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS summary_kind TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS source_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS supporting_sources TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.stories
  DROP CONSTRAINT IF EXISTS stories_summary_kind_check;

ALTER TABLE public.stories
  ADD CONSTRAINT stories_summary_kind_check
  CHECK (summary_kind IN ('none', 'source_excerpt', 'article_summary'));

COMMENT ON COLUMN public.source_archive.processed IS
  'True only after the archived item has been durably clustered into a story and linked to its source.';

COMMENT ON COLUMN public.stories.summary_kind IS
  'Identifies whether summary is absent, a source-provided excerpt, or a generated article summary.';

NOTIFY pgrst, 'reload schema';
