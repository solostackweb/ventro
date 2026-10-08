-- Align legacy company-stage constraints with the canonical Stage vocabulary
-- used by the application and the funding_rounds table.

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_stage_check,
  DROP CONSTRAINT IF EXISTS companies_latest_round_stage_check;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_stage_check CHECK (
    stage IN (
      'pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'series_d',
      'series_e', 'growth', 'public', 'ipo', 'acquisition', 'grant', 'debt',
      'convertible', 'safe', 'other'
    )
  ),
  ADD CONSTRAINT companies_latest_round_stage_check CHECK (
    latest_round_stage IN (
      'pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'series_d',
      'series_e', 'growth', 'public', 'ipo', 'acquisition', 'grant', 'debt',
      'convertible', 'safe', 'other'
    )
  );

ALTER TABLE public.investments
  DROP CONSTRAINT IF EXISTS investments_round_stage_check;

ALTER TABLE public.investments
  ADD CONSTRAINT investments_round_stage_check CHECK (
    round_stage IN (
      'pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'series_d',
      'series_e', 'growth', 'public', 'ipo', 'acquisition', 'grant', 'debt',
      'convertible', 'safe', 'other'
    )
  );
