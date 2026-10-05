export type Entitlement = 'preview' | 'discount_card' | 'subscribed';

export type UserRole = 'founder' | 'investor' | 'analyst' | 'student' | 'other';

export type AITheme =
  | 'foundation_models'
  | 'infrastructure'
  | 'applications'
  | 'robotics'
  | 'hardware'
  | 'research'
  | 'other';

export type Geography = 'us' | 'india' | 'eu' | 'israel' | 'canada' | 'uk' | 'sea' | 'global';

export type Stage = 'pre_seed' | 'seed' | 'series_a' | 'series_b' | 'series_c' | 'series_d' | 'series_e' | 'growth' | 'public' | 'ipo' | 'acquisition' | 'grant' | 'debt' | 'convertible' | 'safe' | 'other';

export type VerificationStatus = 'verified' | 'partial' | 'unverified' | 'conflicted';

export type SourceMethod = 'rss' | 'api' | 'html' | 'sitemap' | 'search';

export type ReusePermission = 'full_text' | 'summary_only' | 'metadata_only' | 'link_only' | 'unknown';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole | null;
  ai_topics: AITheme[];
  geographies: Geography[];
  stages: Stage[];
  onboarding_completed_at: string | null;
  entitlement: Entitlement;
  discount_card_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceSettings {
  user_id: string;
  feed_ranking_weights: FeedRankingWeights;
  alert_frequency: 'instant' | 'daily' | 'weekly';
  alert_channels: ('email' | 'in_app')[];
  created_at: string;
  updated_at: string;
}

export interface FeedRankingWeights {
  follow_fund: number;
  follow_company: number;
  topic_match: number;
  geography_match: number;
  stage_match: number;
}

export interface Follow {
  id: string;
  user_id: string;
  entity_type: 'fund' | 'company';
  entity_id: string;
  created_at: string;
}

export interface SavedItem {
  id: string;
  user_id: string;
  item_type: 'story' | 'company' | 'fund' | 'pattern';
  item_id: string;
  created_at: string;
}

export interface WorkspaceNote {
  id: string;
  user_id: string;
  entity_type: 'company' | 'fund' | 'pattern';
  entity_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface AlertRule {
  id: string;
  user_id: string;
  entity_type: 'fund' | 'company';
  entity_id: string;
  trigger: 'new_funding_round' | 'new_portfolio_company' | 'thesis_update' | 'pattern_published' | 'any_announcement';
  frequency: 'instant' | 'daily' | 'weekly';
  channels: ('email' | 'in_app')[];
  topic_filter: AITheme[];
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  canonical_name: string;
  canonical_domain: string | null;
  short_description: string | null;
  ai_tags: AITheme[];
  hq_city: string | null;
  hq_country: string | null;
  stage: Stage | null;
  latest_round_date: string | null;
  latest_round_amount_usd: number | null;
  latest_round_stage: Stage | null;
  lead_investors: string[] | null;
  yc_batch: string | null;
  source_links: string[];
  last_verified_at: string;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface Fund {
  id: string;
  canonical_name: string;
  canonical_domain: string | null;
  firm_type: 'vc_firm' | 'corporate' | 'angel' | 'government';
  hq_city: string | null;
  hq_country: string | null;
  fund_vehicles: FundVehicle[];
  stated_thesis_excerpts: ThesisExcerpt[];
  portfolio_companies: string[];
  recent_investments: Investment[];
  ai_focus_areas: AITheme[];
  typical_stages: Stage[];
  typical_geographies: Geography[];
  source_coverage: SourceCoverage[];
  source_links: string[];
  last_verified_at: string;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
  fund_portfolio?: {
    company_id: string;
    first_investment_date: string | null;
    latest_investment_date: string | null;
    total_invested_usd: number | null;
    companies?: {
      id: string;
      canonical_name: string;
      canonical_domain: string | null;
      ai_tags: string[];
      hq_city: string | null;
      hq_country: string | null;
      stage: string | null;
      latest_round_date: string | null;
      latest_round_amount_usd: number | null;
    } | null;
  }[];
  stated_thesis?: {
    id: string;
    text: string;
    source_url: string;
    source_type: string;
    date_stated: string;
    extracted_at: string;
  }[];
  observed_thesis?: {
    id: string;
    methodology: string;
    period_start: string;
    period_end: string;
    sample_size: number;
    themes: {
      theme: string;
      company_count: number;
      deal_count: number;
      percentage: number;
    }[];
    confidence: 'high' | 'medium' | 'low';
    caveats: string | null;
    last_computed: string;
  } | null;
  investments?: {
    id: string;
    company_id: string;
    company_name: string;
    announced_date: string;
    round_stage: string | null;
    amount_usd: number | null;
    investor_role: string | null;
    source_urls: string[];
    verification_status: string;
  }[];
}

export interface FundVehicle {
  id: string;
  fund_id: string;
  name: string;
  vintage_year: number | null;
  size_usd: number | null;
  focus: string | null;
}

export interface ThesisExcerpt {
  id: string;
  fund_id: string;
  text: string;
  source_url: string;
  source_type: 'blog' | 'interview' | 'podcast' | 'twitter' | 'sec_filing' | 'other';
  date_stated: string;
  extracted_at: string;
}

export interface ObservedThesis {
  id: string;
  fund_id: string;
  methodology: string;
  period_start: string;
  period_end: string;
  sample_size: number;
  themes: ObservedTheme[];
  confidence: 'high' | 'medium' | 'low';
  caveats: string | null;
  last_computed: string;
}

export interface ObservedTheme {
  theme: string;
  company_count: number;
  deal_count: number;
  percentage: number;
}

export interface Investment {
  id: string;
  round_id?: string;
  fund_id: string;
  fund_vehicle_id: string | null;
  company_id: string;
  company_name: string;
  announced_date: string;
  round_stage: Stage | null;
  amount_usd: number | null;
  amount_currency: string;
  investor_role: 'lead' | 'co_lead' | 'participant' | 'mentioned' | 'undisclosed';
  source_urls: string[];
  verification_status: VerificationStatus;
  conflicts: RoundConflict[];
  created_at?: string;
  updated_at?: string;
  companies?: {
    id: string;
    canonical_name: string;
    canonical_domain: string | null;
    ai_tags: AITheme[];
    hq_city: string | null;
    hq_country: string | null;
    stage: Stage | null;
    yc_batch: string | null;
  } | null;
  funds?: {
    id: string;
    canonical_name: string;
    canonical_domain: string | null;
    firm_type: string;
    hq_city: string | null;
    hq_country: string | null;
  } | null;
  fund_vehicles?: {
    id: string;
    name: string;
    vintage_year: number | null;
    size_usd: number | null;
    focus: string | null;
  } | null;
}

export interface SourceCoverage {
  source_id: string;
  last_fetched_at: string;
  fetch_success_rate: number;
  unique_yield: number;
}

export interface Story {
  id: string;
  canonical_url: string;
  content_hash: string;
  headline: string;
  summary: string;
  summary_kind: 'none' | 'source_excerpt' | 'article_summary';
  image_url: string | null;
  event_date: string | null;
  publisher: string;
  source_count: number;
  companies: StoryCompany[];
  investors: StoryInvestor[];
  ai_topics: AITheme[];
  geography: Geography | null;
  event_type: 'funding' | 'launch' | 'partnership' | 'research' | 'acquisition' | 'other';
  verification_label: VerificationStatus;
  last_checked_at: string;
  created_at: string;
}

export interface StoryCompany {
  company_id: string;
  name: string;
  role: 'primary' | 'mentioned';
}

export interface StoryInvestor {
  fund_id: string;
  name: string;
  role: 'lead' | 'participant' | 'mentioned';
}

export interface SourceConnector {
  source_id: string;
  name: string;
  category: 'vc_blog' | 'company_blog' | 'news_aggregator' | 'government' | 'developer_platform' | 'yc' | 'search';
  base_url: string;
  access_method: SourceMethod;
  auth_required: 'none' | 'api_key' | 'oauth' | 'login';
  rate_limit: string;
  robots_txt_allows: 'yes' | 'no' | 'conditional';
  terms_of_use_url: string | null;
  reuse_permission: ReusePermission;
  attribution_required: boolean;
  commercial_use_allowed: 'yes' | 'no' | 'unclear';
  retention_max_days: number;
  expected_fact_types: ('thesis' | 'portfolio' | 'round' | 'team' | 'product' | 'event')[];
  cadence: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'on_demand';
  owner: string;
  status: 'approved' | 'pending_review' | 'rejected' | 'paused';
  last_audit_date: string;
  notes: string | null;
}

export interface FetchResult {
  source_id: string;
  url: string;
  fetched_at: string;
  content_hash: string;
  raw_content: string;
  metadata: {
    title?: string;
    published_at?: string;
    author?: string;
    publisher?: string;
    image_url?: string | null;
    excerpt?: string;
    tags?: string[];
    language?: string;
  };
  permissions: {
    can_store_raw: boolean;
    can_store_full_text: boolean;
    max_retention_days: number;
    attribution_required: boolean;
  };
}

export interface SourceArchive {
  id: string;
  source_id: string;
  url: string;
  content_hash: string;
  fetched_at: string;
  r2_key: string | null;
  r2_url: string | null;
  metadata: Record<string, unknown>;
  permissions: Record<string, unknown>;
  created_at: string;
}

export interface RoundExtraction {
  company_name: string;
  company_domain: string | null;
  announced_date: string | null;
  round_stage: Stage | 'undisclosed';
  amount_usd: number | null;
  amount_currency: string;
  investors: RoundInvestor[];
  valuation_usd: number | null;
  source_urls: string[];
  verification_status: VerificationStatus;
  conflicts: RoundConflict[];
}

export interface RoundInvestor {
  name: string;
  role: 'lead' | 'participant' | 'undisclosed';
  domain: string | null;
}

export interface RoundConflict {
  field: string;
  source_a: string;
  source_b: string;
  values: string[];
}

export interface InvestorIdentityResolution {
  mention_text: string;
  canonical_firm_id: string | null;
  canonical_firm_name: string | null;
  fund_vehicle: string | null;
  partner_name: string | null;
  confidence: 'high' | 'medium' | 'low';
  evidence_spans: EvidenceSpan[];
  disambiguation_notes: string | null;
}

export interface EvidenceSpan {
  start: number;
  end: number;
  text: string;
}

export interface ThesisAttribution {
  investor_id: string;
  thesis_text: string;
  thesis_type: 'stated' | 'inferred';
  source_urls: string[];
  source_type: 'blog' | 'interview' | 'twitter' | 'podcast' | 'sec_filing' | 'portfolio_analysis';
  date_stated: string | null;
  inference_method: 'portfolio_clustering' | 'keyword_frequency' | 'partner_quotes' | 'other' | null;
  inference_period: { start: string; end: string } | null;
  sample_size: number | null;
  confidence: 'high' | 'medium' | 'low';
  caveats: string | null;
}

export interface SummaryFaithfulness {
  source_text: string;
  summary_text: string;
  faithfulness_score: 1 | 2 | 3 | 4 | 5;
  hallucinated_claims: string[];
  omitted_key_facts: string[];
  attribution_accuracy: 'high' | 'medium' | 'low';
  evidence_spans: { claim: string; source_span: EvidenceSpan }[];
}

export interface Pattern {
  id: string;
  name: string;
  description: string;
  time_window_start: string;
  time_window_end: string;
  baseline_value: number;
  current_value: number;
  change_percentage: number;
  distinct_companies: number;
  distinct_funds: number;
  qualifying_events: PatternEvent[];
  counterexamples: PatternCounterexample[];
  confidence: 'high' | 'medium' | 'low';
  coverage_notes: string | null;
  status: 'candidate' | 'published' | 'corrected' | 'retired' | 'rejected';
  source_links: string[];
  created_at: string;
  updated_at: string;
}

export interface PatternEvent {
  date: string;
  company_id: string;
  company_name: string;
  round_stage: Stage | null;
  amount_usd: number | null;
  fund_ids: string[];
  fund_names: string[];
  source_url: string;
}

export interface PatternCounterexample {
  entity_id: string;
  entity_name: string;
  entity_type: 'company' | 'fund';
  reason: string;
}

export interface DiscussionThread {
  id: string;
  entity_type: 'company' | 'fund' | 'pattern';
  entity_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscussionComment {
  id: string;
  thread_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  is_hidden: boolean;
  hidden_reason: string | null;
  hidden_by: string | null;
  hidden_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminSourceRegistry {
  source_id: string;
  status: 'active' | 'paused' | 'error';
  last_fetch_at: string | null;
  last_fetch_status: 'success' | 'error' | 'partial';
  consecutive_failures: number;
  items_fetched_24h: number;
  unique_yield_24h: number;
  health_score: number;
  updated_at: string;
}
