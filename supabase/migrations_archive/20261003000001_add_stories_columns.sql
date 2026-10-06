-- Migration: Add missing columns to stories table
-- Date: 2026-10-03
-- Description: Adds source_urls, supporting_sources, and other missing columns for clustering

ALTER TABLE stories ADD COLUMN IF NOT EXISTS source_urls TEXT[] DEFAULT '{}';
ALTER TABLE stories ADD COLUMN IF NOT EXISTS supporting_sources TEXT[] DEFAULT '{}';
ALTER TABLE stories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE stories ADD COLUMN IF NOT EXISTS canonical_url TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS event_date TIMESTAMPTZ;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS publisher TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS source_count INTEGER DEFAULT 1;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS ai_topics TEXT[] DEFAULT '{}';
ALTER TABLE stories ADD COLUMN IF NOT EXISTS geography TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'other';
ALTER TABLE stories ADD COLUMN IF NOT EXISTS verification_label TEXT DEFAULT 'unverified';
ALTER TABLE stories ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE stories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add unique constraint for upsert on canonical_url
CREATE UNIQUE INDEX IF NOT EXISTS idx_stories_canonical_url ON stories(canonical_url);