# Critical Decisions for Phase 1 — Must Resolve Before Implementation

**Version:** 0.1  
**Date:** 2026-09-30  
**Status:** Draft for decision; each item blocks specific Phase 1 workstreams

---

## Decision Register

| ID | Decision | Blocking Workstream | Deadline | Owner | Status |
|----|----------|---------------------|----------|-------|--------|
| D1 | Payment provider for $10/month USD checkout | Phase 4 (billing), Phase 1 (env setup) | Before Phase 1 kickoff | Founder | 🔴 Open |
| D2 | Legal business entity & jurisdiction | D1, tax, compliance, Stripe eligibility | Before Phase 1 kickoff | Founder/Legal | 🔴 Open |
| D3 | Public profile gating: preview vs full | Phase 2 (profiles), Phase 4 (entitlements) | Before Phase 2 kickoff | Product | 🟡 Pending |
| D4 | Exact 50 VCs + 50 companies (final) | Phase 1 (seed data), Phase 2 (ingestion) | Before Phase 1 kickoff | Product/Research | 🟡 Pending |
| D5 | Verified funding round definition | Phase 3 (rounds), evaluation set | Before Phase 3 kickoff | Product/Research | 🟡 Pending |
| D6 | YC directory access terms | Phase 2 (YC pages), Phase 3 (YC intelligence) | Before Phase 2 kickoff | Legal/BD | 🔴 Open |
| D7 | Community moderation policy | Phase 6 (community) | Before Phase 6 kickoff | Product/Legal | 🟢 Later |
| D8 | Product name & brand | All (domain, SEO, marketing) | Before launch | Founder/Design | 🟡 Pending |
| D9 | Supabase project region & auth providers | Phase 1 (foundation) | Before Phase 1 kickoff | Engineering | 🟡 Pending |
| D10 | Cloudflare R2 bucket structure & lifecycle | Phase 1 (archive), Phase 2 (ingestion) | Before Phase 1 kickoff | Engineering | 🟡 Pending |

---

## D1: Payment Provider — DEFERRED (Coming Soon)

### Current Plan
- **$10/month plan**: Mark as "Coming Soon" in UI — no payment integration in Phase 1–4
- **Masters' Union students**: Special discount card for 10-day full access (not a trial)
  - No payment card collected
  - Activated on verified `@mastersunion.org` email
  - Expires after 10 × 24 hours UTC
  - No auto-charge; no subscription created
  - Discount card = one-time access token, not a recurring plan
- **All other users**: Public preview only; "Notify me when pricing launches" CTA

### Implementation (Phase 4+)
- Build entitlement system with three states: `preview` | `discount_card` | `subscribed`
- Discount card: issued via admin or automated domain check; stored in `user_entitlements` with `expires_at`
- Payment provider decision deferred to separate workstream

### Action Required
- [ ] Implement entitlement states in Supabase (Phase 1)
- [ ] Build discount card issuance + validation (Phase 4)
- [ ] Payment provider evaluation — separate track

---

## D2: Legal Business Entity & Jurisdiction — CLARIFIED

### What This Means
You need a **legal company** to operate this business. The jurisdiction determines:
- **Tax obligations** (where you pay corporate tax, GST/VAT)
- **Banking** (where you can open a business account)
- **Payment providers** (which ones will accept you)
- **Investor readiness** (future fundraising)
- **IP ownership** (who owns the code/brand)

### Options (Simplified)

| Jurisdiction | Best If... | Payment Providers Available |
|--------------|------------|----------------------------|
| **Delaware, US (C-Corp)** | You want global investors, Stripe, simple banking | Stripe, Paddle, Lemon Squeezy |
| **India (Pvt Ltd)** | Team in India, India customers, India fundraising | Razorpay, Cashfree, Paddle |
| **Singapore (Pte Ltd)** | IP holding, SE Asia focus, tax treaties | Stripe SG, Paddle |
| **UK (Ltd)** | UK/EU focus, simple setup | Stripe UK, Paddle |

### Since Payment Is Deferred (D1)
**D2 only blocks:**
- Supabase region choice (data residency)
- Tax/GST on future revenue
- Future payment provider setup

**You can start Phase 1 without finalizing D2** — just pick a Supabase region and note the entity decision for later.

### Action Required (Minimal for Phase 1)
- [ ] Pick Supabase region: `ap-south-1` (Mumbai) or `us-east-1` (Virginia)
- [ ] Note: Entity decision can wait until Phase 4+ (payment workstream)

---

## D3: Public Profile Gating Strategy

### Options

| Approach | Free Preview | Trial | Paid | Implementation Complexity |
|----------|--------------|-------|------|---------------------------|
| **A: Full preview, premium depth gated** | All fields visible; "Not disclosed" for unknown | Full access | Full access | Low (single profile view) |
| **B: Factual preview only** | Name, domain, description, tags, source links | Full access | Full access | Medium (field-level gates) |
| **C: Minimal preview** | Name, domain, one-line description only | Full access | Full access | Medium |
| **D: Paywall at profile** | Redirect to pricing | Full access | Full access | Low but hostile UX |

### PRD Guidance (Section 4)
> "Each catalogued company gets a stable URL and profile, even with sparse data. Minimum: name, canonical site when known, short sourced description, AI tags, location if known, source links, last updated, and 'information not yet verified' where appropriate."

### Recommendation: **Option A (Full preview, premium depth gated)**
- Aligns with PRD: "Public pages show a useful factual preview; premium depth and personalized functions require entitlement"
- Premium depth = Observed thesis, full investment timeline, investor relationships, patterns, alerts, follows
- Free gets: Stated thesis excerpts (2 sentences), 3 recent investments, basic info

### Action Required
- [ ] Confirm gating fields per entity type (company/investor)
- [ ] Implement field-level RLS policies in Supabase
- [ ] Design "Upgrade to see more" inline CTAs

---

## D4: Final 50 VCs + 50 Companies

### Current Status
- 50 VCs documented in `02-50-ai-vcs.md` (Tier 1–5)
- 50 Companies documented in `03-50-ai-companies.md` (Categories + India)
- Both have source access status

### Open Questions
1. **Replace any Tier 1 VCs?** (Benchmark, Coatue, Tiger Global have HTML-only, unclear reuse)
2. **Add more India VCs?** (Current: 8/50 = 16%; target 20–25%)
3. **Company replacements?** (Several HTML-only: xAI, Cursor, Harvey, Figure, etc.)
4. **YC batch companies:** Add 10–15 recent YC AI companies as supplemental?

### Decision Criteria
- Source accessibility (RSS > API > HTML)
- Reuse permission clarity
- Geographic/stage/category diversity
- Recent activity (2024–2025)

### Action Required
- [ ] Review unclear-reuse sources with legal
- [ ] Finalize lists; update source-rights register
- [ ] Generate seed data JSON for Phase 1 DB seeding
- [ ] Assign entity IDs (UUIDs) for all 100

---

## D5: Verified Funding Round Definition

### Required for Phase 3 Extraction & Evaluation

### Minimum Evidence Thresholds

| Field | Minimum Evidence | "Not Disclosed" Trigger |
|-------|------------------|-------------------------|
| **Company** | Official announcement + Crunchbase/SEC cross-ref | Never |
| **Date** | Announcement date OR filing date | Never |
| **Stage** | Source uses standard term (Pre-seed/Seed/Series A–G/Growth) | Source says "undisclosed" or "private" |
| **Amount (USD)** | Source discloses specific USD amount (or convertible with rate/date) | Source says "undisclosed" OR only "multi-million" |
| **Lead Investor** | Source explicitly states "led by" or "lead investor" | Source lists investors without role |
| **Participating Investors** | Source names them | Source says "including" without names |
| **Valuation** | Source discloses post-money | Almost always undisclosed |

### Verification States
| State | Criteria |
|-------|----------|
| `verified` | ≥2 independent sources agree on all disclosed fields; amount + stage + lead confirmed |
| `partial` | 1 credible source; some fields undisclosed; no conflicts |
| `conflicted` | ≥2 sources disagree on material field (amount, lead, stage) |
| `unverified` | Single non-primary source (e.g., news aggregator only) |

### Conflict Resolution
- Primary: Company blog > SEC Form D > Investor blog > Reputable news (TechCrunch, VB) > Crunchbase > PitchBook
- Amount: Use USD amount from primary source; note conversion rate/date if non-USD
- Stage: Map source terminology to standard taxonomy

### Action Required
- [ ] Finalize evidence hierarchy
- [ ] Update evaluation set ground truth (R1–R30) to match
- [ ] Implement in extraction schema validation

---

## D6: YC Directory Access Terms

### Current Blocker
- YC Company Directory (`ycombinator.com/companies`) ToS **unclear for automated scraping**
- YC Blog RSS is fine (approved)
- Manual curation only for Phase 1

### Options
1. **Contact YC BD/legal** for API access or ToS clarification
2. **Manual curation** of AI companies from recent batches (W24, S24, W25, S25)
3. **Use public YC launch posts** (Hacker News, TechCrunch) as sources
4. **Partner with YC** for official data license (long-term)

### Phase 1 Approach
- Manual list of ~30 AI companies from W24/S24/W25/S25
- Source: YC blog batch announcements + HN launch posts
- Track as `yc_batch` field on company profiles
- No automated YC directory ingestion

### Action Required
- [ ] Email YC (press@ycombinator.com or BD contact) for clarification
- [ ] Compile manual YC AI company list for Phase 1 seed
- [ ] Document in source-rights register as `manual_curation`

---

## D7: Community Moderation Policy (Phase 6)

### Decisions Needed
| Question | Recommendation |
|----------|----------------|
| Who can post? | **Paid members only** (trial reads only) |
| Pre-moderation? | **New users only** (first 3 posts queued) |
| Anonymous? | **No** — display name + avatar (from profile) |
| Fact-checking? | **Community flags → admin verifies** (not auto) |
| Promotion to corpus? | **Never** — discussion stays separate |
| Banning? | **3-strike** (warn → temp ban → perm ban) |
| Appeals? | **Email support** with 48h SLA |

### Action Required
- [ ] Finalize before Phase 6
- [ ] Implement in Phase 6 only

---

## D8: Product Name & Brand

### Requirements
- Available .com or .ai domain
- Trademarkable (distinctive)
- Pronounceable, memorable
- No conflict with existing AI/finance brands
- Works internationally

### Process
1. Generate 20+ candidates
2. Domain check (Namecheap/GoDaddy)
3. Trademark search (USPTO + India)
4. Stakeholder vote (top 3)
5. Secure domain + social handles

### Timeline
- **Before Phase 1**: Working title for repo/config
- **Before Phase 4**: Final name for billing/emails
- **Before Launch**: Full brand system

### Action Required
- [ ] Brainstorming session
- [ ] Domain/trademark checks
- [ ] Decision

---

## D9: Supabase Project Configuration

### Decisions
| Setting | Recommendation |
|---------|----------------|
| **Region** | `ap-south-1` (Mumbai) for India team/users; or `us-east-1` for global |
| **Auth Providers** | Email/password + Google + GitHub OAuth |
| **Email Template** | Custom branded (verify, invite, reset, magic link) |
| **RLS** | Enabled on all tables; policies per entitlement |
| **Realtime** | Enabled for feed, notifications, discussion |
| **Backups** | Daily automated + manual export script |

### Action Required
- [ ] Create Supabase project
- [ ] Configure auth providers
- [ ] Set up custom SMTP (Resend/SendGrid)
- [ ] Document connection strings for Phase 1

---

## D10: Cloudflare R2 Structure

### Bucket Design
```
ventro-archive-prod/
├── source-archives/
│   ├── {source_id}/
│   │   ├── {YYYY}/
│   │   │   ├── {MM}/
│   │   │   │   ├── {DD}/
│   │   │   │   │   ├── {fetch_id}_{hash[:16]}.html
│   │   │   │   │   ├── {fetch_id}_{hash[:16]}.json
│   │   │   │   │   └── {fetch_id}_{hash[:16]}.pdf
│   │   │   │   └── manifest.json
│   │   │   └── manifest.json
│   │   └── manifest.json
│   └── _metadata/
│       └── source_registry.json
├── evaluation-set/
│   ├── v1/
│   │   ├── round-extraction/
│   │   ├── investor-identity/
│   │   ├── thesis-attribution/
│   │   └── summary-faithfulness/
│   └── manifests/
└── exports/
    ├── supabase/
    └── r2-manifest/
```

### Lifecycle Rules
| Prefix | Transition to IA | Expire (Delete) |
|--------|------------------|-----------------|
| `source-archives/*/2024/` | 30 days | 90 days (or source policy) |
| `source-archives/*/2025/` | 30 days | 90 days |
| `evaluation-set/` | Never | Never |
| `exports/` | 7 days | 30 days |

### Action Required
- [ ] Create R2 bucket
- [ ] Configure lifecycle rules
- [ ] Generate API tokens (read/write scoped)
- [ ] Test upload/download from Phase 1 fetcher

---

## Decision Dependencies Graph

```
D2 (Entity) ──┬──→ D1 (Payment Provider)
              ├──→ D9 (Supabase Region)
              └──→ Tax/GST Strategy

D1 ──→ Phase 4 Implementation
D3 ──→ Phase 2 Profile Implementation
D4 ──→ Phase 1 Seed Data / Phase 2 Ingestion
D5 ──→ Phase 3 Round Extraction / Evaluation Set
D6 ──→ Phase 2 YC Pages / Phase 3 YC Intelligence
D9 ──→ Phase 1 Foundation (Day 1)
D10 ──→ Phase 1 Archive / Phase 2 Ingestion
```

---

## Immediate Next Steps (This Week)

1. **Resolve D2** — Legal entity decision (founder + tax advisor)
2. **Resolve D1** — Payment provider based on D2
3. **Resolve D9** — Create Supabase project (independent)
4. **Resolve D10** — Create R2 bucket (independent)
5. **Finalize D4** — Review 50/50 lists with legal on unclear reuse
6. **Draft D5** — Verified round definition for evaluation set alignment

---

## Decision Log Template (for tracking)

| Date | Decision ID | Decision Made | Rationale | Decided By | Reversible? |
|------|-------------|---------------|-----------|------------|-------------|
| 2026-09-30 | — | Phase 0 deliverables defined | PRD scope | Team | Yes |
| TBD | D2 | — | — | — | — |
| TBD | D1 | — | — | — | — |

---

## Escalation Path

If decisions not resolved by Phase 1 kickoff:
- **D1/D2**: Use **Paddle (MoR)** as interim — works globally, no entity constraint, handles tax
- **D4**: Proceed with documented 50/50; swap in Phase 2
- **D3**: Default to Option A (full preview)
- **D9**: Default `us-east-1`; migrate later if needed
- **D10**: Default structure; adjust lifecycle after source audit