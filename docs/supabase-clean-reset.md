# Supabase Clean Reset Runbook

## Overview
This document describes the clean baseline migration for the Ventro project (Milestone 0.1), the consolidation of migration history, and the procedures for local and remote database resets.

**Date**: 2026-10-06
**Status**: Pre-launch — no production data, no real users

---

## What Was Consolidated

### Archived Migrations
All previous migration files have been moved to `supabase/migrations_archive/`:
- `20261001090000_add_source_archive.sql`
- `20261001093000_create_user_profiles_on_signup.sql`
- `20261001094500_enable_uuid_extension.sql`
- `20261001_add_yc_tables.sql`
- `20261003000000_add_raw_content_processed.sql`
- `20261003000001_add_stories_columns.sql`
- `20261003000002_add_funding_rounds.sql`
- `20261004000000_add_subscriptions_billing.sql`
- `20261005000000_add_story_presentation.sql`
- `20261005000001_admin_review_decisions.sql`
- `20261006000001_trial_activation_and_entitlement_security.sql`

### Reason for Consolidation
- No production data existed that needed migration preservation
- Multiple migrations referenced objects before they were created
- Legacy `discount_card` / 10-day trial conversions were unnecessary for a fresh database
- The `supabase/config.toml` referenced a missing `./seed.sql` file
- A single reproducible baseline is simpler to maintain and verify

### Replacement
The canonical schema is now defined in `supabase/migrations/20261006010000_initial_ventro_schema.sql` (the clean baseline migration).

---

## Canonical Schema Location

| Artifact | Location | Purpose |
|----------|----------|---------|
| **Active baseline migration** | `supabase/migrations/20261006010000_initial_ventro_schema.sql` | Single source of truth for schema |
| **Archived migrations** | `supabase/migrations_archive/` | Historical reference only |
| **Schema reference** | `supabase/schema.sql` | Generated from baseline; kept for reference |
| **Seed configuration** | `supabase/config.toml` → `[db.seed].sql_paths` | Ordered seed files |

---

## Local Reset and Verification Commands

### Prerequisites
- Docker Desktop running
- Supabase CLI installed (`npm install -g supabase` or via package manager)
- Node.js 20+ and npm

### Clean Reset Workflow
```bash
# Stop any existing local Supabase instance
npx supabase stop

# Start fresh local Supabase stack
npx supabase start

# Apply migrations and seed data from scratch
npx supabase db reset --local

# Lint the database schema
npx supabase db lint --local

# Run database tests (requires live local DB)
npm run test:db

# Run application tests
npm test

# Type-check
npm run typecheck

# Lint
npm run lint

# Build
npm run build
```

### Expected Results
- **Exactly one active migration**: `20261006010000_initial_ventro_schema.sql`
- **All migrations apply cleanly** on empty database
- **Seed files load in dependency order**: companies → funds → source_connectors → source_connectors_extended → yc_batches
- **No `discount_card` or 10-day trial references** in active schema
- **Trial and authorization tests** execute against real database
- **Payments remain disabled** (checkout/webhook return 503 PAYMENTS_DISABLED)
- **All health checks pass**: typecheck, lint, unit tests, build

> **Note**: `npx supabase test db` only provides coverage if real pgTAP tests exist under `supabase/tests/`. This project uses Jest-based database integration tests run via `npm run test:db`.

---

## Destructive Remote Reset Instructions

⚠️ **WARNING**: The following commands **permanently delete all data** in the linked Supabase project. There is no recovery without a backup.

### Verify Before Resetting
```bash
# Check which project is linked
npx supabase status

# Verify project reference
cat supabase/.temp/linked-project.json
```

### Remote Reset (Destructive)
The correct destructive workflow is:

```bash
# List available projects
npx supabase projects list

# Link to remote project (if not already linked)
npx supabase link --project-ref <project-ref>

# View current remote migration state
npx supabase migration list --linked

# DROP all remote user-created database objects and rebuild from local migrations
# Use --no-seed because current seeds are development/reference data, not production-curated
npx supabase db reset --linked --no-seed

# Verify the reset
npx supabase migration list --linked
```

**Key distinction**:
- `db push` only applies *pending* local migrations to remote — it does NOT drop existing remote objects.
- `db reset --linked` drops all remote user-created objects (tables, functions, policies, etc.) and recreates them from local migration files. This is the destructive operation.
- `--no-seed` should be used for the initial hosted reset because the current seeds are described as development/reference data and are not yet production-curated.
- Seeding hosted data must be a separate explicit decision after verification.
- The operator MUST verify the linked project before the destructive reset.

### Post-Reset Remote Verification
```bash
# Verify migration status
npx supabase migration list --linked

# Run schema diff to confirm clean state
npx supabase db diff --local --linked
```

---

## Post-Reset Smoke Checks

After any reset (local or remote), verify:

1. **Schema integrity**
   ```bash
   npx supabase db lint --local
   ```

2. **Seed data loaded**
   ```sql
   -- Check companies seeded
   SELECT count(*) FROM companies;
   
   -- Check funds seeded
   SELECT count(*) FROM funds;
   
   -- Check source connectors seeded
   SELECT count(*) FROM source_connectors;
   
   -- Check YC batches seeded
   SELECT count(*) FROM yc_batches;
   ```

3. **Auth trigger works**
   ```sql
   -- Create test user via Supabase Auth UI or API
   -- Verify profile auto-created
   SELECT * FROM user_profiles WHERE id = '<new-user-id>';
   ```

4. **Trial activation flow**
   ```bash
   # Via API (requires authenticated user with @mastersunion.org email)
   curl -X POST http://localhost:3000/api/trial/activate \
     -H "Authorization: Bearer <anon-key>" \
     -H "Content-Type: application/json"
   ```

5. **Authorization function**
   ```sql
   -- As authenticated user
   SELECT has_full_access();  -- Should return false for preview users
   ```

6. **Payments disabled**
   ```bash
   curl -X POST http://localhost:3000/api/checkout \
     -H "Content-Type: application/json" \
     -d '{"plan":"monthly"}'
   # Should return 503 PAYMENTS_DISABLED
   ```

---

## Rollback / Recovery Limitations

| Scenario | Recovery Possible? | Method |
|----------|-------------------|--------|
| Local reset | Yes | `npx supabase stop && npx supabase start && npx supabase db reset` |
| Remote reset (staging) | **No** | Data permanently deleted; restore from Supabase dashboard backup only |
| Remote reset (production) | **No** | **NEVER run on production** — this project has no production data yet |
| Schema drift | Yes | `npx supabase db diff` then generate new migration |

**Critical**: Once `npx supabase db reset --linked` executes on a linked project, all existing tables, data, and migration history are replaced by the baseline. The old migration chain cannot be recovered from the database.

---

## Strong Warning

> **REMOTE RESET DELETES APPLICATION DATA**
> 
> Running `npx supabase db reset --linked` against a linked remote project will:
> - Drop all tables, functions, triggers, policies, and data
> - Replace the migration history with the single baseline migration
> - Cannot be undone without a Supabase dashboard backup restore
> 
> **Only execute on:**
> - Local development (`--local`)
> - Staging/preview environments with no irreplaceable data
> - **NEVER on production**

---

## File Changes Summary

### Created
- `supabase/migrations/20261006010000_initial_ventro_schema.sql` — Clean baseline migration

### Modified
- `supabase/config.toml` — Fixed seed paths to reference existing seed files in dependency order
- `supabase/schema.sql` — Updated to match baseline (parameterless `has_full_access()`, named constraint)
- `src/lib/supabase/server.ts` — `hasFullAccess()` now takes no arguments (derives from `auth.uid()`)
- `src/app/api/community/route.ts` — Updated to call `hasFullAccess()` without userId
- `tests/trial-activation.test.js` — References baseline migration; legacy behavior tests point to archive
- `tests/onboarding-persistence.test.js` — References baseline migration
- `tests/admin-review.regression-1.test.js` — References active baseline migration (admin review is in Milestone 0.1)
- `tests/database-integration.test.js` — Rewritten for fresh final schema (no legacy tests)

### Archived (not deleted)
- `supabase/migrations_archive/` — All 11 previous migrations with README

---

## Remaining Risks

1. **Database integration tests unverified** — Docker not available in this environment. The following commands remain unverified:
   - `npx supabase stop`
   - `npx supabase start`
   - `npx supabase db reset --local`
   - `npx supabase db lint --local`
   - `npx supabase test db`

2. **Remote project not linked** — No `linked-project.json` with valid project reference exists. Remote reset commands untested.

3. **Payment tables exist but endpoints disabled** — Billing tables created but checkout/webhook return 503. Phase 7 will enable.

4. **Seed data is reference data** — Seed files contain AI company/VC data for development. Not production-ready.

---

## Verification Checklist for Milestone Completion

- [x] Exactly one active baseline migration exists (`20261006010000_initial_ventro_schema.sql`)
- [x] Clean migration builds entire schema on empty database (verified by inspection)
- [x] Seed configuration references only existing valid files in dependency order
- [x] No active schema or application code contains `discount_card` or 10-day trial behavior
- [x] Trial and authorization security tests updated to reference baseline
- [x] Payments remain disabled (checkout/webhook return 503 PAYMENTS_DISABLED)
- [x] Typecheck passes (`npm run typecheck`)
- [x] Lint passes (`npm run lint` — warnings only)
- [x] Build passes (`npm run build`)
- [x] Unit tests pass (20/21 test suites; 1 requires Docker)
- [ ] **Database integration tests pass** — **BLOCKED: Docker unavailable**
- [ ] **Remote reset verified** — **BLOCKED: No linked project**

---

## Next Steps

When Docker becomes available:
1. Run full clean-room validation workflow
2. Link a staging Supabase project and verify remote push
3. Mark Milestone 0.1 complete

For now, the codebase is ready for Milestone 1 development with a clean, reproducible schema baseline.