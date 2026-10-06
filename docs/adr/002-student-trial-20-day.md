# ADR-002: Student Trial Eligibility and Expiry

## Status
Accepted

## Date
2026-10-05

## Context
The product offers a 20-day free trial to verified `@mastersunion.org` email addresses. The previous implementation used 10 days and confusing `discount_card` terminology. Key requirements:
- Exactly 20 days (not 10)
- Limited to `@mastersunion.org` domain (verified exact match, case-insensitive)
- Server-owned duration and eligibility; UI must not calculate authorization
- Preserve `trial_issued_at` historical timestamps
- No second trial for accounts that already consumed one
- No automatic charge at expiry
- UTC for entitlement boundaries

## Decision
- Rename `discount_card` → `student_trial` in database and code
- Rename `discount_card_expires_at` → `trial_expires_at`
- Rename `discount_card_issued_at` → `trial_issued_at`
- Add `trial_eligibility_domain` to track qualifying domain
- Duration constant: 20 days (20 * 24 * 60 * 60 * 1000 ms)
- Trial eligibility checked by a dedicated authenticated server endpoint or database RPC, independent of checkout and any payment provider
- Trial expiry checked server-side via `has_student_trial_access()` and `has_full_access()` PostgreSQL functions
- Trial issuance and its audit record are atomic and use the authenticated identity rather than client-supplied user data
- Repeated or concurrent activation cannot create, renew, or extend a trial
- Authenticated clients cannot directly update entitlement, trial timestamps, subscription state, or billing-authority fields
- Expired trials are treated as `preview` by server authorization even if the historical row still records `student_trial`
- No auto-charge; expired users must explicitly subscribe

## Migration Strategy
- A uniquely versioned trial-policy migration:
  - Backfills legacy values before replacing constraints
  - Updates `entitlement` CHECK constraint: `preview`, `student_trial`, `subscribed`
  - Renames columns (backward compatible via views if needed)
  - Adds new columns and indexes
  - Updates PostgreSQL helper functions and restricted column-update policies
- All runtime and UI references updated: "10-day" → "20-day", `discount_card` → `student_trial`
- An active legacy trial expires exactly 20 days after its original issue time
- An expired or otherwise consumed legacy trial is not revived; incomplete legacy records are handled conservatively and reported

## Consequences
- Clear terminology: `student_trial` vs `subscribed`
- Server-authoritative: no client-side entitlement calculation
- Audit trail via `entitlement_audit` with source `student_trial`, committed in the same transaction as issuance
- Backward compatible: old columns renamed, not dropped
- No dependency on checkout, Razorpay, a card, or a provider webhook

## Implementation Files
- Uniquely versioned Supabase migration for trial policy, legacy backfill, and restricted writes
- Dedicated authenticated trial-activation route or RPC
- `src/lib/utils/helpers.ts`: `getEntitlementLabel`
- All UI pages: pricing, settings, dashboard, signup, landing
