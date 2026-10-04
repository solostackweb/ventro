# Ventro next-gen intelligence phase

Status: implementation plan, not a claim that these engines already exist. This document extends the current product without replacing [the PRD](AI_INTELLIGENCE_WEBAPP_PRD.md). Scope is AI markets only, with one shared evidence corpus and personalized delivery.

## Product contract

Ventro must answer, with inspectable evidence:

1. **Where are investors investing?** Show a dated company–round–investor relationship, stage, disclosed amount and role, with the exact supporting source and uncertainty. An investor mention is not automatically round participation.
2. **What are investors looking for?** Show *stated thesis* from an investor's own dated words separately from *observed thesis* inferred from a disclosed, coverage-qualified portfolio. Never attribute an inference to the investor.

The next layer asks: **What is changing, what need remains underserved, and what could a founder test?** Patterns, gaps and ideas are hypotheses with counterevidence and validation status—not facts or guaranteed investment opportunities.

The user's first useful journey is: open an AI topic → see recent sourced AI updates, YC launches and investor activity → inspect stated versus observed thesis on a fund page → open a pattern with its baseline and counterexamples → inspect a gap and a falsifiable idea → save or discuss it. Personalization changes ranking and alerts, never the underlying fact.

The three continuously maintained input streams are **VCs/investors**, **YC companies**, and **the wider AI news/research/product world**. They are distinct datasets joined by canonical companies, people, products, topics and events. The feed is their readable front door, not a substitute for the underlying verified graph. “Never miss an AI update” is an aspiration, not a credible completeness promise: expose tracked sources, last successful fetch and known coverage gaps.

## Honest starting point in this repository

| Existing foundation | Current limitation to close |
|---|---|
| [Schema](supabase/schema.sql) models companies, funds, vehicles, investments, stories, stated/observed thesis, patterns and workspaces. | Tables are not a completed intelligence engine. Claim-level provenance, typed pattern lineage, gap/idea/validation records and pipeline versioning are still needed. |
| [Investment API](src/app/api/investments/route.ts), [fund API](src/app/api/funds/%5Bid%5D/route.ts) and [pattern API](src/app/api/patterns/route.ts) read structured tables. | They do not derive verified investments, thesis or patterns from collected documents. |
| [Ingestion module](src/lib/ingestion/rss-fetcher.ts) collects RSS items into `source_archive`/R2. | Execution registry has three hardcoded connectors; HTML/API branches are deferred. It does not produce normalized rounds, theses or stories. It uses a request-cookie Supabase client in a scheduled context and does not check all write results. |
| [Scheduled workflow](.github/workflows/scheduled-ingestion.yml) calls `require('./lib/ingestion/rss-fetcher')`. | This is a TypeScript source path in `src/`, not a compiled standalone worker artifact. Verify and repair execution before treating scheduled collection as live. |
| [News screen](src/app/%28dashboard%29/news/page.tsx) contains `MOCK_STORIES`; [feed API](src/app/api/feed/route.ts) reads `stories`. | The main feed UI does not yet prove an end-to-end real-data journey. |
| [Dashboard](src/app/%28dashboard%29/dashboard/page.tsx) requests `/api/feed`, while the News page uses local `MOCK_STORIES`. | An empty home feed and a populated mock News page can disagree. Diagnose deployed rows/RLS/API response separately from the mock-page issue; do not hide zero real rows with fixtures. |
| [Dashboard layout](src/app/%28dashboard%29/layout.tsx) renders the shared `Header`. Many dashboard pages, including [News](src/app/%28dashboard%29/news/page.tsx), also render a `<header>`. | This directly explains the duplicate top bar and inconsistent sticky positions; navigation needs one owner. |
| [Phase 0 material](phase0/) inventories candidate sources and defines evaluation tasks. | Inventories and evaluation specifications are not evidence that connectors run or that a labeled benchmark has passed. |

These observations are from repository inspection, not a production database audit. Confirm deployed migrations, source permissions and live row counts before declaring any gate passed.

## Architecture and trust boundaries

```text
VC official sources + YC official directory/launches + AI official updates/research + selective licensed/allowed reporting
  → scheduled capture + immutable metadata/allowed R2 snapshot
  → rights check → relevance filter → URL/content dedupe → event cluster
  → source documents and atomic claims with source spans → cross-source verification
  → canonical company, investor firm, vehicle, round and participation graph
  → dated investor statements + observed portfolio aggregates
  → baseline-aware patterns + counterexamples
  → gap hypotheses → idea candidates → adversarial validation
  → published intelligence cards → domain preferences, follows, alerts, discussion
```

- **Shared corpus:** One global set of source documents, entities and derived public intelligence. Workspace records hold preferences, follows, saves, notes and alerts. Do not duplicate collected facts per customer.
- **Evidence first:** Every material claim links to a source URL, capture time, publication time, span or structured field, extraction/model version, and current verification state. Keep source rights and retention rules on every capture. R2 stores only content permitted by that source; link-only sources retain URL and permitted metadata.
- **Deterministic authority:** Code/SQL performs schema validation, identity resolution decisions, deduplication, arithmetic, thresholds, coverage and publication gates. LLMs extract bounded candidates, summarize supplied evidence and suggest hypotheses; they do not certify their own output.
- **Separate identities:** Distinguish investment firm, fund vehicle, partner, lead investor, participant and portfolio company. YC batch membership is company context, not proof of investor preference or investment.
- **Abstain visibly:** Conflicts, sparse coverage and missing sources produce `unknown`, `partial` or `needs_review`, never zero activity or a confident “gap.” A single article republished by several outlets is one underlying source, not corroboration.
- **Versions and reversibility:** Derived outputs retain input IDs, code/model/prompt version and computation date. When an underlying fact is corrected, dependent theses, patterns and gaps become stale and are recomputed or retired; corrections remain auditable.

## Source coverage: three streams, one shared pipeline

Source selection is an operational program, not a one-time list of RSS URLs. The [Phase 0 register](phase0/01-source-rights-register.md) is a candidate inventory; each connector still needs a working endpoint, cadence, rights review, parser test and freshness monitor before activation. Begin with official feeds/APIs and expand by evidence yield, not raw article count. These are examples to evaluate, not assertions that every site has a usable RSS feed or grants republication rights.

| Stream | First-party priority | Supplement and reason |
|---|---|---|
| VC/investor | Firm and partner blogs, thesis posts, portfolio/announcement pages, fund press releases, official filings where relevant. Track firm, vehicle and partner attribution separately. | Selective reputable deal reporting for discovery or corroboration; search only when an official investment/thesis page is missing. |
| YC | [YC Company Directory](https://www.ycombinator.com/companies), company pages and launches, YC blog/batch announcements, then each company's official product and funding pages. | Independent reporting can establish later financing or changes; YC listing alone proves neither current traction nor a VC's investment. |
| AI updates | Official product/research/developer sources such as [Google for Developers Blog](https://developers.googleblog.com/), [Google DeepMind News](https://deepmind.google/discover/blog/), [Google's AI coverage](https://blog.google/innovation-and-ai/), official model-provider and cloud blogs, selected project release streams via [GitHub's public releases API](https://docs.github.com/en/rest/releases/releases). Monitor papers/preprints separately from shipping products. | Carefully selected news publishers, research indexes and community discovery surfaces find stories primary feeds miss. They trigger verification against the original announcement; they are not automatically independent confirmation. |

For each category maintain a source register with feed/API/page URL, source owner, topic tags, access method, rights and image rights, robots/terms decision, expected cadence, last success, observed yield, failure rate and duplicate rate. Support RSS/Atom, documented public APIs, permitted HTML discovery and sitemaps as separate adapters. A provider can change its URL or feed without changing its canonical identity. Test candidate URLs live before enabling them; never infer access permission from public visibility.

Use Tavily for *targeted discovery* when a source cohort has a coverage hole, and Firecrawl for *specific allowed pages* lacking a structured feed. Set per-source and daily/monthly request caps, cache by canonical URL/content hash, back off on failures, and halt on blocked/unclear rights. Do not run open-ended web search for every user visit. A discovery result goes through the same source, claim and verification gates as an RSS item.

### Collection-to-publication quality gates

1. **Capture:** Fetch with conditional requests or cursors where supported; preserve canonical URL, source ID, publication/fetch timestamps, HTTP status, content hash and allowed snapshot. Keep scheduler errors, retries and dead-letter items visible. Never mark a fetch successful if storage failed.
2. **Filter:** Reject off-topic posts, old resurfaced articles, thin promotional pages, inaccessible content and low-signal repeats. Keep rejection reason and a small sample for auditing. Route research papers, policy, product launches and funding into distinct event types so the feed does not imply each is an investment.
3. **Deduplicate and cluster:** Normalize URLs and tracking parameters; detect same-content reposts; cluster coverage of one event using entity, event type, date and claim similarity. Preserve all source links under one story. Distinguish a genuinely new follow-up from a duplicate announcement. Count syndicated copies as one origin.
4. **Extract and resolve:** Produce typed claims with evidence spans; resolve company/fund/product aliases and YC identity; keep unknown identity rather than forcing a match. Check dates, money, round stage, investor role and source attribution against the original document.
5. **Verify:** Confirm material facts against a primary source or genuinely independent corroboration. Use the existing `verified`, `partial`, `unverified`, `conflicted` labels consistently, and add an explicit retraction/correction state in a migration. An LLM's agreement with a source is not second-source verification. High-impact conflicts enter a small human exception queue; routine low-risk items can be automatically verified under explicit rules.
6. **Publish and maintain:** Create one canonical story card with provenance, freshness and correction status. Propagate corrections to linked company, fund, round, thesis and pattern views. Recheck mutable pages and expire stale claims. Measure time from source publication to *verified* publication, not just collection speed.

Set initial service targets from measured baseline, then track source coverage by stream, successful fetch percentage, eligible items, publication latency, dedupe precision, false-positive rate, missing-story reports and age of newest verified item. Daily sampling of both published and rejected content protects against over-filtering. The admin view should make source outages and silent empty feeds obvious.

### Images and media

Store a candidate image URL, origin, attribution, license/usage decision, dimensions and expiry with the story, never an untraceable image blob. Use a publisher-provided image only when its terms allow Ventro's display or hotlinking; otherwise use a licensed company logo or an intentional topic illustration. No unrelated AI-generated “news photo.” Avoid copying social/press images to R2 without permission. Provide a clean text-first card when no safe image exists; broken image URLs should fall back without collapsing layout.

## Additive data model (design target, migrate incrementally)

Keep existing tables; avoid a replacement migration or a second database until volume, rights or query load justify it. Supabase Postgres is the authoritative structured store, R2 the rights-aware blob archive. Add constraints, indexes and row policies with each table.

| Data unit | Minimum fields / relationship |
|---|---|
| `source_documents` or hardened `source_archive` | connector, canonical URL, published/fetched times, content hash, permitted R2 key, rights/retention, fetch state; unique source+URL+version. |
| `source_coverage` / `ingestion_failures` | per-source last attempt/success, cursor, eligible/published/filtered/deduplicated counts, error reason, freshness state and retry status. |
| `extracted_claims` | document ID, subject/predicate/object or typed payload, evidence span, extraction version, source independence key, confidence, review state. |
| `story_clusters` / enhanced `story_sources` | one event cluster with all original URLs, independent-origin keys, canonical event date, verification status and correction history; optionally retain existing `stories` as its public representation. |
| `story_media` | canonical story, image URL or licensed asset key, origin URL, rights decision, attribution, dimensions and fallback state. |
| `funding_rounds` and `round_participants` | one canonical round per company/date/stage; firm/vehicle/role per participant; disclosed amount currency and conversion provenance; conflict records. Existing `investments` can remain a read projection during migration. |
| `investor_statements` / `thesis_versions` | firm or partner attribution, statement date, direct quote/excerpt and source; observed-theme window, sample size, distinct company/round counts, coverage and linked participating rounds. Reuse `stated_thesis`/`observed_thesis` where compatible. |
| `pattern_events` and `pattern_counterexamples` | typed links from existing `patterns` to qualifying rounds/companies/funds/documents; comparison window, denominator, baseline and coverage. JSON may cache display, not be sole lineage. |
| `opportunity_gaps`, `idea_hypotheses`, `validation_runs`, `validation_evidence` | exact problem/user/alternative, pattern IDs, assumptions, falsifiers, pro/con evidence, research method, status and expiry. Separate market observation from founder idea. |
| `pipeline_runs` and `model_usage` | stage, version, input count, output count, rejected count, error, latency, tokens and estimated cost; no secrets or raw prompts in user-facing views. |

Before any schema changes, map existing migrations and deployed state, then use additive migrations and idempotent backfills. Seeds labeled `unverified` are demo/catalog material, not training or verified evidence by default.

## How data becomes an investor answer

The handoff between stages must be typed, replayable and measurable. A screen never asks a language model to invent an answer from live search results. It reads a versioned result produced by the pipeline below. Keep a lineage table or equivalent links from every published sentence back to its claims and source documents.

| Stage | Input → persisted output | Gate before the next stage |
|---|---|---|
| 1. Discover and capture | Approved connector → source document with URL, rights, timestamps, hash and permitted snapshot. | Fetch succeeded, rights known, duplicate source version recognized. |
| 2. Classify and cluster | Source document → typed candidate (`funding`, `thesis_statement`, `product_release`, `YC_launch`, `research`, `policy`, other) and canonical event cluster. | Relevant to AI; old/reposted/syndicated material not presented as a new event. |
| 3. Extract claims | Candidate + allowed text → atomic claims with exact evidence spans and entity mentions. | Schema, span existence, date/currency validation; unsupported fields rejected, not guessed. |
| 4. Resolve and verify | Claims → canonical company/fund/vehicle/product/round IDs, verification state and conflicts. | Primary or independent evidence for material claims; unresolved identity/role stays partial. |
| 5. Publish base data | Verified/qualified event → one story, company/YC timeline entry and, for disclosed financing, round participation edges. | All displays use the same canonical IDs and disclose what is unknown. |
| 6. Derive investor intent | Dated official statements + verified round edges → stated-thesis excerpts and observed-theme snapshots. | Observed themes show window, sample, coverage and supporting rounds; sparse data abstains. |
| 7. Derive patterns | Verified events + historical baseline → candidate change with supporting events, denominator, counterexamples and uncertainty. | Deterministic counts, source-diversity/coverage checks, high-impact review before publication. |
| 8. Derive gaps and ideas | Qualified patterns + buyer pain + alternative map → gap and falsifiable solution hypothesis. | Supporting **and** contradictory evidence, explicit assumptions; desk research never equals customer validation. |
| 9. Serve and monitor | Published versioned cards → shared browse/feed/search plus workspace ranking and alerts. | Freshness, corrections, evidence links and cache scope are visible; no per-page research call. |

**Question 1, “Where are investors investing?”** Query canonical `funding_rounds` and `round_participants` by investor, period, stage, geography and AI topic; join company profile and original round evidence. Show counts of distinct companies and rounds, disclosed amount only when known, and separate *led*, *participated* and *mentioned*. YC affiliation is a company attribute, not a round participant.

**Question 2, “What are investors looking for?”** Return two side-by-side answers: (a) dated *stated* themes with direct firm/partner attribution and source, and (b) *observed* themes computed from verified investments with a fixed taxonomy, window, denominator, coverage and examples. Add a comparison such as alignment or emerging divergence only when both sides have enough evidence. A recent pattern involving YC companies may be context, but cannot substitute for an investor's statement or verified investment. On insufficient data, answer “not enough public evidence” and show the missing coverage.

**A thesis is not a pattern.** A thesis describes one investor's declared or revealed focus. A pattern is a measured change across a cohort and time window. A gap adds evidence of unmet customer demand and inadequate alternatives. An idea is a proposed testable response. Keep these as separate records and separate UI labels so one attractive model-generated sentence cannot jump four inference steps.

### Example lineage for one published card

```text
official round announcement + independent report
  → claim: company X raised round Y on date Z; investor F participated
  → canonical round Y and verified F→Y edge (question 1)
  → F's observed portfolio theme snapshot, with N disclosed rounds (question 2)
  → cohort-level change versus prior period, with counterexamples (pattern)
  → only if buyer pain and alternatives are independently researched: gap candidate
```

The card stores every upstream ID and computation version. If the investor is later found to be merely mentioned, retract that edge and recompute every dependent result. A second LLM agreeing with the first does not repair missing source evidence.

## Model routing, keys and cost controls

Use models as replaceable processors behind one server-side `ModelRouter` contract, not as scattered calls from React pages or a single `OPENAI_API_KEY` used for everything. The router accepts `task_type`, schema version, approved evidence IDs, maximum input/output tokens, deadline, spend ceiling and sensitivity; it returns a schema-validated candidate plus provider/model/prompt version, token usage, latency and estimated cost. Persist outcomes in `pipeline_runs`/`model_usage`. Never send unrestricted raw archives, credentials or private workspace notes to a provider by default.

| Work | Default route | When to escalate | Never delegate to a model |
|---|---|---|---|
| Fetch, URL normalization, duplicate hashes, date/currency parsing and known aliases | Deterministic code/SQL, no inference bill. | Uncertain semantic event clustering may use a small model after rules. | Rights decisions, exact arithmetic, database authority. |
| AI relevance, event type, topic tags and basic claim extraction | Benchmark-selected low-cost hosted model **or** commercially usable open-weight model, given only permitted text; strict output schema. | Ambiguous investor role, mixed announcements, cross-language or conflicting facts go to a stronger model or review queue. | Treating confidence text as proof or filling absent fields. |
| Short source-grounded story summary | Low-cost model on verified claims and allowed excerpts; deterministic citation attachment. | Stronger model only for complex multi-source reconciliation after bounded retrieval. | Unsupported numbers, unattributed quotes or independent verification. |
| Stated-thesis candidate extraction | Low-cost model on official investor material, with exact span and speaker/date. | Stronger model for attribution ambiguity; human review for consequential dispute. | Calling a portfolio inference an official statement. |
| Observed thesis and pattern calculation | SQL/statistical code computes windows, sample sizes, counts, baselines and coverage. A small model can draft plain-language labels from those computed fields. | Stronger model may critique a candidate against retrieved counterevidence. | Deciding the numerical result, source independence or publication threshold. |
| Gap/idea generation and adversarial research | Small model proposes candidates from bounded, cited inputs; targeted search/fetch only for uncertainties. | Stronger model tests an already specified hypothesis on a limited evidence pack; unresolved claims stay unpublished. | Claiming buyer demand, validation or market size without direct evidence. |

**Provider strategy:** Start with deterministic work plus one low-cost hosted candidate and one stronger OpenAI candidate to establish a quality/cost baseline. Evaluate an open-weight model through a hosted or self-hosted runtime as a third candidate; do not assume “open weight” means free, commercially licensed or cheap to operate. NVIDIA NIM is one possible runtime with an OpenAI-compatible API, but self-hosting requires suitable GPU capacity and an applicable license; evaluate total GPU uptime, operations and throughput before switching. Keep the provider adapter portable so a winning model can change without rewriting the evidence pipeline. Check current [OpenAI API pricing](https://platform.openai.com/pricing), [OpenAI structured-output support](https://developers.openai.com/api/docs/guides/structured-outputs), [OpenAI Batch options](https://developers.openai.com/api/docs/guides/batch), and [NVIDIA NIM compatibility/licensing](https://docs.nvidia.com/nim/large-language-models/latest/reference/api-reference.html) when making the actual deployment choice; these terms change.

**Routing policy:** A failed cheap-model schema validation gets one bounded retry or a rule-based rejection; it does not trigger unlimited premium retries. Escalate only if the item's expected value and ambiguity warrant it and the remaining stage budget allows it. Batch asynchronous backfills where freshness permits; reuse identical model inputs by `(content_hash, task, schema_version, prompt_version, model_version)`. Cache common prompt prefixes only where the selected provider supports it. New model/provider/prompt versions run in shadow mode on labeled items before replacing production output.

**Key policy:** Keep OpenAI, NVIDIA, Tavily, Firecrawl, Supabase service-role and R2 credentials in server/job secret stores, never `NEXT_PUBLIC_*`, browser bundles, commits, user-visible logs or prompt text. Use separate provider keys/projects for development and production where available, least privilege, rotation, explicit owner and environment-specific spend/rate limits. The browser calls Ventro APIs; only the backend job/router calls model providers. Sanitize logs, restrict source URL fetches, and treat retrieved web text as untrusted data, not instructions. If a provider key is absent, optional jobs fail visibly or enter a pending queue; never silently publish a lower-standard result.

**Spend policy:** Set owner-configurable per-call, per-task, per-day and monthly ceilings before the first backfill. Reserve a portion of available credits for evaluation and emergencies. Forecast `items × eligible_fraction × average_input_tokens × input_rate + outputs × output_rate + search/fetch cost`, then compare to actual cost per *accepted cited fact* and per *published useful card*. Stop or downshift enrichment at the budget ceiling, but keep deterministic collection and a truthful feed alive. A user page view must not generate a billable research workflow. The price table and free credits are temporary inputs, not architecture constants.

**Selection test:** On the same held-out labeled set, measure fact precision, unsupported-claim rate, investor-role accuracy, attribution accuracy, JSON/schema success, abstention quality, latency and cost per accepted fact for each candidate route. A cheaper model wins only if it meets the quality floor. Re-run the benchmark after model/prompt changes; record regression and provider outage behavior.

## Delivery sequence and exit gates

### Gate 0A — Make the present data path real

Repair the scheduled worker entry point and server-side service credentials, load enabled connectors from `source_connectors` rather than the three-item array, and record failed DB/R2 writes as failures. Start with one individually rights-checked official source per stream (VC, YC, AI update); use RSS only where the source actually offers it. Do not assume the Phase 0 source inventory is approved in production. Wire both home and News screens to the same real feed API and show honest empty/loading/error states. Add a smoke run from capture → archive → story row → feed card with a clickable original source. Diagnose any zero-row home feed at the API, RLS and database levels before changing presentation.

**Pass when:** a scheduled run succeeds without a browser session, a second run is idempotent, failed writes are visible, real sourced items from each stream appear in home/News, and no `MOCK_STORIES` content appears as live news. Log fetched/new/rejected counts per connector. Do not proceed on seed rows alone.

### Gate 0B — Expand coverage and verify before scaling intelligence

Activate additional official sources in tested cohorts: more VC blogs/portfolio pages, YC directory/launches and company pages, major model-provider/developer/research blogs, then selective independent reporting and permitted search/fetch gap-fill. Build the six quality gates above before increasing source count. Differentiate paper, release, funding, investment thesis, policy and general news in both storage and UI. Add source-health dashboards, missing-update reports and a weekly spot audit of rejected posts.

**Pass when:** each stream has a documented source coverage map, working automated cadence, last-success visibility and a measured false-positive/missed-update sample. A duplicate or syndicated article produces one canonical story with multiple attributed links; a disputed claim is never silently labeled verified. Volume alone is not a pass criterion.

### Gate 1 — Verified investment graph (question 1)

Build an extractor for funding-event candidates from approved documents; classify announcement versus analysis/rumor; resolve company and investor aliases; distinguish one round from multiple articles and a firm from its vehicle. For each participant require source support for role. Keep conflicts as parallel claims until resolved, and mark undisclosed amounts as unknown. Backfill a deliberately bounded AI cohort (suggestion: 10–20 funds and their disclosed AI rounds over a defined recent window), then incrementally expand. Company and fund pages use the same canonical graph.

**Pass when:** a user can trace a displayed investment to its round, participant evidence and original source; duplicate articles do not create duplicate rounds; lead/participant/mentioned are not conflated. Evaluate on a human-labeled set of disclosed rounds and publish precision, recall, identity error and abstention rates before expanding coverage.

### Gate 2 — Investor intent engine (question 2)

Extract dated thesis statements only from attributable investor material (firm sites, partner interviews, talks where attribution is clear). Store exact evidence; display short original excerpts within rights limits and link out. Compute observed thesis from *verified* disclosed investments using fixed windows and a stable AI taxonomy; show distinct companies, rounds, stage/geography/theme distributions, period, coverage and caveats. Compare stated and observed thesis as aligned, emerging, divergent or insufficient evidence—never “the investor wants” without a direct statement.

**Pass when:** every stated theme opens its own source, every inferred theme opens its supporting investments, and a sparse portfolio yields “insufficient public evidence.” Test statement attribution and portfolio-theme accuracy against labeled examples; show methodology and last-computed date on investor pages.

### Gate 3 — Pattern engine

Generate candidates only from the verified event graph. Define a pattern as a measurable change from a baseline within a stated window and cohort, not merely two similar headlines. Count distinct companies and investors, normalize for source coverage, detect reused syndicated reporting, seek counterexamples and compare plausible alternative explanations. An LLM may name/explain a candidate but cannot set counts or publish it. Review high-impact or disputed interpretations; routine event ingestion remains automatic.

**Pass when:** each published pattern card exposes its qualifying events, denominator/baseline, period, counterexamples, coverage and status; changing/removing a supporting round invalidates affected patterns. A held-out evaluation set includes attractive false patterns and sparse-coverage cases. Track precision at publication, not only candidate volume.

### Gate 4 — Gaps, ideation and adversarial validation

Gap candidates require *both* a demand signal (repeated buyer pain, requests, spending, adoption bottleneck or explicit investor thesis) and a supply/alternative map. “Few startups found” or “investor activity increasing” alone is not a market gap. Express each candidate as target customer + job-to-be-done + current workaround + evidence + why existing alternatives fail + what is unknown. Generate an idea as a testable solution hypothesis, then actively search for competitors, counterexamples, regulatory/technical blockers and negative customer evidence. Distinguish desk-research validation from real customer validation; the latter requires actual interviews/experiments, not an LLM verdict.

**Pass when:** each gap/idea shows supporting and contradicting evidence, assumptions, falsifiers, next validation experiment and status (`candidate`, `needs_research`, `invalidated`, `desk_validated`, `customer_validated`). The engine can invalidate its own attractive idea. No automatic “validated business” badge from web research alone.

### Gate 5 — Feed UX, design system, personalization and operational quality

Give the app one navigation shell: the dashboard layout owns the top bar, while pages own only their title, filters and content. Remove page-level duplicate `<header>` elements, audit sticky offsets on desktop/mobile, and make navigation/active state consistent. Redesign the visual system deliberately: typography scale, spacing grid, colors/contrast, card density, image ratios, badges and mobile behavior. Keep the brand calm and information-first; facts and source labels outrank decoration.

Make the feed useful at a glance: clear sections/tabs for **For You**, **All AI**, **Investors**, and **YC** (not four separate data stores); each card shows event type, concise sourced summary, date, entities, verification/freshness state, image when licensed, and a path to source details. Offer “why shown,” topic filters, follow/save and a story timeline without crowding the first scan. A read of one card should make the relevant company and investor pages discoverable.

Implement distinct UI states: first-visit with no preferences, genuinely empty database, empty filtered results, loading skeleton, partial/stale cached result, authentication/permission error, source outage, transient API failure with retry, and unavailable image. Never replace an empty real response with mock data. Use server-side pagination or cursor loading, bounded caching and stale-while-revalidate only where the result is safe to share; workspace-personalized responses must be cache-keyed by user/preferences or private. Display “updated at” and stale status so cache does not masquerade as live news.

Rank the shared corpus by each workspace's selected topics, followed funds/companies, stage and geography. Alerts fire on meaningful verified changes, not every article. Saved cards and community discussions reference canonical IDs; user claims never silently enter the fact corpus. Instrument freshness, source coverage, review backlog, corrections, accepted facts per dollar, model cost, user click-through to evidence and alert quality. Rate-limit external calls and cache derived results globally.

**Pass when:** one top bar appears on every desktop/mobile route; home and News show the same real story corpus; image/no-image cards remain legible; all listed loading/empty/error/stale states are tested; two users with different preferences see different rankings from identical underlying facts; entitlement/RLS prevents cross-user private data exposure; stale/retired insights and source corrections propagate to pages and alerts. Test keyboard navigation, screen-reader labels and mobile widths alongside visual review.

## Evaluation and cost discipline

Turn [the evaluation-set specification](phase0/05-100-item-evaluation-set.md) into an actual labeled fixture before choosing a default extraction model. Include round identity/participation, source-backed thesis attribution, summary faithfulness, baseline-valid patterns, false gaps and explicit abstentions. Sample failures weekly; keep gold labels separate from model output. A release needs measured performance on held-out items and a manual review of the most consequential errors; set numeric thresholds after baseline measurement rather than inventing them here.

Use official RSS/APIs first; invoke Tavily/Firecrawl only for missing or ambiguous evidence and only where terms permit. Batch extraction per document, hash/cache by content and model/prompt version, use cheaper models for candidate generation, and spend stronger-model calls on ambiguous high-value records. Add a per-run and monthly budget with hard stops before scaling the cohort. User requests read precomputed intelligence; they should not launch expensive research on every page load. Record tokens, external requests, cost estimates, accepted facts and rejection reasons by stage.

## Step-by-step build and real-data population runbook

These are implementation and launch steps, **not commands that work in the current repository today**. Complete each output check before moving dependent stages forward. Keep the existing PRD intact. For the first real cohort, use a bounded target (for example, 10–20 VC firms, a recent YC batch, and a set of official AI update sources over a declared lookback window); expand only when the quality and rights checks hold. Do not equate this cohort with complete global coverage.

| Order | Build or run | Evidence that the step is done |
|---|---|---|
| 1 | Inventory the live environment: Supabase project/migration versions, R2 bucket, scheduled-job status, secret presence **without revealing values**, and row counts for connectors, archive, stories, companies, funds, YC tables, investments, theses and patterns. Record known mock-only pages. | A dated baseline report distinguishes seed/demo rows from real, sourced rows and identifies why the home feed is empty. |
| 2 | Fix the ingestion worker boundary: a runnable job entry point, service-side database client, scoped secrets, checked DB/R2 writes, retries/dead letters and per-source logs. Add dry-run mode. | Manual and scheduled smoke runs work without a browser session; failures are visible and a repeated run is idempotent. |
| 3 | Choose the first source cohort from VC, YC and AI-world categories. For every connector verify live endpoint, rights, permitted media, cadence and expected facts; store these in the source registry. | Source register contains working tests, owner and last-success timestamps; unapproved sources cannot run. |
| 4 | Implement RSS/Atom and documented API adapters first, then permitted HTML for high-value gaps. Keep stable source IDs and cursors. Add bounded Tavily discovery/Firecrawl fetch only for recorded coverage gaps. | Each of the three streams produces actual archived metadata, and request caps prevent unexpected spend. |
| 5 | Build source filtering, URL/content deduplication and event clustering, with rejection reasons and a review sample. Add an admin queue for disputed claims and source failures. | One real-world event covered by multiple articles yields one cluster; an off-topic item is rejected with an auditable reason. |
| 6 | Add the model router and usage ledger, benchmark low-cost hosted, stronger OpenAI and an open-weight candidate on labeled extraction items, then pin a route per task. Store keys only in job/server environments. | Selected routes meet the quality floor and budget; every billable call reports task, model/version, tokens, cost and outcome. |
| 7 | Extract typed claims and resolve canonical company, investor, vehicle, product and YC identities. Persist source spans and unresolved conflicts. | A sampled set of records can be replayed from archive to claims; unsupported dates, roles and amounts are null or rejected, never filled by guesswork. |
| 8 | Publish real `stories`/`story_sources`, company timelines and YC updates from verified/qualified clusters. Connect both home and News to the same API. Remove mock news from live routes; implement loading, empty, stale and error states. | After a fresh run, a new real item appears in the feed with original-source link, timestamp, verification label and safe image/fallback. Zero rows remain an honest empty state. |
| 9 | Backfill the chosen lookback window and pilot source cohort with resumable checkpoints. Process oldest-to-newest per source or cursor; use content hashes and idempotent upserts so retries cannot duplicate articles. Run daily incremental collection after backfill catches up. | Counts by source/date are stable on replay; at least one week of scheduled runs is observed, with freshness and missed-source alerts. |
| 10 | Derive canonical funding rounds and participant edges from sourced claims; reconcile press releases and independent reporting. Populate investments/portfolios from those edges, not guessed investor arrays in company seeds. | “Where is fund F investing?” returns real dated rounds with company, stage, role and source; a sampled manual audit checks identity and dedupe. |
| 11 | Extract official dated investor statements and compute observed thesis snapshots from verified edges. Materialize a versioned investor-answer record that joins both views but never merges their meaning. | “What is fund F looking for?” shows attributable stated themes, portfolio-derived observed themes, period, sample size and caveats; insufficient evidence is explicit. |
| 12 | Run baseline-aware pattern candidates on the verified graph, add counterevidence and source-coverage checks, then publish only qualified/reviewed cards. | At least one pattern is reproducible from its event IDs and baseline; a false/sparse-coverage candidate is withheld. Corrections invalidate downstream cards. |
| 13 | Add gaps and idea-validation jobs after the underlying data supports them. Require buyer-demand and alternative evidence, then run bounded adversarial searches and generate a next experiment. | A gap can be rejected, and a desk-validated idea is never shown as customer-validated. |
| 14 | Repair the shared app shell and complete the feed/profile UI: one top bar, consistent mobile navigation, real image policy, filters, evidence drill-down, personalized ranking, save/follow and clear loading/error/empty states. | Desktop/mobile and keyboard checks pass; two accounts see different ranking but the same canonical facts. No page implies stale cache is live. |
| 15 | Launch with an operations review: source health, rights retention, model spend, correction workflow, API/RLS access, backup/replay, and the held-out evaluation results. Switch on alerts only for verified meaningful events. | A new source event travels through the system without manual SQL, appears on the correct pages, updates a related company/investor answer when applicable, and can be corrected end-to-end. |

**The real-data acceptance check:** Public-facing home and News have no mock records; the VC, YC and AI-world feeds each have current, attributed items; the company/investor pages link to underlying source documents; investments are backed by canonical rounds; a fund's stated and observed theses are distinguishable and dated; patterns link to their baseline and events. Admin can see connector freshness, rejected items, conflicts and model spend. Run a sampled source-click audit before claiming this milestone. Exact counts and freshness targets should be set from the chosen source cohort and measured baseline, not invented in advance.

**If a stage is behind:** Serve the last known good, visibly timestamped *verified* snapshot when rights and freshness policy allow. Otherwise show an honest partial/empty state. Do not fabricate missing AI news, backfill with unverified seed records, silently widen search spend or call an investor inactive because coverage failed.

**Do not call the product an intelligence engine merely because a table or screen exists.** The milestone is a user-visible, reproducible answer to both investor questions, with source-level evidence and honest unknowns. That is the decision point for the next-generation product.
