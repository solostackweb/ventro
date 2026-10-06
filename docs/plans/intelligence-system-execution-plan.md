# Ventro Intelligence System Execution Plan

Date: 2026-10-05  
Status: Ready for implementation  
Source brief: `docs/designs/intelligence-system-foundation.md`

## Executive Assessment

**Overall repository score: 5.5/10.** Ventro has more product breadth than a typical prototype, but the trust, data-lineage, commercial, and visual foundations are not yet strong enough for the product promise.

| Area | Score | Assessment |
| --- | ---: | --- |
| Product scope and information architecture | 7.0 | The domain model covers news, companies, investors, YC, investments, patterns, community, accounts, and admin. The two-question hierarchy is now clear. |
| Data ingestion foundation | 6.0 | Source connectors, R2, fetch logs, clustering, and scheduled ingestion exist. Durable stage state, replay, leases, and cost visibility are missing. |
| Evidence and data integrity | 4.5 | Useful provenance concepts exist, but there is no unified claim-to-evidence-to-model-run chain across all engines. |
| Thesis and pattern intelligence | 3.5 | Current implementations are keyword and count heuristics. They are suitable for experiments, not published intelligence claims. |
| Application architecture | 6.0 | A Next.js modular monolith is the right shape for this stage. Repeated client fetching and inconsistent contracts will slow expansion if not consolidated. |
| Test and delivery health | 7.0 | Typecheck, lint, tests, and production build now pass, and dashboard pagination works. The remaining Milestone 0 gap is access-control regression coverage. |
| Access and billing readiness | 3.0 | The 20-day trial is still coupled to checkout, entitlement fields are not sufficiently protected, and the unfinished payment flow must not remain live. |
| Current UI/UX | 4.5 | Responsive and readable, but visually generic, low-density, and disconnected from the intelligence-terminal positioning. Public preview navigation is misleading. |
| Approved design direction | 8.0 | The approved toned-down editorial-financial direction has the hierarchy and distinctive identity needed for the product. |

## Release Blockers

These must be resolved before presenting generated theses and patterns as trusted intelligence. Production payments are intentionally deferred to the final commercial-activation milestone.

1. **Safe payment deferral:** no live route or UI action may create a provider order, accept payment, or grant `subscribed` access until the commercial-activation milestone. Checkout and webhook surfaces must fail closed with an explicit unavailable response.
2. **Claim provenance:** every published amount, round participant, investor thesis, and generated answer needs a stable evidence link to a stored source version and exact supporting span.
3. **Pattern validity:** remove the zero historical baseline and fixed-confidence shortcuts. Candidate patterns need reproducible inputs, a comparison baseline, sample size, counterexamples, and a review state.
4. **Thesis attribution:** separate official investor statements from behavior inferred from investments. Never present inferred text as the investor's words.
5. **Build health:** preserve the now-passing typecheck, lint, test, and production-build baseline while adding access-control regression coverage.
6. **Trial correctness:** make the verified-student trial a payment-independent, server-authoritative, one-time 20-day grant; protect entitlement fields from direct user mutation; and change every server rule, API response, test, document, and UI reference from 10 to 20 days as one migration.

## Product Contract

The launch experience answers, for a chosen time window, AI domain, geography, and funding stage:

1. **What are investors investing in now?**
2. **What are investors looking for from the market?**

Each answer must expose:

- the conclusion and the time window it describes;
- supporting investments, sources, and thesis statements;
- deal-count and disclosed-dollar views;
- confidence, coverage, and last-updated state;
- counter-evidence and material conflicts;
- a route into VC, YC, company, news, investment, thesis, and pattern detail pages.

The product may suggest research or idea hypotheses. It must not claim that an idea is guaranteed to be fundable or predict that a specific investor will invest.

## Target Architecture

Keep a modular monolith until measured load justifies distributed workers.

```text
Sources -> Connector policy -> Fetch/archive -> Documents/versions
                                               |
                                               v
                                     Model/extraction runs
                                               |
                                               v
                                  Claims <-> Evidence spans
                                               |
                    +--------------------------+-------------------------+
                    v                          v                         v
             Funding events             Thesis records          Entity resolution
                    +--------------------------+-------------------------+
                                               v
                               Verification and publication gate
                                               |
                    +--------------------------+-------------------------+
                    v                          v                         v
                 VC/YC                    Patterns                 Answer snapshots
                    +--------------------------+-------------------------+
                                               v
                               APIs -> Personalized workspace
```

Use Supabase/Postgres as the canonical structured store and R2 for permitted immutable source snapshots. GitHub Actions may schedule work, but Postgres must own pipeline truth so a timed-out workflow can be resumed safely.

## Delivery Sequence

### Milestone 0: Make Free Access Safe and Correct

Estimated scope: 1 week.
Status: correction pass required; health, pagination, API-error, and ADR work is already present, but the trial/payment boundary is not yet complete.

- Remove the student-trial path from checkout and expose one authenticated, server-owned activation path that never contacts a payment provider.
- Grant an eligible, email-verified `@mastersunion.org` account exactly one 20-day trial in UTC through an atomic database operation with an audit event.
- Preserve `trial_issued_at`, prevent repeat and concurrent grants, and define the migration treatment for active, expired, and incomplete legacy trial records.
- Centralize full-access evaluation so APIs and server-rendered pages require either an unexpired `student_trial` or a future valid `subscribed` entitlement.
- Prevent authenticated users from directly updating entitlement, trial, subscription, or billing-authority fields through `user_profiles` policies.
- Disable checkout, payment-provider calls, payment CTAs, and the Razorpay webhook surface until the commercial-activation milestone. Disabled routes must fail closed and must not mutate data.
- Fix Jest ESM configuration and add `.gstack` to the lint ignore boundary.
- Finish dashboard pagination and standardize API error envelopes.
- Add architecture decisions for claim provenance, funding-round identity, thesis types, pattern states, and entitlements.

**Exit gate:** typecheck, lint, tests, and build pass; eligible verified students can activate exactly one 20-day trial without a card or provider call; expired or ineligible users cannot access protected features; clients cannot self-upgrade entitlement; and every payment surface is visibly and technically disabled.

### Milestone 1: Build the Evidence Spine

Estimated scope: 2–3 weeks.

- Add document versions, model runs, claims, evidence spans, pipeline runs, and stage attempts.
- Add connector trust tier, source rights, cadence, rate limit, and health fields.
- Implement idempotency keys, leases, bounded retries, dead-letter state, and replay controls.
- Backfill current stories, sources, investments, and thesis records with explicit migration reports.
- Add admin views for source freshness, failures, ingestion yield, model usage, and publication rejection.

**Exit gate:** a published investment can be traced from UI field to claim, source version, archived bytes, extraction version, and verification decision.

### Milestone 2: Make the Core Research Engines Reliable

Estimated scope: 3–4 weeks.

- Seed and audit the first 100 VC profiles with official sources, aliases, focus, geography, stages, and connector coverage.
- Define the lawful YC batch/company source strategy and track membership as evidence-backed company metadata.
- Normalize funding rounds separately from investor participation, including undisclosed values and currency conversion metadata.
- Improve story clustering, image provenance, source timelines, correction history, and stale/partial/conflict states.
- Build complete VC, YC, company, and investment timelines from shared evidence contracts.

**Exit gate:** sampled profiles and rounds meet the evidence-completeness target and do not duplicate the same economic event.

### Milestone 3: Rebuild Thesis and Pattern Intelligence

Estimated scope: 3 weeks.

- Extract stated thesis propositions only from attributable source spans.
- Compute observed thesis from verified investments over explicit windows and label it as inference.
- Add thesis change history and stated-versus-observed comparison with coverage caveats.
- Replace narrative-first patterns with deterministic measures, segmented baselines, minimum sample rules, sensitivity checks, and counterexamples.
- Require review before high-impact patterns can be published.
- Create labelled evaluation sets for funding extraction, entity resolution, thesis attribution, and pattern validity.

**Exit gate:** funding extraction reaches at least 90% precision on the labelled set; every published pattern shows method, baseline, sample, counterexamples, and coverage.

### Milestone 4: Ship the Two-Answer Product and Visual System

Estimated scope: 3–4 weeks.

- Add time-bound answer snapshots assembled only from published claims and patterns.
- Build the approved dark-ink/warm-ivory token system, typography, data colors, charts, evidence drawers, and shared table/card primitives.
- Redesign Today, News, Investments, VC, YC, Thesis, Pattern, and entity profiles around the two questions.
- Make the public “Explore Feed” route an honest limited preview or rename it to make the sign-in requirement explicit.
- Support loading, empty, partial, stale, conflict, corrected, and failure states on every core page.
- Validate desktop, tablet, and mobile layouts; preserve source inspection on mobile.

**Exit gate:** ten students can answer either question for a chosen AI domain in under five minutes, and at least eight can explain the evidence behind the answer.

### Milestone 5: Personalization, Accounts, and Access

Estimated scope: 2 weeks.

- Centralize server-side entitlement policy.
- Add complete profile, research interests, geographies, stages, follows, and “why this” explanations.
- Complete password reset/change, email verification, OAuth connections, active sessions, sign-out-all, data export, and account deletion.
- Complete non-payment account and access surfaces. Keep billing-history and payment-management views hidden or explicitly unavailable until commercial activation.
- Verify the Milestone 0 student-trial migration in production-like data without reissuing already consumed trials.
- Add audit events and boundary tests for signup time, UTC expiry, retries, and existing users.

**Exit gate:** account and entitlement behavior is consistent across UI, API, database, and tests; expired users are never charged automatically.

### Milestone 6: Community and Idea Validation

Estimated scope: 2–3 weeks after core-engine quality gates.

- Anchor discussions to companies, funds, stories, investments, theses, patterns, and saved research.
- Keep user discussion out of the verified corpus until independently sourced.
- Add reporting, moderation, rate limits, audit history, and abuse workflows.
- Add structured idea-validation notebooks that cite market evidence and explicitly separate fact, inference, and founder hypothesis.

**Exit gate:** community content cannot silently change factual answers, and users can trace every validation claim to either evidence or a clearly labelled hypothesis.

### Milestone 7: Commercial Activation and Payments

Estimated scope: planned only after the core intelligence product and access model are stable.

- Select and configure the production payment provider, legal entity, pricing, currency, tax, refund, and support policies.
- Implement checkout without granting entitlement from order or intent creation.
- Activate `subscribed` only from cryptographically verified, idempotent provider events processed with server-only credentials and atomic database transitions.
- Implement cancellation, renewal, invoices, failed-payment recovery, refunds, reconciliation, audit history, and production observability.
- Run provider sandbox tests, webhook replay/reordering tests, and an end-to-end production-readiness review before enabling any payment CTA.

**Exit gate:** a reviewed production payment can be reconciled from provider event to subscription and entitlement; duplicate, invalid, missing-signature, reordered, and failed events cannot grant access.

## Visual System Workstream

The approved mockup is the design north star: `docs/designs/assets/ventro-intelligence-dashboard-direction.png`.

Priorities:

1. Replace generic white-card SaaS styling with a restrained editorial research frame.
2. Make the two answers, investment flow, market movement, confidence, and counter-evidence visible above the fold.
3. Use color only for meaning: positive/verified, caution/partial, contradiction, and active selection.
4. Use dense tables and charts for scanning, then evidence drawers and timelines for depth.
5. Reduce decorative containers; use typography, alignment, dividers, and whitespace to create hierarchy.
6. Make auth, settings, and billing feel like the same product rather than separate templates.

Current live-pass findings:

- The landing page is responsive and has no observed browser console warnings or errors.
- The hero communicates the two questions well, but the page is visually sparse and generic on desktop.
- Login, signup, and pricing use basic centered-card layouts with little Ventro identity.
- “Explore Feed” routes unauthenticated users to sign-in despite the pricing page promising a free preview.
- Trial copy still says 10 days on the landing and pricing pages.

## 20-Day Trial Migration Checklist

- Create one server-owned duration constant or policy record; UI must not calculate entitlement independently.
- Activate the trial through a dedicated authenticated server endpoint or database RPC, never through checkout and never through a payment-provider order.
- Require a confirmed email and an exact case-insensitive `mastersunion.org` domain match based on the authenticated identity, not a client-supplied user ID or email.
- Make issuance and its audit record atomic; repeated and concurrent activation attempts must return the same effective trial rather than create or extend it.
- Restrict client updates so users cannot alter entitlement, trial timestamps, subscription state, or billing authority fields.
- Update signup, landing, pricing, settings, headers, emails, API responses, tests, fixtures, and product documentation. Remove stale `discount_card` and `10-day` runtime behavior.
- Preserve the original `trial_issued_at`; calculate the policy transition explicitly instead of overwriting history.
- Extend an active legacy eligible trial to exactly 20 days from its original issue time. Do not revive an expired trial or grant a second trial to a user whose eligible trial was already consumed.
- Add migration/audit records recording old duration, new duration, affected cohort, and effective time.
- Backfill legacy values before adding new constraints, use unique migration version prefixes, and keep `supabase/schema.sql` aligned with the migrations.
- Test eligibility, unverified email, non-eligible and deceptive domains, case normalization, UTC boundaries, repeat/concurrent activation, account recreation, OAuth signup, expiry, direct profile-update attacks, and the absence of provider calls.

## Validation Dashboard

Track product-market and system quality separately.

**User value**

- Core-question completion rate and median completion time.
- Evidence opened per answer and trust rating after inspection.
- Week-one return rate for the initial student cohort.
- Saved research, followed entities, and alert revisit rate.
- Explicit willingness to pay after the 20-day period.

**Intelligence quality**

- Evidence coverage by published field.
- Extraction precision and entity-resolution accuracy.
- Duplicate-round and conflicting-amount rate.
- Pattern acceptance, correction, rejection, and retirement rates.
- Citation completeness and unsupported-sentence rate in answer snapshots.

**Operations**

- Source freshness, fetch success, ingestion yield, and stale connector count.
- Queue age, retry rate, dead letters, and replay success.
- Model cost per accepted claim and per answer snapshot.
- API latency, Core Web Vitals, error rate, and entitlement failures.

## Immediate Backlog Order

1. Decouple and harden the one-time 20-day student trial; lock down entitlement writes.
2. Disable checkout, Razorpay calls, payment CTAs, and webhook mutation until commercial activation.
3. Repair test/lint health and complete pagination.
4. Add the evidence and pipeline migrations.
5. Backfill and audit the first source set.
6. Normalize investments and entity resolution.
7. Rebuild stated/observed thesis contracts.
8. Rebuild deterministic pattern computation and review.
9. Implement answer snapshots.
10. Apply the new visual system across core engines.
11. Finish account/security and non-payment access surfaces.
12. Run the ten-student unguided pilot.
13. Add community and structured idea validation only after the quality gates hold.
14. Implement and activate payments only in Milestone 7.

## Scope Boundary

Do not split the system into microservices, build a native mobile app, create investor-ranking scores, promise exhaustive private-market coverage, make community content part of the verified corpus, or implement live payments before Milestone 7. Those additions do not help prove the two core answers.

## Same-Day Execution Structure

Decision date: 2026-10-06  
Target: an integrated, deployable beta that preserves the approved full-product plan and converges on `docs/designs/assets/ventro-intelligence-dashboard-direction.png` using real evidence-backed data and insights.

The product scope is unchanged. Implementation is divided into four sequential checkpoints so each checkpoint remains runnable and verifiable:

1. **Evidence foundation:** immutable document versions, model runs, claims, evidence spans, entity-resolution records, and compatibility links from existing news and funding records.
2. **Automated intelligence pipeline:** durable runs and stage attempts, idempotency, leases, bounded retries, dead-letter/replay behavior, automated confidence-based publication, and the news/funding/thesis/pattern processing path.
3. **Two-answer product contracts:** answer snapshots and APIs for “What are investors investing in now?” and “What are investors looking for from the market?”, with filters, citations, confidence, coverage, and counter-evidence.
4. **Final application experience:** apply the approved editorial-financial visual system across the dashboard and core engines, backed by real ingested data; complete the required account, preference, security, and non-payment access surfaces without enabling payments.

Operational policy:

- Ingestion and ordinary evidence-backed publication are automatic; the pipeline must not wait for routine admin approval.
- Deterministic rules may automatically publish sufficiently supported, non-conflicting facts. Weak, conflicting, or unsupported records remain candidates and are excluded from published answers.
- Manual review is reserved for high-impact patterns, corrections, material conflicts, and exceptional cases.
- Admin dashboards are support tooling and do not gate ingestion or publication. Their full UI is deferred until useful operational data exists; secure diagnostic queries and machine-readable status remain required.
- Bulk legacy backfill is deferred because the hosted database was reset without production data. Newly ingested records and deterministic fixtures prove the evidence contract first.
- The pipeline-orchestration rewrite follows the evidence-contract checkpoint rather than landing in the same change.

Scope decision record:

- Feature answers: D1=A (pipeline orchestration follows the evidence-foundation checkpoint); D2=A (bulk historical backfill deferred, fixtures and new ingestion used first); D3=A (admin UI deferred, diagnostics retained).
- Structure: D4=B, smaller sequential arrangement with the full approved product scope retained.
- Accepted scope: the four checkpoints above, completed in order without reducing the approved VC, YC, news, investment, thesis, pattern, two-answer, personalization, account, or final visual outcome.
- Pending remedies: none at the scope level; engineering review findings below may add implementation requirements without changing product scope.

## Decision Ledger

### R1: Automatic funding-claim publication threshold

Finding: P1, confidence 10/10, `docs/designs/intelligence-system-foundation.md` Open Questions — the approved plan requires automatic evidence-based publication but does not define the promotion threshold.

Plan baseline: Routine evidence-backed publication is automatic; weak, conflicting, or unsupported records remain candidates; manual review is reserved for high-impact patterns, corrections, material conflicts, and exceptional cases. Exact numeric/source thresholds are unapproved.

Runtime evidence: Existing funding extraction copies story verification state to funding rounds and re-fetches mutable public article URLs. It does not calculate source independence, extraction confidence, resolution confidence, or field-level claim evidence.

Comparison grid:

| Choice | Current | A: Conservative | B: Balanced | C: Existing labels |
| --- | --- | --- | --- | --- |
| Required source support | Unspecified | One official primary source or two independent approved sources | One approved source | Existing story label only |
| Extraction confidence | Unspecified | At least 0.85 | At least 0.80 | Not required |
| Entity-resolution confidence | Unspecified | At least 0.90 | At least 0.80 | Not required |
| Active contradiction | Must not publish weak/conflicted data | Blocks publication | Blocks publication | Existing conflicted label blocks publication |
| Manual approval for ordinary claims | Not required | Not required | Not required | Not required |
| Result below threshold | Candidate, excluded from answers | Candidate | Candidate | Existing state |

Question D5:

### D5 — Automatic evidence threshold

ELI10: Ventro needs a deterministic line between a claim that can appear in investor answers automatically and one that should remain an unpublished candidate. A stricter line produces fewer but more trustworthy facts; a looser line fills the product faster but raises correction risk.

Stakes if we pick wrong: unsupported funding amounts or investor participation could appear as verified market intelligence and damage trust in both core answers.

Recommendation: A, because the product's advantage is inspectable evidence and the current empty database lets us start clean.

Completeness: A = 10/10, B = 8/10, C = 5/10.

Net: choose the trust threshold for ordinary funding claims; this does not require routine admin approval.

Header: Evidence threshold

Options:

A) Conservative evidence (recommended)
Automatically publish only with one official primary source or two independent approved sources, extraction confidence at least 0.85, entity-resolution confidence at least 0.90, and no active contradiction. Lower-confidence records remain candidates. Human: no routine review / coding agent: modest deterministic policy and tests.

B) Balanced evidence
Automatically publish from one approved source when extraction and resolution confidence are both at least 0.80 and no contradiction exists. This creates a fuller feed sooner but accepts more single-source extraction risk. Human: no routine review / coding agent: slightly simpler policy and tests.

C) Preserve existing labels
Continue using current story verification labels without new numeric or source-independence requirements. This is fastest but cannot support the evidence-first trust promise or the published-claim exit gate. Human: no routine review / coding agent: minimal change.

State: approved
Actual answer: A, provided by the user in response to D5 on 2026-10-06
Accepted scope: Automatically publish an ordinary funding claim only when it has one official primary source or two independent approved sources, extraction confidence of at least 0.85, entity-resolution confidence of at least 0.90, and no active contradiction. Otherwise retain it as a candidate excluded from published answers. Routine claims require no manual approval.
History: none

Approval readiness: PASS — scope decisions D1–D5 are resolved and the implementation requirements below preserve those decisions.

## Engineering Review: Same-Day Checkpoint 1

### Scope Challenge

Result: scope accepted as-is, arranged into four sequential checkpoints. Checkpoint 1 is the evidence-foundation vertical slice; pipeline orchestration, bulk backfill, and admin UI remain in their approved later checkpoints.

### Architecture Review

1. **[P1] Immutable-input requirement:** funding extraction currently re-fetches mutable public URLs. Checkpoint 1 must extract from `document_versions.normalized_text` and retain the source version identifier.
2. **[P1] Field binding requirement:** a generic claim graph alone cannot prove which claim supports `funding_rounds.amount_usd` or a participant role. Add `claim_bindings` keyed by record type, record ID, and field name.
3. **[P1] Atomic compatibility requirement:** the existing `source_archive` queue must remain functional, but archive and document-version writes cannot diverge. Persist the archive row, source document, immutable version, and their link in one transaction through a service-role-only database function.
4. **[P1] Publication boundary:** enforce the approved D5 threshold centrally. Callers may request evaluation but cannot directly mark unsupported claims published.
5. **[P1] Evidence-span integrity:** offsets refer only to a documented normalized-text representation. Insertion must reject out-of-range spans, excerpt mismatches, and checksum mismatches.
6. **[P2] Rights boundary:** authenticated evidence reads must never expose raw content beyond connector retention/reuse rights. Internal provenance writes remain service-role-only.
7. **[P2] Correction history:** claims are superseded, corrected, or retracted with reasons; published facts are not silently overwritten.

### Code Quality Review

1. Add one evidence repository module as the only application writer for documents, versions, model runs, claims, evidence, and bindings.
2. Keep URL canonicalization, text normalization, SHA-256 hashing, span calculation, and publication evaluation as deterministic pure helpers with table-driven tests.
3. Extend connector metadata only with fields required by the approved threshold: `trust_tier`, `is_official`, and `independence_group`. Preserve the existing rights and cadence fields.
4. Reuse archived bytes in funding extraction. Do not introduce a second article-fetch path.
5. Propagate every Supabase/R2 write failure. A partial evidence chain must not be reported as a successful ingestion item.
6. Keep provider-neutral model-run fields while representing deterministic extraction as an explicit run kind rather than a fake external model call.

### Test Review

```text
SOURCE INGESTION                              FUNDING CLAIM
FetchResult                                  document_version.normalized_text
  -> canonical URL                             -> deterministic extractor
  -> content hash                              -> model_run/run metadata
  -> [ATOMIC] source_document                   -> candidate claims
              document_version                 -> exact evidence spans
              source_archive link              -> resolution confidence
  -> existing clustering queue                 -> publication evaluator
                                                   | pass -> published + binding
                                                   | fail -> candidate only
                                                   v
                                             funding_round/participant field
                                                   v
                                             evidence lookup contract

Failure branches requiring tests:
- repeated URL with unchanged hash -> reuse version, no duplicate queue work
- same URL with changed hash -> append immutable version and supersede latest pointer
- R2 succeeds but DB transaction fails -> visible failure, safe retry, no false success
- invalid/mismatched span -> reject evidence write
- official source + thresholds + no contradiction -> published automatically
- two independent sources + thresholds -> published automatically
- duplicate/related sources only -> remain candidate
- low extraction or resolution confidence -> remain candidate
- active contradiction -> remain candidate
- insufficient reuse rights -> no prohibited raw-content response
- funding amount/stage/participant writes retain claim bindings
- existing story ingestion and clustering behavior remains intact
```

Required coverage:

- Migration source-contract tests for every table, constraint, grant, RLS policy, and service-role-only function.
- Unit tests for URL canonicalization, normalization stability, hashes, spans, independence counting, thresholds, contradictions, and correction transitions.
- Repository tests proving atomic payload construction, idempotent retries, and surfaced write failures.
- Funding-extractor regression tests proving archived-version input, exact spans, candidate/published behavior, and field bindings.
- Existing ingestion, clustering, funding, typecheck, lint, test, and build suites must remain green.
- One deterministic end-to-end fixture must trace a published funding amount from bound database field to claim, evidence span, document version, archive key, and run metadata.

### Performance Review

1. Add unique keys for canonical source identity and immutable version hashes; do not scan JSON to deduplicate documents.
2. Index claim subject/status/effective time, evidence claim/version/stance, binding record/field, aliases, and resolution decision lookup paths.
3. Fetch evidence for a page in one bounded query/RPC rather than an N+1 query per displayed field.
4. Store large permitted raw bytes in R2; keep only normalized evidence text or a rights-compliant excerpt in Postgres when appropriate.
5. Paginate claim/evidence lookup and cap excerpts returned to the application.

### Independent Outside Voice

Claude Code outside review was unavailable because its local execution context was not authenticated. No outside findings were credited; the native architecture and code inspection remains the review evidence.

## Checkpoint 1 Implementation Tasks

1. **T1, P1 — Evidence migration:** add the eight provenance/resolution tables, connector trust fields, compatibility foreign keys, constraints, indexes, comments, RLS, grants, and transactional functions in one incremental migration after `20261006010000`.
2. **T2, P1 — Deterministic evidence core:** implement canonical URL, normalized text, hashing, span validation, publication evaluation, and typed evidence contracts.
3. **T3, P1 — Atomic persistence adapter:** create the evidence repository and route all new fetch results through the atomic archive/document/version write path.
4. **T4, P1 — Story compatibility:** preserve document-version identity in story sources without breaking the current clustering queue.
5. **T5, P1 — Funding trace:** stop live article re-fetching; extract from archived versions and persist funding claims, evidence spans, model-run metadata, resolution confidence, publication state, and field bindings.
6. **T6, P1 — Evidence read contract:** add one bounded server-side lookup returning published field evidence without leaking restricted raw content.
7. **T7, P1 — Verification:** implement the approved tests and deterministic end-to-end trace fixture; run all project health checks.

Checkpoint 1 exit gate: a deterministic fixture and one newly ingested funding item can be traced from a funding-round field through `claim_bindings`, a published claim, validated evidence span, immutable document version, archived object reference, and extraction run. Existing news ingestion and clustering continue working, and no routine admin approval is required.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | Product hierarchy and evidence-first positioning approved previously |
| Outside Review | Claude Code | Independent second opinion | 1 | UNAVAILABLE | Authentication unavailable; no findings credited |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES OPEN | 24 requirements mapped into Checkpoint 1 tasks; 5 decisions resolved |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | Approved toned-down editorial-financial direction retained |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | Not required for this internal implementation checkpoint |

**OUTSIDE COVERAGE:** Claude Code plan challenge attempted but unavailable due to local authentication; native review completed.

**VERDICT:** ENG REVIEW ISSUES MAPPED — Checkpoint 1 is ready to implement; later checkpoints remain gated by the same-day sequence.

NO UNRESOLVED DECISIONS
