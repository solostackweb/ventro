# Source-Rights Register — Phase 0

**Version:** 0.1  
**Date:** 2026-09-30  
**Status:** Draft for review before Phase 1 implementation

---

## Purpose

This register documents every source connector's legal basis, access method, rate limits, retention rules, and permitted reuse before any code is written. No connector is enabled in Phase 1 without an entry here.

---

## Source Categories

| Category | Count (Target) | Primary Use |
|----------|----------------|-------------|
| Official VC firm feeds/sites | 50 | Stated thesis, portfolio, team, announcements |
| Official AI company feeds/sites | 50 | Product launches, funding announcements, team |
| YC official sources | 1–2 | Batch lists, company directory |
| Government/regulatory | 4–6 | SEBI AIF registry, PIB, SEC filings, GDELT |
| Aggregators (RSS/API) | 8–12 | TechCrunch, VentureBeat, The Information, Crunchbase RSS, PitchBook RSS, Hacker News, GitHub, Hugging Face |
| Search (gap-only) | 2 | Tavily, Firecrawl (budget-capped) |

---

## Register Template (per source)

| Field | Description |
|-------|-------------|
| `source_id` | Unique slug (e.g., `sequoia-capital-blog`) |
| `name` | Human-readable name |
| `category` | One of the categories above |
| `base_url` | Root domain |
| `access_method` | `rss` \| `api` \| `html` \| `sitemap` \| `search` |
| `auth_required` | `none` \| `api_key` \| `oauth` \| `login` |
| `rate_limit` | Requests per window (e.g., `60/min`, `1000/day`) |
| `robots_txt_allows` | `yes` \| `no` \| `conditional` (quote relevant rule) |
| `terms_of_use_url` | Link to ToS/ToU |
| `reuse_permission` | `full_text` \| `summary_only` \| `metadata_only` \| `link_only` \| `unknown` |
| `attribution_required` | `yes` \| `no` |
| `commercial_use_allowed` | `yes` \| `no` \| `unclear` |
| `retention_max_days` | Max days to store raw capture (per source policy or default 90) |
| `expected_fact_types` | Array: `thesis` \| `portfolio` \| `round` \| `team` \| `product` \| `event` |
| `cadence` | `realtime` \| `hourly` \| `daily` \| `weekly` \| `on_demand` |
| `owner` | Team member responsible for monitoring |
| `status` | `approved` \| `pending_review` \| `rejected` \| `paused` |
| `last_audit_date` | YYYY-MM-DD |
| `notes` | Special handling, pagination, known issues |

---

## Initial Register Entries (Representative Sample — 20 of 100+ target)

### VC Firm Official Sources (10 of 50)

| source_id | name | base_url | access_method | reuse_permission | commercial_use_allowed | expected_fact_types | cadence | status |
|-----------|------|----------|---------------|------------------|------------------------|---------------------|---------|--------|
| `sequoia-capital-blog` | Sequoia Capital Blog | sequoiacap.com | rss + html | summary_only | yes | thesis, portfolio, team | daily | approved |
| `a16z-blog` | Andreessen Horowitz Blog | a16z.com | rss + html | summary_only | yes | thesis, portfolio, team | daily | approved |
| `lightspeed-blog` | Lightspeed Venture Partners | lsvp.com | rss + html | summary_only | yes | thesis, portfolio | daily | approved |
| `benchmark-blog` | Benchmark | benchmark.com | html | link_only | unclear | portfolio, team | weekly | pending_review |
| `greylock-blog` | Greylock Partners | greylock.com | rss + html | summary_only | yes | thesis, portfolio | daily | approved |
| `index-ventures-blog` | Index Ventures | indexventures.com | rss + html | summary_only | yes | thesis, portfolio | daily | approved |
| `coatue-blog` | Coatue Management | coatue.com | html | link_only | unclear | portfolio | weekly | pending_review |
| `tiger-global-blog` | Tiger Global | tigerglobal.com | html | link_only | unclear | portfolio | weekly | pending_review |
| `khosla-ventures-blog` | Khosla Ventures | khoslventures.com | rss + html | summary_only | yes | thesis, portfolio | daily | approved |
| `general-catalyst-blog` | General Catalyst | generalcatalyst.com | rss + html | summary_only | yes | thesis, portfolio | daily | approved |

### AI Company Official Sources (10 of 50)

| source_id | name | base_url | access_method | reuse_permission | commercial_use_allowed | expected_fact_types | cadence | status |
|-----------|------|----------|---------------|------------------|------------------------|---------------------|---------|--------|
| `openai-blog` | OpenAI Blog | openai.com/blog | rss | summary_only | yes | product, team, event | daily | approved |
| `anthropic-blog` | Anthropic Blog | anthropic.com/news | rss | summary_only | yes | product, team, event | daily | approved |
| `google-deepmind-blog` | Google DeepMind Blog | deepmind.com/blog | rss | summary_only | yes | product, team, event | daily | approved |
| `meta-ai-blog` | Meta AI Blog | ai.meta.com/blog | rss | summary_only | yes | product, team, event | daily | approved |
| `huggingface-blog` | Hugging Face Blog | huggingface.co/blog | rss | summary_only | yes | product, model, event | daily | approved |
| `cohere-blog` | Cohere Blog | cohere.com/blog | rss | summary_only | yes | product, team, event | daily | approved |
| `mistral-ai-blog` | Mistral AI Blog | mistral.ai/news | rss | summary_only | yes | product, team, event | daily | approved |
| `databricks-blog` | Databricks Blog | databricks.com/blog | rss | summary_only | yes | product, team, event | daily | approved |
| `scale-ai-blog` | Scale AI Blog | scale.com/blog | rss | summary_only | yes | product, team, event | daily | approved |
| `perplexity-blog` | Perplexity Blog | perplexity.ai/blog | rss | summary_only | yes | product, team, event | daily | approved |

### Aggregator / News Sources (8)

| source_id | name | base_url | access_method | reuse_permission | commercial_use_allowed | expected_fact_types | cadence | status |
|-----------|------|----------|---------------|------------------|------------------------|---------------------|---------|--------|
| `techcrunch-ai` | TechCrunch AI | techcrunch.com/tag/artificial-intelligence | rss | link_only | no | round, event, portfolio | hourly | approved |
| `venturebeat-ai` | VentureBeat AI | venturebeat.com/category/ai | rss | link_only | no | round, event, portfolio | hourly | approved |
| `the-information-ai` | The Information AI | theinformation.com | html (paywall) | link_only | no | round, thesis, portfolio | daily | pending_review |
| `crunchbase-rss` | Crunchbase News RSS | news.crunchbase.com | rss | summary_only | unclear | round, portfolio, team | hourly | approved |
| `pitchbook-rss` | PitchBook News RSS | pitchbook.com/news | rss | summary_only | unclear | round, portfolio | daily | pending_review |
| `hacker-news` | Hacker News | hn.algolia.com/api | api | full_text | yes | event, product, discussion | realtime | approved |
| `github-releases` | GitHub Releases (orgs) | api.github.com | api | full_text | yes | product, model, event | realtime | approved |
| `huggingface-models` | Hugging Face Models | huggingface.co/api | api | metadata_only | yes | model, product | daily | approved |

### Government / Regulatory (4)

| source_id | name | base_url | access_method | reuse_permission | commercial_use_allowed | expected_fact_types | cadence | status |
|-----------|------|----------|---------------|------------------|------------------------|---------------------|---------|--------|
| `sebi-aif-registry` | SEBI AIF Registry | sebi.gov.in | html + pdf | metadata_only | yes (GODL) | fund registration, compliance | weekly | approved |
| `sebi-rss` | SEBI RSS | sebi.gov.in/rss.html | rss | full_text | yes (GODL) | regulation, circular | daily | approved |
| `pib-releases` | PIB Press Releases | pib.gov.in | rss | full_text | yes (GODL) | policy, announcement | daily | approved |
| `sec-edgar` | SEC EDGAR Filings | sec.gov/edgar | api | full_text | yes | round, portfolio, compliance | daily | approved |

### Search / Gap-Fill (2) — Budget-Capped

| source_id | name | base_url | access_method | reuse_permission | commercial_use_allowed | expected_fact_types | cadence | status |
|-----------|------|----------|---------------|------------------|------------------------|---------------------|---------|--------|
| `tavily-search` | Tavily Search API | tavily.com | api | summary_only | yes | round, thesis, portfolio, event | on_demand | approved (capped) |
| `firecrawl-scrape` | Firecrawl | firecrawl.dev | api | summary_only | yes | round, thesis, portfolio, event | on_demand | approved (capped) |

---

## YC Sources — Requires Explicit Permission Check

| source_id | name | base_url | access_method | reuse_permission | commercial_use_allowed | notes |
|-----------|------|----------|---------------|------------------|------------------------|-------|
| `yc-directory` | YC Company Directory | ycombinator.com/companies | html | unknown | unknown | **Must verify ToS before automated import**; manual curation only for Phase 1 |
| `yc-blog` | YC Blog | ycombinator.com/blog | rss | summary_only | yes | Batch announcements, advice |

---

## Gap-Fill Search Policy

- **Tavily**: Free tier = 1,000 searches/month. Cap at 500/month for Phase 1. Use only when: (a) no official feed covers a tracked entity for 14+ days, or (b) conflicting reports need resolution.
- **Firecrawl**: Free tier = 500 credits/month. Cap at 200/month. Use only for: (a) JavaScript-heavy official pages with no RSS/API, (b) PDF filings (SEC, SEBI) where text extraction fails.
- **Hard stops**: When monthly cap reached, log `source_exhausted` and continue with feed metadata only. No silent fallback to paid tiers.

---

## Retention & Archive Rules

| Content Type | Store in R2 | Max Retention | Postgres Reference |
|--------------|-------------|---------------|-------------------|
| Raw HTML/RSS/API response (permitted) | Yes | 90 days (or source policy) | `source_archive` table: source_id, fetch_id, url, checksum, r2_key, fetched_at, expires_at |
| Extracted structured facts | No (Postgres only) | Indefinite | `evidence` table with provenance |
| Full third-party article text (non-permitted) | No | 0 days (do not store) | Store only URL, headline, publisher, published_at |
| PDF filings (SEC, SEBI) | Yes | 365 days | `source_archive` with `content_type: application/pdf` |

---

## Compliance Checklist per Connector (Phase 1 Gate)

Before enabling any connector in code:

- [ ] `robots.txt` checked and allows path
- [ ] Terms of Use reviewed; commercial reuse confirmed or limited to `link_only`
- [ ] Rate limit implemented in fetcher (token bucket)
- [ ] Retention policy coded; R2 lifecycle rule matches `retention_max_days`
- [ ] Attribution format documented and implemented in UI
- [ ] Error handling: 429 → backoff; 403/401 → pause connector, alert admin
- [ ] Checksum deduplication on fetch (skip if unchanged)
- [ ] Admin can pause/configure via source registry UI

---

## Next Steps

1. Complete all 100+ register entries (50 VC + 50 company + aggregators + gov + YC)
2. Legal review of `reuse_permission = unclear` entries
3. Confirm YC directory access terms with YC legal/contact
4. Finalize Tavily/Firecrawl cap monitoring dashboard
5. Present register for approval before Phase 1 kickoff