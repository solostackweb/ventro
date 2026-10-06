-- Migration: Initial Ventro Schema (Clean Baseline)
-- Date: 2026-10-06
-- Description: Single reproducible baseline migration for the complete Ventro application schema.
--              Builds the entire application schema successfully on a completely empty database.
--              No legacy backfills, no discount_card conversions, no migration-time compatibility code.
--              Objects are ordered by dependency: extensions -> types -> tables -> functions -> triggers -> indexes -> RLS -> grants.

-- ============================================
-- EXTENSIONS
-- ============================================
-- UUID generation uses built-in gen_random_uuid() (pgcrypto)

-- ============================================
-- ENUMS (Created as CHECK constraints for simplicity and portability)
-- ============================================

-- ============================================
-- TABLES: AUTH & USERS
-- ============================================

-- User profiles (extends auth.users)
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('founder', 'investor', 'analyst', 'student', 'other')),
  ai_topics TEXT[] DEFAULT '{}',
  geographies TEXT[] DEFAULT '{}',
  stages TEXT[] DEFAULT '{}',
  onboarding_completed_at TIMESTAMPTZ,
  entitlement TEXT DEFAULT 'preview' CHECK (entitlement IN ('preview', 'student_trial', 'subscribed')),
  trial_expires_at TIMESTAMPTZ,
  trial_issued_at TIMESTAMPTZ,
  trial_eligibility_domain TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace settings
CREATE TABLE public.workspace_settings (
  user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  feed_ranking_weights JSONB DEFAULT '{"follow_fund": 1.0, "follow_company": 0.8, "topic_match": 0.6, "geography_match": 0.4, "stage_match": 0.3}',
  alert_frequency TEXT DEFAULT 'daily' CHECK (alert_frequency IN ('instant', 'daily', 'weekly')),
  alert_channels TEXT[] DEFAULT '{"email", "in_app"}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLES: ENTITIES
-- ============================================

-- Companies
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL,
  canonical_domain TEXT,
  short_description TEXT,
  ai_tags TEXT[] DEFAULT '{}',
  hq_city TEXT,
  hq_country TEXT,
  stage TEXT CHECK (stage IN ('pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'growth', 'public')),
  latest_round_date TIMESTAMPTZ,
  latest_round_amount_usd BIGINT,
  latest_round_stage TEXT CHECK (latest_round_stage IN ('pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'growth', 'public')),
  lead_investors TEXT[],
  yc_batch TEXT,
  source_links TEXT[] DEFAULT '{}',
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('verified', 'partial', 'unverified', 'conflicted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Company aliases (for renames/mergers)
CREATE TABLE public.company_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_type TEXT CHECK (alias_type IN ('former_name', 'acronym', 'common_misspelling', 'product_name')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Funds / Investment Firms
CREATE TABLE public.funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL,
  canonical_domain TEXT,
  firm_type TEXT CHECK (firm_type IN ('vc_firm', 'corporate', 'angel', 'government')),
  hq_city TEXT,
  hq_country TEXT,
  source_links TEXT[] DEFAULT '{}',
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('verified', 'partial', 'unverified', 'conflicted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fund vehicles (distinct funds under a firm)
CREATE TABLE public.fund_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vintage_year INTEGER,
  size_usd BIGINT,
  focus TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stated thesis excerpts (from official sources)
CREATE TABLE public.stated_thesis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT CHECK (source_type IN ('blog', 'interview', 'podcast', 'twitter', 'sec_filing', 'other')),
  date_stated TIMESTAMPTZ,
  extracted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Observed thesis (inferred from portfolio)
CREATE TABLE public.observed_thesis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  methodology TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  sample_size INTEGER NOT NULL,
  themes JSONB NOT NULL,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  caveats TEXT,
  last_computed TIMESTAMPTZ DEFAULT NOW()
);

-- Fund portfolio companies (many-to-many)
CREATE TABLE public.fund_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  first_investment_date TIMESTAMPTZ,
  latest_investment_date TIMESTAMPTZ,
  total_invested_usd BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fund_id, company_id)
);

-- Individual investments (round participation)
CREATE TABLE public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  fund_vehicle_id UUID REFERENCES public.fund_vehicles(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  announced_date TIMESTAMPTZ NOT NULL,
  round_stage TEXT CHECK (round_stage IN ('pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'growth', 'public')),
  amount_usd BIGINT,
  amount_currency TEXT DEFAULT 'USD',
  investor_role TEXT CHECK (investor_role IN ('lead', 'participant', 'undisclosed')),
  source_urls TEXT[] DEFAULT '{}',
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('verified', 'partial', 'unverified', 'conflicted')),
  conflicts JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLES: NEWS & INTELLIGENCE
-- ============================================

-- News stories (deduplicated clusters)
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_url TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT,
  event_date TIMESTAMPTZ,
  publisher TEXT,
  source_count INTEGER DEFAULT 1,
  ai_topics TEXT[] DEFAULT '{}',
  geography TEXT CHECK (geography IN ('us', 'india', 'eu', 'israel', 'canada', 'uk', 'sea', 'global')),
  event_type TEXT CHECK (event_type IN ('funding', 'launch', 'partnership', 'research', 'acquisition', 'other')),
  verification_label TEXT DEFAULT 'unverified' CHECK (verification_label IN ('verified', 'partial', 'unverified', 'conflicted')),
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Story-company associations
CREATE TABLE public.story_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('primary', 'mentioned')),
  UNIQUE(story_id, company_id)
);

-- Story-investor associations
CREATE TABLE public.story_investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  fund_id UUID NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('lead', 'participant', 'mentioned')),
  UNIQUE(story_id, fund_id)
);

-- Story sources (original articles)
CREATE TABLE public.story_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  publisher TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  content_hash TEXT,
  supports_claims JSONB,
  UNIQUE(story_id, source_url)
);

-- ============================================
-- TABLES: SOURCE MANAGEMENT
-- ============================================

-- Source connectors registry
CREATE TABLE public.source_connectors (
  source_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('vc_blog', 'company_blog', 'news_aggregator', 'government', 'developer_platform', 'yc', 'search')),
  base_url TEXT NOT NULL,
  access_method TEXT CHECK (access_method IN ('rss', 'api', 'html', 'sitemap', 'search')),
  auth_required TEXT CHECK (auth_required IN ('none', 'api_key', 'oauth', 'login')),
  rate_limit TEXT,
  robots_txt_allows TEXT CHECK (robots_txt_allows IN ('yes', 'no', 'conditional')),
  terms_of_use_url TEXT,
  reuse_permission TEXT CHECK (reuse_permission IN ('full_text', 'summary_only', 'metadata_only', 'link_only', 'unknown')),
  attribution_required BOOLEAN DEFAULT TRUE,
  commercial_use_allowed TEXT CHECK (commercial_use_allowed IN ('yes', 'no', 'unclear')),
  retention_max_days INTEGER DEFAULT 90,
  expected_fact_types TEXT[] DEFAULT '{}',
  cadence TEXT CHECK (cadence IN ('realtime', 'hourly', 'daily', 'weekly', 'on_demand')),
  owner TEXT,
  status TEXT DEFAULT 'pending_review' CHECK (status IN ('approved', 'pending_review', 'rejected', 'paused')),
  last_audit_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Source fetch logs
CREATE TABLE public.source_fetch_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL REFERENCES public.source_connectors(source_id),
  url TEXT NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  content_hash TEXT,
  status TEXT CHECK (status IN ('success', 'error', 'partial', 'unchanged')),
  error_message TEXT,
  items_found INTEGER DEFAULT 0,
  items_new INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  r2_key TEXT,
  latency_ms INTEGER
);

-- Source archive (raw content stored in R2)
CREATE TABLE public.source_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL REFERENCES public.source_connectors(source_id),
  url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  r2_key TEXT,
  r2_url TEXT,
  raw_content TEXT,
  metadata JSONB,
  permissions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, content_hash)
);

-- ============================================
-- TABLES: FUNDING ROUNDS (Phase 3)
-- ============================================

-- Funding rounds (canonical round per company/date/stage)
CREATE TABLE public.funding_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  announced_date TIMESTAMPTZ NOT NULL,
  round_stage TEXT CHECK (round_stage IN ('pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'series_d', 'series_e', 'growth', 'public', 'ipo', 'acquisition', 'grant', 'debt', 'convertible', 'safe', 'other')),
  amount_usd BIGINT,
  amount_currency TEXT DEFAULT 'USD',
  amount_source_url TEXT,
  pre_money_usd BIGINT,
  post_money_usd BIGINT,
  valuation_source_url TEXT,
  lead_investor_ids UUID[],
  source_urls TEXT[] DEFAULT '{}',
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('verified', 'partial', 'unverified', 'conflicted')),
  conflicts JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, announced_date, round_stage)
);

-- Round participants (firm/vehicle/role per participant)
CREATE TABLE public.round_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.funding_rounds(id) ON DELETE CASCADE,
  fund_id UUID NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  fund_vehicle_id UUID REFERENCES public.fund_vehicles(id) ON DELETE SET NULL,
  role TEXT CHECK (role IN ('lead', 'co_lead', 'participant', 'mentioned', 'undisclosed')),
  amount_usd BIGINT,
  amount_currency TEXT DEFAULT 'USD',
  amount_source_url TEXT,
  source_urls TEXT[] DEFAULT '{}',
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('verified', 'partial', 'unverified', 'conflicted')),
  conflicts JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(round_id, fund_id, fund_vehicle_id)
);

-- ============================================
-- TABLES: YC BATCHES
-- ============================================

-- YC Batches table
CREATE TABLE public.yc_batches (
  id TEXT PRIMARY KEY,
  batch_name TEXT NOT NULL,
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
CREATE TABLE public.yc_batch_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT NOT NULL REFERENCES public.yc_batches(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  is_ai_company BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(batch_id, company_id)
);

-- ============================================
-- TABLES: USER INTERACTIONS
-- ============================================

-- Follows
CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  entity_type TEXT CHECK (entity_type IN ('fund', 'company')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entity_type, entity_id)
);

-- Saved items
CREATE TABLE public.saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  item_type TEXT CHECK (item_type IN ('story', 'company', 'fund', 'pattern')),
  item_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_type, item_id)
);

-- Private workspace notes
CREATE TABLE public.workspace_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  entity_type TEXT CHECK (entity_type IN ('company', 'fund', 'pattern')),
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entity_type, entity_id)
);

-- Alert rules
CREATE TABLE public.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  entity_type TEXT CHECK (entity_type IN ('fund', 'company')),
  entity_id UUID NOT NULL,
  trigger TEXT CHECK (trigger IN ('new_funding_round', 'new_portfolio_company', 'thesis_update', 'pattern_published', 'any_announcement')),
  frequency TEXT DEFAULT 'daily' CHECK (frequency IN ('instant', 'daily', 'weekly')),
  channels TEXT[] DEFAULT '{"in_app"}',
  topic_filter TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification queue
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  alert_rule_id UUID REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,
  channels TEXT[] NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'read')),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLES: PATTERNS
-- ============================================

CREATE TABLE public.patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  time_window_start TIMESTAMPTZ NOT NULL,
  time_window_end TIMESTAMPTZ NOT NULL,
  baseline_value NUMERIC,
  current_value NUMERIC,
  change_percentage NUMERIC,
  distinct_companies INTEGER,
  distinct_funds INTEGER,
  qualifying_events JSONB NOT NULL,
  counterexamples JSONB,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  coverage_notes TEXT,
  status TEXT DEFAULT 'candidate' CHECK (status IN ('candidate', 'published', 'corrected', 'retired', 'rejected')),
  source_links TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES public.user_profiles(id),
  reviewed_by UUID REFERENCES public.user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLES: COMMUNITY
-- ============================================

CREATE TABLE public.discussion_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT CHECK (entity_type IN ('company', 'fund', 'pattern')),
  entity_id UUID NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.discussion_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.discussion_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.discussion_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_hidden BOOLEAN DEFAULT FALSE,
  hidden_reason TEXT,
  hidden_by UUID REFERENCES public.user_profiles(id),
  hidden_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLES: ADMIN & AUDIT
-- ============================================

CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.user_profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.entitlement_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  previous_entitlement TEXT,
  new_entitlement TEXT NOT NULL,
  source TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT entitlement_audit_source_check CHECK (source IN ('razorpay_webhook', 'student_trial', 'admin', 'trial_expiry', 'manual'))
);

-- Admin review tables (for human review of unverified content)
-- Human review is an authenticated, atomic database transition. Never grant direct
-- browser update policies on the reviewed tables.
-- user_profiles.role is user-editable in the base schema, so it is NOT an admin authority.
CREATE TABLE public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_users FROM anon, authenticated;

CREATE TABLE public.admin_review_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_kind TEXT NOT NULL CHECK (item_kind IN ('story', 'funding_round', 'round_participant', 'pattern')),
  item_id UUID NOT NULL,
  reviewer_id UUID NOT NULL REFERENCES public.user_profiles(id),
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence_urls TEXT[] NOT NULL DEFAULT '{}',
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX admin_review_events_item_idx
  ON public.admin_review_events (item_kind, item_id, reviewed_at DESC);

ALTER TABLE public.admin_review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_review_events FROM anon, authenticated;

-- ============================================
-- TABLES: BILLING (Phase 7 - tables exist but payment endpoints disabled)
-- ============================================

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'monthly' CHECK (plan IN ('monthly')),
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'trialing', 'active', 'past_due', 'payment_failed', 'cancelled', 'completed', 'pending')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_ends_at TIMESTAMPTZ,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_subscription_id TEXT,
  razorpay_customer_id TEXT,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  failed_payment_count INTEGER DEFAULT 0,
  last_failed_payment_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  entitlement_granted_by_webhook BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  razorpay_invoice_id TEXT,
  razorpay_payment_id TEXT,
  amount_usd INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  invoice_url TEXT,
  pdf_url TEXT,
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'checkout_created', 'payment_succeeded', 'payment_failed', 
    'subscription_created', 'subscription_updated', 'subscription_cancelled',
    'subscription_completed', 'trial_started', 'trial_ended',
    'entitlement_changed', 'refund_issued', 'refund_failed'
  )),
  event_data JSONB NOT NULL DEFAULT '{}',
  razorpay_event_id TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  idempotency_key TEXT UNIQUE
);

-- ============================================
-- VIEWS
-- ============================================

-- Investment graph for "Where are investors investing?"
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
JOIN public.round_participants rp ON fr.id = rp.round_id
JOIN public.funds f ON rp.fund_id = f.id
LEFT JOIN public.fund_vehicles fv ON rp.fund_vehicle_id = fv.id
WHERE fr.verification_status IN ('verified', 'partial')
  AND rp.verification_status IN ('verified', 'partial');

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update updated_at column trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Handle new user signup - create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email)
  VALUES (NEW.id, COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Centralized expiry-aware access check (no user_id parameter - derives from auth.uid())
-- Returns true only for active subscribed or non-expired student_trial
CREATE OR REPLACE FUNCTION public.has_full_access()
RETURNS BOOLEAN LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_profile RECORD;
  v_user_id UUID := auth.uid();
BEGIN
  SELECT entitlement, trial_expires_at INTO v_profile
  FROM public.user_profiles WHERE id = v_user_id;
  
  IF v_profile.entitlement = 'subscribed' THEN
    RETURN TRUE;
  END IF;
  
  IF v_profile.entitlement = 'student_trial' 
     AND v_profile.trial_expires_at IS NOT NULL 
     AND v_profile.trial_expires_at > NOW() THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Atomic trial activation function
-- Verifies eligibility, prevents reissue, sets entitlement and audit in one transaction
CREATE OR REPLACE FUNCTION public.activate_student_trial()
RETURNS JSONB LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT;
  v_domain TEXT;
  v_profile RECORD;
  v_result JSONB;
  v_issued_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Get user email from auth.users (not user_profiles, which may be stale)
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  
  IF v_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'EMAIL_NOT_FOUND',
      'message', 'User email not found'
    );
  END IF;
  
  -- Normalize domain and check exact match
  v_domain := lower(split_part(v_email, '@', 2));
  IF v_domain <> 'mastersunion.org' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INELIGIBLE_DOMAIN',
      'message', 'Only verified @mastersunion.org emails are eligible for the student trial'
    );
  END IF;
  
  -- Check email confirmation status
  IF (SELECT email_confirmed_at FROM auth.users WHERE id = v_user_id) IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'EMAIL_UNCONFIRMED',
      'message', 'Email must be confirmed before activating trial'
    );
  END IF;
  
  -- Lock the profile row to prevent concurrent activation
  -- First, ensure profile exists (trigger should have created it)
  -- If not found, return error rather than creating - profile creation is trigger's responsibility
  SELECT entitlement, trial_issued_at, trial_expires_at, trial_eligibility_domain
  INTO v_profile
  FROM public.user_profiles
  WHERE id = v_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    -- Profile missing despite trigger - this indicates an auth state issue
    -- Return error rather than creating to avoid race conditions
    RETURN jsonb_build_object(
      'success', false,
      'code', 'PROFILE_MISSING',
      'message', 'User profile not found. Please contact support.'
    );
  END IF;
  
  -- Never downgrade a subscribed user
  IF v_profile.entitlement = 'subscribed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'code', 'ALREADY_FULL_ACCESS',
      'message', 'User already has full subscription access',
      'entitlement', 'subscribed',
      'trial_expires_at', v_profile.trial_expires_at,
      'trial_issued_at', v_profile.trial_issued_at
    );
  END IF;
  
  -- Check if trial already consumed (trial_issued_at IS NOT NULL means consumed)
  IF v_profile.trial_issued_at IS NOT NULL THEN
    -- Check if it's an active trial (not expired)
    IF v_profile.trial_expires_at IS NOT NULL AND v_profile.trial_expires_at > NOW() THEN
      RETURN jsonb_build_object(
        'success', true,
        'code', 'TRIAL_ACTIVE',
        'message', 'Trial already active',
        'entitlement', 'student_trial',
        'trial_expires_at', v_profile.trial_expires_at,
        'trial_issued_at', v_profile.trial_issued_at
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'code', 'TRIAL_CONSUMED',
        'message', 'Trial already consumed and expired; cannot be reissued'
      );
    END IF;
  END IF;
  
  -- Check if currently on student_trial (defense in depth)
  IF v_profile.entitlement = 'student_trial' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'TRIAL_ALREADY_ACTIVE',
      'message', 'Trial already active'
    );
  END IF;
  
  -- Activate trial: exactly 20 days from transaction time in UTC
  v_issued_at := NOW();
  v_expires_at := NOW() + INTERVAL '20 days';
  
  UPDATE public.user_profiles
  SET entitlement = 'student_trial',
      trial_issued_at = v_issued_at,
      trial_expires_at = v_expires_at,
      trial_eligibility_domain = 'mastersunion.org',
      updated_at = v_issued_at
  WHERE id = v_user_id;
  
  -- Insert audit event in same transaction
  INSERT INTO public.entitlement_audit (user_id, previous_entitlement, new_entitlement, source, metadata)
  VALUES (v_user_id, v_profile.entitlement, 'student_trial', 'student_trial', 
          jsonb_build_object('trial_expires_at', v_expires_at, 'trial_issued_at', v_issued_at));
  
  RETURN jsonb_build_object(
    'success', true,
    'code', 'TRIAL_ACTIVATED',
    'message', '20-day student trial activated',
    'entitlement', 'student_trial',
    'trial_expires_at', v_expires_at,
    'trial_issued_at', v_issued_at
  );
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.activate_student_trial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_student_trial() TO authenticated;

-- Grant execute on has_full_access to authenticated users
REVOKE ALL ON FUNCTION public.has_full_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_full_access() TO authenticated;

-- Admin review function
-- Human review is an authenticated, atomic database transition. Never grant direct
-- browser update policies on the reviewed tables.
-- user_profiles.role is user-editable in the base schema, so it is NOT an admin authority.
CREATE OR REPLACE FUNCTION public.admin_review_candidate(
  p_kind TEXT,
  p_id UUID,
  p_expected_status TEXT,
  p_new_status TEXT,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_table TEXT;
  v_column TEXT;
  v_old JSONB;
  v_new JSONB;
  v_old_status TEXT;
  v_urls TEXT[] := '{}';
  v_event_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL OR p_expected_status IS NULL OR p_new_status IS NULL
     OR LENGTH(TRIM(COALESCE(p_reason, ''))) < 10
     OR LENGTH(p_reason) > 1000 THEN
    RAISE EXCEPTION 'Review requires an item, expected state, target state, and 10-1000 character reason'
      USING ERRCODE = '22023';
  END IF;

  CASE p_kind
    WHEN 'story' THEN v_table := 'stories'; v_column := 'verification_label';
    WHEN 'funding_round' THEN v_table := 'funding_rounds'; v_column := 'verification_status';
    WHEN 'round_participant' THEN v_table := 'round_participants'; v_column := 'verification_status';
    WHEN 'pattern' THEN v_table := 'patterns'; v_column := 'status';
    ELSE RAISE EXCEPTION 'Unsupported review kind' USING ERRCODE = '22023';
  END CASE;

  EXECUTE FORMAT('SELECT TO_JSONB(t) FROM public.%I t WHERE id = $1 FOR UPDATE', v_table)
    INTO v_old USING p_id;
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'Review item not found' USING ERRCODE = 'P0002';
  END IF;
  v_old_status := v_old ->> v_column;
  IF v_old_status IS DISTINCT FROM p_expected_status THEN
    RAISE EXCEPTION 'Review item changed; refresh the queue' USING ERRCODE = '40001';
  END IF;

  IF p_kind = 'pattern' THEN
    IF NOT ((v_old_status = 'candidate' AND p_new_status IN ('published', 'rejected'))
      OR (v_old_status = 'published' AND p_new_status = 'retired')
      OR (v_old_status = 'corrected' AND p_new_status IN ('published', 'retired'))) THEN
      RAISE EXCEPTION 'Invalid pattern review transition' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(ARRAY_AGG(VALUE), '{}') INTO v_urls
      FROM JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(v_old -> 'source_links', '[]'::JSONB)) VALUE;
    IF p_new_status = 'published' AND (
      CARDINALITY(v_urls) = 0 OR JSONB_ARRAY_LENGTH(COALESCE(v_old -> 'qualifying_events', '[]'::JSONB)) = 0
    ) THEN
      RAISE EXCEPTION 'Pattern needs source links and qualifying events' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_new_status NOT IN ('verified', 'partial', 'unverified', 'conflicted')
       OR p_new_status = v_old_status THEN
      RAISE EXCEPTION 'Invalid verification transition' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(ARRAY_AGG(VALUE), '{}') INTO v_urls
      FROM JSONB_ARRAY_ELEMENTS_TEXT(COALESCE(v_old -> 'source_urls', '[]'::JSONB)) VALUE;
    IF p_kind = 'story' AND CARDINALITY(v_urls) = 0
       AND NULLIF(v_old ->> 'canonical_url', '') IS NOT NULL THEN
      v_urls := ARRAY[v_old ->> 'canonical_url'];
    END IF;
    IF p_new_status IN ('verified', 'partial') AND CARDINALITY(v_urls) = 0 THEN
      RAISE EXCEPTION 'Verified items require original source URLs' USING ERRCODE = '22023';
    END IF;
    IF p_kind = 'round_participant' AND p_new_status IN ('verified', 'partial')
       AND COALESCE(v_old ->> 'role', '') NOT IN ('lead', 'co_lead', 'participant') THEN
      RAISE EXCEPTION 'Investor role must be explicit before verification' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_kind = 'pattern' THEN
    UPDATE public.patterns SET status = p_new_status, reviewed_by = v_actor,
      reviewed_at = NOW() WHERE id = p_id;
  ELSE
    EXECUTE FORMAT('UPDATE public.%I SET %I = $1 WHERE id = $2', v_table, v_column)
      USING p_new_status, p_id;
  END IF;

  INSERT INTO public.admin_review_events
    (item_kind, item_id, reviewer_id, previous_status, new_status, reason, evidence_urls)
  VALUES (p_kind, p_id, v_actor, v_old_status, p_new_status, TRIM(p_reason), v_urls)
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_candidate(TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_candidate(TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================
-- COLUMN-LEVEL PRIVILEGES FOR USER_PROFILES
-- ============================================

-- Revoke table-level UPDATE from authenticated (Supabase commonly grants this)
REVOKE UPDATE ON public.user_profiles FROM authenticated;

-- Grant UPDATE only on explicitly allowed profile columns
GRANT UPDATE (role, ai_topics, geographies, stages, onboarding_completed_at) 
ON public.user_profiles TO authenticated;

-- ============================================
-- TRIGGERS
-- ============================================

-- Updated_at triggers
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workspace_settings_updated_at BEFORE UPDATE ON public.workspace_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_funds_updated_at BEFORE UPDATE ON public.funds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fund_vehicles_updated_at BEFORE UPDATE ON public.fund_vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON public.investments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stories_updated_at BEFORE UPDATE ON public.stories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_source_connectors_updated_at BEFORE UPDATE ON public.source_connectors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workspace_notes_updated_at BEFORE UPDATE ON public.workspace_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON public.alert_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_patterns_updated_at BEFORE UPDATE ON public.patterns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_discussion_threads_updated_at BEFORE UPDATE ON public.discussion_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_discussion_comments_updated_at BEFORE UPDATE ON public.discussion_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_funding_rounds_updated_at BEFORE UPDATE ON public.funding_rounds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_round_participants_updated_at BEFORE UPDATE ON public.round_participants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_yc_batches_updated_at BEFORE UPDATE ON public.yc_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_billing_events_updated_at BEFORE UPDATE ON public.billing_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Handle new user signup - create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_comments ENABLE ROW LEVEL SECURITY;

-- Admin tables (access via service_role only)
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_review_events ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own data
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile (non-sensitive)" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own workspace settings" ON public.workspace_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own workspace settings" ON public.workspace_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own follows" ON public.follows
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own saved items" ON public.saved_items
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own notes" ON public.workspace_notes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own alert rules" ON public.alert_rules
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can create comments" ON public.discussion_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON public.discussion_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view published comments" ON public.discussion_comments
  FOR SELECT USING (is_hidden = FALSE);

-- Public read access for entities (companies, funds, stories)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stated_thesis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observed_thesis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yc_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yc_batch_companies ENABLE ROW LEVEL SECURITY;

-- Public profiles: basic info visible to all
CREATE POLICY "Public can view company profiles" ON public.companies
  FOR SELECT USING (true);

CREATE POLICY "Public can view fund profiles" ON public.funds
  FOR SELECT USING (true);

CREATE POLICY "Public can view stories" ON public.stories
  FOR SELECT USING (true);

CREATE POLICY "Public can view stated thesis excerpts" ON public.stated_thesis
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can view observed thesis" ON public.observed_thesis
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Public can view investments" ON public.investments
  FOR SELECT USING (true);

CREATE POLICY "Public can view published patterns" ON public.patterns
  FOR SELECT USING (status = 'published');

CREATE POLICY "Public can view funding rounds" ON public.funding_rounds
  FOR SELECT USING (verification_status IN ('verified', 'partial'));

CREATE POLICY "Public can view round participants" ON public.round_participants
  FOR SELECT USING (verification_status IN ('verified', 'partial'));

CREATE POLICY "Public can view YC batches" ON public.yc_batches
  FOR SELECT USING (true);

CREATE POLICY "Public can view YC batch companies" ON public.yc_batch_companies
  FOR SELECT USING (true);

-- Admin policies (bypass RLS) - Use service_role key for admin operations

-- ============================================
-- INDEXES
-- ============================================

-- Companies
CREATE INDEX idx_companies_name ON public.companies(canonical_name);
CREATE INDEX idx_companies_domain ON public.companies(canonical_domain);
CREATE INDEX idx_companies_ai_tags ON public.companies USING GIN(ai_tags);
CREATE INDEX idx_companies_geo ON public.companies(hq_country);
CREATE INDEX idx_companies_stage ON public.companies(stage);
CREATE INDEX idx_companies_verification ON public.companies(verification_status);

-- Funds
CREATE INDEX idx_funds_name ON public.funds(canonical_name);
CREATE INDEX idx_funds_domain ON public.funds(canonical_domain);
CREATE INDEX idx_funds_type ON public.funds(firm_type);
CREATE INDEX idx_funds_geo ON public.funds(hq_country);

-- Investments
CREATE INDEX idx_investments_fund ON public.investments(fund_id);
CREATE INDEX idx_investments_company ON public.investments(company_id);
CREATE INDEX idx_investments_date ON public.investments(announced_date DESC);
CREATE INDEX idx_investments_stage ON public.investments(round_stage);
CREATE INDEX idx_investments_verification ON public.investments(verification_status);

-- Stories
CREATE INDEX idx_stories_date ON public.stories(event_date DESC);
CREATE INDEX idx_stories_publisher ON public.stories(publisher);
CREATE INDEX idx_stories_topics ON public.stories USING GIN(ai_topics);
CREATE INDEX idx_stories_geography ON public.stories(geography);
CREATE INDEX idx_stories_event_type ON public.stories(event_type);
CREATE INDEX idx_stories_verification ON public.stories(verification_label);

-- Story associations
CREATE INDEX idx_story_companies_company ON public.story_companies(company_id);
CREATE INDEX idx_story_investors_fund ON public.story_investors(fund_id);

-- Source connectors
CREATE INDEX idx_source_connectors_status ON public.source_connectors(status);
CREATE INDEX idx_source_connectors_cadence ON public.source_connectors(cadence);

-- Fetch logs
CREATE INDEX idx_fetch_logs_source ON public.source_fetch_logs(source_id);
CREATE INDEX idx_fetch_logs_fetched_at ON public.source_fetch_logs(fetched_at DESC);
CREATE INDEX idx_fetch_logs_status ON public.source_fetch_logs(status);

-- Source archive
CREATE INDEX idx_source_archive_source ON public.source_archive(source_id);
CREATE INDEX idx_source_archive_hash ON public.source_archive(content_hash);

-- Follows
CREATE INDEX idx_follows_user ON public.follows(user_id);
CREATE INDEX idx_follows_entity ON public.follows(entity_type, entity_id);

-- Alerts
CREATE INDEX idx_alert_rules_user ON public.alert_rules(user_id);
CREATE INDEX idx_alert_rules_entity ON public.alert_rules(entity_type, entity_id);
CREATE INDEX idx_alert_rules_active ON public.alert_rules(is_active) WHERE is_active = TRUE;

-- Notifications
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_status ON public.notifications(status);
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);

-- Discussion
CREATE INDEX idx_discussion_threads_entity ON public.discussion_threads(entity_type, entity_id);
CREATE INDEX idx_discussion_comments_thread ON public.discussion_comments(thread_id);
CREATE INDEX idx_discussion_comments_user ON public.discussion_comments(user_id);

-- User profiles trial expiry
CREATE INDEX idx_user_profiles_trial_expires 
ON public.user_profiles(trial_expires_at) WHERE trial_expires_at IS NOT NULL;

-- Funding rounds
CREATE INDEX idx_funding_rounds_company ON public.funding_rounds(company_id);
CREATE INDEX idx_funding_rounds_date ON public.funding_rounds(announced_date DESC);
CREATE INDEX idx_funding_rounds_stage ON public.funding_rounds(round_stage);
CREATE INDEX idx_funding_rounds_verification ON public.funding_rounds(verification_status);

-- Round participants
CREATE INDEX idx_round_participants_round ON public.round_participants(round_id);
CREATE INDEX idx_round_participants_fund ON public.round_participants(fund_id);
CREATE INDEX idx_round_participants_role ON public.round_participants(role);
CREATE INDEX idx_round_participants_verification ON public.round_participants(verification_status);

-- YC batches
CREATE INDEX idx_yc_batches_year_season ON public.yc_batches(year DESC, season DESC);
CREATE INDEX idx_yc_batch_companies_batch ON public.yc_batch_companies(batch_id);
CREATE INDEX idx_yc_batch_companies_company ON public.yc_batch_companies(company_id);
CREATE INDEX idx_yc_batch_companies_ai ON public.yc_batch_companies(is_ai_company) WHERE is_ai_company = TRUE;

-- Subscriptions
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_razorpay_order ON public.subscriptions(razorpay_order_id);
CREATE INDEX idx_subscriptions_razorpay_sub ON public.subscriptions(razorpay_subscription_id);

-- Invoices
CREATE INDEX idx_invoices_subscription ON public.invoices(subscription_id);
CREATE INDEX idx_invoices_user ON public.invoices(user_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_razorpay_invoice ON public.invoices(razorpay_invoice_id);

-- Billing events
CREATE INDEX idx_billing_events_user ON public.billing_events(user_id);
CREATE INDEX idx_billing_events_subscription ON public.billing_events(subscription_id);
CREATE INDEX idx_billing_events_type ON public.billing_events(event_type);
CREATE INDEX idx_billing_events_idempotency ON public.billing_events(idempotency_key);
CREATE INDEX idx_billing_events_razorpay_event ON public.billing_events(razorpay_event_id);

-- ============================================
-- BILLING TABLES RLS
-- ============================================

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own invoices" ON public.invoices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own billing events" ON public.billing_events
  FOR SELECT USING (auth.uid() = user_id);

-- Service role manages all (for webhooks)
-- Admin policies would be added separately

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN public.user_profiles.trial_expires_at IS 'Expiry timestamp for student trial (20 days from issuance)';
COMMENT ON COLUMN public.user_profiles.trial_issued_at IS 'Timestamp when student trial was granted (immutable after set)';
COMMENT ON COLUMN public.user_profiles.trial_eligibility_domain IS 'Email domain that qualified user for trial (e.g., mastersunion.org)';
COMMENT ON FUNCTION public.activate_student_trial() IS 'Atomic trial activation: verifies eligibility, prevents reissue, sets entitlement and audit in one transaction';
COMMENT ON FUNCTION public.has_full_access() IS 'Centralized expiry-aware access check: returns true only for active subscribed or non-expired student_trial';