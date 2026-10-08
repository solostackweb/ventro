-- Ventro Database Schema (Supabase Postgres)
-- This reflects the migrated state through 20261008020000 (Checkpoint 3, pending hosted push)
-- Run this in Supabase SQL Editor for fresh installs

-- UUID generation uses built-in gen_random_uuid() (pgcrypto)

-- ============================================
-- AUTH & USERS
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

-- Keep application profiles in sync with Supabase Auth. Without this trigger,
-- an auth user can complete the UI while every profile update affects zero rows.
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Repair auth users created before the trigger existed.
INSERT INTO public.user_profiles (id, email)
SELECT id, COALESCE(email, '')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

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
-- ENTITIES
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
  stage TEXT CHECK (stage IN ('pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'series_d', 'series_e', 'growth', 'public', 'ipo', 'acquisition', 'grant', 'debt', 'convertible', 'safe', 'other')),
  latest_round_date TIMESTAMPTZ,
  latest_round_amount_usd BIGINT,
  latest_round_stage TEXT CHECK (latest_round_stage IN ('pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'series_d', 'series_e', 'growth', 'public', 'ipo', 'acquisition', 'grant', 'debt', 'convertible', 'safe', 'other')),
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
  created_at TIMESTAMPTZ DEFAULT NOW()
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
  themes JSONB NOT NULL, -- [{"theme": "...", "company_count": N, "deal_count": N, "percentage": N}]
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
  company_name TEXT NOT NULL, -- denormalized for display
  announced_date TIMESTAMPTZ NOT NULL,
  round_stage TEXT CHECK (round_stage IN ('pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'series_d', 'series_e', 'growth', 'public', 'ipo', 'acquisition', 'grant', 'debt', 'convertible', 'safe', 'other')),
  amount_usd BIGINT,
  amount_currency TEXT DEFAULT 'USD',
  investor_role TEXT CHECK (investor_role IN ('lead', 'participant', 'undisclosed')),
  source_urls TEXT[] DEFAULT '{}',
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('verified', 'partial', 'unverified', 'conflicted')),
  conflicts JSONB, -- [{"field": "...", "source_a": "...", "source_b": "...", "values": [...]}]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NEWS & INTELLIGENCE
-- ============================================

-- News stories (deduplicated clusters)
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_url TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT,
  summary_kind TEXT NOT NULL DEFAULT 'none' CHECK (summary_kind IN ('none', 'source_excerpt', 'article_summary')),
  image_url TEXT,
  event_date TIMESTAMPTZ,
  publisher TEXT,
  source_count INTEGER DEFAULT 1,
  source_urls TEXT[] NOT NULL DEFAULT '{}',
  supporting_sources TEXT[] NOT NULL DEFAULT '{}',
  ai_topics TEXT[] DEFAULT '{}',
  geography TEXT CHECK (geography IN ('us', 'india', 'eu', 'israel', 'canada', 'uk', 'sea', 'global')),
  event_type TEXT CHECK (event_type IN ('funding', 'launch', 'partnership', 'research', 'acquisition', 'other')),
  verification_label TEXT DEFAULT 'unverified' CHECK (verification_label IN ('verified', 'partial', 'unverified', 'conflicted')),
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  supports_claims JSONB, -- [{"claim": "...", "evidence_span": {...}}]
  UNIQUE(story_id, source_url)
);

-- ============================================
-- SOURCE MANAGEMENT
-- ============================================

-- Source connectors registry
CREATE TABLE public.source_connectors (
  source_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('vc_blog', 'corporate', 'company_blog', 'news_aggregator', 'government', 'developer_platform', 'yc', 'search')),
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
  r2_key TEXT, -- Cloudflare R2 object key for raw archive
  latency_ms INTEGER
);

-- ============================================
-- USER INTERACTIONS
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
-- PATTERNS
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
  qualifying_events JSONB NOT NULL, -- array of events
  counterexamples JSONB, -- array of counterexamples
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
-- COMMUNITY
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
-- ADMIN & AUDIT
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

-- ============================================
-- BILLING (DEFERRED TO PHASE 7 - tables exist but payment endpoints disabled)
-- ============================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
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

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_order ON public.subscriptions(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_sub ON public.subscriptions(razorpay_subscription_id);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  razorpay_invoice_id TEXT,
  razorpay_payment_id TEXT,
  amount_usd INTEGER NOT NULL, -- in cents
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

CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON public.invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_razorpay_invoice ON public.invoices(razorpay_invoice_id);

CREATE TABLE IF NOT EXISTS public.billing_events (
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

CREATE INDEX IF NOT EXISTS idx_billing_events_user ON public.billing_events(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_subscription ON public.billing_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_type ON public.billing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_events_idempotency ON public.billing_events(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_billing_events_razorpay_event ON public.billing_events(razorpay_event_id);

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

-- Public profiles: basic info visible to all
CREATE POLICY "Public can view company profiles" ON public.companies
  FOR SELECT USING (true);

-- Public can view fund basic info
CREATE POLICY "Public can view fund profiles" ON public.funds
  FOR SELECT USING (true);

-- Public can view stories
CREATE POLICY "Public can view stories" ON public.stories
  FOR SELECT USING (true);

-- Stated thesis: public sees excerpts
CREATE POLICY "Public can view stated thesis excerpts" ON public.stated_thesis
  FOR SELECT USING (true);

-- Observed thesis: gated by entitlement (handled in API layer via has_full_access)
CREATE POLICY "Authenticated can view observed thesis" ON public.observed_thesis
  FOR SELECT USING (auth.role() = 'authenticated');

-- Investments: basic info public, full detail gated
CREATE POLICY "Public can view investments" ON public.investments
  FOR SELECT USING (true);

-- Patterns: only published visible
CREATE POLICY "Public can view published patterns" ON public.patterns
  FOR SELECT USING (status = 'published');

-- Admin policies (bypass RLS)
-- Note: Use service_role key for admin operations

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
CREATE INDEX IF NOT EXISTS idx_user_profiles_trial_expires 
ON public.user_profiles(trial_expires_at) WHERE trial_expires_at IS NOT NULL;

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

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

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

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
  v_issued_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  
  IF v_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'EMAIL_NOT_FOUND',
      'message', 'User email not found'
    );
  END IF;
  
  v_domain := lower(split_part(v_email, '@', 2));
  IF v_domain <> 'mastersunion.org' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INELIGIBLE_DOMAIN',
      'message', 'Only verified @mastersunion.org emails are eligible for the student trial'
    );
  END IF;
  
  IF (SELECT email_confirmed_at FROM auth.users WHERE id = v_user_id) IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'EMAIL_UNCONFIRMED',
      'message', 'Email must be confirmed before activating trial'
    );
  END IF;
  
  SELECT entitlement, trial_issued_at, trial_expires_at, trial_eligibility_domain
  INTO v_profile
  FROM public.user_profiles
  WHERE id = v_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'PROFILE_MISSING',
      'message', 'User profile not found. Please contact support.'
    );
  END IF;
  
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
  
  IF v_profile.trial_issued_at IS NOT NULL THEN
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
  
  IF v_profile.entitlement = 'student_trial' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'TRIAL_ALREADY_ACTIVE',
      'message', 'Trial already active'
    );
  END IF;
  
  v_issued_at := NOW();
  v_expires_at := NOW() + INTERVAL '20 days';
  
  UPDATE public.user_profiles
  SET entitlement = 'student_trial',
      trial_issued_at = v_issued_at,
      trial_expires_at = v_expires_at,
      trial_eligibility_domain = 'mastersunion.org',
      updated_at = v_issued_at
  WHERE id = v_user_id;
  
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

-- Server-managed admin membership and immutable review audit trail.
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

-- Authenticated admin-only review transition with an atomic audit event.
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
  v_old_status TEXT;
  v_urls TEXT[] := ARRAY[]::TEXT[];
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

    SELECT COALESCE(ARRAY_AGG(VALUE), ARRAY[]::TEXT[]) INTO v_urls
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

    SELECT COALESCE(ARRAY_AGG(VALUE), ARRAY[]::TEXT[]) INTO v_urls
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

-- Revoke table-level UPDATE from authenticated
REVOKE UPDATE ON public.user_profiles FROM authenticated;

-- Grant UPDATE only on explicitly allowed profile columns
GRANT UPDATE (role, ai_topics, geographies, stages, onboarding_completed_at) 
ON public.user_profiles TO authenticated;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN public.user_profiles.trial_expires_at IS 'Expiry timestamp for student trial (20 days from issuance)';
COMMENT ON COLUMN public.user_profiles.trial_issued_at IS 'Timestamp when student trial was granted (immutable after set)';
COMMENT ON COLUMN public.user_profiles.trial_eligibility_domain IS 'Email domain that qualified user for trial (e.g., mastersunion.org)';
COMMENT ON FUNCTION public.activate_student_trial() IS 'Atomic trial activation: verifies eligibility, prevents reissue, sets entitlement and audit in one transaction';
COMMENT ON FUNCTION public.has_full_access() IS 'Centralized expiry-aware access check: returns true only for active subscribed or non-expired student_trial';

-- ============================================
-- EVIDENCE FOUNDATION (Checkpoint 1)
-- ============================================

-- Model run kind enum
CREATE TYPE public.model_run_kind AS ENUM (
  'embedding',
  'extraction',
  'resolution',
  'verification',
  'clustering',
  'other'
);

-- Model runs table
CREATE TABLE public.model_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_kind public.model_run_kind NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'timeout')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_model_runs_kind ON public.model_runs(run_kind);
CREATE INDEX idx_model_runs_provider_model ON public.model_runs(provider, model);
CREATE INDEX idx_model_runs_created_at ON public.model_runs(created_at DESC);
CREATE INDEX idx_model_runs_cost ON public.model_runs(cost_usd);

-- Source documents table
CREATE TABLE public.source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL REFERENCES public.source_connectors(source_id),
  url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  r2_key TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, url)
);

CREATE INDEX idx_source_documents_source ON public.source_documents(source_id);
CREATE INDEX idx_source_documents_hash ON public.source_documents(content_hash);
CREATE INDEX idx_source_documents_fetched ON public.source_documents(fetched_at DESC);

-- Document versions table
CREATE TABLE public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id UUID NOT NULL REFERENCES public.source_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  content_hash TEXT NOT NULL,
  content_text TEXT,
  r2_key TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_document_id, version_number)
);

CREATE INDEX idx_document_versions_source_doc ON public.document_versions(source_document_id);
CREATE INDEX idx_document_versions_hash ON public.document_versions(content_hash);

-- Source archive table (raw content storage)
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
  document_version_id UUID REFERENCES public.document_versions(id),
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, content_hash)
);

CREATE INDEX idx_source_archive_source ON public.source_archive(source_id);
CREATE INDEX idx_source_archive_version ON public.source_archive(document_version_id);
CREATE INDEX idx_source_archive_unprocessed ON public.source_archive(fetched_at, id) WHERE processed = FALSE;

-- Claims table
CREATE TABLE public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('funding_round', 'round_participant', 'company', 'fund', 'thesis', 'pattern')),
  subject_id UUID NOT NULL,
  claim_type TEXT NOT NULL,
  predicate TEXT NOT NULL,
  value_json JSONB NOT NULL,
  extraction_confidence NUMERIC,
  resolution_confidence NUMERIC,
  publication_status TEXT NOT NULL DEFAULT 'candidate' CHECK (publication_status IN ('candidate', 'published', 'rejected', 'superseded')),
  publication_reason TEXT,
  superseded_by_claim_id UUID REFERENCES public.claims(id),
  evidence_spans JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claims_subject ON public.claims(subject_type, subject_id);
CREATE INDEX idx_claims_type ON public.claims(claim_type);
CREATE INDEX idx_claims_publication ON public.claims(publication_status);
CREATE INDEX idx_claims_extraction_conf ON public.claims(extraction_confidence);
CREATE INDEX idx_claims_resolution_conf ON public.claims(resolution_confidence);
CREATE INDEX idx_claims_superseded ON public.claims(superseded_by_claim_id);

-- Resolution decisions table
CREATE TABLE public.resolution_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_text TEXT NOT NULL,
  normalized_input TEXT NOT NULL,
  target_entity_type TEXT NOT NULL CHECK (target_entity_type IN ('company', 'fund', 'person')),
  resolved_entity_id UUID,
  method TEXT NOT NULL CHECK (method IN ('deterministic', 'llm', 'human', 'hybrid')),
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  evidence_claim_id UUID REFERENCES public.claims(id),
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'rejected', 'pending')),
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (input_text, target_entity_type, resolved_entity_id)
);

CREATE INDEX idx_resolution_decisions_input ON public.resolution_decisions(normalized_input);
CREATE INDEX idx_resolution_decisions_entity ON public.resolution_decisions(target_entity_type, resolved_entity_id);
CREATE INDEX idx_resolution_decisions_claim ON public.resolution_decisions(evidence_claim_id);

-- Claim bindings table
CREATE TABLE public.claim_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN ('funding_round', 'round_participant', 'company', 'fund', 'thesis', 'pattern')),
  record_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE (claim_id, record_type, record_id, field_name)
);

CREATE INDEX idx_claim_bindings_claim ON public.claim_bindings(claim_id);
CREATE INDEX idx_claim_bindings_record ON public.claim_bindings(record_type, record_id);

-- Publication status enum (if not exists)
DO $$ BEGIN
  CREATE TYPE public.publication_status AS ENUM (
    'candidate',
    'published',
    'rejected',
    'superseded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Claim type enum (if not exists)
DO $$ BEGIN
  CREATE TYPE public.claim_type AS ENUM (
    'investor_participation',
    'funding_amount',
    'valuation',
    'round_stage',
    'company_name',
    'fund_name',
    'thesis_theme',
    'pattern_theme',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Triggers for updated_at on evidence tables
CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grants for evidence tables
GRANT ALL ON public.model_runs TO service_role;
GRANT ALL ON public.source_documents TO service_role;
GRANT ALL ON public.document_versions TO service_role;
GRANT ALL ON public.source_archive TO service_role;
GRANT ALL ON public.claims TO service_role;
GRANT ALL ON public.resolution_decisions TO service_role;
GRANT ALL ON public.claim_bindings TO service_role;

-- RLS for evidence tables (service-role only)
ALTER TABLE public.model_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resolution_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_bindings ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated/anon - evidence is service-role only
-- Migration: Pipeline Orchestration (Checkpoint 2)
-- Date: 2026-10-07
-- Description: Durable pipeline orchestration with leases, retries, idempotency, and replay
-- Depends on: 20261007020808 (Checkpoint 1 lint fixes)

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE public.pipeline_type AS ENUM (
  'news_ingestion',
  'funding_extraction',
  'thesis_extraction',
  'pattern_detection',
  'full_refresh'
);

CREATE TYPE public.pipeline_trigger AS ENUM (
  'scheduled',
  'manual',
  'webhook',
  'retry'
);

CREATE TYPE public.pipeline_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'partial',
  'cancelled'
);

CREATE TYPE public.stage_name AS ENUM (
  'discover',
  'fetch',
  'archive',
  'normalize',
  'extract',
  'resolve',
  'verify',
  'publish'
);

CREATE TYPE public.stage_status AS ENUM (
  'pending',
  'leased',
  'running',
  'completed',
  'retry_wait',
  'failed',
  'dead_letter',
  'skipped'
);

CREATE TYPE public.retryability AS ENUM (
  'retryable',
  'non_retryable'
);

-- ============================================
-- PIPELINE_RUNS TABLE
-- ============================================

CREATE TABLE public.pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_type public.pipeline_type NOT NULL,
  trigger public.pipeline_trigger NOT NULL DEFAULT 'scheduled',
  status public.pipeline_status NOT NULL DEFAULT 'pending',
  parameters JSONB NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_items BIGINT NOT NULL DEFAULT 0,
  completed_items BIGINT NOT NULL DEFAULT 0,
  failed_items BIGINT NOT NULL DEFAULT 0,
  total_latency_ms BIGINT NOT NULL DEFAULT 0,
  failure_summary JSONB,
  crash_budget INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idempotency_key)
);

CREATE INDEX idx_pipeline_runs_type_status ON public.pipeline_runs(pipeline_type, status);
CREATE INDEX idx_pipeline_runs_requested_at ON public.pipeline_runs(requested_at DESC);
CREATE INDEX idx_pipeline_runs_heartbeat ON public.pipeline_runs(heartbeat_at) WHERE status = 'running';
CREATE INDEX idx_pipeline_runs_stale ON public.pipeline_runs(id, heartbeat_at) WHERE status = 'running';

-- ============================================
-- STAGE_ATTEMPTS TABLE
-- ============================================

CREATE TABLE public.stage_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id UUID NOT NULL REFERENCES public.pipeline_runs(id) ON DELETE CASCADE,
  stage_name public.stage_name NOT NULL,
  status public.stage_status NOT NULL DEFAULT 'pending',
  attempt_number INTEGER NOT NULL DEFAULT 1,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  idempotency_key TEXT NOT NULL,
  lease_owner TEXT,
  lease_token TEXT,
  leased_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  retry_after TIMESTAMPTZ,
  input_ref JSONB NOT NULL DEFAULT '{}',
  output_ref JSONB,
  model_run_id UUID REFERENCES public.model_runs(id),
  error_code TEXT,
  error_message TEXT,
  error_metadata JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  latency_ms BIGINT,
  items_processed BIGINT NOT NULL DEFAULT 0,
  items_succeeded BIGINT NOT NULL DEFAULT 0,
  items_failed BIGINT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  crash_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pipeline_run_id, stage_name, idempotency_key)
);

-- Indexes for lease acquisition and queue polling (no NOW() in predicates)
CREATE INDEX idx_stage_attempts_run_stage ON public.stage_attempts(pipeline_run_id, stage_name);
CREATE INDEX idx_stage_attempts_lease_acquire ON public.stage_attempts(status, retry_after, lease_expires_at, pipeline_run_id)
  WHERE status IN ('pending', 'retry_wait', 'leased');
CREATE INDEX idx_stage_attempts_expired_lease ON public.stage_attempts(id, lease_expires_at)
  WHERE status = 'leased';
CREATE INDEX idx_stage_attempts_retry_ready ON public.stage_attempts(id, retry_after)
  WHERE status = 'retry_wait';
CREATE INDEX idx_stage_attempts_dead_letter ON public.stage_attempts(pipeline_run_id, stage_name)
  WHERE status = 'dead_letter';

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_pipeline_runs_updated_at
  BEFORE UPDATE ON public.pipeline_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stage_attempts_updated_at
  BEFORE UPDATE ON public.stage_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SERVICE-ROLE ONLY ORCHESTRATION FUNCTIONS
-- ============================================

-- create_or_get_pipeline_run: Creates a new run or returns existing one by idempotency_key
CREATE OR REPLACE FUNCTION public.create_or_get_pipeline_run(
  p_pipeline_type public.pipeline_type,
  p_trigger public.pipeline_trigger,
  p_idempotency_key TEXT,
  p_parameters JSONB DEFAULT '{}'
)
RETURNS TABLE (
  run_id UUID,
  is_new BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run_id UUID;
  v_is_new BOOLEAN := FALSE;
BEGIN
  INSERT INTO public.pipeline_runs (pipeline_type, trigger, idempotency_key, parameters, status, requested_at)
  VALUES (p_pipeline_type, p_trigger, p_idempotency_key, p_parameters, 'pending', NOW())
  ON CONFLICT (idempotency_key) DO UPDATE SET
    trigger = CASE WHEN EXCLUDED.trigger = 'retry' THEN 'retry' ELSE public.pipeline_runs.trigger END,
    parameters = EXCLUDED.parameters,
    updated_at = NOW()
  RETURNING id, (xmax = 0) INTO v_run_id, v_is_new;

  IF NOT v_is_new AND p_trigger = 'retry' THEN
    UPDATE public.pipeline_runs
    SET status = 'pending',
        started_at = NULL,
        heartbeat_at = NULL,
        completed_at = NULL,
        failure_summary = NULL,
        updated_at = NOW()
    WHERE id = v_run_id
      AND status IN ('completed', 'failed', 'partial', 'cancelled');
  END IF;

  RETURN QUERY SELECT v_run_id, v_is_new;
END;
$$;

REVOKE ALL ON FUNCTION public.create_or_get_pipeline_run(public.pipeline_type, public.pipeline_trigger, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_or_get_pipeline_run(public.pipeline_type, public.pipeline_trigger, TEXT, JSONB) TO service_role;

-- enqueue_stage_attempt: Creates or gets a stage attempt with idempotency
-- Atomic concurrency-safe idempotency: INSERT ... ON CONFLICT DO NOTHING followed by SELECT of the canonical row.
-- Re-enqueue of same terminal key returns existing attempt UNCHANGED (no mutation of input_ref, model_run_id, max_attempts, counters, audit).
-- Only replay_dead_letter creates new work from terminal state.
CREATE OR REPLACE FUNCTION public.enqueue_stage_attempt(
  p_pipeline_run_id UUID,
  p_stage_name public.stage_name,
  p_idempotency_key TEXT,
  p_input_ref JSONB DEFAULT '{}',
  p_max_attempts INTEGER DEFAULT 3,
  p_model_run_id UUID DEFAULT NULL
)
RETURNS TABLE (
  attempt_id UUID,
  is_new BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_attempt_id UUID;
  v_is_new BOOLEAN := FALSE;
  v_run_status public.pipeline_status;
BEGIN
  SELECT status INTO v_run_status
  FROM public.pipeline_runs
  WHERE id = p_pipeline_run_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pipeline run not found: %', p_pipeline_run_id USING ERRCODE = 'P0001';
  END IF;

  IF v_run_status IN ('completed', 'failed', 'partial', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot enqueue stage for terminal pipeline run: %', v_run_status USING ERRCODE = '55000';
  END IF;

  -- Atomic upsert: try to insert, on conflict do nothing and select existing
  INSERT INTO public.stage_attempts (
    pipeline_run_id, stage_name, idempotency_key, input_ref,
    max_attempts, model_run_id, status
  ) VALUES (
    p_pipeline_run_id, p_stage_name, p_idempotency_key, p_input_ref,
    p_max_attempts, p_model_run_id, 'pending'
  )
  ON CONFLICT (pipeline_run_id, stage_name, idempotency_key) DO NOTHING
  RETURNING id, TRUE INTO v_attempt_id, v_is_new;

  IF v_is_new THEN
    RETURN QUERY SELECT v_attempt_id, TRUE;
  ELSE
    -- Conflict occurred, select the existing row unchanged
    RETURN QUERY SELECT id, FALSE FROM public.stage_attempts
    WHERE pipeline_run_id = p_pipeline_run_id
      AND stage_name = p_stage_name
      AND idempotency_key = p_idempotency_key;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_stage_attempt(UUID, public.stage_name, TEXT, JSONB, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_stage_attempt(UUID, public.stage_name, TEXT, JSONB, INTEGER, UUID) TO service_role;

-- acquire_stage_lease: Claims a pending/retry_wait/expired attempt for processing
-- Returns zero rows (not a null row) when no work available.
-- Requires p_pipeline_run_id to scope to a specific run; omit for global queue polling.
-- Crash budget is a run-wide gate: each expired-lease recovery atomically decrements it.
-- When exhausted, the recovered attempt is dead-lettered without returning a lease.
CREATE OR REPLACE FUNCTION public.acquire_stage_lease(
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 300,
  p_allowed_stage_names public.stage_name[] DEFAULT NULL,
  p_pipeline_run_id UUID DEFAULT NULL
)
RETURNS TABLE (
  attempt_id UUID,
  pipeline_run_id UUID,
  stage_name public.stage_name,
  idempotency_key TEXT,
  attempt_number INTEGER,
  input_ref JSONB,
  max_attempts INTEGER,
  model_run_id UUID,
  lease_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lease_token TEXT := replace(gen_random_uuid()::TEXT, '-', '') || replace(gen_random_uuid()::TEXT, '-', '');
  v_now TIMESTAMPTZ := NOW();
  v_lease_expires_at TIMESTAMPTZ := v_now + (p_lease_seconds || ' seconds')::INTERVAL;
  v_attempt RECORD;
  v_new_crash_count INTEGER;
  v_crash_budget INTEGER;
BEGIN
  SELECT sa.id, sa.pipeline_run_id, sa.stage_name, sa.idempotency_key,
         sa.attempt_number, sa.input_ref, sa.max_attempts, sa.model_run_id,
         sa.status, sa.lease_expires_at, sa.crash_count, sa.started_at
  INTO v_attempt
  FROM public.stage_attempts sa
  JOIN public.pipeline_runs pr ON pr.id = sa.pipeline_run_id
  WHERE sa.status IN ('pending', 'retry_wait', 'leased')
    AND (sa.retry_after IS NULL OR sa.retry_after <= v_now)
    AND (sa.status <> 'leased' OR sa.lease_expires_at <= v_now)
    AND pr.status IN ('pending', 'running')
    AND (p_allowed_stage_names IS NULL OR sa.stage_name = ANY(p_allowed_stage_names))
    AND (p_pipeline_run_id IS NULL OR sa.pipeline_run_id = p_pipeline_run_id)
    AND sa.attempt_number <= sa.max_attempts
  ORDER BY
    CASE sa.status WHEN 'pending' THEN 0 WHEN 'retry_wait' THEN 1 WHEN 'leased' THEN 2 END,
    sa.created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Compute new crash_count if this is an expired lease recovery
  v_new_crash_count := v_attempt.crash_count;
  IF v_attempt.status = 'leased' AND v_attempt.lease_expires_at <= v_now THEN
    v_new_crash_count := v_attempt.crash_count + 1;
  END IF;

  -- Atomically check and decrement crash_budget for expired lease recoveries
  IF v_attempt.status = 'leased' AND v_attempt.lease_expires_at <= v_now THEN
    UPDATE public.pipeline_runs
    SET crash_budget = GREATEST(0, crash_budget - 1),
        updated_at = v_now
    WHERE id = v_attempt.pipeline_run_id
      AND crash_budget > 0
    RETURNING crash_budget INTO v_crash_budget;

    -- If crash_budget exhausted (was 0 or decremented to 0), dead-letter without lease
    IF v_crash_budget IS NULL OR v_crash_budget <= 0 THEN
      UPDATE public.stage_attempts
      SET status = 'dead_letter',
          error_code = 'RUN_CRASH_BUDGET_EXHAUSTED',
          error_message = 'Pipeline run crash budget exhausted on lease recovery',
          error_metadata = jsonb_build_object('crash_count', v_new_crash_count, 'crash_budget', 0),
          completed_at = v_now,
          lease_owner = NULL,
          lease_token = NULL,
          leased_at = NULL,
          lease_expires_at = NULL,
          heartbeat_at = NULL,
          crash_count = v_new_crash_count,
          updated_at = v_now
      WHERE id = v_attempt.id;
      RETURN;
    END IF;
  END IF;

  -- Also enforce per-attempt crash threshold (3)
  -- Dead-letter without consuming run crash_budget (already consumed for expiry recovery above)
  IF v_new_crash_count >= 3 THEN
    UPDATE public.stage_attempts
    SET status = 'dead_letter',
        error_code = 'CRASH_BUDGET_EXCEEDED',
        error_message = 'Lease expired too many times (crash budget exceeded)',
        error_metadata = jsonb_build_object('crash_count', v_new_crash_count, 'threshold', 3),
        completed_at = v_now,
        lease_owner = NULL,
        lease_token = NULL,
        leased_at = NULL,
        lease_expires_at = NULL,
        heartbeat_at = NULL,
        crash_count = v_new_crash_count,
        updated_at = v_now
    WHERE id = v_attempt.id;

    RETURN;
  END IF;

  UPDATE public.stage_attempts
  SET status = 'leased',
      lease_owner = p_worker_id,
      lease_token = v_lease_token,
      leased_at = v_now,
      lease_expires_at = v_lease_expires_at,
      heartbeat_at = v_now,
      started_at = COALESCE(v_attempt.started_at, v_now),
      crash_count = v_new_crash_count,
      updated_at = v_now
  WHERE id = v_attempt.id;

  UPDATE public.pipeline_runs
  SET status = 'running',
      started_at = COALESCE(started_at, v_now),
      heartbeat_at = v_now,
      updated_at = v_now
  WHERE id = v_attempt.pipeline_run_id
    AND status = 'pending';

  RETURN QUERY SELECT
    v_attempt.id,
    v_attempt.pipeline_run_id,
    v_attempt.stage_name,
    v_attempt.idempotency_key,
    v_attempt.attempt_number,
    v_attempt.input_ref,
    v_attempt.max_attempts,
    v_attempt.model_run_id,
    v_lease_token;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_stage_lease(TEXT, INTEGER, public.stage_name[], UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_stage_lease(TEXT, INTEGER, public.stage_name[], UUID) TO service_role;

-- heartbeat_stage_lease: Extends lease TTL for long-running work
-- Returns FALSE if lease expired or token invalid; does not emit error.
CREATE OR REPLACE FUNCTION public.heartbeat_stage_lease(
  p_attempt_id UUID,
  p_lease_token TEXT,
  p_lease_seconds INTEGER DEFAULT 300
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_lease_expires_at TIMESTAMPTZ := v_now + (p_lease_seconds || ' seconds')::INTERVAL;
  v_updated INTEGER;
BEGIN
  UPDATE public.stage_attempts
  SET heartbeat_at = v_now,
      lease_expires_at = v_lease_expires_at,
      updated_at = v_now
  WHERE id = p_attempt_id
    AND lease_token = p_lease_token
    AND status = 'leased'
    AND lease_expires_at > v_now;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    UPDATE public.pipeline_runs
    SET heartbeat_at = v_now,
        updated_at = v_now
    WHERE id IN (SELECT pipeline_run_id FROM public.stage_attempts WHERE id = p_attempt_id)
      AND status = 'running';
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.heartbeat_stage_lease(UUID, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.heartbeat_stage_lease(UUID, TEXT, INTEGER) TO service_role;

-- complete_stage_attempt: Marks attempt as completed with output and counters
-- Uses explicit TIMESTAMPTZ variable for started_at; computes latency_ms with numeric cast.
CREATE OR REPLACE FUNCTION public.complete_stage_attempt(
  p_attempt_id UUID,
  p_lease_token TEXT,
  p_output_ref JSONB,
  p_items_processed BIGINT DEFAULT 0,
  p_items_succeeded BIGINT DEFAULT 0,
  p_items_failed BIGINT DEFAULT 0,
  p_cost_usd NUMERIC DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_started_at TIMESTAMPTZ;
  v_latency_ms BIGINT;
  v_pipeline_run_id UUID;
  v_updated INTEGER;
BEGIN
  SELECT pipeline_run_id, started_at INTO v_pipeline_run_id, v_started_at
  FROM public.stage_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found: %', p_attempt_id USING ERRCODE = 'P0001';
  END IF;

  v_latency_ms := EXTRACT(EPOCH FROM (v_now - v_started_at)) * 1000;

  UPDATE public.stage_attempts
  SET status = 'completed',
      output_ref = p_output_ref,
      items_processed = p_items_processed,
      items_succeeded = p_items_succeeded,
      items_failed = p_items_failed,
      cost_usd = p_cost_usd,
      completed_at = v_now,
      latency_ms = v_latency_ms,
      lease_owner = NULL,
      lease_token = NULL,
      lease_expires_at = NULL,
      heartbeat_at = NULL,
      updated_at = v_now
  WHERE id = p_attempt_id
    AND lease_token = p_lease_token
    AND status = 'leased';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.pipeline_runs
  SET total_items = total_items + p_items_processed,
      completed_items = completed_items + p_items_succeeded,
      failed_items = failed_items + p_items_failed,
      total_latency_ms = total_latency_ms + v_latency_ms,
      heartbeat_at = v_now,
      updated_at = v_now
  WHERE id = v_pipeline_run_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_stage_attempt(UUID, TEXT, JSONB, BIGINT, BIGINT, BIGINT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_stage_attempt(UUID, TEXT, JSONB, BIGINT, BIGINT, BIGINT, NUMERIC) TO service_role;

-- fail_stage_attempt: Marks attempt as failed with error info and schedules retry or dead_letter
-- Retry increments attempt_number ON FAILURE SCHEDULING (not on reacquisition).
-- Bounded exponential backoff: ~1, 5, 15 minutes. After max_attempts -> dead_letter.
CREATE OR REPLACE FUNCTION public.fail_stage_attempt(
  p_attempt_id UUID,
  p_lease_token TEXT,
  p_error_code TEXT,
  p_error_message TEXT,
  p_retryability public.retryability DEFAULT 'retryable',
  p_error_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE (
  attempt_id UUID,
  next_status public.stage_status,
  retry_after TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_attempt RECORD;
  v_next_status public.stage_status;
  v_retry_after TIMESTAMPTZ;
  v_backoff_minutes INTEGER;
BEGIN
  SELECT pipeline_run_id, attempt_number, max_attempts, started_at
  INTO v_attempt
  FROM public.stage_attempts
  WHERE id = p_attempt_id
    AND lease_token = p_lease_token
    AND status = 'leased'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found or invalid lease: %', p_attempt_id USING ERRCODE = 'P0001';
  END IF;

  IF p_retryability = 'non_retryable' OR v_attempt.attempt_number >= v_attempt.max_attempts THEN
    v_next_status := 'dead_letter';
    v_retry_after := NULL;
  ELSE
    v_next_status := 'retry_wait';
    v_backoff_minutes := CASE v_attempt.attempt_number
      WHEN 1 THEN 1
      WHEN 2 THEN 5
      ELSE 15
    END;
    v_retry_after := v_now + (v_backoff_minutes || ' minutes')::INTERVAL;
  END IF;

  UPDATE public.stage_attempts
  SET status = v_next_status,
      error_code = p_error_code,
      error_message = p_error_message,
      error_metadata = p_error_metadata,
      retry_after = v_retry_after,
      completed_at = CASE WHEN v_next_status = 'dead_letter' THEN v_now ELSE NULL END,
      latency_ms = EXTRACT(EPOCH FROM (v_now - v_attempt.started_at)) * 1000,
      lease_owner = NULL,
      lease_token = NULL,
      lease_expires_at = NULL,
      heartbeat_at = NULL,
      attempt_number = v_attempt.attempt_number + 1,
      updated_at = v_now
  WHERE id = p_attempt_id;

  IF v_next_status = 'dead_letter' THEN
    UPDATE public.pipeline_runs
    SET failed_items = failed_items + 1,
        updated_at = v_now
    WHERE id = v_attempt.pipeline_run_id;
  END IF;

  RETURN QUERY SELECT p_attempt_id, v_next_status, v_retry_after;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_stage_attempt(UUID, TEXT, TEXT, TEXT, public.retryability, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_stage_attempt(UUID, TEXT, TEXT, TEXT, public.retryability, JSONB) TO service_role;

-- replay_dead_letter: Creates a new auditable attempt from a dead-lettered item
-- New attempt has attempt_number = 1 (bounded), fresh leaseable status, replayed_from metadata.
-- Original dead letter preserved with replayed_to link.
-- If parent run is terminal (completed/failed/partial/cancelled), reopen it to 'running':
-- status running, completed_at NULL, failure_summary NULL, heartbeat refreshed, original dead letter retained.
CREATE OR REPLACE FUNCTION public.replay_dead_letter(
  p_attempt_id UUID,
  p_reason TEXT
)
RETURNS TABLE (
  new_attempt_id UUID,
  old_attempt_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_attempt RECORD;
  v_new_attempt_id UUID;
BEGIN
  SELECT sa.pipeline_run_id, sa.stage_name, sa.idempotency_key, sa.input_ref, sa.max_attempts, sa.model_run_id,
         pr.status
  INTO v_old_attempt
  FROM public.stage_attempts sa
  JOIN public.pipeline_runs pr ON pr.id = sa.pipeline_run_id
  WHERE sa.id = p_attempt_id
    AND sa.status = 'dead_letter'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dead letter attempt not found: %', p_attempt_id USING ERRCODE = 'P0001';
  END IF;

  -- If parent run is terminal, reopen it to running
  IF v_old_attempt.status IN ('completed', 'failed', 'partial', 'cancelled') THEN
    UPDATE public.pipeline_runs
    SET status = 'running',
        started_at = COALESCE(started_at, NOW()),
        heartbeat_at = NOW(),
        completed_at = NULL,
        failure_summary = NULL,
        updated_at = NOW()
    WHERE id = v_old_attempt.pipeline_run_id;
  END IF;

  INSERT INTO public.stage_attempts (
    pipeline_run_id, stage_name, idempotency_key, input_ref,
    max_attempts, model_run_id, attempt_number, status,
    error_metadata
  ) VALUES (
    v_old_attempt.pipeline_run_id,
    v_old_attempt.stage_name,
    v_old_attempt.idempotency_key || ':replay:' || gen_random_uuid()::TEXT,
    v_old_attempt.input_ref,
    v_old_attempt.max_attempts,
    v_old_attempt.model_run_id,
    1,
    'pending',
    jsonb_build_object('replayed_from', p_attempt_id, 'reason', p_reason, 'replayed_at', NOW())
  )
  RETURNING id INTO v_new_attempt_id;

  UPDATE public.stage_attempts
  SET error_metadata = error_metadata || jsonb_build_object('replayed_to', v_new_attempt_id, 'replay_reason', p_reason),
      updated_at = NOW()
  WHERE id = p_attempt_id;

  RETURN QUERY SELECT v_new_attempt_id, p_attempt_id;
END;
$$;

REVOKE ALL ON FUNCTION public.replay_dead_letter(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replay_dead_letter(UUID, TEXT) TO service_role;

-- finalize_pipeline_run: Marks pipeline run as completed/partial/failed based on stage outcomes
CREATE OR REPLACE FUNCTION public.finalize_pipeline_run(
  p_run_id UUID,
  p_status public.pipeline_status DEFAULT 'completed',
  p_failure_summary JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pending_stages INTEGER;
  v_failed_stages INTEGER;
BEGIN
  PERFORM 1
  FROM public.pipeline_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pipeline run not found: %', p_run_id USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) FILTER (WHERE status NOT IN ('completed', 'skipped', 'dead_letter')) INTO v_pending_stages
  FROM public.stage_attempts
  WHERE pipeline_run_id = p_run_id;

  SELECT COUNT(*) FILTER (WHERE status = 'dead_letter') INTO v_failed_stages
  FROM public.stage_attempts
  WHERE pipeline_run_id = p_run_id;

  IF p_status = 'completed' THEN
    IF v_failed_stages > 0 AND v_pending_stages = 0 THEN
      p_status := 'partial';
    ELSIF v_failed_stages > 0 OR v_pending_stages > 0 THEN
      p_status := 'failed';
    END IF;
  END IF;

  UPDATE public.pipeline_runs
  SET status = p_status,
      completed_at = NOW(),
      failure_summary = COALESCE(p_failure_summary,
        CASE WHEN v_failed_stages > 0 THEN jsonb_build_object(
          'failed_stages', v_failed_stages,
          'message', 'Some stages ended in dead_letter'
        ) ELSE NULL END),
      updated_at = NOW()
  WHERE id = p_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_pipeline_run(UUID, public.pipeline_status, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_pipeline_run(UUID, public.pipeline_status, JSONB) TO service_role;

-- ============================================
-- DIAGNOSTIC READ FUNCTIONS (service-role only)
-- ============================================

-- Get recent pipeline runs with statuses
CREATE OR REPLACE FUNCTION public.get_recent_pipeline_runs(
  p_limit INTEGER DEFAULT 50,
  p_pipeline_type public.pipeline_type DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  pipeline_type public.pipeline_type,
  trigger public.pipeline_trigger,
  status public.pipeline_status,
  requested_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_items BIGINT,
  completed_items BIGINT,
  failed_items BIGINT,
  total_latency_ms BIGINT,
  failure_summary JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT pr.id, pr.pipeline_type, pr.trigger, pr.status,
         pr.requested_at, pr.started_at, pr.completed_at,
         pr.total_items, pr.completed_items, pr.failed_items,
         pr.total_latency_ms, pr.failure_summary
  FROM public.pipeline_runs pr
  WHERE p_pipeline_type IS NULL OR pr.pipeline_type = p_pipeline_type
  ORDER BY pr.requested_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_recent_pipeline_runs(INTEGER, public.pipeline_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recent_pipeline_runs(INTEGER, public.pipeline_type) TO service_role;

-- Get stage waterfall for a pipeline run
CREATE OR REPLACE FUNCTION public.get_pipeline_run_stages(p_run_id UUID)
RETURNS TABLE (
  id UUID,
  stage_name public.stage_name,
  status public.stage_status,
  attempt_number INTEGER,
  max_attempts INTEGER,
  idempotency_key TEXT,
  lease_owner TEXT,
  leased_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  retry_after TIMESTAMPTZ,
  input_ref JSONB,
  output_ref JSONB,
  model_run_id UUID,
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  latency_ms BIGINT,
  items_processed BIGINT,
  items_succeeded BIGINT,
  items_failed BIGINT,
  cost_usd NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT sa.id, sa.stage_name, sa.status, sa.attempt_number, sa.max_attempts,
         sa.idempotency_key, sa.lease_owner, sa.leased_at, sa.lease_expires_at,
         sa.retry_after, sa.input_ref, sa.output_ref, sa.model_run_id,
         sa.error_code, sa.error_message, sa.started_at, sa.completed_at,
         sa.latency_ms, sa.items_processed, sa.items_succeeded, sa.items_failed,
         sa.cost_usd
  FROM public.stage_attempts sa
  WHERE sa.pipeline_run_id = p_run_id
  ORDER BY
    CASE sa.stage_name
      WHEN 'discover' THEN 1
      WHEN 'fetch' THEN 2
      WHEN 'archive' THEN 3
      WHEN 'normalize' THEN 4
      WHEN 'extract' THEN 5
      WHEN 'resolve' THEN 6
      WHEN 'verify' THEN 7
      WHEN 'publish' THEN 8
      ELSE 99
    END,
    sa.attempt_number;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pipeline_run_stages(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pipeline_run_stages(UUID) TO service_role;

-- Get pending/retry/dead-letter counts by pipeline type
CREATE OR REPLACE FUNCTION public.get_pipeline_queue_counts()
RETURNS TABLE (
  pipeline_type public.pipeline_type,
  pending_count BIGINT,
  running_count BIGINT,
  retry_wait_count BIGINT,
  dead_letter_count BIGINT,
  expired_lease_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT pr.pipeline_type,
         COUNT(*) FILTER (WHERE sa.status = 'pending') AS pending_count,
         COUNT(*) FILTER (WHERE sa.status = 'running' OR (sa.status = 'leased' AND sa.lease_expires_at > NOW())) AS running_count,
         COUNT(*) FILTER (WHERE sa.status = 'retry_wait') AS retry_wait_count,
         COUNT(*) FILTER (WHERE sa.status = 'dead_letter') AS dead_letter_count,
         COUNT(*) FILTER (WHERE sa.status = 'leased' AND sa.lease_expires_at <= NOW()) AS expired_lease_count
  FROM public.pipeline_runs pr
  JOIN public.stage_attempts sa ON sa.pipeline_run_id = pr.id
  WHERE pr.status IN ('pending', 'running')
  GROUP BY pr.pipeline_type;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pipeline_queue_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pipeline_queue_counts() TO service_role;

-- Get stale leases (for monitoring/alerting)
CREATE OR REPLACE FUNCTION public.get_stale_leases(p_threshold_minutes INTEGER DEFAULT 10)
RETURNS TABLE (
  attempt_id UUID,
  pipeline_run_id UUID,
  stage_name public.stage_name,
  lease_owner TEXT,
  leased_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  minutes_stale INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT sa.id, sa.pipeline_run_id, sa.stage_name, sa.lease_owner,
         sa.leased_at, sa.lease_expires_at,
         FLOOR(EXTRACT(EPOCH FROM (NOW() - sa.lease_expires_at)) / 60)::INTEGER AS minutes_stale
  FROM public.stage_attempts sa
  WHERE sa.status = 'leased'
    AND sa.lease_expires_at <= NOW()
    AND sa.lease_expires_at <= NOW() - (p_threshold_minutes || ' minutes')::INTERVAL
  ORDER BY sa.lease_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_stale_leases(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stale_leases(INTEGER) TO service_role;

-- Get source health: aggregates 24h logs independently from latest log row
CREATE OR REPLACE FUNCTION public.get_source_health(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  source_id TEXT,
  name TEXT,
  status TEXT,
  last_fetch_at TIMESTAMPTZ,
  last_fetch_status TEXT,
  consecutive_failures BIGINT,
  items_fetched_24h BIGINT,
  items_new_24h BIGINT,
  unique_yield_24h NUMERIC,
  health_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.source_id,
    sc.name,
    sc.status,
    latest_log.fetched_at AS last_fetch_at,
    latest_log.status AS last_fetch_status,
    COALESCE((
      SELECT COUNT(*)
      FROM public.source_fetch_logs sfl2
      WHERE sfl2.source_id = sc.source_id
        AND sfl2.status = 'error'
        AND sfl2.fetched_at > (
          SELECT COALESCE(MAX(sfl3.fetched_at), '1970-01-01'::TIMESTAMPTZ)
          FROM public.source_fetch_logs sfl3
          WHERE sfl3.source_id = sc.source_id AND sfl3.status = 'success'
        )
    ), 0) AS consecutive_failures,
    COALESCE(SUM(sfl.items_found) FILTER (WHERE sfl.fetched_at > NOW() - INTERVAL '24 hours'), 0) AS items_fetched_24h,
    COALESCE(SUM(sfl.items_new) FILTER (WHERE sfl.fetched_at > NOW() - INTERVAL '24 hours'), 0) AS items_new_24h,
    CASE WHEN SUM(sfl.items_found) FILTER (WHERE sfl.fetched_at > NOW() - INTERVAL '24 hours') > 0
      THEN SUM(sfl.items_new) FILTER (WHERE sfl.fetched_at > NOW() - INTERVAL '24 hours')::NUMERIC /
           SUM(sfl.items_found) FILTER (WHERE sfl.fetched_at > NOW() - INTERVAL '24 hours')
      ELSE 0 END AS unique_yield_24h,
    CASE
      WHEN sc.status = 'approved' THEN
        LEAST(100, 50 + COALESCE(SUM(sfl.items_new) FILTER (WHERE sfl.fetched_at > NOW() - INTERVAL '24 hours'), 0) * 2)::NUMERIC
      ELSE 0::NUMERIC
    END AS health_score
  FROM public.source_connectors sc
  LEFT JOIN LATERAL (
    SELECT latest_sfl.fetched_at, latest_sfl.status
    FROM public.source_fetch_logs latest_sfl
    WHERE latest_sfl.source_id = sc.source_id
    ORDER BY latest_sfl.fetched_at DESC
    LIMIT 1
  ) latest_log ON TRUE
  LEFT JOIN public.source_fetch_logs sfl ON sfl.source_id = sc.source_id
  GROUP BY sc.source_id, sc.name, sc.status, latest_log.fetched_at, latest_log.status
  ORDER BY health_score DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_source_health(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_source_health(INTEGER) TO service_role;

-- Get model run metrics
CREATE OR REPLACE FUNCTION public.get_model_run_metrics(
  p_since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
  p_run_kind public.model_run_kind DEFAULT NULL
)
RETURNS TABLE (
  run_kind public.model_run_kind,
  provider TEXT,
  model TEXT,
  runs_count BIGINT,
  total_tokens_input BIGINT,
  total_tokens_output BIGINT,
  total_latency_ms BIGINT,
  total_cost_usd NUMERIC,
  avg_latency_ms NUMERIC,
  success_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT mr.run_kind, mr.provider, mr.model,
         COUNT(*) AS runs_count,
         SUM(mr.tokens_input) AS total_tokens_input,
         SUM(mr.tokens_output) AS total_tokens_output,
         SUM(mr.latency_ms) AS total_latency_ms,
         SUM(mr.cost_usd) AS total_cost_usd,
         AVG(mr.latency_ms)::NUMERIC AS avg_latency_ms,
         COUNT(*) FILTER (WHERE mr.status = 'success')::NUMERIC / COUNT(*) AS success_rate
  FROM public.model_runs mr
  WHERE mr.started_at >= p_since
    AND (p_run_kind IS NULL OR mr.run_kind = p_run_kind)
  GROUP BY mr.run_kind, mr.provider, mr.model
  ORDER BY total_cost_usd DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_model_run_metrics(TIMESTAMPTZ, public.model_run_kind) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_model_run_metrics(TIMESTAMPTZ, public.model_run_kind) TO service_role;

-- Get publication stats
CREATE OR REPLACE FUNCTION public.get_publication_stats(
  p_since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS TABLE (
  publication_status public.publication_status,
  claim_type public.claim_type,
  count BIGINT,
  avg_extraction_confidence NUMERIC,
  avg_resolution_confidence NUMERIC,
  top_rejection_reasons JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT c.publication_status, c.claim_type,
         COUNT(*) AS count,
         AVG(c.extraction_confidence) AS avg_extraction_confidence,
         AVG(c.resolution_confidence) AS avg_resolution_confidence,
         jsonb_agg(DISTINCT c.publication_reason) FILTER (WHERE c.publication_reason IS NOT NULL) AS top_rejection_reasons
  FROM public.claims c
  WHERE c.created_at >= p_since
  GROUP BY c.publication_status, c.claim_type
  ORDER BY c.publication_status, c.claim_type;
END;
$$;

REVOKE ALL ON FUNCTION public.get_publication_stats(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_publication_stats(TIMESTAMPTZ) TO service_role;

-- ============================================
-- RLS POLICIES (service-role only; no authenticated grants)
-- ============================================

ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_attempts ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.pipeline_runs TO service_role;
GRANT ALL ON public.stage_attempts TO service_role;

-- No policies for authenticated/anon - orchestration is service-role only

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.pipeline_runs IS 'Durable pipeline execution records with idempotent scheduling';
COMMENT ON TABLE public.stage_attempts IS 'Individual stage attempts within a pipeline run with lease-based concurrency control';

COMMENT ON COLUMN public.pipeline_runs.idempotency_key IS 'Deterministic key for idempotent scheduling: pipeline_type:trigger:scope:content_hash:schema_version';
COMMENT ON COLUMN public.stage_attempts.idempotency_key IS 'Deterministic key for idempotent stage execution: pipeline_type:stage:source/input:content_hash:schema_version';
COMMENT ON COLUMN public.stage_attempts.lease_token IS 'Unguessable token proving lease ownership (not just worker name)';
COMMENT ON COLUMN public.stage_attempts.error_metadata IS 'Structured error metadata. NEVER store secrets, raw provider responses, or prohibited source text.';
COMMENT ON FUNCTION public.acquire_stage_lease IS 'Claims work using SELECT FOR UPDATE SKIP LOCKED with unguessable lease token. Default 5-min TTL. Scope to pipeline_run_id when processing a specific run.';
COMMENT ON FUNCTION public.fail_stage_attempt IS 'Handles retry with bounded exponential backoff (1, 5, 15 min). Increments attempt_number on failure scheduling. After max attempts -> dead_letter.';
COMMENT ON FUNCTION public.replay_dead_letter IS 'Creates auditable new attempt with attempt_number=1, preserving history. Does not delete original dead letter.';

-- ============================================
-- CHECKPOINT 3: ANSWER INTELLIGENCE CONTRACTS
-- ============================================
-- Checkpoint 3: versioned, evidence-backed answer intelligence contracts.
-- This migration is additive and must be pushed only after 20261008010000.

CREATE TYPE public.answer_kind AS ENUM ('investing_now', 'market_demand');
CREATE TYPE public.answer_snapshot_status AS ENUM ('computing', 'published', 'stale', 'failed', 'superseded');
CREATE TYPE public.intelligence_confidence_label AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.thesis_record_kind AS ENUM ('stated', 'observed');
CREATE TYPE public.thesis_record_status AS ENUM ('candidate', 'published', 'corrected', 'retired', 'rejected');
CREATE TYPE public.answer_citation_stance AS ENUM ('supports', 'contradicts', 'context');

CREATE TABLE public.thesis_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  thesis_kind public.thesis_record_kind NOT NULL,
  status public.thesis_record_status NOT NULL DEFAULT 'candidate',
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  methodology_version TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0 CHECK (sample_size >= 0),
  covered_investment_count INTEGER NOT NULL DEFAULT 0 CHECK (covered_investment_count >= 0),
  coverage_ratio NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (coverage_ratio BETWEEN 0 AND 1),
  confidence_score NUMERIC(5,4) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
  confidence_label public.intelligence_confidence_label NOT NULL,
  themes JSONB NOT NULL DEFAULT '[]'::JSONB,
  summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  caveats JSONB NOT NULL DEFAULT '[]'::JSONB,
  counter_evidence JSONB NOT NULL DEFAULT '[]'::JSONB,
  model_run_id UUID REFERENCES public.model_runs(id) ON DELETE SET NULL,
  supersedes_id UUID REFERENCES public.thesis_records(id) ON DELETE SET NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fund_id, thesis_kind, input_fingerprint),
  CHECK (
    (thesis_kind = 'stated' AND sample_size = 0)
    OR
    (thesis_kind = 'observed' AND period_start IS NOT NULL AND period_end IS NOT NULL AND period_end > period_start)
  )
);

CREATE TABLE public.thesis_record_claims (
  thesis_record_id UUID NOT NULL REFERENCES public.thesis_records(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE RESTRICT,
  claim_evidence_id UUID NOT NULL REFERENCES public.claim_evidence(id) ON DELETE RESTRICT,
  stance public.answer_citation_stance NOT NULL DEFAULT 'supports',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thesis_record_id, claim_id, claim_evidence_id, stance)
);

ALTER TABLE public.patterns
  ADD COLUMN IF NOT EXISTS pattern_type TEXT,
  ADD COLUMN IF NOT EXISTS filter_dimensions JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS baseline_window_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS baseline_window_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sample_size INTEGER,
  ADD COLUMN IF NOT EXISTS qualifying_claim_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS independent_source_count INTEGER,
  ADD COLUMN IF NOT EXISTS coverage_metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS sensitivity JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS methodology_version TEXT,
  ADD COLUMN IF NOT EXISTS input_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS publication_reason TEXT;

CREATE TABLE public.pattern_citations (
  pattern_id UUID NOT NULL REFERENCES public.patterns(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE RESTRICT,
  claim_evidence_id UUID NOT NULL REFERENCES public.claim_evidence(id) ON DELETE RESTRICT,
  stance public.answer_citation_stance NOT NULL DEFAULT 'supports',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pattern_id, claim_id, claim_evidence_id, stance)
);

CREATE TABLE public.answer_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_kind public.answer_kind NOT NULL,
  status public.answer_snapshot_status NOT NULL DEFAULT 'computing',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  data_cutoff_at TIMESTAMPTZ NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stale_after TIMESTAMPTZ NOT NULL,
  domains TEXT[] NOT NULL DEFAULT '{}',
  geographies TEXT[] NOT NULL DEFAULT '{}',
  stages TEXT[] NOT NULL DEFAULT '{}',
  fund_id UUID REFERENCES public.funds(id) ON DELETE SET NULL,
  yc_batch_id TEXT REFERENCES public.yc_batches(id) ON DELETE SET NULL,
  normalized_filters JSONB NOT NULL,
  filter_fingerprint TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  methodology_version TEXT NOT NULL,
  narration_model_run_id UUID REFERENCES public.model_runs(id) ON DELETE SET NULL,
  summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  disclosed_amount_usd BIGINT NOT NULL DEFAULT 0 CHECK (disclosed_amount_usd >= 0),
  disclosed_round_count INTEGER NOT NULL DEFAULT 0 CHECK (disclosed_round_count >= 0),
  undisclosed_round_count INTEGER NOT NULL DEFAULT 0 CHECK (undisclosed_round_count >= 0),
  company_count INTEGER NOT NULL DEFAULT 0 CHECK (company_count >= 0),
  fund_count INTEGER NOT NULL DEFAULT 0 CHECK (fund_count >= 0),
  round_count INTEGER NOT NULL DEFAULT 0 CHECK (round_count >= 0),
  thesis_count INTEGER NOT NULL DEFAULT 0 CHECK (thesis_count >= 0),
  pattern_count INTEGER NOT NULL DEFAULT 0 CHECK (pattern_count >= 0),
  coverage_metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
  confidence_score NUMERIC(5,4) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
  confidence_label public.intelligence_confidence_label NOT NULL,
  caveats JSONB NOT NULL DEFAULT '[]'::JSONB,
  counter_evidence JSONB NOT NULL DEFAULT '[]'::JSONB,
  supersedes_id UUID REFERENCES public.answer_snapshots(id) ON DELETE SET NULL,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (answer_kind, input_fingerprint),
  CHECK (period_end > period_start),
  CHECK (stale_after > computed_at),
  CHECK (disclosed_round_count + undisclosed_round_count <= round_count)
);

CREATE TABLE public.answer_snapshot_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES public.answer_snapshots(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  material BOOLEAN NOT NULL DEFAULT TRUE,
  narrative TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
  why_this JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (snapshot_id, section_key),
  UNIQUE (snapshot_id, position)
);

CREATE TABLE public.answer_snapshot_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES public.answer_snapshots(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.answer_snapshot_sections(id) ON DELETE CASCADE,
  stance public.answer_citation_stance NOT NULL DEFAULT 'supports',
  label TEXT,
  claim_id UUID REFERENCES public.claims(id) ON DELETE RESTRICT,
  claim_binding_id UUID REFERENCES public.claim_bindings(id) ON DELETE RESTRICT,
  claim_evidence_id UUID REFERENCES public.claim_evidence(id) ON DELETE RESTRICT,
  funding_round_id UUID REFERENCES public.funding_rounds(id) ON DELETE RESTRICT,
  round_participant_id UUID REFERENCES public.round_participants(id) ON DELETE RESTRICT,
  thesis_record_id UUID REFERENCES public.thesis_records(id) ON DELETE RESTRICT,
  pattern_id UUID REFERENCES public.patterns(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(claim_id, claim_binding_id, claim_evidence_id, funding_round_id, round_participant_id, thesis_record_id, pattern_id) >= 1)
);

CREATE INDEX answer_snapshots_latest_idx ON public.answer_snapshots (answer_kind, filter_fingerprint, computed_at DESC) WHERE status = 'published';
CREATE INDEX answer_snapshots_freshness_idx ON public.answer_snapshots (stale_after) WHERE status = 'published';
CREATE INDEX answer_snapshot_sections_snapshot_idx ON public.answer_snapshot_sections (snapshot_id, position);
CREATE INDEX answer_snapshot_citations_snapshot_idx ON public.answer_snapshot_citations (snapshot_id, section_id);
CREATE INDEX answer_snapshot_citations_claim_idx ON public.answer_snapshot_citations (claim_id) WHERE claim_id IS NOT NULL;
CREATE INDEX thesis_records_latest_idx ON public.thesis_records (fund_id, thesis_kind, computed_at DESC) WHERE status = 'published';
ALTER TABLE public.patterns ADD CONSTRAINT patterns_input_fingerprint_key UNIQUE (input_fingerprint);

CREATE TRIGGER update_answer_snapshots_updated_at
  BEFORE UPDATE ON public.answer_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.thesis_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thesis_record_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pattern_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_snapshot_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_snapshot_citations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.persist_answer_snapshot(p_snapshot JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_snapshot_id UUID;
  v_previous_id UUID;
  v_section_id UUID;
  v_section JSONB;
  v_citation JSONB;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_snapshot->>'input_fingerprint', 0));
  SELECT s.id INTO v_snapshot_id
  FROM public.answer_snapshots s
  WHERE s.answer_kind = (p_snapshot->>'answer_kind')::public.answer_kind
    AND s.input_fingerprint = p_snapshot->>'input_fingerprint';

  IF v_snapshot_id IS NOT NULL THEN
    RETURN v_snapshot_id;
  END IF;

  SELECT s.id INTO v_previous_id
  FROM public.answer_snapshots s
  WHERE s.answer_kind = (p_snapshot->>'answer_kind')::public.answer_kind
    AND s.filter_fingerprint = p_snapshot->>'filter_fingerprint'
    AND s.status = 'published'
  ORDER BY s.computed_at DESC
  LIMIT 1
  FOR UPDATE;

  INSERT INTO public.answer_snapshots (
    answer_kind, status, period_start, period_end, data_cutoff_at, computed_at, stale_after,
    domains, geographies, stages, fund_id, yc_batch_id, normalized_filters,
    filter_fingerprint, input_fingerprint, schema_version, methodology_version,
    summary, disclosed_amount_usd, disclosed_round_count, undisclosed_round_count,
    company_count, fund_count, round_count, thesis_count, pattern_count,
    coverage_metrics, confidence_score, confidence_label, caveats, counter_evidence, supersedes_id
  ) VALUES (
    (p_snapshot->>'answer_kind')::public.answer_kind, 'computing',
    (p_snapshot->>'period_start')::TIMESTAMPTZ, (p_snapshot->>'period_end')::TIMESTAMPTZ,
    (p_snapshot->>'data_cutoff_at')::TIMESTAMPTZ, (p_snapshot->>'computed_at')::TIMESTAMPTZ,
    (p_snapshot->>'stale_after')::TIMESTAMPTZ,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_snapshot->'domains', '[]'::JSONB))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_snapshot->'geographies', '[]'::JSONB))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_snapshot->'stages', '[]'::JSONB))),
    NULLIF(p_snapshot->>'fund_id', '')::UUID, NULLIF(p_snapshot->>'yc_batch_id', ''),
    p_snapshot->'normalized_filters', p_snapshot->>'filter_fingerprint', p_snapshot->>'input_fingerprint',
    p_snapshot->>'schema_version', p_snapshot->>'methodology_version', p_snapshot->'summary',
    COALESCE((p_snapshot->>'disclosed_amount_usd')::BIGINT, 0),
    COALESCE((p_snapshot->>'disclosed_round_count')::INTEGER, 0),
    COALESCE((p_snapshot->>'undisclosed_round_count')::INTEGER, 0),
    COALESCE((p_snapshot->>'company_count')::INTEGER, 0),
    COALESCE((p_snapshot->>'fund_count')::INTEGER, 0),
    COALESCE((p_snapshot->>'round_count')::INTEGER, 0),
    COALESCE((p_snapshot->>'thesis_count')::INTEGER, 0),
    COALESCE((p_snapshot->>'pattern_count')::INTEGER, 0),
    p_snapshot->'coverage_metrics', (p_snapshot->>'confidence_score')::NUMERIC,
    (p_snapshot->>'confidence_label')::public.intelligence_confidence_label,
    COALESCE(p_snapshot->'caveats', '[]'::JSONB), COALESCE(p_snapshot->'counter_evidence', '[]'::JSONB),
    v_previous_id
  ) RETURNING id INTO v_snapshot_id;

  FOR v_section IN SELECT value FROM jsonb_array_elements(COALESCE(p_snapshot->'sections', '[]'::JSONB))
  LOOP
    INSERT INTO public.answer_snapshot_sections (
      snapshot_id, section_key, title, position, material, narrative, metrics, why_this
    ) VALUES (
      v_snapshot_id, v_section->>'section_key', v_section->>'title',
      (v_section->>'position')::INTEGER, COALESCE((v_section->>'material')::BOOLEAN, TRUE),
      v_section->>'narrative', COALESCE(v_section->'metrics', '{}'::JSONB),
      COALESCE(v_section->'why_this', '{}'::JSONB)
    ) RETURNING id INTO v_section_id;

    FOR v_citation IN SELECT value FROM jsonb_array_elements(COALESCE(v_section->'citations', '[]'::JSONB))
    LOOP
      INSERT INTO public.answer_snapshot_citations (
        snapshot_id, section_id, stance, label, claim_id, claim_binding_id, claim_evidence_id,
        funding_round_id, round_participant_id, thesis_record_id, pattern_id
      ) VALUES (
        v_snapshot_id, v_section_id,
        COALESCE((v_citation->>'stance')::public.answer_citation_stance, 'supports'),
        v_citation->>'label', NULLIF(v_citation->>'claim_id', '')::UUID,
        NULLIF(v_citation->>'claim_binding_id', '')::UUID,
        NULLIF(v_citation->>'claim_evidence_id', '')::UUID,
        NULLIF(v_citation->>'funding_round_id', '')::UUID,
        NULLIF(v_citation->>'round_participant_id', '')::UUID,
        NULLIF(v_citation->>'thesis_record_id', '')::UUID,
        NULLIF(v_citation->>'pattern_id', '')::UUID
      );
    END LOOP;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.answer_snapshot_sections s
    WHERE s.snapshot_id = v_snapshot_id AND s.material
      AND NOT EXISTS (SELECT 1 FROM public.answer_snapshot_citations c WHERE c.section_id = s.id)
  ) THEN
    RAISE EXCEPTION 'Every material answer section requires at least one normalized citation';
  END IF;

  IF v_previous_id IS NOT NULL THEN
    UPDATE public.answer_snapshots SET status = 'superseded' WHERE id = v_previous_id;
  END IF;
  UPDATE public.answer_snapshots SET status = 'published' WHERE id = v_snapshot_id;
  RETURN v_snapshot_id;
END;
$$;

REVOKE ALL ON FUNCTION public.persist_answer_snapshot(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_answer_snapshot(JSONB) TO service_role;

REVOKE ALL ON public.thesis_records, public.thesis_record_claims, public.pattern_citations,
  public.answer_snapshots, public.answer_snapshot_sections, public.answer_snapshot_citations
  FROM anon, authenticated;
GRANT ALL ON public.thesis_records, public.thesis_record_claims, public.pattern_citations,
  public.answer_snapshots, public.answer_snapshot_sections, public.answer_snapshot_citations
  TO service_role;

COMMENT ON TABLE public.answer_snapshots IS 'Immutable historical answers to Ventro core questions; new inputs create a superseding snapshot.';
COMMENT ON COLUMN public.answer_snapshots.disclosed_amount_usd IS 'Sum of disclosed amounts only. Undisclosed rounds are counted separately and never represented as zero.';
COMMENT ON TABLE public.thesis_records IS 'Versioned stated and observed thesis records. thesis_kind must remain visible to every consumer.';
COMMENT ON TABLE public.answer_snapshot_citations IS 'Normalized citations to evidence-spine and intelligence records; free-form URLs are intentionally excluded.';
