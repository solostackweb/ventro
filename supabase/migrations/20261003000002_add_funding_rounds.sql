-- Migration: Add funding_rounds and round_participants tables (Phase 3)
-- Date: 2026-10-03
-- Description: Canonical funding rounds and participant edges for verified investment graph

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- FUNDING ROUNDS (Canonical round per company/date/stage)
-- ============================================
CREATE TABLE IF NOT EXISTS funding_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  announced_date TIMESTAMPTZ NOT NULL,
  round_stage TEXT CHECK (round_stage IN ('pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'series_d', 'series_e', 'growth', 'public', 'ipo', 'acquisition', 'grant', 'debt', 'convertible', 'safe', 'other')),
  amount_usd BIGINT,
  amount_currency TEXT DEFAULT 'USD',
  amount_source_url TEXT, -- source URL for the amount claim
  pre_money_usd BIGINT,
  post_money_usd BIGINT,
  valuation_source_url TEXT,
  lead_investor_ids UUID[], -- array of fund_ids that led
  source_urls TEXT[] DEFAULT '{}', -- all source URLs for this round
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('verified', 'partial', 'unverified', 'conflicted')),
  conflicts JSONB, -- [{"field": "...", "source_a": "...", "source_b": "...", "values": [...]}]
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, announced_date, round_stage)
);

CREATE INDEX IF NOT EXISTS idx_funding_rounds_company ON funding_rounds(company_id);
CREATE INDEX IF NOT EXISTS idx_funding_rounds_date ON funding_rounds(announced_date DESC);
CREATE INDEX IF NOT EXISTS idx_funding_rounds_stage ON funding_rounds(round_stage);
CREATE INDEX IF NOT EXISTS idx_funding_rounds_verification ON funding_rounds(verification_status);

-- ============================================
-- ROUND PARTICIPANTS (Firm/vehicle/role per participant)
-- ============================================
CREATE TABLE IF NOT EXISTS round_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES funding_rounds(id) ON DELETE CASCADE,
  fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  fund_vehicle_id UUID REFERENCES fund_vehicles(id) ON DELETE SET NULL,
  role TEXT CHECK (role IN ('lead', 'co_lead', 'participant', 'mentioned', 'undisclosed')),
  amount_usd BIGINT, -- amount this participant contributed (if disclosed)
  amount_currency TEXT DEFAULT 'USD',
  amount_source_url TEXT, -- source for this participant's amount
  source_urls TEXT[] DEFAULT '{}', -- source URLs supporting this participation
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('verified', 'partial', 'unverified', 'conflicted')),
  conflicts JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(round_id, fund_id, fund_vehicle_id)
);

CREATE INDEX IF NOT EXISTS idx_round_participants_round ON round_participants(round_id);
CREATE INDEX IF NOT EXISTS idx_round_participants_fund ON round_participants(fund_id);
CREATE INDEX IF NOT EXISTS idx_round_participants_role ON round_participants(role);
CREATE INDEX IF NOT EXISTS idx_round_participants_verification ON round_participants(verification_status);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_funding_rounds_updated_at ON funding_rounds;
CREATE TRIGGER update_funding_rounds_updated_at BEFORE UPDATE ON funding_rounds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_round_participants_updated_at ON round_participants;
CREATE TRIGGER update_round_participants_updated_at BEFORE UPDATE ON round_participants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE funding_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_participants ENABLE ROW LEVEL SECURITY;

-- Public can view verified/partial funding rounds
CREATE POLICY "Public can view funding rounds" ON funding_rounds
  FOR SELECT USING (verification_status IN ('verified', 'partial'));

-- Public can view verified/partial round participants
CREATE POLICY "Public can view round participants" ON round_participants
  FOR SELECT USING (verification_status IN ('verified', 'partial'));

-- Admin/service role can manage all (handled via service_role key)

-- ============================================
-- HELPER VIEW: Investment graph for "Where are investors investing?"
-- ============================================
CREATE OR REPLACE VIEW investment_graph AS
SELECT
  fr.id AS round_id,
  fr.company_id,
  c.canonical_name AS company_name,
  c.canonical_domain AS company_domain,
  c.ai_tags AS company_ai_tags,
  c.hq_country AS company_country,
  c.yc_batch,
  fr.announced_date,
  fr.round_stage,
  fr.amount_usd,
  fr.amount_currency,
  fr.verification_status AS round_verification,
  rp.fund_id,
  f.canonical_name AS fund_name,
  f.firm_type,
  rp.fund_vehicle_id,
  fv.name AS vehicle_name,
  fv.vintage_year,
  rp.role AS participant_role,
  rp.amount_usd AS participant_amount_usd,
  rp.verification_status AS participant_verification,
  rp.source_urls AS participant_sources,
  fr.source_urls AS round_sources
FROM funding_rounds fr
JOIN companies c ON fr.company_id = c.id
JOIN round_participants rp ON fr.id = rp.round_id
JOIN funds f ON rp.fund_id = f.id
LEFT JOIN fund_vehicles fv ON rp.fund_vehicle_id = fv.id
WHERE fr.verification_status IN ('verified', 'partial')
  AND rp.verification_status IN ('verified', 'partial');