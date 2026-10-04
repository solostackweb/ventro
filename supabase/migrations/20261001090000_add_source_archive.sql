-- Migration: Add source_archive table for R2 raw content storage
-- Date: 2026-10-01
-- Description: Adds source_archive table to store metadata and R2 references for ingested source content.
--              Includes RLS policy for authenticated access.

-- Create source_archive table if not exists
CREATE TABLE IF NOT EXISTS source_archive (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id TEXT NOT NULL REFERENCES source_connectors(source_id),
  url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  r2_key TEXT, -- Cloudflare R2 object key
  r2_url TEXT, -- Public or presigned URL for access
  metadata JSONB NOT NULL DEFAULT '{}',
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, content_hash)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_source_archive_source ON source_archive(source_id);
CREATE INDEX IF NOT EXISTS idx_source_archive_fetched_at ON source_archive(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_archive_content_hash ON source_archive(content_hash);

-- Enable RLS on source_archive (idempotent)
ALTER TABLE source_archive ENABLE ROW LEVEL SECURITY;

-- Create RLS policy if not exists (using DO block for conditional creation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'source_archive' 
    AND policyname = 'Authenticated can view source archive'
  ) THEN
    CREATE POLICY "Authenticated can view source archive" ON source_archive
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Grant permissions for authenticated role (idempotent)
GRANT SELECT ON source_archive TO authenticated;

