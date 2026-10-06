-- Migration: Add raw_content and processed columns to source_archive
-- Date: 2026-10-03
-- Description: Adds raw_content (for full text storage) and processed (for clustering tracking) columns

ALTER TABLE source_archive ADD COLUMN IF NOT EXISTS raw_content TEXT;
ALTER TABLE source_archive ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_source_archive_processed ON source_archive(processed);