# ADR-006: Pipeline Run and Publication States

## Status
Accepted

## Date
2026-10-05

## Context
Ingestion pipelines need durable state machine with replay, idempotency, and visibility. GitHub Actions schedule work, but Postgres must own pipeline truth so timed-out workflows can resume safely.

## Decision

### Pipeline Runs (`pipeline_runs`)
- One row per end-to-end pipeline execution
- `pipeline_type`: `news_ingestion` | `funding_extraction` | `thesis_extraction` | `pattern_detection` | `full_refresh`
- `status`: `pending` | `running` | `completed` | `failed` | `partial`
- `started_at`, `completed_at`, `total_latency_ms`
- `trigger`: `scheduled` | `manual` | `webhook` | `retry`
- `parameters` JSONB for reproducibility

### Stage Attempts (`stage_attempts`)
- One row per stage within a pipeline run
- `stage_name`: `fetch` | `archive` | `extract` | `resolve` | `verify` | `publish`
- `status`: `pending` | `running` | `completed` | `failed` | `dead_letter`
- `attempt_number` (1-based, max 3)
- `idempotency_key` (unique per pipeline_run + stage + input)
- `lease_expires_at` (prevents concurrent processing)
- `input_ref` JSONB (what was processed)
- `output_ref` JSONB (what was produced)
- `error_message`, `retry_after`
- `model_run_id` if extraction stage
- `started_at`, `completed_at`, `latency_ms`

### Idempotency Keys
- Format: `{pipeline_type}:{stage}:{source_id}:{content_hash}:{schema_version}`
- Unique constraint prevents duplicate work
- Leases: `SELECT ... FOR UPDATE SKIP LOCKED` with 5-min TTL

### Dead Letter Handling
- After max retries, status = `dead_letter`
- Admin UI shows dead letters with error, input, retry button
- Manual fix → reset to `pending` → reprocess

### Publication States (for claims, patterns, theses)
- `candidate`: Produced by pipeline, awaiting review
- `published`: Approved, visible to users
- `corrected`: Published then corrected (links to correction)
- `retracted`: Published then retracted (reason required)
- `rejected`: Reviewed and rejected (reason required)

### Retry Policy
- Max 3 attempts per stage
- Exponential backoff: 1min, 5min, 15min
- `retry_after` timestamp for scheduled retries
- GitHub Action polls `stage_attempts` WHERE `status IN ('pending', 'running') AND (retry_after IS NULL OR retry_after < NOW())`

## Consequences
- Postgres owns truth: no lost work on workflow timeout
- Full audit trail: every stage attempt recorded
- Replayable: failed stages retry with same idempotency key
- Observable: admin dashboards show queue depth, latency, failure rates
- Cost tracking: model runs linked to stage attempts

## Implementation (Milestone 1)
- Migrations for `pipeline_runs`, `stage_attempts`
- Helper functions: `acquire_lease()`, `release_lease()`, `schedule_retry()`
- GitHub Action worker updated to use lease-based polling
- Admin page: `/dashboard/admin/pipelines` with stage waterfall view