-- Ventro Seed Data: Source Connectors
-- Run after schema.sql in Supabase SQL Editor
-- Based on phase0/01-source-rights-register.md

INSERT INTO source_connectors (
  source_id, name, category, base_url, access_method, auth_required,
  rate_limit, robots_txt_allows, terms_of_use_url, reuse_permission,
  attribution_required, commercial_use_allowed, retention_max_days,
  expected_fact_types, cadence, owner, status, last_audit_date, notes
) VALUES
-- ============================================
-- VC Firm Official Sources (10 of 50)
-- ============================================
(
  'sequoia-capital-blog', 'Sequoia Capital Blog', 'vc_blog', 'https://sequoiacap.com',
  'rss', 'none', '60/min', 'yes', 'https://sequoiacap.com/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['thesis', 'portfolio', 'team'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://sequoiacap.com/feed/'
),
(
  'a16z-blog', 'Andreessen Horowitz Blog', 'vc_blog', 'https://a16z.com',
  'rss', 'none', '60/min', 'yes', 'https://a16z.com/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['thesis', 'portfolio', 'team'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://a16z.com/feed/'
),
(
  'lightspeed-blog', 'Lightspeed Venture Partners', 'vc_blog', 'https://lsvp.com',
  'rss', 'none', '60/min', 'yes', 'https://lsvp.com/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['thesis', 'portfolio'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://lsvp.com/feed/'
),
(
  'benchmark-blog', 'Benchmark', 'vc_blog', 'https://benchmark.com',
  'html', 'none', '30/min', 'conditional', 'https://benchmark.com/terms',
  'link_only', true, 'unclear', 90,
  ARRAY['portfolio', 'team'], 'weekly', 'ingestion-team', 'pending_review', '2026-09-30',
  'No RSS; HTML scraping required. Check robots.txt for /portfolio path.'
),
(
  'greylock-blog', 'Greylock Partners', 'vc_blog', 'https://greylock.com',
  'rss', 'none', '60/min', 'yes', 'https://greylock.com/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['thesis', 'portfolio'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://greylock.com/feed/'
),
(
  'index-ventures-blog', 'Index Ventures', 'vc_blog', 'https://indexventures.com',
  'rss', 'none', '60/min', 'yes', 'https://indexventures.com/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['thesis', 'portfolio'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://indexventures.com/feed/'
),
(
  'coatue-blog', 'Coatue Management', 'vc_blog', 'https://coatue.com',
  'html', 'none', '30/min', 'conditional', 'https://coatue.com/terms',
  'link_only', true, 'unclear', 90,
  ARRAY['portfolio'], 'weekly', 'ingestion-team', 'pending_review', '2026-09-30',
  'No RSS; HTML only. Link-only reuse per terms.'
),
(
  'tiger-global-blog', 'Tiger Global', 'vc_blog', 'https://tigerglobal.com',
  'html', 'none', '30/min', 'conditional', 'https://tigerglobal.com/terms',
  'link_only', true, 'unclear', 90,
  ARRAY['portfolio'], 'weekly', 'ingestion-team', 'pending_review', '2026-09-30',
  'No RSS; HTML only. Link-only reuse per terms.'
),
(
  'khosla-ventures-blog', 'Khosla Ventures', 'vc_blog', 'https://khoslaventures.com',
  'rss', 'none', '60/min', 'yes', 'https://khoslaventures.com/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['thesis', 'portfolio'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://khoslaventures.com/feed/'
),
(
  'general-catalyst-blog', 'General Catalyst', 'vc_blog', 'https://generalcatalyst.com',
  'rss', 'none', '60/min', 'yes', 'https://generalcatalyst.com/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['thesis', 'portfolio'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://generalcatalyst.com/feed/'
),

-- ============================================
-- AI Company Official Sources (10 of 50)
-- ============================================
(
  'openai-blog', 'OpenAI Blog', 'company_blog', 'https://openai.com',
  'rss', 'none', '60/min', 'yes', 'https://openai.com/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['product', 'team', 'event'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://openai.com/blog/rss.xml'
),
(
  'anthropic-blog', 'Anthropic Blog', 'company_blog', 'https://anthropic.com',
  'rss', 'none', '60/min', 'yes', 'https://anthropic.com/legal/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['product', 'team', 'event'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://www.anthropic.com/news/feed.xml'
),
(
  'google-deepmind-blog', 'Google DeepMind Blog', 'company_blog', 'https://deepmind.com',
  'rss', 'none', '60/min', 'yes', 'https://deepmind.com/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['product', 'team', 'event'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://deepmind.com/blog/feed.xml'
),
(
  'meta-ai-blog', 'Meta AI Blog', 'company_blog', 'https://ai.meta.com',
  'rss', 'none', '60/min', 'yes', 'https://ai.meta.com/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['product', 'team', 'event'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://ai.meta.com/blog/rss/'
),
(
  'huggingface-blog', 'Hugging Face Blog', 'company_blog', 'https://huggingface.co',
  'rss', 'none', '60/min', 'yes', 'https://huggingface.co/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['product', 'model', 'event'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://huggingface.co/blog/feed.xml'
),
(
  'cohere-blog', 'Cohere Blog', 'company_blog', 'https://cohere.com',
  'rss', 'none', '60/min', 'yes', 'https://cohere.com/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['product', 'team', 'event'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://cohere.com/blog/rss.xml'
),
(
  'mistral-ai-blog', 'Mistral AI Blog', 'company_blog', 'https://mistral.ai',
  'rss', 'none', '60/min', 'yes', 'https://mistral.ai/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['product', 'team', 'event'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://mistral.ai/news/feed.xml'
),
(
  'databricks-blog', 'Databricks Blog', 'company_blog', 'https://databricks.com',
  'rss', 'none', '60/min', 'yes', 'https://databricks.com/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['product', 'team', 'event'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://databricks.com/blog/feed.xml'
),
(
  'scale-ai-blog', 'Scale AI Blog', 'company_blog', 'https://scale.com',
  'rss', 'none', '60/min', 'yes', 'https://scale.com/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['product', 'team', 'event'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://scale.com/blog/feed.xml'
),
(
  'perplexity-blog', 'Perplexity Blog', 'company_blog', 'https://perplexity.ai',
  'rss', 'none', '60/min', 'yes', 'https://perplexity.ai/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['product', 'team', 'event'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://perplexity.ai/blog/feed.xml'
),

-- ============================================
-- Aggregator / News Sources (8)
-- ============================================
(
  'techcrunch-ai', 'TechCrunch AI', 'news_aggregator', 'https://techcrunch.com',
  'rss', 'none', '120/min', 'yes', 'https://techcrunch.com/terms',
  'link_only', true, 'no', 90,
  ARRAY['round', 'event', 'portfolio'], 'hourly', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://techcrunch.com/tag/artificial-intelligence/feed/'
),
(
  'venturebeat-ai', 'VentureBeat AI', 'news_aggregator', 'https://venturebeat.com',
  'rss', 'none', '120/min', 'yes', 'https://venturebeat.com/terms',
  'link_only', true, 'no', 90,
  ARRAY['round', 'event', 'portfolio'], 'hourly', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://venturebeat.com/category/ai/feed/'
),
(
  'the-information-ai', 'The Information AI', 'news_aggregator', 'https://theinformation.com',
  'html', 'login', '30/min', 'conditional', 'https://theinformation.com/terms',
  'link_only', true, 'no', 90,
  ARRAY['round', 'thesis', 'portfolio'], 'daily', 'ingestion-team', 'pending_review', '2026-09-30',
  'Paywall; HTML scraping with auth required. Link-only reuse.'
),
(
  'crunchbase-rss', 'Crunchbase News RSS', 'news_aggregator', 'https://news.crunchbase.com',
  'rss', 'none', '60/min', 'yes', 'https://news.crunchbase.com/terms',
  'summary_only', true, 'unclear', 90,
  ARRAY['round', 'portfolio', 'team'], 'hourly', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://news.crunchbase.com/feed/'
),
(
  'pitchbook-rss', 'PitchBook News RSS', 'news_aggregator', 'https://pitchbook.com',
  'rss', 'none', '60/min', 'yes', 'https://pitchbook.com/terms',
  'summary_only', true, 'unclear', 90,
  ARRAY['round', 'portfolio'], 'daily', 'ingestion-team', 'pending_review', '2026-09-30',
  'Feed: https://pitchbook.com/news/feed/'
),
(
  'hacker-news', 'Hacker News', 'developer_platform', 'https://hn.algolia.com',
  'api', 'none', '100/min', 'yes', 'https://hn.algolia.com/terms',
  'full_text', true, 'yes', 90,
  ARRAY['event', 'product', 'discussion'], 'realtime', 'ingestion-team', 'approved', '2026-09-30',
  'API: https://hn.algolia.com/api/v1/search_by_date?tags=story'
),
(
  'github-releases', 'GitHub Releases (orgs)', 'developer_platform', 'https://api.github.com',
  'api', 'api_key', '5000/hr', 'yes', 'https://docs.github.com/site-policy/terms',
  'full_text', true, 'yes', 90,
  ARRAY['product', 'model', 'event'], 'realtime', 'ingestion-team', 'approved', '2026-09-30',
  'Requires GitHub token. Track orgs: openai, anthropic, huggingface, etc.'
),
(
  'huggingface-models', 'Hugging Face Models', 'developer_platform', 'https://huggingface.co/api',
  'api', 'none', '1000/hr', 'yes', 'https://huggingface.co/terms',
  'metadata_only', true, 'yes', 90,
  ARRAY['model', 'product'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'API: https://huggingface.co/api/models'
),

-- ============================================
-- Government / Regulatory (4)
-- ============================================
(
  'sebi-aif-registry', 'SEBI AIF Registry', 'government', 'https://sebi.gov.in',
  'html', 'none', '10/min', 'yes', 'https://sebi.gov.in/terms',
  'metadata_only', true, 'yes', 365,
  ARRAY['fund_registration', 'compliance'], 'weekly', 'ingestion-team', 'approved', '2026-09-30',
  'GODL license. HTML + PDF parsing for AIF registry.'
),
(
  'sebi-rss', 'SEBI RSS', 'government', 'https://sebi.gov.in',
  'rss', 'none', '60/min', 'yes', 'https://sebi.gov.in/terms',
  'full_text', true, 'yes', 90,
  ARRAY['regulation', 'circular'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://www.sebi.gov.in/rss.html'
),
(
  'pib-releases', 'PIB Press Releases', 'government', 'https://pib.gov.in',
  'rss', 'none', '60/min', 'yes', 'https://pib.gov.in/terms',
  'full_text', true, 'yes', 90,
  ARRAY['policy', 'announcement'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://pib.gov.in/RssMain.aspx'
),
(
  'sec-edgar', 'SEC EDGAR Filings', 'government', 'https://sec.gov/edgar',
  'api', 'none', '10/sec', 'yes', 'https://sec.gov/terms',
  'full_text', true, 'yes', 365,
  ARRAY['round', 'portfolio', 'compliance'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'API: https://data.sec.gov/submissions/CIKXXXXXX.json'
),

-- ============================================
-- Search / Gap-Fill (2) — Budget-Capped
-- ============================================
(
  'tavily-search', 'Tavily Search API', 'search', 'https://tavily.com',
  'api', 'api_key', '500/month', 'yes', 'https://tavily.com/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['round', 'thesis', 'portfolio', 'event'], 'on_demand', 'ingestion-team', 'approved', '2026-09-30',
  'Cap: 500 searches/month. Use only for gap-fill after 14+ days no official coverage.'
),
(
  'firecrawl-scrape', 'Firecrawl', 'search', 'https://firecrawl.dev',
  'api', 'api_key', '200/month', 'yes', 'https://firecrawl.dev/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['round', 'thesis', 'portfolio', 'event'], 'on_demand', 'ingestion-team', 'approved', '2026-09-30',
  'Cap: 200 credits/month. Use for JS-heavy pages or PDF extraction failures.'
),

-- ============================================
-- YC Sources (2) — Manual Curation for Phase 1
-- ============================================
(
  'yc-directory', 'YC Company Directory', 'yc', 'https://ycombinator.com/companies',
  'html', 'none', '10/min', 'conditional', 'https://ycombinator.com/terms',
  'unknown', true, 'unclear', 90,
  ARRAY['portfolio', 'team', 'round'], 'on_demand', 'ingestion-team', 'pending_review', '2026-09-30',
  'MUST verify ToS before automated import. Manual curation only for Phase 1.'
),
(
  'yc-blog', 'YC Blog', 'yc', 'https://ycombinator.com',
  'rss', 'none', '60/min', 'yes', 'https://ycombinator.com/terms',
  'summary_only', true, 'yes', 90,
  ARRAY['thesis', 'portfolio', 'team'], 'daily', 'ingestion-team', 'approved', '2026-09-30',
  'Feed: https://www.ycombinator.com/blog/feed.xml'
);

-- ============================================
-- Verification Query
-- ============================================
-- SELECT source_id, name, category, status, access_method, reuse_permission
-- FROM source_connectors
-- ORDER BY category, source_id;
