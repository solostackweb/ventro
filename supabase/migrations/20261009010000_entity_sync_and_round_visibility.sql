-- Structured entity synchronization and funding-round visibility.

ALTER TYPE public.pipeline_type ADD VALUE IF NOT EXISTS 'entity_sync';

ALTER TABLE public.yc_batches
  DROP CONSTRAINT IF EXISTS yc_batches_season_check;
ALTER TABLE public.yc_batches
  ADD CONSTRAINT yc_batches_season_check CHECK (season IN ('W', 'P', 'S', 'F'));

ALTER TABLE public.fund_portfolio
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'partial'
    CHECK (verification_status IN ('verified', 'partial', 'unverified', 'conflicted')),
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS update_fund_portfolio_updated_at ON public.fund_portfolio;
CREATE TRIGGER update_fund_portfolio_updated_at
  BEFORE UPDATE ON public.fund_portfolio
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.fund_portfolio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view fund portfolio" ON public.fund_portfolio;
CREATE POLICY "Public can view fund portfolio" ON public.fund_portfolio
  FOR SELECT USING (verification_status IN ('verified', 'partial'));

CREATE OR REPLACE VIEW public.investment_graph AS
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
FROM public.funding_rounds fr
JOIN public.companies c ON fr.company_id = c.id
LEFT JOIN public.round_participants rp
  ON fr.id = rp.round_id
  AND rp.verification_status IN ('verified', 'partial')
LEFT JOIN public.funds f ON rp.fund_id = f.id
LEFT JOIN public.fund_vehicles fv ON rp.fund_vehicle_id = fv.id
WHERE fr.verification_status IN ('verified', 'partial');

GRANT SELECT ON public.investment_graph TO anon, authenticated;
