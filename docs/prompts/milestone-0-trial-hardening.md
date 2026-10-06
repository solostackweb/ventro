# Nemotron Implementation Prompt: Milestone 0 Trial Hardening

You are continuing work in the existing Ventro repository. Do not start Milestone 1. Complete the corrected Milestone 0 only.

## Product Decision

Razorpay and the entire paid-payment lifecycle are deferred to Phase 7, after the intelligence engines and product experience are stable. Do not configure Razorpay, build payment processing, require payment credentials, or attempt to make the existing webhook production-ready in this milestone.

The only commercial-access outcome required now is a correct, secure, one-time 20-day student trial for eligible verified users.

Read before editing:

- `AGENTS.md`
- `docs/plans/intelligence-system-execution-plan.md`
- `docs/designs/intelligence-system-foundation.md`
- `docs/adr/001-paid-entitlement-webhook-only.md`
- `docs/adr/002-student-trial-20-day.md`
- `docs/adr/007-payment-integration-deferred.md`

Inspect the current dirty working tree before making changes. Preserve the already completed health, pagination, API-error, and ADR work. Do not overwrite unrelated user changes.

## Current Baseline

The last reported baseline is:

- `npm run typecheck`: pass
- `npm run lint`: pass with pre-existing warnings
- `npm test`: 19 suites and 59 tests pass
- `npm run build`: pass

Keep all four checks passing. Do not treat this baseline as proof that access control is correct; there are currently no sufficient trial/payment security tests.

## Required Outcome

An authenticated user with a confirmed email whose normalized domain is exactly `mastersunion.org` can activate one 20-day trial without a card, checkout, Razorpay order, or payment-provider call. Issuance is atomic, replay-safe, auditable, and cannot be extended by retries or concurrency. Ineligible, unverified, expired, and previously consumed users cannot obtain full access. Clients cannot write protected entitlement fields directly. All payment surfaces fail closed until Phase 7.

## Workstream 1: Disable Payments Safely

1. Replace the reachable behavior of `POST /api/checkout` with a stable feature-unavailable response, preferably HTTP 503 using the project's standardized API error envelope and code `PAYMENTS_DISABLED`.
2. The disabled checkout route must not authenticate with Razorpay, call `fetch` to a provider, create an order, create/update a subscription, write billing events, or modify entitlement.
3. Replace the reachable behavior of `POST /api/webhooks/razorpay` with the same fail-closed policy. It must not parse/process provider events or mutate any database record while payments are disabled.
4. Remove or isolate unused payment secrets/imports so local development, CI, preview, and production do not require Razorpay variables.
5. Keep paid CTAs disabled and honestly labelled “Coming soon” or equivalent. Make only the minimum UI integration/copy edits needed for correctness; do not perform the large visual redesign in this task.
6. Do not delete the future webhook-only security decision. `subscribed` remains reserved for the later Phase 7 payment implementation.

## Workstream 2: Create a Payment-Independent Trial Flow

1. Add a dedicated authenticated trial activation contract, such as `POST /api/trial/activate`, backed by one atomic PostgreSQL function/transaction.
2. Derive the user ID and email from the authenticated server session. Never trust a client-supplied user ID, email, domain, entitlement, or expiry.
3. Require `email_confirmed_at` and an exact case-insensitive normalized domain match for `mastersunion.org`. Reject deceptive suffixes such as `user@mastersunion.org.attacker.com`.
4. Grant exactly 20 × 24 hours in UTC from the database transaction time. Use one server-owned policy constant/function; do not let UI code calculate authorization.
5. In the same transaction:
   - verify eligibility;
   - ensure `trial_issued_at IS NULL` and the trial has never been consumed;
   - set `entitlement = 'student_trial'`;
   - set immutable `trial_issued_at` and `trial_expires_at`;
   - record `trial_eligibility_domain = 'mastersunion.org'`;
   - insert the entitlement audit event.
6. Make repeated and concurrent activation attempts idempotent. They must return the existing trial state or a clear already-consumed result; they must never extend or duplicate the trial.
7. Do not create a `subscriptions` row, `billing_events` row, Razorpay order, or any provider metadata for a free trial.
8. Connect the existing eligible trial CTA/onboarding action to this trial endpoint. Do not route it through `/api/checkout`.

## Workstream 3: Lock Down Entitlements

1. Audit every current write to `user_profiles` before changing privileges.
2. Prevent `authenticated` users from directly updating these protected fields at minimum: `entitlement`, `trial_issued_at`, `trial_expires_at`, `trial_eligibility_domain`, and any subscription/billing-authority field.
3. Do not assume a row-level `USING (auth.uid() = id)` policy protects columns; it currently allows self-updates to sensitive fields. Use explicit column privileges or purpose-specific server/database functions while preserving legitimate profile, preferences, and onboarding writes.
4. Ensure the trial-granting function cannot be used for another user. If it is `SECURITY DEFINER`, pin a safe `search_path`, use `auth.uid()`, restrict execute privileges, and avoid dynamic SQL.
5. Centralize expiry-aware access evaluation. Full access is true only for:
   - a non-expired `student_trial`; or
   - a legitimate future `subscribed` record according to the centralized policy.
6. Replace stale raw enum checks in protected server APIs with the centralized access rule. Client checks may control presentation only and must not authorize protected operations.

## Workstream 4: Repair the Trial Migration

1. Inspect the repository's migration history before choosing filenames. Migration version prefixes must be unique; the current branch contains a duplicate `20261005000001` prefix.
2. If these new migrations have not been applied anywhere, rename/consolidate them safely. If any have been applied, add forward-only corrective migrations instead of rewriting deployed history. State which assumption you verified.
3. Backfill legacy `discount_card` values and columns before adding constraints that only accept `student_trial`.
4. Keep `supabase/schema.sql`, TypeScript types, helpers, APIs, and migrations consistent.
5. Apply this legacy policy explicitly:
   - active eligible legacy trial: expiry becomes original `trial_issued_at + interval '20 days'`;
   - expired/consumed legacy trial: do not revive or reissue;
   - missing or contradictory legacy timestamps: fail conservatively to preview, preserve the record, and report the count for manual review.
6. Preserve original issuance history; never replace an old `trial_issued_at` with migration time.
7. Remove stale runtime authorization and terminology using `discount_card` or 10-day behavior. Search the whole repository, including community APIs/components, server helpers, headers, admin, pricing, fixtures, and schema.

## Workstream 5: Regression Tests

Add focused tests that prove behavior, not only copy changes:

1. Confirmed eligible email activates one 20-day UTC trial.
2. Unconfirmed email is rejected.
3. Non-eligible and deceptive domains are rejected; domain case normalization works.
4. A repeated activation does not extend `trial_expires_at` or add another grant.
5. Concurrent activation attempts result in one grant and one audit event.
6. A previously consumed or expired trial cannot be reissued.
7. An expired trial fails the centralized full-access check.
8. A client attempting to self-update `entitlement` or trial timestamps is denied while ordinary allowed profile edits still work.
9. `/api/checkout` and `/api/webhooks/razorpay` return the disabled contract and perform no provider or database mutation.
10. Trial activation performs no provider call and creates no subscription/billing-event record.
11. Migration tests cover legacy active, expired, `discount_card`, and incomplete rows, plus unique migration versions.
12. Existing protected server routes recognize active `student_trial` and reject expired trials without relying on client state.

Prefer integration tests at the database/API boundary where security behavior depends on PostgreSQL policies or atomicity. Use unit tests only where they faithfully exercise the actual contract.

## Required Verification

Run and report:

```text
npm run typecheck
npm run lint
npm test
npm run build
```

Also report repository searches proving:

- no reachable trial path calls Razorpay or `/api/checkout`;
- no stale runtime `discount_card` authorization remains;
- no user-facing 10-day trial copy remains;
- payment endpoints are fail-closed;
- migration version prefixes are unique.

## Guardrails

- Do not start the evidence-spine/Milestone 1 migrations.
- Do not implement or configure Razorpay.
- Do not redesign the UI.
- Do not weaken RLS or expose a service-role key to the client.
- Do not silently swallow database errors.
- Do not claim Milestone 0 is complete if database security/atomicity was only mocked.
- Do not modify unrelated ingestion, thesis, pattern, news, VC, or YC work.

## Final Response Format

Return:

1. Root causes corrected.
2. Files changed, grouped by database, API, UI integration, and tests.
3. Exact trial state transition and legacy migration behavior.
4. Proof that checkout/webhook/provider calls are disabled.
5. Test and build results with counts.
6. Remaining risks or external steps. Razorpay credentials and live payment testing must be listed as deferred Phase 7 work, not as a Milestone 0 blocker.
7. A clear statement: `Milestone 0 complete` or `Milestone 0 not complete`, justified against the exit gate.
