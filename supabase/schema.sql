-- Ventro Database Schema (Supabase Postgres)
-- This reflects the FINAL migrated state after all migrations including 20261006000001
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
  round_stage TEXT CHECK (round_stage IN ('pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'growth', 'public')),
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
  v_result JSONB;
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
  
  v_result := jsonb_build_object(
    'success', true,
    'code', 'TRIAL_ACTIVATED',
    'message', '20-day student trial activated',
    'entitlement', 'student_trial',
    'trial_expires_at', v_expires_at,
    'trial_issued_at', v_issued_at
  );
  
  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.activate_student_trial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_student_trial() TO authenticated;

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