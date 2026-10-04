-- Ventro Database Schema (Supabase Postgres)
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- AUTH & USERS
-- ============================================

-- User profiles (extends auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('founder', 'investor', 'analyst', 'student', 'other')),
  ai_topics TEXT[] DEFAULT '{}',
  geographies TEXT[] DEFAULT '{}',
  stages TEXT[] DEFAULT '{}',
  onboarding_completed_at TIMESTAMPTZ,
  entitlement TEXT DEFAULT 'preview' CHECK (entitlement IN ('preview', 'discount_card', 'subscribed')),
  discount_card_expires_at TIMESTAMPTZ,
  discount_card_issued_at TIMESTAMPTZ,
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
CREATE TABLE workspace_settings (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
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
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE TABLE company_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_type TEXT CHECK (alias_type IN ('former_name', 'acronym', 'common_misspelling', 'product_name')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Funds / Investment Firms
CREATE TABLE funds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE TABLE fund_vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vintage_year INTEGER,
  size_usd BIGINT,
  focus TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stated thesis excerpts (from official sources)
CREATE TABLE stated_thesis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT CHECK (source_type IN ('blog', 'interview', 'podcast', 'twitter', 'sec_filing', 'other')),
  date_stated TIMESTAMPTZ,
  extracted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Observed thesis (inferred from portfolio)
CREATE TABLE observed_thesis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
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
CREATE TABLE fund_portfolio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  first_investment_date TIMESTAMPTZ,
  latest_investment_date TIMESTAMPTZ,
  total_invested_usd BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fund_id, company_id)
);

-- Individual investments (round participation)
CREATE TABLE investments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  fund_vehicle_id UUID REFERENCES fund_vehicles(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE TABLE story_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('primary', 'mentioned')),
  UNIQUE(story_id, company_id)
);

-- Story-investor associations
CREATE TABLE story_investors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('lead', 'participant', 'mentioned')),
  UNIQUE(story_id, fund_id)
);

-- Story sources (original articles)
CREATE TABLE story_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
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
CREATE TABLE source_connectors (
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
CREATE TABLE source_fetch_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id TEXT NOT NULL REFERENCES source_connectors(source_id),
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
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  entity_type TEXT CHECK (entity_type IN ('fund', 'company')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entity_type, entity_id)
);

-- Saved items
CREATE TABLE saved_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  item_type TEXT CHECK (item_type IN ('story', 'company', 'fund', 'pattern')),
  item_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_type, item_id)
);

-- Private workspace notes
CREATE TABLE workspace_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  entity_type TEXT CHECK (entity_type IN ('company', 'fund', 'pattern')),
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entity_type, entity_id)
);

-- Alert rules
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
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
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  alert_rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
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

CREATE TABLE patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  created_by UUID REFERENCES user_profiles(id),
  reviewed_by UUID REFERENCES user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COMMUNITY
-- ============================================

CREATE TABLE discussion_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT CHECK (entity_type IN ('company', 'fund', 'pattern')),
  entity_id UUID NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE discussion_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES discussion_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES discussion_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_hidden BOOLEAN DEFAULT FALSE,
  hidden_reason TEXT,
  hidden_by UUID REFERENCES user_profiles(id),
  hidden_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADMIN & AUDIT
-- ============================================

CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES user_profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE entitlement_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  previous_entitlement TEXT,
  new_entitlement TEXT NOT NULL,
  source TEXT CHECK (source IN ('stripe_webhook', 'discount_card', 'admin', 'trial_expiry', 'manual')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_comments ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own data
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own workspace settings" ON workspace_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own workspace settings" ON workspace_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own follows" ON follows
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own saved items" ON saved_items
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own notes" ON workspace_notes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own alert rules" ON alert_rules
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can create comments" ON discussion_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON discussion_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view published comments" ON discussion_comments
  FOR SELECT USING (is_hidden = FALSE);

-- Public read access for entities (companies, funds, stories)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE stated_thesis ENABLE ROW LEVEL SECURITY;
ALTER TABLE observed_thesis ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;

-- Public profiles: basic info visible to all
CREATE POLICY "Public can view company profiles" ON companies
  FOR SELECT USING (true);

-- Public can view fund basic info
CREATE POLICY "Public can view fund profiles" ON funds
  FOR SELECT USING (true);

-- Public can view stories
CREATE POLICY "Public can view stories" ON stories
  FOR SELECT USING (true);

-- Stated thesis: public sees excerpts
CREATE POLICY "Public can view stated thesis excerpts" ON stated_thesis
  FOR SELECT USING (true);

-- Observed thesis: gated by entitlement (handled in API layer)
CREATE POLICY "Authenticated can view observed thesis" ON observed_thesis
  FOR SELECT USING (auth.role() = 'authenticated');

-- Investments: basic info public, full detail gated
CREATE POLICY "Public can view investments" ON investments
  FOR SELECT USING (true);

-- Patterns: only published visible
CREATE POLICY "Public can view published patterns" ON patterns
  FOR SELECT USING (status = 'published');

-- Admin policies (bypass RLS)
-- Note: Use service_role key for admin operations

-- ============================================
-- INDEXES
-- ============================================

-- Companies
CREATE INDEX idx_companies_name ON companies(canonical_name);
CREATE INDEX idx_companies_domain ON companies(canonical_domain);
CREATE INDEX idx_companies_ai_tags ON companies USING GIN(ai_tags);
CREATE INDEX idx_companies_geo ON companies(hq_country);
CREATE INDEX idx_companies_stage ON companies(stage);
CREATE INDEX idx_companies_verification ON companies(verification_status);

-- Funds
CREATE INDEX idx_funds_name ON funds(canonical_name);
CREATE INDEX idx_funds_domain ON funds(canonical_domain);
CREATE INDEX idx_funds_type ON funds(firm_type);
CREATE INDEX idx_funds_geo ON funds(hq_country);

-- Investments
CREATE INDEX idx_investments_fund ON investments(fund_id);
CREATE INDEX idx_investments_company ON investments(company_id);
CREATE INDEX idx_investments_date ON investments(announced_date DESC);
CREATE INDEX idx_investments_stage ON investments(round_stage);
CREATE INDEX idx_investments_verification ON investments(verification_status);

-- Stories
CREATE INDEX idx_stories_date ON stories(event_date DESC);
CREATE INDEX idx_stories_publisher ON stories(publisher);
CREATE INDEX idx_stories_topics ON stories USING GIN(ai_topics);
CREATE INDEX idx_stories_geography ON stories(geography);
CREATE INDEX idx_stories_event_type ON stories(event_type);
CREATE INDEX idx_stories_verification ON stories(verification_label);

-- Story associations
CREATE INDEX idx_story_companies_company ON story_companies(company_id);
CREATE INDEX idx_story_investors_fund ON story_investors(fund_id);

-- Source connectors
CREATE INDEX idx_source_connectors_status ON source_connectors(status);
CREATE INDEX idx_source_connectors_cadence ON source_connectors(cadence);

-- Fetch logs
CREATE INDEX idx_fetch_logs_source ON source_fetch_logs(source_id);
CREATE INDEX idx_fetch_logs_fetched_at ON source_fetch_logs(fetched_at DESC);
CREATE INDEX idx_fetch_logs_status ON source_fetch_logs(status);

-- Follows
CREATE INDEX idx_follows_user ON follows(user_id);
CREATE INDEX idx_follows_entity ON follows(entity_type, entity_id);

-- Alerts
CREATE INDEX idx_alert_rules_user ON alert_rules(user_id);
CREATE INDEX idx_alert_rules_entity ON alert_rules(entity_type, entity_id);
CREATE INDEX idx_alert_rules_active ON alert_rules(is_active) WHERE is_active = TRUE;

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Discussion
CREATE INDEX idx_discussion_threads_entity ON discussion_threads(entity_type, entity_id);
CREATE INDEX idx_discussion_comments_thread ON discussion_comments(thread_id);
CREATE INDEX idx_discussion_comments_user ON discussion_comments(user_id);

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

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workspace_settings_updated_at BEFORE UPDATE ON workspace_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_funds_updated_at BEFORE UPDATE ON funds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fund_vehicles_updated_at BEFORE UPDATE ON fund_vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON investments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stories_updated_at BEFORE UPDATE ON stories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_source_connectors_updated_at BEFORE UPDATE ON source_connectors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workspace_notes_updated_at BEFORE UPDATE ON workspace_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON alert_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patterns_updated_at BEFORE UPDATE ON patterns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_discussion_threads_updated_at BEFORE UPDATE ON discussion_threads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_discussion_comments_updated_at BEFORE UPDATE ON discussion_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if user has discount card access
CREATE OR REPLACE FUNCTION has_discount_card_access(user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  profile RECORD;
BEGIN
  SELECT entitlement, discount_card_expires_at INTO profile
  FROM user_profiles WHERE id = user_id;
  
  IF profile.entitlement = 'discount_card' AND profile.discount_card_expires_at > NOW() THEN
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

-- Check if user has full access (subscribed or valid discount card)
CREATE OR REPLACE FUNCTION has_full_access(user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  profile RECORD;
BEGIN
  SELECT entitlement, discount_card_expires_at INTO profile
  FROM user_profiles WHERE id = user_id;
  
  IF profile.entitlement = 'subscribed' THEN
    RETURN TRUE;
  END IF;
  
  IF profile.entitlement = 'discount_card' AND profile.discount_card_expires_at > NOW() THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- ============================================
-- SEED DATA (Run after tables created)
-- ============================================

-- Insert source connectors (run separately after review)
-- See phase0/01-source-rights-register.md for full list
