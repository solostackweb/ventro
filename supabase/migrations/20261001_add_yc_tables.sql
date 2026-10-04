-- Migration: Add YC batch tracking tables
-- Date: 2026-10-01
-- Description: Adds yc_batches and yc_batch_companies tables for Y Combinator batch tracking

-- YC Batches table
CREATE TABLE IF NOT EXISTS yc_batches (
  id TEXT PRIMARY KEY, -- e.g., 'W24', 'S24', 'W25'
  batch_name TEXT NOT NULL, -- e.g., 'Winter 2024'
  season TEXT NOT NULL CHECK (season IN ('W', 'S')),
  year INTEGER NOT NULL,
  demo_day_date TIMESTAMPTZ,
  total_companies INTEGER DEFAULT 0,
  ai_companies_count INTEGER DEFAULT 0,
  source_links TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season, year)
);

-- YC Batch Companies join table
CREATE TABLE IF NOT EXISTS yc_batch_companies (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  batch_id TEXT NOT NULL REFERENCES yc_batches(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  is_ai_company BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(batch_id, company_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_yc_batches_year_season ON yc_batches(year DESC, season DESC);
CREATE INDEX IF NOT EXISTS idx_yc_batch_companies_batch ON yc_batch_companies(batch_id);
CREATE INDEX IF NOT EXISTS idx_yc_batch_companies_company ON yc_batch_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_yc_batch_companies_ai ON yc_batch_companies(is_ai_company) WHERE is_ai_company = TRUE;

-- RLS
ALTER TABLE yc_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE yc_batch_companies ENABLE ROW LEVEL SECURITY;

-- Public read access (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'yc_batches' AND policyname = 'Public can view YC batches'
  ) THEN
    CREATE POLICY "Public can view YC batches" ON yc_batches
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'yc_batch_companies' AND policyname = 'Public can view YC batch companies'
  ) THEN
    CREATE POLICY "Public can view YC batch companies" ON yc_batch_companies
      FOR SELECT USING (true);
  END IF;
END $$;

-- Triggers (idempotent)
DROP TRIGGER IF EXISTS update_yc_batches_updated_at ON yc_batches;
CREATE TRIGGER update_yc_batches_updated_at BEFORE UPDATE ON yc_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();