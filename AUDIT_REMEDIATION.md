# Ventro production audit (2026-10-05)

This audit compares the signed-in production UI with the current repository. It is a diagnosis, not a claim that the data pipeline is complete.

## P0: Core intelligence pipeline is disconnected

- Scheduled ingestion fetches connectors and clusters stories, but does not run verification, entity linking, funding extraction, thesis extraction, or pattern detection (`scripts/run-ingestion.mjs`).
- New clusters are always `unverified` and have empty company and investor links (`src/lib/ingestion/story-clustering.ts`). Funding extraction only accepts `verified` or `partial` funding stories and relies on company links (`src/lib/ingestion/funding-extractor.ts`).
- Funding extraction writes `funding_rounds` and `round_participants`; the Investments page reads their `investment_graph` view through `/api/investment-graph`. The separate `/api/investments` route still reads the legacy `investments` table but is not used by this page. The empty page is therefore an upstream evidence/verification gap, not this route mismatch.
- Pattern detection requires verified investment-graph rows. Production currently shows zero investment rounds and zero patterns.

**Repair order:** add deterministic story source verification and entity matching with review states; connect an idempotent, budgeted extraction job after clustering; compute investor theses from cited records; then run pattern detection. Add stage counts and last-success timestamps to admin before scheduling costly jobs. Retire or redirect the unused legacy `/api/investments` contract separately.

## P1: Trust and data presentation

- News shows 600 stories but first-page cards are unverified and usually single-source. The page promises "verified sources", which is not the same as verified claims.
- A story detail lists one source in its header but zero rows in Source Timeline. It also displays an empty `By` field. The API reads `story_sources` but does not expose the stored `source_urls` fallback.
- Company listings include duplicate Browserbase and E2B entries. Company profiles show round amounts and lead investors while their funding timeline and investor relations are empty; the figure cannot be checked in context.
- Investor profiles show zero portfolio links and no usable thesis. YC lists S25 as "in progress" in October 2026 and sparse older batches.

**Repair order:** reconcile backfilled source links; hide or qualify uncited funding claims; merge duplicate entities using canonical domains and redirect IDs; link rounds to companies/funds; refresh YC batches from primary data and derive batch status from dates.

## P1: Operational and access issues

- Admin Sources displays "No sources found" despite prior ingestion processing approved connectors. Check the endpoint's user-scoped RLS result and show a distinct error/permission state instead of an empty state.
- `POST /api/admin/extract` treats any email containing `admin` as an administrator. Replace this with a server-enforced role check before exposing expensive jobs.
- The review page treats an email containing `admin` as admin and handles stated-thesis actions as observed-thesis writes. Its review actions need a single server-side route with per-record status transitions and an audit log.
- Prior manual all-source run used almost the 30-minute action limit while many feeds returned 404/403/429 and clustering handled only 100 archived items per normal run. Keep successful-source data, but isolate disabled/dead connectors and drain the backlog in bounded chunks.

## P2: UX structure

- Dashboard layout renders a global navigation header and most pages render a second local Ventro header. Keep one shared shell and page-level breadcrumbs/actions.
- Investments filter exposes raw fund/company UUID fields; replace with searchable names.
- Community is a placeholder (`Community page content here.`). Do not present it as a working feature until real discussion content and moderation are connected.
- Every empty state should distinguish no data, still processing, permission failure, and request failure. Loading states need to preserve layout instead of flashing empty cards.

## Acceptance criteria for the next build

1. A newly ingested funding story has source URL(s), verification state, company link, and a traceable extraction decision.
2. An accepted funding round appears in Investments, the company timeline, and relevant investor portfolio from the same round ID.
3. A thesis and pattern each cite the underlying rounds/stories; a missing evidence base produces a clear insufficient-data state.
4. Admin shows source counts, failure reasons, backlog, stage counts, and last completed run, including errors instead of false empty states.
5. The public UI never calls an unverified claim verified, never shows an empty byline, and has one top navigation bar.

Do not bulk-mark stories verified or fabricate rounds to populate the UI. A smaller cited graph is more useful than a large untraceable directory.

## Local first-pass repairs

- Story detail now falls back to stored source URLs when `story_sources` links are absent, and does not show an empty publisher byline.
- Admin extraction and review UI no longer treat `admin` in an email address as an admin role; extraction GET also checks the server-side role.
- Admin Sources now distinguishes a fetch error from an empty result, labels table columns correctly, and removes placeholder controls that only showed alerts.

These local repairs are not deployed. The P0 pipeline work above remains open.

The Investments page already used `investment_graph`; the earlier claim that its API read the legacy `investments` table was incorrect. No behavioral rewrite of that unused route was applied. The active graph endpoint now preserves participant identity, merges round and participant source links, and requires both sides to be verified before labeling a participation verified. Page-level disclosed value is deduplicated by round, and the empty state explains missing evidence rather than suggesting filters are the only cause.

Remaining data-integrity risk: `round_participants` has a unique constraint on `(round_id, fund_id, fund_vehicle_id)`, but `fund_vehicle_id` can be null. PostgreSQL allows multiple nulls in a standard unique constraint, so repeated extraction may create duplicate firm-level participant rows. Resolve this with a reviewed migration and duplicate audit before automating extraction.
