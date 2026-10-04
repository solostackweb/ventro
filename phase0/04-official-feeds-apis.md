# Initial Official Feeds & APIs — Phase 0 Inventory

**Version:** 0.1  
**Date:** 2026-09-30  
**Status:** Draft for review; each connector requires source-rights register approval before Phase 1 implementation

---

## Connector Inventory Summary

| Category | Count | RSS | API | HTML | Priority |
|----------|-------|-----|-----|------|----------|
| VC Firm Blogs | 38 | 38 | 0 | 12* | P0 |
| AI Company Blogs | 28 | 28 | 0 | 18* | P0 |
| News Aggregators | 6 | 4 | 0 | 2 | P0 |
| Government/Regulatory | 4 | 2 | 1 | 1 | P0 |
| Developer Platforms | 3 | 0 | 3 | 0 | P0 |
| YC Sources | 2 | 1 | 0 | 1 | P1 (permission needed) |
| Search (Gap-Fill) | 2 | 0 | 2 | 0 | P0 (capped) |
| **Total** | **83** | **73** | **6** | **34** | — |

*Some sources have both RSS and HTML; HTML is fallback when RSS lacks full content.

---

## Detailed Connector Specifications

### 1. VC Firm Official Feeds (38 RSS + 12 HTML fallback)

| Source ID | Name | Feed URL | Type | Rate Limit | Auth | Reuse | Notes |
|-----------|------|----------|------|------------|------|-------|-------|
| `sequoia-capital-blog` | Sequoia Capital | `https://www.sequoiacap.com/feed/` | RSS | 60/min | None | summary_only | Covers US + India/SEA + China posts |
| `a16z-blog` | Andreessen Horowitz | `https://a16z.com/feed/` | RSS | 60/min | None | summary_only | Multiple categories; filter AI tags |
| `lightspeed-blog` | Lightspeed VP | `https://lsvp.com/feed/` | RSS | 60/min | None | summary_only | India/China posts included |
| `greylock-blog` | Greylock | `https://greylock.com/feed/` | RSS | 60/min | None | summary_only | Partner essays tagged |
| `index-ventures-blog` | Index Ventures | `https://www.indexventures.com/feed/` | RSS | 60/min | None | summary_only | European + US coverage |
| `khosla-ventures-blog` | Khosla Ventures | `https://www.khoslaventures.com/feed/` | RSS | 60/min | None | summary_only | Vinod Khosla essays |
| `general-catalyst-blog` | General Catalyst | `https://www.generalcatalyst.com/feed/` | RSS | 60/min | None | summary_only | Hemant Taneja posts |
| `radical-ventures-blog` | Radical Ventures | `https://radical.vc/feed/` | RSS | 60/min | None | summary_only | AI-only fund |
| `air-street-blog` | Air Street Capital | `https://www.airstreet.com/feed/` | RSS | 60/min | None | summary_only | Nathan Benaich State of AI |
| `zetta-vp-blog` | Zetta VP | `https://zettavp.com/feed/` | RSS | 60/min | None | summary_only | AI infra focus |
| `amplify-partners-blog` | Amplify Partners | `https://amplify.com/feed/` | RSS | 60/min | None | summary_only | Technical founders |
| `costanoa-blog` | Costanoa | `https://costanoa.com/feed/` | RSS | 60/min | None | summary_only | B2B AI |
| `wing-vc-blog` | Wing VC | `https://wing.vc/feed/` | RSS | 60/min | None | summary_only | Data/AI |
| `dcvc-blog` | DCVC | `https://dcvc.com/feed/` | RSS | 60/min | None | summary_only | Deep tech |
| `two-sigma-ventures-blog` | Two Sigma Ventures | `https://twosigmaventures.com/feed/` | RSS | 60/min | None | summary_only | Quant/AI |
| `ia-ventures-blog` | IA Ventures | `https://iaventures.com/feed/` | RSS | 60/min | None | summary_only | Data/AI |
| `pillar-vc-blog` | Pillar VC | `https://pillar.vc/feed/` | RSS | 60/min | None | summary_only | MIT/Harvard spinouts |
| `firstmark-blog` | FirstMark | `https://firstmarkcap.com/feed/` | RSS | 60/min | None | summary_only | Matt Turck MAD landscape |
| `insight-partners-blog` | Insight Partners | `https://www.insightpartners.com/feed/` | RSS | 60/min | None | summary_only | ScaleUp:AI content |
| `battery-blog` | Battery Ventures | `https://www.battery.com/feed/` | RSS | 60/min | None | summary_only | AI/ML tag filter |
| `redpoint-blog` | Redpoint | `https://redpoint.com/feed/` | RSS | 60/min | None | summary_only | Tomasz Tunguz posts |
| `peak-xv-blog` | Peak XV | `https://peakxv.com/feed/` | RSS | 60/min | None | summary_only | India/SEA AI |
| `accel-india-blog` | Accel India | `https://www.accel.com/india/feed/` | RSS | 60/min | None | summary_only | India AI |
| `matrix-india-blog` | Matrix India | `https://matrixpartners.in/feed/` | RSS | 60/min | None | summary_only | India AI |
| `blume-blog` | Blume Ventures | `https://blume.vc/feed/` | RSS | 60/min | None | summary_only | India early-stage |
| `elevate-blog` | Elevate Capital | `https://elevatecapital.in/feed/` | RSS | 60/min | None | summary_only | Deep tech India |
| `3one4-blog` | 3one4 Capital | `https://3one4capital.com/feed/` | RSS | 60/min | None | summary_only | Frontier tech India |
| `chiratae-blog` | Chiratae | `https://chiratae.com/feed/` | RSS | 60/min | None | summary_only | India AI/deep tech |
| `together-fund-blog` | Together Fund | `https://together.fund/feed/` | RSS | 60/min | None | summary_only | B2B AI/SaaS India |
| `aleph-blog` | Aleph | `https://aleph.vc/feed/` | RSS | 60/min | None | summary_only | Israel AI |
| `tlv-partners-blog` | TLV Partners | `https://tlvpartners.com/feed/` | RSS | 60/min | None | summary_only | Israel AI |
| `atomico-blog` | Atomico | `https://atomico.com/feed/` | RSS | 60/min | None | summary_only | EU tech |
| `balderton-blog` | Balderton | `https://www.balderton.com/feed/` | RSS | 60/min | None | summary_only | EU growth |
| `creandum-blog` | Creandum | `https://www.creandum.com/feed/` | RSS | 60/min | None | summary_only | EU early-stage |
| `inovia-blog` | Inovia | `https://inovia.vc/feed/` | RSS | 60/min | None | summary_only | Canada AI |
| `omers-blog` | OMERS Ventures | `https://omersventures.com/feed/` | RSS | 60/min | None | summary_only | Canada growth |
| `hg-ventures-blog` | HG Ventures | `https://hgventures.vc/feed/` | RSS | 60/min | None | summary_only | SEA/India |
| `salesforce-ventures-blog` | Salesforce Ventures | `https://www.salesforceventures.com/feed/` | RSS | 60/min | None | summary_only | Enterprise AI |
| `databricks-ventures-blog` | Databricks Ventures | `https://www.databricks.com/ventures/feed/` | RSS | 60/min | None | summary_only | Data/AI |
| `nvidia-blog` | NVIDIA Blog | `https://blogs.nvidia.com/feed/` | RSS | 60/min | None | summary_only | Research, GR00T, investments |
| `m12-blog` | M12 (Microsoft) | `https://m12.vc/feed/` | RSS | 60/min | None | summary_only | Enterprise AI |
| `gv-blog` | GV (Google Ventures) | `https://www.gv.com/feed/` | RSS | 60/min | None | summary_only | AI tags |

**HTML-only fallbacks (no RSS):** Benchmark, Coatue, Tiger Global, Intel Capital, Samsung Next, Adobe Ventures, Workday Ventures, Snowflake Ventures, Amazon Alexa Fund, Amazon AWS AI Blog, Google Cloud AI Blog, Microsoft AI Blog

---

### 2. AI Company Official Feeds (28 RSS + 18 HTML fallback)

| Source ID | Name | Feed URL | Type | Rate Limit | Auth | Reuse | Notes |
|-----------|------|----------|------|------------|------|-------|-------|
| `openai-blog` | OpenAI | `https://openai.com/blog/rss.xml` | RSS | 60/min | None | summary_only | Product launches, research |
| `anthropic-blog` | Anthropic | `https://www.anthropic.com/news/feed.xml` | RSS | 60/min | None | summary_only | Model releases, safety |
| `deepmind-blog` | Google DeepMind | `https://deepmind.com/blog/feed.xml` | RSS | 60/min | None | summary_only | Research, Gemini |
| `meta-ai-blog` | Meta AI | `https://ai.meta.com/blog/rss/` | RSS | 60/min | None | summary_only | Llama, open science |
| `mistral-blog` | Mistral AI | `https://mistral.ai/news/feed.xml` | RSS | 60/min | None | summary_only | Model releases |
| `cohere-blog` | Cohere | `https://cohere.com/blog/rss.xml` | RSS | 60/min | None | summary_only | Enterprise, RAG |
| `ai21-blog` | AI21 Labs | `https://www.ai21.com/blog/feed/` | RSS | 60/min | None | summary_only | Jurassic, enterprise |
| `huggingface-blog` | Hugging Face | `https://huggingface.co/blog/feed.xml` | RSS | 60/min | None | summary_only | Models, hub, enterprise |
| `together-blog` | Together AI | `https://www.together.ai/blog/rss.xml` | RSS | 60/min | None | summary_only | Open models, inference |
| `databricks-blog` | Databricks | `https://www.databricks.com/blog/feed` | RSS | 60/min | None | summary_only | DBRX, MosaicML, platform |
| `wandb-blog` | Weights & Biases | `https://wandb.ai/site/feed.xml` | RSS | 60/min | None | summary_only | MLOps, tracking |
| `langchain-blog` | LangChain | `https://blog.langchain.dev/rss/` | RSS | 60/min | None | summary_only | Framework, agents |
| `llamaindex-blog` | LlamaIndex | `https://blog.llamaindex.ai/rss/` | RSS | 60/min | None | summary_only | RAG, data framework |
| `modal-blog` | Modal | `https://modal.com/blog/rss.xml` | RSS | 60/min | None | summary_only | Serverless GPU |
| `replicate-blog` | Replicate | `https://replicate.com/blog/rss.xml` | RSS | 60/min | None | summary_only | Model API |
| `baseten-blog` | Baseten | `https://www.baseten.co/blog/rss.xml` | RSS | 60/min | None | summary_only | Deployment, Truss |
| `runai-blog` | Run:ai | `https://www.run.ai/blog/rss.xml` | RSS | 60/min | None | summary_only | GPU orchestration |
| `tecton-blog` | Tecton | `https://www.tecton.ai/blog/rss.xml` | RSS | 60/min | None | summary_only | Feature platform |
| `feast-blog` | Feast | `https://feast.dev/blog/rss.xml` | RSS | 60/min | None | summary_only | OSS feature store |
| `dagshub-blog` | DagsHub | `https://dagshub.com/blog/rss.xml` | RSS | 60/min | None | summary_only | ML collaboration |
| `zenml-blog` | ZenML | `https://zenml.io/blog/rss.xml` | RSS | 60/min | None | summary_only | MLOps pipelines |
| `glean-blog` | Glean | `https://www.glean.com/blog/rss.xml` | RSS | 60/min | None | summary_only | Enterprise search |
| `perplexity-blog` | Perplexity | `https://www.perplexity.ai/blog/rss.xml` | RSS | 60/min | None | summary_only | Answer engine |
| `elevenlabs-blog` | ElevenLabs | `https://elevenlabs.io/blog/rss.xml` | RSS | 60/min | None | summary_only | Voice AI |
| `synthesia-blog` | Synthesia | `https://www.synthesia.io/blog/rss.xml` | RSS | 60/min | None | summary_only | Video generation |
| `runway-blog` | Runway | `https://runwayml.com/blog/rss.xml` | RSS | 60/min | None | summary_only | Video generation |
| `descript-blog` | Descript | `https://www.descript.com/blog/rss.xml` | RSS | 60/min | None | summary_only | Audio/video editing |
| `nvidia-dev-blog` | NVIDIA Developer | `https://developer.nvidia.com/blog/feed/` | RSS | 60/min | None | summary_only | Robotics, GR00T, CUDA |

**HTML-only fallbacks:** xAI, Cursor, Codeium, Harvey, Abridge, Sierra, Decagon, Character.ai, Midjourney, Pika, HeyGen, Figure, Covariant, Skild, Physical Intelligence, Apptronik, Sarvam AI, Krutrim, CoRover

---

### 3. News Aggregators (4 RSS + 2 HTML)

| Source ID | Name | Feed URL | Type | Rate Limit | Auth | Reuse | Notes |
|-----------|------|----------|------|------------|------|-------|-------|
| `techcrunch-ai` | TechCrunch AI | `https://techcrunch.com/tag/artificial-intelligence/feed/` | RSS | 120/min | None | link_only | High volume; cluster aggressively |
| `venturebeat-ai` | VentureBeat AI | `https://venturebeat.com/category/ai/feed/` | RSS | 120/min | None | link_only | Good funding coverage |
| `crunchbase-news` | Crunchbase News | `https://news.crunchbase.com/feed/` | RSS | 60/min | None | summary_only | Funding rounds, exits |
| `hacker-news` | Hacker News (Algolia) | `https://hn.algolia.com/api/v1/search_by_date?tags=story` | API | 1000/hour | None | full_text | Real-time; filter AI tags |
| `the-information` | The Information | `https://www.theinformation.com/` | HTML | 30/min | Paywall | link_only | **Permission needed**; high-value scoops |
| `pitchbook-news` | PitchBook News | `https://pitchbook.com/news/rss` | RSS | 60/min | None | summary_only | **Verify access**; PE/VC focus |

---

### 4. Government / Regulatory (2 RSS + 1 API + 1 HTML)

| Source ID | Name | Feed URL | Type | Rate Limit | Auth | Reuse | Notes |
|-----------|------|----------|------|------------|------|-------|-------|
| `sebi-rss` | SEBI RSS | `https://www.sebi.gov.in/rss.html` | RSS | 60/min | None | full_text (GODL) | Circulars, regulations, AIF |
| `pib-rss` | PIB Press Releases | `https://pib.gov.in/RssMain.aspx` | RSS | 60/min | None | full_text (GODL) | Govt policy, AI missions |
| `sec-edgar` | SEC EDGAR | `https://www.sec.gov/edgar/sec-api-documentation` | API | 10/sec | None | full_text | Form D, 13F, Schedule 13D |
| `sebi-aif-registry` | SEBI AIF Registry | `https://www.sebi.gov.in/alternative-investment-funds.html` | HTML | 30/min | None | metadata_only (GODL) | Fund registrations, compliance |

---

### 5. Developer Platforms (3 APIs)

| Source ID | Name | Base URL | Type | Rate Limit | Auth | Reuse | Notes |
|-----------|------|----------|------|------------|------|-------|-------|
| `github-releases` | GitHub Releases | `https://api.github.com/repos/{owner}/{repo}/releases` | API | 5000/hr (auth) | Token | full_text | Track orgs: openai, anthropic, huggingface, pytorch, tensorflow, langchain, etc. |
| `huggingface-models` | HF Models API | `https://huggingface.co/api/models` | API | 1000/hr | None | metadata_only | Model cards, tags, downloads |
| `huggingface-papers` | HF Daily Papers | `https://huggingface.co/api/daily_papers` | API | 1000/hr | None | metadata_only | ArXiv papers with HF discussion |

---

### 6. YC Sources (Permission Required)

| Source ID | Name | URL | Type | Status | Notes |
|-----------|------|-----|------|--------|-------|
| `yc-directory` | YC Company Directory | `https://www.ycombinator.com/companies` | HTML | **Blocked** | Must contact YC for ToS clarification before automated import. Manual curation only for Phase 1. |
| `yc-blog` | YC Blog | `https://www.ycombinator.com/blog/feed.xml` | RSS | Approved | Batch announcements, advice posts |

---

### 7. Search / Gap-Fill (2 APIs — Hard Capped)

| Source ID | Name | Base URL | Type | Monthly Cap | Auth | Reuse | Trigger Conditions |
|-----------|------|----------|------|-------------|------|-------|-------------------|
| `tavily-search` | Tavily Search | `https://api.tavily.com/search` | API | 500 calls | API Key | summary_only | No official feed for entity >14 days; conflicting reports |
| `firecrawl-scrape` | Firecrawl | `https://api.firecrawl.dev/v1/scrape` | API | 200 credits | API Key | summary_only | JS-heavy official page; PDF extraction failure |

---

## Connector Implementation Spec (Phase 1)

### Common Fetcher Interface

```typescript
interface SourceConnector {
  sourceId: string;
  fetch(): Promise<FetchResult[]>;
  getRateLimiter(): RateLimiter;
  getRetentionDays(): number;
  getReusePermission(): ReusePermission;
  validateResponse(response: FetchResult): ValidationResult;
}

interface FetchResult {
  sourceId: string;
  url: string;
  fetchedAt: Date;
  contentHash: string;
  rawContent: string;           // Stored in R2 if permitted
  metadata: {
    title?: string;
    publishedAt?: Date;
    author?: string;
    tags?: string[];
    language?: string;
  };
  permissions: {
    canStoreRaw: boolean;
    canStoreFullText: boolean;
    maxRetentionDays: number;
    attributionRequired: boolean;
  };
}
```

### Rate Limiting Strategy

| Tier | Sources | Algorithm | Config |
|------|---------|-----------|--------|
| RSS Feeds | 73 | Token Bucket | 60 req/min per domain; burst 10 |
| APIs (GitHub, HF, SEC) | 6 | Token Bucket | Per-provider limits (see above) |
| HTML Fallback | 34 | Token Bucket | 30 req/min per domain; burst 5 |
| Search (Tavily/Firecrawl) | 2 | Leaky Bucket | Monthly hard cap; daily budget = monthly/30 |

### Deduplication Keys

| Content Type | Dedup Key |
|--------------|-----------|
| RSS Item | `source_id + guid` (or `link` hash) |
| API Response | `source_id + resource_id + updated_at` |
| HTML Page | `source_id + canonical_url + content_hash` |
| Search Result | `source_id + url + content_hash` |

### R2 Archive Naming Convention

```
source-archives/
  {source_id}/
    {YYYY}/
      {MM}/
        {DD}/
          {fetch_id}_{content_hash[:16]}.{ext}
```

Metadata in Postgres `source_archive` table with R2 key reference.

---

## Phase 1 Implementation Priority

| Priority | Connectors | Count | Rationale |
|----------|------------|-------|-----------|
| P0 | All 73 RSS feeds | 73 | Lowest friction; highest coverage; `summary_only` reuse |
| P0 | 6 APIs (GitHub, HF, SEC, HN) | 6 | Structured data; high signal; generous limits |
| P0 | Tavily + Firecrawl (capped) | 2 | Gap-fill only; budget protection |
| P0 | 2 Gov RSS (SEBI, PIB) | 2 | GODL license; full text allowed |
| P1 | 34 HTML fallbacks | 34 | Higher effort; `link_only` or `unclear` reuse; need per-source scraper |
| P1 | YC Directory | 1 | **Requires YC permission**; manual curation for Phase 1 |

---

## Monitoring & Alerting (Per Connector)

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Fetch success rate | >99% | <95% for 2 consecutive runs |
| Unique yield (new items/100 fetches) | >10 | <2 for 7 days (stale source) |
| Latency (p95) | <5s | >15s |
| Rate limit hits | 0 | >5/hour |
| Content hash change rate | >0% | 0% for 14 days (source may be dead) |
| Paid API credits used | <80% cap | >90% cap (hard stop at 100%) |

---

## Next Steps

1. Complete source-rights register for all 83 connectors
2. Legal review for: The Information, PitchBook, Benchmark, Coatue, Tiger Global, Crunchbase
3. Contact YC for directory access terms
4. Implement P0 RSS/API fetcher framework (shared code)
5. Build HTML fetcher with `readability` extraction for P1
6. Configure R2 lifecycle policies per `retention_max_days`
7. Build admin source registry UI with pause/configure controls