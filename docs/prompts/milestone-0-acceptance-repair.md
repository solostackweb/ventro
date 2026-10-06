# Nemotron Prompt: Milestone 0 Acceptance Repair

Do not start Milestone 1. The application health checks pass, but Milestone 0 failed acceptance review because the new tests inspect source text instead of executing the PostgreSQL behavior. Repair the current implementation and prove the database contract.

Read first:

- `AGENTS.md`
- `docs/prompts/milestone-0-trial-hardening.md`
- `docs/adr/002-student-trial-20-day.md`
- `docs/adr/007-payment-integration-deferred.md`
- `supabase/migrations/20261006000001_trial_activation_and_entitlement_security.sql`
- `supabase/schema.sql`
- `tests/trial-activation.test.js`

Preserve unrelated working-tree changes. Razorpay and paid subscriptions remain deferred. Do not start evidence-spine work or a visual redesign.

## Acceptance Findings to Fix

### P0: The migration rejects legacy rows before converting them

The migration adds a CHECK constraint allowing only `preview`, `student_trial`, and `subscribed` before it converts existing `discount_card` rows. PostgreSQL validates existing rows when the constraint is added, so the migration fails on the legacy data it is meant to migrate.

Required repair:

1. Drop the old constraint.
2. Backfill the new timestamp/domain fields.
3. Convert `discount_card` entitlement values to `student_trial`.
4. Only then install and validate the new constraint.
5. Add an executable migration test with a seeded legacy `discount_card` row. A regex ordering assertion is not sufficient.

### P0: SECURITY DEFINER functions use an empty search path with unqualified relations

Both `has_full_access()` and `activate_student_trial()` set `search_path = ''` but reference `user_profiles` and `entitlement_audit` without the `public.` schema. Those functions will fail at runtime with relation-not-found errors.

Required repair:

- Keep the hardened empty search path.
- Fully qualify every relation, function signature, policy target, index target, and comment target where relevant, including `public.user_profiles` and `public.entitlement_audit`.
- Add an executable database test that invokes `public.activate_student_trial()` and `public.has_full_access(...)` against a real local/test PostgreSQL or Supabase instance.

### P0: The sensitive-column REVOKE is ineffective when table UPDATE remains granted

Supabase projects commonly grant table-level UPDATE on public tables to `authenticated`. Revoking UPDATE on selected columns does not override a table-level UPDATE grant.

Required repair:

1. Revoke table-level UPDATE on `public.user_profiles` from `authenticated`.
2. Grant UPDATE only for the explicitly allowed profile columns required by the current application.
3. Keep the own-row RLS policy as a second boundary.
4. Verify with real role/privilege checks such as `has_table_privilege` and `has_column_privilege`.
5. Execute an authenticated database/API test proving:
   - an ordinary permitted profile update succeeds;
   - direct changes to `entitlement`, `trial_issued_at`, `trial_expires_at`, and `trial_eligibility_domain` fail.

Do not claim this is proven by matching `REVOKE` text.

### P0: Expired legacy 10-day trials are revived

The current backfill extends every short legacy trial to `trial_issued_at + 20 days`, even when the old trial already expired. For a trial issued 15 days ago and expired after 10 days, the migration creates five new days of access. The existing test comment says this does not happen, but the SQL has no `NOW()` condition.

Required repair:

- Extend only legacy trials that are active at migration time.
- Never revive an expired or consumed trial.
- Preserve the original `trial_issued_at`.
- Seed and execute separate database cases for active, expired, and contradictory/missing legacy timestamps.
- Record/report contradictory legacy rows for manual review and leave them without full access.

### P1: Expired trials still pass server authorization

`src/app/api/community/route.ts` authorizes any `student_trial` value without checking `trial_expires_at`. An expired trial can still create discussions. `getEntitlement()` also returns `student_trial` when its expiry is missing.

Required repair:

- Centralize the expiry-aware access rule in one server-side helper/RPC.
- Make missing, invalid, or expired `trial_expires_at` evaluate to preview/no full access.
- Replace raw entitlement authorization in every protected server route, beginning with the community POST route.
- Client checks may control presentation only.
- Add route-level tests proving active trial succeeds and expired/missing-expiry trial receives 403.

### P1: Trial activation can downgrade a subscribed user

`activate_student_trial()` does not reject or preserve a user whose entitlement is already `subscribed` and whose `trial_issued_at` is null.

Required repair:

- Never replace `subscribed` with `student_trial`.
- Return a stable success/already-full-access result without changing timestamps, entitlement, or audit history.
- Add an executable regression test.

### P1: Missing-profile concurrency path is not safe

After `INSERT ... ON CONFLICT DO NOTHING`, the function does not reselect and lock the winning row. Concurrent calls on a missing profile can proceed with an empty record and can overwrite/duplicate issuance.

Required repair:

- Either require the auth trigger-created profile and return a stable error when it is missing, or insert-if-missing and then always reselect the row `FOR UPDATE` before checking/issuing.
- Prove concurrent activation produces one immutable issuance timestamp and exactly one audit event.

### P1: Canonical schema and product documentation are stale

`supabase/schema.sql` still defines `discount_card`, legacy columns, the old audit source, the old RLS policy, and old helper functions. Root and phase-zero product documents still present a 10-day discount card and live checkout behavior.

Required repair:

- Align `supabase/schema.sql` with the final migrated schema and access policy.
- Update current product documentation (`README.md`, `AI_INTELLIGENCE_WEBAPP_PRD.md`, `setup_next_gen.md`, and relevant phase-zero journey/decision summaries) to the 20-day payment-independent trial and deferred payments.
- Historical ADR context and migration compatibility references may retain legacy terms when clearly labelled historical.
- Replace the stale execution-plan observation that current landing/pricing copy still says 10 days.

## Test Quality Requirement

Keep lightweight source-contract tests only where useful, but they cannot be the primary proof for SQL behavior. Add executable integration coverage using the project's Supabase/PostgreSQL testing approach. If no database test harness exists, create the smallest repeatable local test harness and document its prerequisites. Do not silently skip these tests in the default validation command.

At minimum, execute and assert:

1. Migration succeeds with a real legacy `discount_card` row.
2. Active legacy trial becomes 20 days from original issuance.
3. Expired legacy trial remains expired.
4. Contradictory/missing legacy timestamps do not grant access.
5. Eligible confirmed user activates exactly once.
6. Concurrent activations create one grant and one audit event.
7. Unconfirmed and deceptive-domain accounts fail.
8. Subscribed account is not downgraded.
9. Expired/missing-expiry student trial fails full-access authorization.
10. Authenticated direct sensitive-column update fails while an allowed profile update succeeds.
11. Disabled checkout/webhook contracts still return 503 without mutations.

## Verification

Run:

```text
npm run typecheck
npm run lint
npm test
npm run build
```

Also run the executable database migration/integration suite and provide its exact command and result. Do not declare Milestone 0 complete if that suite was skipped, mocked, or reduced to reading SQL as text.

## Final Response

Return:

1. Each acceptance finding and its repair.
2. Exact migration ordering and legacy cohort behavior.
3. Actual database-test command, cases, and results.
4. Privilege proof for allowed versus protected profile columns.
5. Server routes converted to centralized expiry-aware authorization.
6. Typecheck, lint, test, and build results.
7. Remaining external step: applying the verified migration to production Supabase.
8. `Milestone 0 complete` only if every P0/P1 item and executable database test passes; otherwise say `Milestone 0 not complete`.
