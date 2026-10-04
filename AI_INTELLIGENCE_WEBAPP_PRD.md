# AI Investment Intelligence Web App — Product Requirements Document

**Version:** 1.0 draft  
**Date:** 2026-09-30  
**Status:** Build brief for a new repository; not a description of the existing n8n system  
**Initial scope:** AI companies and AI-focused investors worldwide, with useful India coverage

## 1. Product decision

Build a web app that answers two questions with inspectable evidence:

1. **Where are investors investing?** Show verified company–round–investor relationships, dates, amounts when disclosed, and source links.
2. **What are investors looking for?** Show a fund's *stated thesis* from its own material separately from an *inferred thesis* based on observed investments and recent activity. Never present an inference as a fund's official position.

The entry point is a timely, deduplicated AI news feed. Company and investor profile pages turn news into a navigable history. Patterns and insights explain changes across multiple events. Personal workspaces and community discussion make the intelligence actionable.

### Primary users

- **AI founder:** identify relevant, recently active investors and understand why a fund may fit.
- **Investor/analyst:** follow AI subsectors, companies, peers, rounds, and emerging themes.
- **Student/researcher:** learn from sourced market history and save a focused watchlist.

The first launch should optimize for the AI founder's investor-discovery journey while keeping analyst-grade evidence. Do not claim to predict a fund's next investment.

### Product principles

- One centrally collected corpus serves all users; workspaces hold preferences and private activity, not copied news.
- Every factual claim has provenance. Unknown, disputed, and inferred values are visibly labelled.
- AI assists extraction, classification, summarization, and candidate insight generation. Rules and evidence determine publication status.
- Fast scan first, depth on demand. Every feed card links to a company, investor, event, or original source where relevant.
- No n8n and no hardcoded workspace IDs in collection jobs.

## 2. Scope and release boundaries

### Included in the product roadmap

- Responsive landing site; authentication; onboarding; $10/month subscription; eligible student trial.
- AI news feed with clustering, attribution, search, filters, and summaries.
- Public company directory and a profile page for **every company in our catalog**, even if some fields are unknown.
- Public investor directory and an individual profile for every tracked VC/fund.
- YC company/batch tracking, investment tracker, stated/inferred thesis views, evidence-backed patterns, alerts, saved workspace, and discussion.
- A minimal internal admin panel for source health, ingestion, AI/request usage, claim correction, and one insight/exception review queue.

### Not promised at launch

- Exhaustive coverage of all private investments or all YC companies.
- Proprietary deal-flow access, undisclosed valuations, private fund mandates, or guaranteed real-time updates.
- A general-purpose financial adviser, investor recommendation engine, CRM, mobile app, or large-scale social network.
- Bulk republishing of third-party articles or a resale API for third-party data.

## 3. Information architecture and key journeys

**Public navigation:** Home, News, Companies, Investors, YC, Pricing, Sign in. Public pages show a useful factual preview; premium depth and personalized functions require entitlement.

**Signed-in navigation:** For You, News, Investments, Companies, Investors, YC, Patterns, Saved, Community, Settings. Keep the same navigation and filters on desktop and mobile; use a compact bottom navigation or menu on small screens.

### Journey A — new member

1. Landing page explains the two questions, shows a real cited example, coverage/freshness, and transparent $10/month pricing.
2. Sign up with email/password or supported OAuth; verify email; sign in, reset password, and sign out safely.
3. Onboarding asks five short questions: role; AI topics (for example models, infrastructure, applications, robotics); geography; company stage; and funds/companies to follow. All are editable and skippable. Do **not** force users into the old seven-domain taxonomy.
4. Show a useful personalized feed immediately, explain why each item appears, and offer save/follow actions.
5. Show payment or trial entitlement before gated depth. Preserve onboarding choices if payment is abandoned.

### Journey B — founder researches an investor

Search a fund → open its profile → inspect stated thesis, recent investments, typical disclosed stage/geography, and source-backed inferred themes → compare with own selected AI topics → follow fund and receive an alert when a new relevant event is verified. Fit explanations must say *why* and link to evidence; no unsourced “best investor” score.

### Journey C — analyst investigates a pattern

Open a pattern card → see the time window, baseline, distinct companies/funds, qualifying events, counterexamples, confidence/coverage, and exact links → save it and discuss it. A pattern is not publishable solely because an LLM wrote an attractive summary.

## 4. Page and interaction requirements

### Landing page

- Hero centred on the two product questions; one short interactive example from a real, cited data item.
- Sections for news → round → investor thesis → pattern, each with a preview of the real UI.
- Explain sourcing, freshness, coverage limitations, privacy, and the single $10 plan.
- Clear actions: Explore preview, Sign up, Pricing. No fabricated counters, testimonials, or “live deals.”
- Fast loading, accessible contrast, keyboard navigation, meaningful empty/error states, SEO metadata.

### News feed

- Cluster duplicate coverage into one story; show headline, original short summary, event date, publisher/source count, companies, investors, AI topics, and verification label.
- Filters: latest, topic, geography, event type, company, investor, YC batch; search and sort; follow/save.
- Story detail shows a timeline of source links and which claims each source supports. Show “last checked” and corrections.
- Do not show full third-party article text unless its licence permits it.

### Company directory and **every company profile**

- Directory search/filter by AI topic, geography, stage, YC batch, funding activity, and recency.
- Each catalogued company gets a stable URL and profile, even with sparse data. Minimum: name, canonical site when known, short sourced description, AI tags, location if known, source links, last updated, and “information not yet verified” where appropriate.
- Richer profiles add founding details, product, funding timeline, investor relationships, YC membership, key announcements, technical signals, related companies, and saved/follow status.
- Never invent revenue, valuation, employees, customer counts, or round size. Display “not disclosed” instead.
- Resolve aliases/renames to one company identity; preserve redirects and correction history. Profiles can be reported for correction.

### Investor directory and **individual VC pages**

- Track an initial curated set of 50 AI-relevant VCs; expand toward 100–200 only as source quality allows. Distinguish investment firm, fund vehicle, and individual partner.
- Profile: name/site, location, fund/partner relationships when verified, official thesis excerpts paraphrased with links, disclosed portfolio/investments, activity timeline, sectors, stages, geographies, and source coverage.
- Separate tabs or clear labels for **Stated thesis** and **Observed thesis**. Observed thesis includes methodology, period, sample size, and last computed date. A lack of recent public announcements does not mean a fund is inactive.
- Allow follow, compare, and report correction. Do not publish personal contact details without a clear lawful source and product need.

### YC and investments

- YC batch pages and an AI-company subset, with source-labelled membership and company links. YC data access/reuse must be checked before automated bulk import.
- Funding event detail: company, date, stage, amount/currency if disclosed, investor and lead roles only when sourced, announcement/filing links, conflicting reports, and verification state.
- Round list filters by date, stage, geography, AI topic, YC status, and investor. Charts must show disclosed-only totals and coverage notes; never sum undisclosed rounds as zero.

### Patterns, workspace, community

- Pattern pages show the underlying events and baseline. Statuses: candidate, published, corrected, retired. One admin review gate applies to high-impact interpretations/disputed claims, not routine low-risk news ingestion.
- Workspace contains follows, saved stories/profiles/patterns, private notes, personalized feed settings, and alert frequency. Users can explain or reset personalization.
- Community initially supports discussion attached to a company, investor, or pattern; basic reporting and moderation. No free-form public claims are promoted into the factual corpus without independent verification.

## 5. Access, pricing, and trial

- **One paid plan:** USD **$10/month**, before applicable taxes. No annual tier or complex feature matrix in v1.
- **Masters' Union student offer:** exactly one **10-day free-access trial** after successful verification of an email whose domain is exactly `mastersunion.org` (case-insensitive). `name@sub.mastersunion.org`, lookalike domains, and unverified addresses do not qualify. Do not imply institutional endorsement.
- Trial starts at verified-email entitlement issuance, ends 10 × 24 hours later in UTC, and requires no payment card. The member may subscribe during or after trial; define billing start clearly in checkout. Do not silently charge at expiry.
- All other users can view the public preview and may subscribe immediately. At trial/subscription expiry, private saves and settings remain stored but premium access is gated.
- Subscription state is determined server-side from signed payment webhooks; idempotent processing handles duplicate/out-of-order events. Include billing portal, cancellation, failed payment, refund/support, and entitlement audit views.
- **Payment provider is an explicit launch decision.** Do not assume a new India-based Stripe account is available: Stripe currently describes India onboarding as invite-only. Evaluate Razorpay or another eligible provider for the actual business entity and USD checkout requirements before implementation.

## 6. Shared intelligence pipeline

### Initial source pack

Curate 50 AI-focused VCs, 50 AI companies, recent YC AI batches, relevant official company/fund RSS and announcement pages, SEBI RSS/AIF registry/statistics, PIB, SEC, GDELT, Hacker News, GitHub releases, and Hugging Face. Extend after a two-week source audit, not by increasing paid search indiscriminately.

### Stages

1. **Discover:** official feeds/APIs first; targeted Tavily search only for coverage gaps.
2. **Fetch:** direct permitted HTML/feed/API fetch; Firecrawl only when a difficult page justifies a credit. Check source terms, robots guidance, rate limits, and retention before enabling a connector.
3. **Archive:** store permitted raw response or a minimal metadata snapshot in Cloudflare R2 with source, fetch time, checksum, and retention rule.
4. **Normalize/deduplicate:** canonical URL, content hash, language, publisher, publication time, and story cluster.
5. **Extract:** structured company, fund, event, thesis statement, and evidence spans. Validate JSON contracts and reject unsupported fields.
6. **Resolve and verify:** link entities, separate independent sources from syndication, attach each factual field to evidence, detect conflicts and corrections.
7. **Publish and personalize:** publish factual items with confidence/coverage labels; compute workspace rankings from shared records and individual preferences.
8. **Measure:** record fetch success, unique yield, accepted claims, errors, paid API credits, model tokens, latency, and stale sources.

Every stage is idempotent and replayable. Failures go to an admin queue with an error and retry count. A failed provider call cannot turn into an empty “verified” result.

### Model strategy and credit guardrails

- Use a provider-neutral interface. Start with low-cost OpenAI models for extraction/summarization and evaluate NVIDIA-hosted open models on the same labelled test set. NVIDIA preview access is a development resource, not assumed production capacity.
- The available **$50 OpenAI credit** and existing free Tavily/Firecrawl credits are finite launch resources, not a sustainable monthly budget. Track remaining credits manually or via provider usage APIs where available.
- Cap items/day, tokens/item, fallback searches/day, and scrape credits/day. Stop paid calls at a hard budget threshold; continue ingesting cheap feed metadata and mark delayed enrichment. Never retry indefinitely or silently fall back to a more expensive model.
- Create a 100-item labelled evaluation set for round extraction, investor identity, thesis attribution, and summary faithfulness before choosing a default model. Compare quality, latency, and cost per accepted fact, not just price per token.

## 7. Storage decision for v1

**Recommended:** Supabase Postgres for structured shared intelligence, auth, workspaces, entitlements, discussions, and provenance; **Cloudflare R2** for permitted raw documents and replay snapshots. R2 is object storage, not the user-facing database. Keep a reference and checksum in Postgres. Implement export/restore for both stores because one backup does not cover the other.

**Do not add MongoDB or Cloudflare D1 at launch.** Both create a second query database and synchronisation burden without solving the raw-archive need. Current free limits are approximately 512 MB for MongoDB Atlas M0 and 500 MB per Cloudflare D1 database; R2 has a 10 GB-month free Standard storage allowance. Reconsider a second database only when a measured workload cannot be handled by Postgres plus object storage.

The Supabase Free project has a 500 MB database quota and may pause after low activity, so the product must monitor size, export backups independently, and have a documented upgrade trigger. Store no API/service-role keys in the browser or public GitHub Actions logs.

## 8. Experience, trust, and operations requirements

- Responsive desktop/mobile web; readable dense lists, clear detail hierarchy, keyboard access, accessible labels, loading/skeleton/empty/error states, and source links reachable within one interaction from a claim.
- “Why am I seeing this?” on personalized feed cards; “How was this inferred?” on thesis and pattern pages.
- Search supports aliases and misspellings; filters remain in the URL for sharing. Public profile URLs remain stable.
- Explicit coverage/freshness indicator per source and page; a stale result is not presented as current.
- Admin can pause a connector, correct a fact, merge/split entities, retire a pattern, inspect source rights, and review flagged interpretations. All edits have actor/time/reason history.
- Privacy: workspace notes and follows are private by default; public discussion is opt-in. Enforce server-side authorization and row-level security for member data.
- Security: verified email, protected billing/admin routes, signed webhooks, rate limiting for auth/community, secret rotation, data export/deletion, and least-privilege collection credentials.

## 9. Phased development journey and exit criteria

| Phase | Deliverable | Exit criterion |
|---|---|---|
| **0. Evidence and design** | New repo, source-rights register, 50-VC/50-company seed list, 100-item evaluation set, wireframes, payment-provider feasibility | At least 20 sources tested; each connector has owner, method, rights, cadence, and expected fact type. Core user journeys are clickable. |
| **1. Foundation** | Next.js web shell, Supabase auth, onboarding, workspace, shared entity identities, R2 archive, admin source registry | A new user can sign up, verify email, set preferences, sign out/in, and see an empty-state feed without errors. One source can be fetched and replayed safely. |
| **2. News and profiles** | RSS/API ingestion, deduplicated feed, search, company directory/pages, investor directory/pages | Every catalogued company/investor has a stable page; one event with multiple articles appears once, with links and a correction route. |
| **3. Investment and YC intelligence** | Round verification, company–investor graph, YC batch pages, timelines, disclosed-only aggregates | Test set meets agreed extraction precision; unknown amounts/roles never become fabricated values. YC and round evidence is inspectable. |
| **4. Paid personalization** | $10 checkout, eligible 10-day student trial, entitlements, saved items, follows, alerts | Trial eligibility and expiry pass automated tests; billing webhooks are idempotent; non-students cannot self-issue a trial. |
| **5. Thesis and patterns** | Stated/inferred VC theses, baseline-aware patterns, review queue, coverage labels | Published insight shows distinct supporting events, period, baseline, caveats, and corrections; no LLM-only publication. |
| **6. Community and hardening** | Attached discussion, moderation, source/usage analytics, backups, accessibility/performance work | Private notes remain private; abuse reports can be handled; restore drill and end-to-end core journeys pass. |

Phases can overlap in design, but do not claim an engine is complete until its exit criterion is verified with real data. GitHub Actions scheduled workflows may run late, so they are suitable for initial periodic polling, not strict real-time promises.

## 10. Launch measures

- **Coverage:** number of active official sources; percentage healthy; unique relevant stories and verified rounds per week; share with primary-source evidence.
- **Quality:** precision on labelled extraction set; duplicate-cluster error rate; identity merge/split corrections; unsupported-claim and stale-item counts.
- **Usefulness:** onboarding completion; time to first relevant saved item; company/VC page engagement; followed funds; alert opens; paid conversion and retention.
- **Efficiency:** cost per accepted factual item, Tavily/Firecrawl credits per useful source, model tokens per accepted claim, source-fetch success, and queue lag.

Display denominators and coverage changes alongside trend charts. A larger crawl must not be misrepresented as a sudden surge in investment activity.

## 11. Open decisions to close before the relevant phase

1. Legal business entity/country and available payment provider for a USD $10 subscription.
2. Whether public company/VC profiles are fully indexed or show a factual preview with premium detail gated.
3. Exact first 50 VCs and 50 companies, plus approved feed/website reuse conditions.
4. Definition of “verified funding round” and the minimum evidence for amount, stage, and investor role.
5. Public-community moderation policy and whether posting is limited to paid members.
6. Product name, brand direction, and final design system after wireframe review.

These are decisions, not blockers for the PRD or Phase 0. Record their answers before implementing the affected feature.

## 12. Reference checks for time-sensitive assumptions

- [Vercel Hobby non-commercial restriction](https://vercel.com/docs/plans/hobby)
- [Supabase Free limits and pausing](https://supabase.com/pricing)
- [Cloudflare R2 pricing/free allowance](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [MongoDB Atlas free tier](https://www.mongodb.com/pricing)
- [Stripe India availability](https://support.stripe.com/questions/stripe-accounts-are-invite-only-in-india)
- [GitHub Actions schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [SEBI RSS and AIF registry](https://www.sebi.gov.in/rss.html)
- [Government Open Data License–India](https://ap.data.gov.in/godl)

Recheck provider limits, model offerings, source permissions, and payment availability when each phase begins. They are not permanent product guarantees.
