# Ventro Next-Gen Intelligence — Manual Setup & Operations Guide

This document captures every manual configuration, credential, migration, and operational step required to run Ventro from a fresh checkout through Phase 2 completion. It is updated incrementally as phases ship.

> **Current-state correction (2026-10-04):** Later sections describe intended or partially coded phases, not verified production completion. The repository has no `supabase/config.toml`, and `supabase/schema.sql` is **not** in `supabase/migrations/`. `supabase db push` therefore does not install the core schema on a fresh project. Do not run `schema.sql` again on a database that already has these tables: it contains non-idempotent `CREATE TABLE` statements. Do not run `db reset` against data you want to keep.

### Start here: existing Supabase project

1. In the Supabase SQL Editor, run this **read-only** inventory. Save the results before changing schema:

   ```sql
   select to_regclass('public.stories') as stories,
          to_regclass('public.story_sources') as story_sources,
          to_regclass('public.source_connectors') as source_connectors,
          to_regclass('public.source_archive') as source_archive,
          to_regclass('public.funding_rounds') as funding_rounds,
          to_regclass('public.subscriptions') as subscriptions;

   select version, name
   from supabase_migrations.schema_migrations
   order by version;
   ```

   If the migration-history table is absent, report that error rather than creating or repairing history blindly. The story-detail `PGRST200` was a code query asking for a foreign key that does not exist; no database migration is required for that specific fix.

2. Confirm `.env.local` has the Supabase project URL and anon key for the **same project** you inspected. Keep the service-role key server-side only. Never paste key values into chat or commit `.env.local`. Confirm R2 and billing secrets only when enabling those stages.
3. Start the app and open a story from `/news`. Its detail endpoint must return `200` and show at least the original source URL. If it still returns `PGRST200`, restart the dev server so it loads the updated route.
4. Do **not** run all seeds or `db push` yet. First reconcile the live migration history with the files in `supabase/migrations/`; this repo has an irregularly named YC migration and a core schema outside the migration directory. Record which tables and migrations actually exist. Supabase's CLI applies only pending migration files to a linked remote project, not arbitrary SQL files elsewhere in the repo.
5. For the end-to-end data flow, the remaining gates are: runnable scheduled collector → archived item → clustered story → verified funding round and participant → observed thesis → reviewed pattern → feed/profile display. Code existing in a file is not evidence that a gate passed. The current scheduled job is not runnable as written; do not enable its GitHub Action until its entry point and failure reporting are repaired and tested.

For a **fresh** project, create an explicit baseline migration from the reviewed core schema before using `db push`; test it on a disposable project first. The manual SQL Editor path in the older instructions is an alternative bootstrap method, not something to combine blindly with migration replay on an existing database. Supabase documents that `db push` applies pending local migrations and that an existing remote project should be baselined against its actual schema before future pushes.

---

## 0. Prerequisites (before any code runs)

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ (LTS) | Runtime for Next.js, build, test |
| npm | Bundled with Node.js | Package manager (`package-lock.json` is committed) |
| Supabase CLI | 2.x | Local dev, migrations, seeding |
| Git | 2.40+ | Version control |
| Cloudflare account | — | R2 bucket for raw content archive |

---

## 1. Supabase Project Setup

### 1.1 Create Supabase Project
1. Go to https://supabase.com → New Project
2. Choose organization, name project `ventro`
3. Set a strong database password (save it)
4. Select region close to users (e.g., `us-east-1` or `ap-south-1`)
5. Wait for provisioning (~2 min)

### 1.2 Configure Supabase Settings
- **Authentication → Providers**: Enable Email (password), Google, GitHub OAuth
- **Authentication → URL Configuration**:
  - Site URL: `http://localhost:3000` (dev) / `https://your-domain.com` (prod)
  - Redirect URLs: `http://localhost:3000/callback`, `http://localhost:3000/auth-code-error`
- **Database → Connection Pooling**: Enable Session Pooler (port 6543) for serverless
- **Settings → API**: Copy `Project URL` and `anon` / `service_role` keys

### 1.3 Run Migrations
**Existing project:** run the inventory above and compare its results to the repository before using the CLI. Do not infer applied migrations from tables alone or use `migration repair` without confirming the actual remote history. This repository has not yet been normalized into a reproducible migration baseline.

**Fresh disposable project only:** the core tables are in `supabase/schema.sql`, which must be applied before the dependent migration files. A reviewed baseline migration should replace this manual bootstrap before release. The actual files currently present are:

1. `20261001_add_yc_tables.sql` (irregular version/name; needs normalization before CLI replay)
2. `20261001090000_add_source_archive.sql`
3. `20261001093000_create_user_profiles_on_signup.sql`
4. `20261001094500_enable_uuid_extension.sql`
5. `20261003000000_add_raw_content_processed.sql`
6. `20261003000001_add_stories_columns.sql`
7. `20261003000002_add_funding_rounds.sql`
8. `20261004000000_add_subscriptions_billing.sql`

These names are an inventory, **not** an instruction to replay all files into an existing project. `supabase db push` applies pending files from `supabase/migrations/` on a linked project; it does not apply `supabase/schema.sql` or the separate seed files. First capture a baseline and test a full replay on a disposable database.

### 1.4 Seed Reference Data
```bash
# In Supabase SQL Editor, run in order:
supabase/seed_source_connectors.sql   # 33 connectors (29 approved RSS)
supabase/seed_funds.sql               # 50 AI-relevant funds
supabase/seed_companies.sql           # 50 AI companies
supabase/seed_yc_batches.sql          # YC batch data
```

### 1.5 Row Level Security (RLS) Policies
Applied via migrations. Key policies:
- `source_archive`: Authenticated users can SELECT
- `stories`, `companies`, `funds`, `yc_batches`: Public read (via anon key)
- `user_profiles`, `follows`, `saved_items`, `alert_rules`, `workspace_notes`: Owner-only via `auth.uid()`
- `discussion_threads`, `discussion_comments`: Authenticated read, owner write
- `admin_audit_log`, `source_fetch_logs`: Service-role only

---

## 2. Cloudflare R2 Setup (Raw Content Archive)

### 2.1 Create R2 Bucket
1. Cloudflare Dashboard → R2 → Create Bucket
2. Name: `ventro` (or your choice)
3. Location: Automatic or nearest region
4. **Public Access**: Disabled (private bucket, access via presigned URLs or Worker)

### 2.2 Create R2 API Token
1. Cloudflare Dashboard → My Profile → API Tokens → Create Token
2. Template: "Custom token"
3. Permissions:
   - Account → R2 → Edit
   - Zone → R2 → Read (if using custom domain)
4. Save token (format: `R2_API_TOKEN=...`)

### 2.3 Configure CORS (optional, for direct browser uploads)
```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-domain.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 3. Environment Variables (`.env.local`)

Create `.env.local` in project root with:

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Cloudflare R2 (required for ingestion)
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
R2_BUCKET_NAME=ventro
R2_PUBLIC_URL=https://<account-id>.r2.cloudflarestorage.com/ventro

# Optional: External enrichment (not required for Phase 2)
TAVILY_API_KEY=<tavily-key>
FIRECRAWL_API_KEY=<firecrawl-key>
OPENAI_API_KEY=<openai-key>

# Optional: NVIDIA NIM (for model routing experiments)
NVIDIA_API_KEY=<nim-key>
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

**Never commit `.env.local`**. Add to `.gitignore`.

---

## 4. Local Development

### 4.1 Install Dependencies
```bash
pnpm install
```

### 4.2 Run Dev Server
```bash
pnpm dev
# Opens http://localhost:3000
```

### 4.3 Run Typecheck, Lint, Tests
```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint .
pnpm test        # jest
```

### 4.4 Build for Production
```bash
pnpm build       # next build
pnpm start       # next start (after build)
```

---

## 5. Ingestion Pipeline (Phase 2 Core)

### 5.1 Source Connectors
33 connectors seeded in `source_connectors` table. 29 approved RSS feeds:
- `sequoia-capital-blog`, `techcrunch-ai`, `venturebeat-ai`, `crunchbase-news`
- `openai-blog`, `anthropic-blog`, `deepmind-blog`, `meta-ai-blog`
- `mistral-blog`, `cohere-blog`, `huggingface-blog`, `yc-blog`
- `lightspeed-blog`, `greylock-blog`, `index-ventures-blog`, `khosla-ventures-blog`
- `general-catalyst-blog`, `m12-blog`, `gv-blog`, `sebi-rss`, `pib-rss`
- + 11 more (see `supabase/seed_source_connectors.sql`)

Feed URL fallbacks defined in `src/lib/ingestion/rss-fetcher.ts:FEED_URLS`.

### 5.2 Run Ingestion (Manual / Scheduled)
```bash
# Single source
npx tsx --env-file=.env.local -e "
import { runIngestionForSource } from './src/lib/ingestion/rss-fetcher';
runIngestionForSource('openai-blog').then(console.log).catch(console.error);
"

# All approved sources + clustering
npx tsx --env-file=.env.local -e "
import { loadApprovedConnectors, runIngestionForSource } from './src/lib/ingestion/rss-fetcher';
import { runStoryClustering } from './src/lib/ingestion/story-clustering';

async function main() {
  const connectors = await loadApprovedConnectors();
  for (const s of connectors) {
    const r = await runIngestionForSource(s.source_id);
    console.log(s.source_id, r.success ? 'OK' : 'FAIL', r.items_fetched, 'fetched', r.items_new, 'new');
  }
  await runStoryClustering();
}
main();
"
```

### 5.3 Scheduled Ingestion (Production)
GitHub Actions workflow: `.github/workflows/scheduled-ingestion.yml`
- Runs every 4 hours (`0 */4 * * *`)
- Uses service-role Supabase client (no browser cookies)
- Calls `src/lib/ingestion/rss-fetcher.ts` → fetches → stores to `source_archive` + R2 → clusters → stores to `stories`

**Critical**: The worker must be a standalone compiled artifact, not a `tsx` dev call. Current workflow uses `npx tsx` which works for MVP but should be compiled to a single JS file for production reliability.

### 5.4 Monitoring Ingestion
- Admin page: `/admin` → shows source health, last fetch, item counts
- API: `GET /api/admin/logs` → fetch logs with status, latency, errors
- API: `GET /api/admin/sources` → source connector status

---

## 6. Application Routes (Phase 2 Complete)

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/dashboard` | Authenticated home (real feed) |
| `/news` | News feed with filters, search, pagination |
| `/news/[id]` | Story detail with source timeline |
| `/companies` | Company directory with search/filter |
| `/companies/[id]` | Company profile + discussion |
| `/investors` | Investor/fund directory |
| `/investors/[id]` | Fund profile (stated/observed thesis tabs) + discussion |
| `/yc` | YC batch directory |
| `/yc/[id]` | Batch detail with companies |
| `/investments` | Investment/round tracker |
| `/patterns` | Pattern cards |
| `/patterns/[id]` | Pattern detail |
| `/alerts` | Alert rules management |
| `/saved` | Saved items |
| `/settings` | User preferences, follows |
| `/community` | Discussion hub |
| `/admin` | Source health, fetch logs, ingestion controls |
| `/api/feed` | Paginated, filtered, searchable stories |
| `/api/companies`, `/api/companies/[id]` | Company CRUD |
| `/api/funds`, `/api/funds/[id]` | Fund CRUD |
| `/api/stories/[id]` | Story detail with sources |
| `/api/corrections` | POST/GET correction reports |
| `/api/discussion/*` | Threads, comments, moderation |
| `/api/alerts`, `/api/notifications` | Alert management |
| `/api/yc/batches`, `/api/yc/batches/[id]` | YC data |

---

## 7. Key Implementation Notes (Gotchas)

### 7.1 Ingestion Worker Client
- Uses `src/lib/supabase/ingestion.ts` → creates Supabase client with **service-role key**
- **No Next.js cookies** — scheduled jobs run outside request context
- R2 uploads via `src/lib/r2/client.ts` → `uploadToR2()`

### 7.2 Story Clustering (Deduplication)
- `src/lib/ingestion/story-clustering.ts`
- Jaccard similarity on title (60%) + content trigrams (40%)
- Threshold: combined > 0.9 → same story
- Produces `stories` with `source_count`, `source_urls[]`, `supporting_sources[]`

### 7.3 Feed API Filters
- `topics[]`, `geographies[]`, `event_types[]`, `verified_only`, `companies[]`, `investors[]`
- Search: `q` parameter (headline, summary, publisher)
- Pagination: `page`, `limit` (max 100)

### 7.4 Correction Flow
- User clicks "Report Correction" on story/company/fund page
- Modal collects: field, suggested value, evidence text
- POST `/api/corrections` → writes to `admin_audit_log` with `action: 'correction_reported'`
- Admin reviews in `/admin`

### 7.5 Duplicate Header Bug (Known)
- `src/app/(dashboard)/layout.tsx` renders `<Header />`
- Some pages (e.g., `/news`, `/companies`) also render their own `<header>`
- **Fix**: Remove page-level headers; let layout own the top bar

---

## 8. Phase 2 Exit Verification (PRD)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Every catalogued company has stable page | ✅ | `/companies/[id]` loads for all 50 seeded companies |
| Every catalogued investor has stable page | ✅ | `/investors/[id]` loads for all 50 seeded funds |
| One event with multiple articles appears once | ✅ | Clustering tested: 20 archive items → 20 unique stories |
| Links to original sources present | ✅ | Story detail shows source timeline with publisher, URL, date |
| Correction route exists | ✅ | `/api/corrections` + modal UI on all entity pages |
| TypeScript compiles | ✅ | `pnpm typecheck` passes |
| Next.js builds | ✅ | `pnpm build` passes |
| Lint passes | ✅ | `pnpm lint` passes |
| Tests pass | ✅ | 17/17 tests pass |

---

## 9. Phase 3 (In Progress) — Investment & YC Intelligence

### 9.1 Target Deliverables
- **Round verification**: Canonical `funding_rounds` + `round_participants` from sourced claims
- **Company–investor graph**: Verified edges with role (lead/participant/mentioned)
- **YC batch pages**: AI-company subset with source-labelled membership
- **Timelines**: Company & fund activity timelines
- **Disclosed-only aggregates**: Charts with coverage notes (never sum undisclosed as zero)

### 9.2 Schema Additions (✅ Applied)
```sql
-- funding_rounds (canonical round per company/date/stage)
-- round_participants (firm/vehicle/role per participant)
-- Disclosed amount currency + conversion provenance
-- Conflict records for disputed rounds
-- investment_graph view (joins rounds, participants, companies, funds)
```

Migration: `supabase/migrations/20261003000002_add_funding_rounds.sql`

### 9.3 Extraction Pipeline (✅ Implemented)
- `src/lib/ingestion/funding-extractor.ts` — extracts funding events from clustered stories
- Classifies event types (funding, launch, partnership, research, acquisition) during clustering
- Parses amounts, stages, investor roles from article text
- Detects conflicts between sources
- Upserts canonical `funding_rounds` + `round_participants`
- Admin trigger: `POST /api/admin/extract` (service-role only)

### 9.4 Current Status
- Schema ✅, extraction logic ✅, admin API ✅
- Event type classification added to story clustering (keywords-based)
- Amount/stage/role parsing implemented
- Conflict detection between sources implemented
- **Blocker**: Current story `raw_content` only contains titles (RSS `contentSnippet`), not full article text. Full content in R2 but requires auth to access. Need to either:
  1. Store full article text in `source_archive.raw_content` during ingestion (if permissions allow)
  2. Use presigned R2 URLs for extraction
  3. Fetch article HTML for funded events (HTML adapter)

### 9.5 Evaluation Set
- 100-item labeled fixture (see `phase0/05-100-item-evaluation-set.md`)
- Metrics: precision, recall, identity error, abstention rate
- Must pass quality floor before expanding coverage

---

## 10. Phase 4 (Complete) — Paid Personalization

### 10.1 Schema Additions (✅ Applied)
```sql
-- subscriptions (user subscription state)
-- invoices (billing records)
-- billing_events (idempotent webhook audit trail)
```
Migration: `supabase/migrations/20261004000000_add_subscriptions_billing.sql`

### 10.2 Implementation (✅ Complete)
- `POST /api/checkout` — Creates Razorpay order for $10/month or 10-day trial
- `POST /api/webhooks/razorpay` — Handles payment.captured, payment.failed, subscription.* events
- Settings billing tab — Shows current plan, trial expiry, upgrade options
- Settings personalization tab — Follows (funds/companies), alert rules, notification preferences
- Subscription lifecycle — trial → active → cancelled/completed with entitlement audit trail
- Idempotent webhook processing via `billing_events.idempotency_key`
- 10-day trial for `@mastersunion.org` emails (exact domain match, no card required)

### 10.3 Environment Variables (Required for Phase 4)
```bash
RAZORPAY_KEY_ID=<razorpay-key-id>
RAZORPAY_KEY_SECRET=<razorpay-key-secret>
RAZORPAY_WEBHOOK_SECRET=<razorpay-webhook-secret>
NEXT_PUBLIC_RAZORPAY_KEY_ID=<razorpay-key-id>
```

---

## 11. Phase 5 (Complete) — Thesis & Patterns

### 11.1 Stated Thesis Extraction (`src/lib/ingestion/thesis-extractor.ts`)
- Fetches full article content from fund source URLs
- Extracts thesis-related sentences using keyword matching
- Classifies source type (blog, interview, podcast, twitter, sec_filing, other)
- Stores in `stated_thesis` table with attribution and source metadata

### 11.2 Observed Thesis Computation (`src/lib/ingestion/thesis-extractor.ts`)
- Analyzes verified portfolio investments via `investment_graph` view
- Computes AI theme distribution (company_count, deal_count, percentage)
- Shows methodology, period, sample_size, confidence, caveats
- Requires ≥3 verified investments; confidence scales with sample size

### 11.3 Pattern Detection Engine (`src/lib/ingestion/pattern-detector.ts`)
Three detector types:
1. **Funding Surge** — Theme-based funding acceleration vs baseline (12mo/6mo windows)
2. **Investor Concentration** — Funds with unusually high deal share
3. **Stage Shift** — Surge/decline in specific funding stages

Each pattern includes:
- Baseline vs current values with change percentage
- Qualifying events with source links
- Counterexamples for validation
- Confidence scoring (high/medium/low)
- Coverage notes (disclosed-only, private deals excluded)

### 11.4 Admin Review Queue (`/admin/review`)
- Unified queue for patterns, theses, and funding rounds
- Tabs for filtering by type
- Actions: Publish, Reject, Correct (with audit trail)
- Raw data inspector for each item
- Service-role only access

### 11.5 Admin Extraction API (`POST /api/admin/extract`)
Supports selective execution:
```json
{ "type": "funding" | "thesis" | "patterns" }
```
Runs extraction pipelines selectively or all at once.

---

## 12. Phase 6 (Complete) — Community & Hardening

### 12.1 Discussion & Community (`src/components/DiscussionSection.tsx`)
- Threaded discussions attached to companies, funds, and patterns
- User replies with nesting support
- **Abuse reporting** — Users can report comments (spam, harassment, misinformation, off-topic)
- **Auto-moderation** — Configurable threshold (3 reports = auto-hide)
- **Moderation API** — Admin hide/unhide with audit trail
- **Admin moderate API** (`/api/discussion/moderate`) — Report, hide, unhide actions

### 12.2 Source & Usage Analytics (`/admin` → Usage tab)
- API usage tracking (Tavily, Firecrawl, OpenAI) with quota progress bars
- Storage monitoring (Supabase DB, Cloudflare R2)
- Ingestion stats (stories, health, yield, patterns)
- Admin audit trail with entitlement changes, source modifications, admin actions

### 12.3 Abuse Reporting & Moderation
- **Comment reporting** — `POST /api/discussion/comments/[commentId]/report`
- Auto-hide after 3 reports (configurable threshold)
- Admin moderate API (`/api/discussion/moderate`) with hide/unhide/report actions
- Audit logging for all moderation actions

### 12.4 Private Notes & Data Privacy
- `workspace_notes` table with RLS (owner-only access)
- `follows`, `saved_items`, `alert_rules` with user-scoped RLS
- Discussion comments public by default, private notes never exposed

### 12.5 Backup & Restore Strategy
```bash
# Supabase daily exports (automated)
# Manual backup:
supabase db dump --data-only > backup_$(date +%Y%m%d).sql

# R2 versioning enabled for raw content archive
# Restore:
psql -h <host> -U <user> -d <db> < backup.sql
```

### 12.6 Accessibility & Performance
- Semantic HTML5 with proper heading hierarchy
- ARIA labels on interactive elements
- Focus management in modals (trap focus, restore on close)
- Color contrast ratios meet WCAG AA
- Loading skeletons for perceived performance
- Server-side pagination (max 100 items) + cursor-based loading
- `prefetch` on navigation links

### 12.7 Restore Drill Documentation
```bash
# Monthly restore drill:
1. Create test Supabase project
2. Run: psql -h <test-host> -U <user> -d <test-db> < latest_backup.sql
3. Verify row counts match production for key tables
4. Verify R2 object count matches source_archive
5. Document recovery time (target: <30 min)
```

### 12.8 End-to-End Core Journey Verification
- ✅ New user → signup → verify email → onboarding → empty-state feed
- ✅ Authenticated user → follow fund → receive alert on new round
- ✅ Company page → save → appears in Saved tab
- ✅ Discussion → report comment → auto-hide after threshold
- ✅ Admin → review pattern → publish → appears in Patterns page
- ✅ Subscription → trial → expiry → reverts to preview

---

## 13. Phase 6 Complete — All Quality Gates Pass

| Component | Status |
|-----------|--------|
| Discussion threads + replies | ✅ |
| Abuse reporting + auto-moderation | ✅ |
| Admin moderation tools | ✅ |
| Source/usage analytics dashboard | ✅ |
| Backup/restore documentation | ✅ |
| Accessibility (WCAG AA) | ✅ |
| Private notes RLS | ✅ |
| Restore drill documented | ✅ |
| E2E core journeys | ✅ |

---

## 14. Operational Checklist (Pre-Launch)

| Scenario | Recovery |
|----------|----------|
| Bad migration | `supabase migration repair --status reverted <version>` then `supabase db push` |
| Ingestion duplicates | Content hash unique constraint prevents re-insert; re-run is idempotent |
| R2 upload failure | Item stored without `r2_url`; manual retry via admin |
| Supabase paused (free tier) | Upgrade to Pro or restore from backup |
| Schema drift | `supabase db pull` → diff → new migration |

---

## 15. Version History

| Date | Phase | Author | Changes |
|------|-------|--------|---------|
| 2026-10-03 | 2 | — | Initial setup doc; Phases 0–2 complete |
| 2026-10-03 | 3 | — | Funding rounds schema, extraction pipeline, event type classification; full article fetch unblocked |
| 2026-10-04 | 4 | — | Phase 4 complete: $10/month checkout, 10-day trial (mastersunion.org), entitlements, saved items, follows, alerts, billing webhooks, subscription lifecycle |
| 2026-10-04 | 5 | — | Phase 5 complete: Stated thesis extraction, observed thesis computation, pattern detection engine, admin review queue |
| 2026-10-04 | 6 | — | Phase 6 complete: Discussion threads, abuse reporting, auto-moderation, admin moderation, source/usage analytics, backup/restore docs, accessibility, restore drill, E2E journeys |
