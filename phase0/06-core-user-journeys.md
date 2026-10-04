# Core User Journeys — Phase 0

**Version:** 0.1  
**Date:** 2026-09-30  
**Status:** Draft for review; each journey has acceptance criteria for Phase 1–4 implementation

---

## Journey Overview

| Journey | ID | Primary User | Phase | Status |
|---------|----|--------------|-------|--------|
| New Member Onboarding | J-A | AI Founder / Investor / Student | 1 | Defined |
| Founder Researches Investor | J-B | AI Founder | 2–3 | Defined |
| Analyst Investigates Pattern | J-C | Investor/Analyst | 3–5 | Defined |
| Student Trial Activation | J-D | Masters' Union Student | 4 | Defined |
| Subscription Checkout | J-E | All Users | 4 | Defined |
| Workspace Personalization | J-F | Signed-in Users | 2–5 | Defined |
| Alert Configuration | J-G | Signed-in Users | 4–5 | Defined |
| Community Discussion | J-H | Signed-in Users | 6 | Defined |

---

## Journey J-A: New Member Onboarding

**Primary User:** AI Founder / Investor / Student  
**Entry Point:** Landing page → Sign up  
**Exit Point:** Personalized feed visible, preferences saved, entitlement clear

### Steps

| Step | Action | System Response | Acceptance Criteria |
|------|--------|-----------------|---------------------|
| A1 | Visits landing page | Hero shows two product questions; interactive cited example; pricing; coverage stats | Page loads <2s; example links to real source; no fabricated counters |
| A2 | Clicks "Sign up" | Email/password + OAuth (Google, GitHub) options; terms link | All auth methods work; email verification sent <30s |
| A3 | Verifies email | Clicks link → redirected to onboarding | Token valid 24h; invalid/expired handled gracefully |
| A4 | Onboarding Q1: Role | Select: Founder / Investor / Analyst / Student / Other | Required; stored in `user_profile.role` |
| A5 | Onboarding Q2: AI Topics | Multi-select: Foundation Models, Infrastructure, Applications, Robotics, Hardware, Research, Other | Min 1, max 7; stored in `user_profile.ai_topics[]` |
| A6 | Onboarding Q3: Geography | Multi-select: US, India, EU, Israel, Canada, UK, SEA, Global | Stored in `user_profile.geographies[]` |
| A7 | Onboarding Q4: Company Stage | Multi-select: Pre-seed, Seed, Series A, Series B, Series C+, Growth, Public | Stored in `user_profile.stages[]` |
| A8 | Onboarding Q5: Follow Seeds | Search/typeahead: funds & companies to follow (from 50/50 catalog) | Up to 10 each; creates `follow` records |
| A9 | Completes onboarding | Redirected to "For You" feed with personalized items | Feed loads <3s; each card shows "Why am I seeing this?" |
| A10 | Views feed card | Card shows: headline, summary, event date, source count, companies, investors, AI tags, verification label | All fields populated from shared corpus; no empty cards |
| A11 | Clicks "Follow" on fund | Fund added to follows; feed re-ranks | Immediate UI update; server persists |
| A12 | Hits paywall on deep dive | Modal: "Unlock full profile — $10/month or start 10-day trial (Masters' Union)" | Trial only shown if email domain matches; no card required for trial |

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Email already registered | "Sign in instead" link; preserve onboarding intent in session |
| OAuth email unverified | Require email verification before onboarding |
| Onboarding abandoned at step 5 | Save progress in session; resume on next sign-in |
| Student email not `@mastersunion.org` | Trial option hidden; only $10/month shown |
| User skips all onboarding questions | Show global feed (latest, diversified); "Personalize later" CTA |

### Data Created

- `auth.users` record (Supabase Auth)
- `user_profile` row (role, topics, geographies, stages, onboarding_completed_at)
- `follow` rows (fund_ids, company_ids)
- `workspace_settings` row (feed_ranking_weights, alert_frequency)

---

## Journey J-B: Founder Researches an Investor

**Primary User:** AI Founder (signed in, may be trial or paid)  
**Entry Point:** Search / Investor directory / Feed card  
**Exit Point:** Investor followed, alert configured, fit understood with evidence

### Steps

| Step | Action | System Response | Acceptance Criteria |
|------|--------|-----------------|---------------------|
| B1 | Searches "Sequoia" | Typeahead shows: Sequoia Capital (US), Peak XV (India/SEA), HongShan (China) | Disambiguation clear; entity IDs distinct |
| B2 | Opens Sequoia Capital profile | Tabs: Overview, Stated Thesis, Observed Thesis, Portfolio, Activity, Sources | All tabs load <2s; data from shared corpus |
| B3 | Reads "Stated Thesis" tab | Excerpts from official blog/posts with links; paraphrased; dated | Each claim has source_url; "stated" badge |
| B4 | Reads "Observed Thesis" tab | Methodology, period, sample size, inferred themes, confidence, last computed | "Inferred" badge; not presented as official position |
| B5 | Compares with own topics | "Your topics: Foundation Models, Infrastructure" → highlights overlap | Visual overlap indicators; explanation links to evidence |
| B6 | Views recent investments | Timeline: company, date, stage, amount (if disclosed), role, source | "Not disclosed" shown for unknown; no fabricated values |
| B7 | Clicks "Follow" | Fund added to follows; "Alert me on new relevant events" toggle | Toggle creates `alert_rule` with user's AI topics |
| B8 | Configures alert | Frequency: Instant / Daily digest / Weekly; channels: Email / In-app | Preference saved; test notification works |
| B9 | Views "Why this fit?" | Explains: "Sequoia led 3 Foundation Model rounds in 2024 (OpenAI, xAI, Mistral) — matches your 'Foundation Models' topic" | Each claim links to source round event |

### Evidence Requirements

| Claim Type | Minimum Evidence |
|------------|------------------|
| Stated thesis quote | Official blog/interview/podcast URL + date |
| Inferred theme | ≥3 portfolio companies in theme within period; methodology documented |
| "Lead investor" | Source explicitly states "led" or "lead"; otherwise "participant" |
| Round amount | Source discloses USD amount; otherwise "not disclosed" |
| Stage | Source uses standard stage terminology; otherwise "undisclosed" |

### Entitlement Gates

| Content | Preview | Discount Card | Subscribed (Future) |
|---------|---------|---------------|---------------------|
| Stated thesis excerpts | 2 sentences | Full | Full |
| Observed thesis summary | Theme names only | Full + methodology | Full + methodology |
| Recent investments (last 6mo) | 3 most recent | Full timeline | Full timeline |
| Portfolio company links | Names only | Clickable | Clickable |
| Alert configuration | View only | Create 1 | Unlimited |
| Community posting | Read-only | Read-only | Write |

---

## Journey J-C: Analyst Investigates a Pattern

**Primary User:** Investor/Analyst (paid)  
**Entry Point:** Patterns page / Feed pattern card / Search  
**Exit Point:** Pattern saved, discussed, evidence inspected

### Steps

| Step | Action | System Response | Acceptance Criteria |
|------|--------|-----------------|---------------------|
| C1 | Opens Patterns page | List of pattern cards: name, time window, baseline, distinct companies/funds, status | Only `published` patterns shown; `candidate` hidden |
| C2 | Clicks "AI Infrastructure Funding Surge Q1 2025" | Pattern detail: definition, qualifying events (table), counterexamples, confidence, coverage, source links | All events clickable to source; baseline explained |
| C3 | Inspects "Qualifying Events" | Table: date, company, round, investors, amount, source | Sortable; filterable; each row links to event detail |
| C4 | Reads "Counterexamples" | Companies/funds that matched filter but excluded; reason | Transparent exclusion criteria |
| C5 | Clicks "How was this inferred?" | Modal: methodology, baseline calculation, period, sample size, last computed, confidence factors | No LLM-only publication; rule-based + evidence |
| C6 | Clicks "Save to workspace" | Pattern added to Saved → Patterns | Persists; appears in workspace |
| C7 | Opens Discussion tab | Threaded comments; @mentions; upvotes; report button | Only paid members can post; read-only for trial |
| C8 | Reports a claim | "Flag for review" → admin queue with context | Admin sees pattern, claim, reporter, timestamp |

### Pattern Status Lifecycle

```
candidate → (admin review) → published → (correction) → corrected → (retired) → retired
                ↓
           rejected (with reason)
```

### Admin Review Gate (High-Impact Only)

| Trigger | Review Required |
|---------|-----------------|
| New pattern with >50 qualifying events | Yes |
| Pattern involving valuation claims | Yes |
| Pattern citing non-public sources | Yes |
| Routine sector activity summary | No (auto-publish if rules pass) |

---

## Journey J-D: Masters' Union Discount Card (10-Day Access)

**Primary User:** Student with verified `@mastersunion.org` email  
**Entry Point:** Sign up with Masters' Union email  
**Exit Point:** 10-day full access via discount card, no payment card, no subscription

### Steps

| Step | Action | System Response | Acceptance Criteria |
|------|--------|-----------------|---------------------|
| D1 | Signs up with `name@mastersunion.org` | Email verification sent | Domain check: exact match `mastersunion.org` (case-insensitive) |
| D2 | Verifies email | Discount card issued immediately; `expires_at = now() + 10 days UTC`; `entitlement = 'discount_card'` | No payment card collected; no subscription created |
| D3 | Accesses gated content | Full access granted (same as paid) | All paid features work |
| D4 | Day 9: Receives email | "Your 10-day access ends tomorrow." | Sent 24h before expiry; no upsell to subscription |
| D5 | Day 10 (expiry) | Access reverts to preview; data preserved; "Notify me when pricing launches" CTA | `entitlement = 'preview'`; workspace intact |
| D6 | Re-engages later | Sees "Coming Soon" pricing; can join waitlist | No subscription path available yet |

### Domain Validation Rules

| Email | Qualifies? | Reason |
|-------|------------|--------|
| `student@mastersunion.org` | ✅ | Exact domain |
| `student@campus.mastersunion.org` | ❌ | Subdomain not allowed |
| `student@mastersunion.edu` | ❌ | Different TLD |
| `student@mastersunion.org.in` | ❌ | Different domain |
| `student@mastersun1on.org` | ❌ | Lookalike |

### Discount Card Constraints

- One discount card per verified email (enforced by unique `email` + `discount_card_issued` flag)
- No extension or re-issue
- Usage tracked for analytics
- Institutional endorsement **not implied** in any UI copy
- **Not a trial** — no subscription created, no billing cycle, no payment method

---

## Journey J-E: Subscription Checkout ($10/month)

**Primary User:** Any user (trial, expired, or new)  
**Entry Point:** Paywall CTA / Pricing page / Settings  
**Exit Point:** Active subscription, billing portal access

### Steps

| Step | Action | System Response | Acceptance Criteria |
|------|--------|-----------------|---------------------|
| E1 | Clicks "Subscribe $10/month" | Redirected to payment provider checkout (hosted) | Provider: TBD (Stripe/Razorpay/other) |
| E2 | Completes payment | Webhook received → `subscription_status = 'active'`; `current_period_end` set | Idempotent webhook handling; duplicate events ignored |
| E3 | Returns to app | Success toast; full access immediate | No redirect loops; entitlement updated <5s |
| E4 | Opens Settings → Billing | Shows: plan, next billing date, amount, payment method, "Manage billing" link | Links to provider billing portal |
| E5 | Clicks "Manage billing" | Opens provider portal (cancel, update card, invoices) | SSO via provider session |
| E6 | Cancels subscription | `subscription_status = 'cancelling'`; access until `current_period_end` | No immediate revocation; confirmation email |
| E7 | Payment fails | `subscription_status = 'past_due'`; retry per provider schedule; email user | Grace period per provider; max 3 retries |
| E8 | Requests refund | Support ticket → admin processes via provider → `refunded` status | Audit trail in `entitlement_audit` table |

### Payment Provider Requirements (Decision Required)

| Requirement | Detail |
|-------------|--------|
| Currency | USD checkout (not INR) |
| Entity | Must support business legal entity (TBD) |
| India compliance | GST invoices if applicable |
| Webhooks | Signed, idempotent, retry with backoff |
| Billing portal | Self-service cancel, update payment, download invoices |
| Trial support | Native trial period or manual via metadata |
| Cost | Transparent per-transaction + monthly fees |

---

## Journey J-F: Workspace Personalization

**Primary User:** Signed-in user (any tier)  
**Entry Point:** Settings → Personalization / Feed → "Why am I seeing this?"  
**Exit Point:** Preferences saved, feed re-ranked, explanation accurate

### Steps

| Step | Action | System Response | Acceptance Criteria |
|------|--------|-----------------|---------------------|
| F1 | Opens Settings → Personalization | Shows: Followed funds/companies, AI topics, geographies, stages, alert frequency | All editable; changes save <1s |
| F2 | Edits AI topics | Multi-select with search; "Foundation Models" → adds weight to feed ranker | Immediate feed refresh (debounced 500ms) |
| F3 | Clicks "Why am I seeing this?" on feed card | Modal: "This appears because you follow Sequoia Capital AND it matches your topic 'Foundation Models' (source: Sequoia blog post 'AI Market Map' 2024-01-15)" | Each factor links to evidence; no black-box |
| F4 | Clicks "Reset personalization" | Confirmation modal → reverts to onboarding defaults | One-click; undo available for 30s |
| F5 | Saves private note on company | Note stored in `workspace_notes` (user_id, entity_id, content, created_at) | Private by default; never in shared corpus |
| F6 | Exports workspace data | JSON download: follows, saves, notes, settings | GDPR-compliant; includes all private data |

### Personalization Signals (Ranking Inputs)

| Signal | Weight (Default) | User Control |
|--------|------------------|--------------|
| Explicit follow (fund) | 1.0 | On/off per fund |
| Explicit follow (company) | 0.8 | On/off per company |
| AI topic match | 0.6 | Per-topic weight slider |
| Geography match | 0.4 | Per-geo weight slider |
| Stage match | 0.3 | Per-stage weight slider |
| Recency (exponential decay) | 0.5 | Fixed (not user-controlled) |
| Source credibility | 0.3 | Fixed (admin-configured) |

---

## Journey J-G: Alert Configuration

**Primary User:** Signed-in user (trial or paid)  
**Entry Point:** Profile page "Follow" dropdown / Settings → Alerts  
**Exit Point:** Alert rule active, test notification received

### Steps

| Step | Action | System Response | Acceptance Criteria |
|------|--------|-----------------|---------------------|
| G1 | On fund profile, clicks "Follow" → "Alert me" | Creates `alert_rule`: entity_type=fund, entity_id, trigger=new_event, topics=user_topics | Default: daily digest, email + in-app |
| G2 | Opens Settings → Alerts | List of rules: fund/company, trigger, frequency, channels, last sent | Editable; delete confirmation |
| G3 | Edits rule → "Instant email" | Frequency changed; next event triggers immediate email | Test button sends sample |
| G4 | New relevant event verified | Background job matches event → rules → queues notifications | Dedupe: same event → one notification per user |
| G5 | Receives email | Subject: "New Series A: Anthropic — matches your 'Foundation Models' alert" | Links to event; unsubscribe link |

### Alert Triggers

| Trigger | Description | Entitlement |
|---------|-------------|-------------|
| `new_funding_round` | Company raises round matching user topics | Trial + Paid |
| `new_portfolio_company` | Followed fund invests in new company | Trial + Paid |
| `thesis_update` | Fund publishes new stated thesis | Paid only |
| `pattern_published` | New pattern matches followed entities | Paid only |
| `daily_digest` | Summary of all matched events (24h) | Trial + Paid |

---

## Journey J-H: Community Discussion

**Primary User:** Signed-in user (paid for posting, trial/paid for reading)  
**Entry Point:** Company/Investor/Pattern page → Discussion tab  
**Exit Point:** Comment posted, thread readable, moderation functional

### Steps

| Step | Action | System Response | Acceptance Criteria |
|------|--------|-----------------|---------------------|
| H1 | Opens Discussion tab on Sequoia profile | Threaded comments; sorted: "Top" / "New" / "Old" | Read-only for trial; post for paid |
| H2 | Paid user writes comment | Markdown supported; @mentions notify; "Post" button | Server-side sanitization; XSS prevention |
| H3 | Another user replies | Nested thread (max depth 3); real-time update (SSE/polling) | <2s latency |
| H4 | User reports comment | "Report" → reason select → admin queue | Reporter anonymous to reported user |
| H5 | Admin reviews report | Queue shows: comment, context, reporter, reported, history | Actions: dismiss, hide, ban user, escalate |
| H6 | Admin hides comment | Comment hidden; "This comment was hidden by moderation" shown | Reversible; audit log |

### Moderation Policy (Decision Required)

| Question | Options |
|----------|---------|
| Who can post? | Paid only / Trial + Paid / All verified |
| Pre-moderation? | None / New users only / All |
| Anonymous posting? | No / Pseudonymous (handle only) |
| Fact-checking? | Community flags → admin verifies / No |
| Promotion to corpus? | Never / Admin-approved only / Verified claims only |

---

## Cross-Journey Acceptance Criteria (Phase Gates)

### Phase 1 Gate (Foundation)
- [ ] J-A steps 1–9 work end-to-end (signup → personalized feed)
- [ ] Supabase Auth + email verification + RLS policies enforced
- [ ] One RSS source fetched, normalized, stored, replayed safely
- [ ] Empty states handled for all feed/profile pages

### Phase 2 Gate (News & Profiles)
- [ ] J-A step 10–11: Feed cards clickable → company/investor profiles
- [ ] J-B steps 1–4: Investor profile with Stated/Observed thesis tabs
- [ ] Every catalogued entity has stable URL and profile page
- [ ] Deduplication: same event from 3 sources → one story card

### Phase 3 Gate (Investment & YC Intelligence)
- [ ] J-B steps 5–9: Round timeline, investor roles, disclosed-only amounts
- [ ] YC batch pages with AI-company subset
- [ ] Extraction precision on evaluation set meets threshold

### Phase 4 Gate (Paid Personalization)
- [ ] J-D: Masters' Union trial works (domain check, 10-day UTC, no card)
- [ ] J-E: $10 checkout works (provider TBD), webhooks idempotent
- [ ] J-F: Personalization weights affect feed ranking visibly
- [ ] J-G: Alerts fire on new verified events

### Phase 5 Gate (Thesis & Patterns)
- [ ] J-B: Observed thesis shows methodology, period, sample size
- [ ] J-C: Pattern page shows events, baseline, counterexamples, confidence
- [ ] Admin review queue functional for high-impact patterns

### Phase 6 Gate (Community & Hardening)
- [ ] J-H: Discussion threads work; moderation queue functional
- [ ] Private notes remain private (RLS verified)
- [ ] Backup/restore drill passed for Supabase + R2

---

## Navigation Maps

### Public Navigation (Unauthenticated)
```
Home → News → Companies → Investors → YC → Pricing → Sign In
```

### Signed-In Navigation (Authenticated)
```
For You → News → Investments → Companies → Investors → YC → Patterns → Saved → Community → Settings
```

### Mobile Bottom Nav (≤640px)
```
[For You] [News] [Saved] [Community] [Menu →]
```

---

## Next Steps

1. Review journey steps with design for wireframe alignment
2. Confirm entitlement gates match pricing/trial decisions
3. Define alert trigger event types for Phase 4
4. Finalize moderation policy for Phase 6
5. Map each journey step to API endpoints and database tables