# Archived Migrations

These migrations were replaced by a single clean baseline migration (`initial_ventro_schema.sql`) before launch because the project had no production data and no real users.

## Archive Date
2026-10-06

## Archived Files
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

## Reason for Consolidation
- No production data existed that needed migration preservation
- Multiple migrations referenced objects before they were created
- Legacy `discount_card` / 10-day trial conversions were unnecessary for a fresh database
- The `supabase/config.toml` referenced a missing `./seed.sql` file
- A single reproducible baseline is simpler to maintain and verify

## Replacement
The canonical schema is now defined in `supabase/migrations/20261006010000_initial_ventro_schema.sql` (the clean baseline migration).