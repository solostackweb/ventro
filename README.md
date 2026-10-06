# Ventro — AI Investment Intelligence

> **Where are investors investing? What are they looking for?**
> Verified AI funding rounds, investor theses, and market patterns with inspectable evidence.

## Overview

Ventro is a web application that tracks AI companies and AI-focused investors worldwide, with strong India coverage. It answers two questions with evidence-backed data:

1. **Where are investors investing?** — Verified company–round–investor relationships, dates, amounts, and source links
2. **What are investors looking for?** — Stated thesis (from fund's own materials) vs. inferred thesis (from observed investments)

## Features

- **Deduplicated News Feed** — Cluster duplicate coverage, see source timelines, verification labels
- **Company & Investor Profiles** — Every catalogued entity has a stable URL with sourced data
- **Stated vs. Inferred Theses** — Clear separation with methodology, period, sample size
- **Personalized Workspace** — Follow funds/companies, set AI topics/geographies/stages, save patterns, configure alerts
- **Evidence-Backed Patterns** — Qualifying events, baseline, counterexamples, confidence, admin review gate
- **Community Discussion** — Threaded discussions on entities, private notes, moderation
- **Masters' Union Student Access** — 20-day full access via verified `@mastersunion.org` email (no card)

## Tech Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Database**: Supabase Postgres (structured data, auth, RLS)
- **Object Storage**: Cloudflare R2 (permitted raw captures, replay snapshots)
- **Styling**: Tailwind CSS + custom design tokens
- **State**: TanStack Query (server), Zustand (client)
- **Forms**: React Hook Form + Zod
- **Auth**: Supabase Auth (email/password + OAuth)

## Phase 0 Deliverables

See `phase0/` directory:
- `01-source-rights-register.md` — 83 connectors with legal basis, access method, reuse rights
- `02-50-ai-vcs.md` — 50 AI-focused VCs across 5 tiers (US, India, EU, Israel, Canada, corporate)
- `03-50-ai-companies.md` — 50 AI companies across 6 categories + India priority
- `04-official-feeds-apis.md` — 83 connectors inventoried (73 RSS, 6 APIs, 34 HTML fallback)
- `05-100-item-evaluation-set.md` — 4 extraction tasks × 25/30 items with schemas
- `06-core-user-journeys.md` — 8 journeys with step-level acceptance criteria
- `07-responsive-wireframes.md` — 15 components, 6 breakpoints, design tokens
- `08-critical-decisions-phase1.md` — 10 decisions blocking Phase 1
- `09-phase0-summary.md` — Evidence, risks, acceptance results

## Next Implementation Phase

See [NEXT_GEN_INTELLIGENCE_PHASE.md](NEXT_GEN_INTELLIGENCE_PHASE.md) for the evidence pipeline, model-routing and cost policy, delivery gates, and the ordered real-data population runbook. It extends rather than replaces the PRD.

## Getting Started

### Prerequisites

- Node.js 20+
- Supabase account (free tier)
- Cloudflare account (for R2)

### Setup

1. **Clone and install**
```bash
git clone <repo-url>
cd ventro
npm install
```

2. **Create Supabase project**
   - Go to https://supabase.com
   - Create new project (choose region: `ap-south-1` for India, `us-east-1` for US)
   - Copy Project URL and anon key to `.env.local`

3. **Run database schema**
   - Open Supabase SQL Editor
   - Run `supabase/schema.sql`

4. **Create Cloudflare R2 bucket**
   - Go to Cloudflare Dashboard → R2
   - Create bucket `ventro-archive`
   - Set lifecycle rules (see `phase0/01-source-rights-register.md`)
   - Create API token with R2 read/write permissions

5. **Configure environment**
```bash
cp .env.example .env.local
# Fill in your values
```

6. **Run development server**
```bash
npm run dev
```

Visit http://localhost:3000

## Project Structure

```
src/
├── app/
│   ├── (public)/          # Public pages (landing, login, signup, onboarding)
│   ├── (dashboard)/       # Authenticated pages (dashboard, settings, etc.)
│   └── api/               # API routes (auth, feed, entities, onboarding)
├── components/
│   ├── ui/                # Atomic components (Button, Input, Badge, etc.)
│   ├── features/          # Composed feature components
│   └── layout/            # Layout components (Header, etc.)
├── lib/
│   ├── supabase/          # Supabase clients (browser, server)
│   ├── utils/             # Helper functions
│   └── validators/        # Zod schemas
├── hooks/                 # Custom React hooks
├── store/                 # Zustand stores
├── types/                 # TypeScript types
└── styles/                # Global styles (Tailwind + CSS variables)
```

## Key Decisions (Phase 0)

| Decision | Status |
|----------|--------|
| Payment provider | **Deferred to Phase 7** — $10/mo = "Coming Soon" |
| Masters' Union access | **20-day student trial** (no card, no provider call) |
| Legal entity | **Deferred** — pick Supabase region for now |
| YC directory access | **Manual curation** for Phase 1 |
| Public profile gating | **Full preview, premium depth gated** |

## Budget Constraints

- **OpenAI**: $50 credit (eval + dev) — hard cap at $45
- **Tavily**: 1,000 searches/mo free — capped at 500/mo
- **Firecrawl**: 500 credits/mo free — capped at 200/mo
- **Supabase**: 500 MB DB free — monitor at 400 MB
- **Cloudflare R2**: 10 GB/mo free — ~1-2 GB/mo expected

## Development

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Database types (after schema changes)
npm run db:generate

# Tests
npm run test
```

## Deployment

- **Vercel** (recommended for Next.js)
- Connect GitHub repo
- Add environment variables
- Deploy

## License

Proprietary — All rights reserved.

## Contact

- Email: hello@ventro.ai
- Twitter: @ventro_ai
