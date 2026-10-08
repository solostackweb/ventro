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
- `status`: `pending` | `running` | `completed` | `failed` | `partial` | `cancelled`
- `started_at`, `completed_at`, `total_latency_ms`, `heartbeat_at`
- `trigger`: `scheduled` | `manual` | `webhook` | `retry`
- `parameters` JSONB for reproducibility
- `idempotency_key` TEXT UNIQUE for deterministic scheduling
- Aggregate counters: `total_items`, `completed_items`, `failed_items`
- `failure_summary` JSONB for diagnostics

### Stage Attempts (`stage_attempts`)
- One row per stage within a pipeline run
- `stage_name`: `discover` | `fetch` | `archive` | `normalize` | `extract` | `resolve` | `verify` | `publish`
- `status`: `pending` | `leased` | `running` | `completed` | `retry_wait` | `failed` | `dead_letter` | `skipped`
- `attempt_number` (1-based, max 3 default)
- `max_attempts` (default 3)
- `idempotency_key` (unique per pipeline_run + stage + input)
- Lease fields: `lease_owner`, `lease_token` (unguessable), `leased_at`, `lease_expires_at`, `heartbeat_at`
- `retry_after` timestamp for scheduled retries
- `input_ref` JSONB (what was processed), `output_ref` JSONB (what was produced)
- `model_run_id` FK to `model_runs` if extraction stage
- Error tracking: `error_code`, `error_message`, `error_metadata` (NO secrets, NO raw provider responses, NO prohibited source text)
- Timing: `started_at`, `completed_at`, `latency_ms`
- Counters: `items_processed`, `items_succeeded`, `items_failed`, `cost_usd`

### Constraints & Indexes
- UNIQUE on `pipeline_runs(idempotency_key)` for idempotent scheduling
- UNIQUE on `stage_attempts(pipeline_run_id, stage_name, idempotency_key)` for idempotent stage execution
- Partial index for lease acquisition: `WHERE status IN ('pending', 'retry_wait', 'leased')`
- Partial index for expired leases: `WHERE status = 'leased' AND lease_expires_at < NOW()`
- Partial index for retry-ready: `WHERE status = 'retry_wait' AND retry_after <= NOW()`
- Partial index for dead letters: `WHERE status = 'dead_letter'`

### Idempotency Keys
- Pipeline run: `{pipeline_type}:{trigger}:{scope}:{content_hash}:{schema_version}` — e.g., `news_ingestion:scheduled:all:abc123:1.0`
- Stage attempt: `{pipeline_type}:{stage}:{source_id}:{content_hash}:{schema_version}` — e.g., `news_ingestion:extract:source-123:docver-hash:1.0`
- Replay appends `:replay:{uuid}` to preserve audit trail

### Lease Behavior
- Acquisition: `SELECT ... FOR UPDATE SKIP LOCKED` with unguessable 32-byte hex `lease_token` (not just worker name)
- Default TTL: 5 minutes (300 seconds), renewable via heartbeat
- Heartbeat extends `lease_expires_at` by `lease_seconds`
- Completion/failure requires valid, unexpired `lease_token` — rejects expired/incorrect tokens
- Stale lease detection: `status = 'leased' AND lease_expires_at <= NOW()`

### Retry Policy
- Max 3 attempts per stage (configurable via `max_attempts`)
- Exponential backoff: ~1 min (attempt 1), ~5 min (attempt 2), ~15 min (attempt 3+)
- `retry_after` timestamp set on failure
- GitHub Action polls `stage_attempts WHERE status IN ('pending', 'retry_wait', 'leased') AND (retry_after IS NULL OR retry_after <= NOW()) AND (status != 'leased' OR lease_expires_at <= NOW())`
- After max attempts → `dead_letter`

### Dead Letter Handling
- After max retries, status = `dead_letter`
- `replay_dead_letter(attempt_id, reason)` creates auditable new attempt:
  - Preserves original dead letter row
  - New attempt with incremented `attempt_number`
  - New `idempotency_key` with `:replay:{uuid}` suffix
  - Links back via `error_metadata.replayed_from` / `replayed_to`
- Does NOT delete history

### Publication States (for claims, patterns, theses)
- `candidate`: Produced by pipeline, awaiting review
- `published`: Approved, visible to users
- `corrected`: Published then corrected (links to correction)
- `retracted`: Published then retracted (reason required)
- `rejected`: Reviewed and rejected (reason required)

### Automatic Publication Policy (D5 Conservative)
A claim becomes `published` automatically only when ALL conditions hold:
1. **Source support**: At least 1 official primary source OR at least 2 independent approved sources
2. **Extraction confidence**: >= 0.85
3. **Resolution confidence**: >= 0.90
4. **No active contradiction**: No `claim_evidence` with stance `contradicts`
5. **Evidence validation**: Every supporting span validates against immutable normalized text

Source independence uses explicit `independence_group`, falling back to normalized domain. Multiple URLs from same group count once.

### Stage Dependencies
```
discover → fetch → archive → normalize → extract → resolve → verify → publish
```
- A stage only runs if all dependencies are `completed`
- `skipped` stages do NOT satisfy dependencies
- One failing source produces `partial` run when other independent sources succeed

## Implementation (Checkpoint 2)

Hosted lint follow-up: `20261008010000_fix_hosted_function_lint.sql` replaces the
search-path-dependent lease token generator, qualifies source-health diagnostics,
and removes PL/pgSQL lint warnings without rewriting deployed migration history.

### Migration
- Single active incremental migration: `20261007030000_pipeline_orchestration.sql`
- Adds `pipeline_runs`, `stage_attempts` tables + enums + service-role functions

### Service-Role Orchestration Functions (SECURITY DEFINER, search_path = '')
| Function | Purpose |
|----------|---------|
| `create_or_get_pipeline_run(type, trigger, idempotency_key, parameters)` | Creates or returns existing run; retry trigger resets terminal runs to pending |
| `enqueue_stage_attempt(run_id, stage_name, idempotency_key, input_ref, max_attempts, model_run_id)` | Creates or returns existing attempt; resets terminal attempts to pending on retry |
| `acquire_stage_lease(worker_id, lease_seconds, allowed_stage_names)` | Claims work with SKIP LOCKED; returns attempt + unguessable lease_token |
| `heartbeat_stage_lease(attempt_id, lease_token, lease_seconds)` | Extends lease TTL; rejects expired/incorrect tokens |
| `complete_stage_attempt(attempt_id, lease_token, output_ref, counters)` | Marks completed; updates run aggregates; clears lease |
| `fail_stage_attempt(attempt_id, lease_token, error_code, message, retryability, metadata)` | Schedules retry or dead_letter; exponential backoff; clears lease |
| `replay_dead_letter(attempt_id, reason)` | Creates auditable new attempt; preserves history |
| `finalize_pipeline_run(run_id, status, failure_summary)` | Computes final status (completed/partial/failed) from stage outcomes |

### Read Contracts (service-role + authenticated)
| Function | Purpose |
|----------|---------|
| `get_recent_pipeline_runs(limit, pipeline_type)` | Recent runs with statuses and aggregates |
| `get_pipeline_run_stages(run_id)` | Stage waterfall for one run |
| `get_pipeline_queue_counts()` | Pending/running/retry/dead_letter/stale counts by pipeline type |
| `get_stale_leases(threshold_minutes)` | Leases past expiry for alerting |
| `get_source_health(limit)` | Source success/yield/freshness |
| `get_model_run_metrics(since, run_kind)` | Provider/model tokens, latency, cost |
| `get_publication_stats(since)` | Published/candidate/rejected counts and reasons |

### Typed Orchestration Module (`src/lib/pipeline/`)
- `types.ts` — State types, stage definitions, dependencies, structured log context
- `errors.ts` — Safe error serialization (redacts secrets, JWTs, AWS keys), retry classification, exponential backoff
- `logging.ts` — Structured logger carrying `run_id`, `attempt_id`, `stage`, `source_id`, `document_version_id`, `model_run_id`
- `budget.ts` — Provider/model budget guards with per-stage and per-run limits, alerting
- `lease-client.ts` — LeaseClient plus `executeWithLease` (auto-heartbeat, cooperative abort, token-safe complete/fail)
- `pipeline-client.ts` — PipelineClient for run/attempt management and diagnostics
- `orchestrator.ts` — PipelineOrchestrator runs full pipeline or processes leased work; stage registry
- `stage-handlers.ts` — Wires existing ingestion modules into stages

### GitHub Actions Contract
- Workflow: `.github/workflows/scheduled-ingestion.yml`
- Schedule: `0 * * * *` (hourly)
- Concurrency group per pipeline type, `cancel-in-progress: false`
- Required env vars (no values in repo):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
  - Optional: `TAVILY_API_KEY`, `FIRECRAWL_API_KEY`, `OPENAI_API_KEY`, `GITHUB_TOKEN`
- Dispatch inputs: `pipeline_type`, `source_scope`, `max_stages`
- Worker script: `scripts/pipeline-worker.mjs`
- Worker creates/resumes run, drains bounded attempts, heartbeats, exits before platform timeout

### Worker Flow
```
1. Parse and validate worker arguments before loading credential-dependent modules.
2. Call `runPipelineBounded(...)` exactly once to create/get or resume the requested run.
3. Load completed attempt outputs into bounded `runContext`.
4. Enqueue and lease only the next runnable stage for that run.
5. Heartbeat while the abort-aware handler runs.
6. Complete exactly once when the handler and lease token are still valid; otherwise retry/dead-letter through database-owned state.
7. Merge the completed `output_ref` into context and continue until `max_stages` successful attempts or no runnable work.
8. Finalize only when the graph is complete or terminally partial; otherwise leave the run resumable and exit.
```

### Operator Runbook

#### Resume a Stalled Run
```bash
# Find stale run
psql -c "SELECT * FROM get_recent_pipeline_runs(10);"

# Resume via worker (reuses same idempotency_key)
npm run pipeline:worker -- --type=news_ingestion --resume=<run_id>
```

#### View Dead Letters
```bash
psql -c "SELECT * FROM get_pipeline_queue_counts();"
psql -c "SELECT * FROM get_pipeline_run_stages('<run_id>') WHERE status = 'dead_letter';"
```

#### Replay One Dead Letter
```bash
# Via admin API
curl -X POST /api/admin/pipelines \
  -H "Content-Type: application/json" \
  -d '{"action":"replay-dead-letter","attempt_id":"<attempt_id>","reason":"Fixed provider timeout"}'
```

#### View Stage Waterfall
```bash
psql -c "SELECT * FROM get_pipeline_run_stages('<run_id>') ORDER BY stage_order;"
```

### Consequences
- Postgres owns truth: no lost work on workflow timeout
- Full audit trail: every stage attempt recorded with lease tokens
- Replayable: failed stages retry with same idempotency key
- Observable: admin endpoints show queue depth, latency, failure rates
- Cost tracking: model runs linked to stage attempts
- Secrets never in logs: safe error serialization redacts all sensitive data
- Partial pipeline support: one source failure doesn't block others

## Implementation Files

### Migration
- `supabase/migrations/20261007030000_pipeline_orchestration.sql`

### Service-Role Functions (in migration)
- `create_or_get_pipeline_run`
- `enqueue_stage_attempt`
- `acquire_stage_lease`
- `heartbeat_stage_lease`
- `complete_stage_attempt`
- `fail_stage_attempt`
- `replay_dead_letter`
- `finalize_pipeline_run`
- `get_recent_pipeline_runs`
- `get_pipeline_run_stages`
- `get_pipeline_queue_counts`
- `get_stale_leases`
- `get_source_health`
- `get_model_run_metrics`
- `get_publication_stats`

### TypeScript Module
- `src/lib/pipeline/types.ts`
- `src/lib/pipeline/errors.ts`
- `src/lib/pipeline/logging.ts`
- `src/lib/pipeline/budget.ts`
- `src/lib/pipeline/lease-client.ts`
- `src/lib/pipeline/pipeline-client.ts`
- `src/lib/pipeline/orchestrator.ts`
- `src/lib/pipeline/stage-handlers.ts`
- `src/lib/pipeline/index.ts`

### GitHub Actions
- `.github/workflows/scheduled-ingestion.yml`
- `scripts/pipeline-worker.mjs`

### Diagnostics API
- `src/app/api/admin/pipelines/route.ts`

### Tests
- `tests/pipeline/orchestration.test.ts`
- `tests/pipeline/lease-logic.test.ts`
- `tests/pipeline/idempotency.test.ts`
- `tests/pipeline/state-machine.test.ts`
- `tests/pipeline/budget.test.ts`

### Manual Hosted Migration Command
```bash
# Review, then apply the tracked incremental migration to the linked hosted project
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list --linked
npx supabase db lint --linked
```

## Remaining Risks
1. **Worker timezone drift**: Lease TTL uses DB time (NOW()), workers should sync clocks
2. **Long-running stages**: Stages >5 min need heartbeat; `extract` stage may need longer default lease
3. **Dead letter accumulation**: Monitoring alert needed for `dead_letter` count growth
4. **Cost budget enforcement**: Currently advisory; hard enforcement would require pre-check before model calls
5. **Partial run semantics**: `partial` status when some sources fail but others succeed — downstream consumers must handle
6. **Schema version drift**: Idempotency keys include `schema_version`; bump on breaking changes

## Manual Hosted Migration Commands
```bash
# 1. Apply the tracked migration to hosted Supabase
npx supabase db push

# 2. Verify tables created
psql "postgresql://..." -c "\dt pipeline_runs stage_attempts"

# 3. Verify functions
psql "postgresql://..." -c "\df create_or_get_pipeline_run enqueue_stage_attempt acquire_stage_lease"

# 4. Test idempotency
psql "postgresql://..." -c "
SELECT create_or_get_pipeline_run('news_ingestion', 'scheduled', 'test-key-1', '{}');
SELECT create_or_get_pipeline_run('news_ingestion', 'scheduled', 'test-key-1', '{}');
"
```

## Final State Machine

### Pipeline Run States
```
pending → running → completed
              ↘ failed
              ↘ partial
              ↘ cancelled
completed/failed/partial/cancelled --(retry trigger)--> pending
```

### Stage Attempt States
```
pending → leased → running → completed
              ↘ retry_wait → leased (after backoff)
              ↘ dead_letter (max attempts or non-retryable)
              ↘ skipped
dead_letter --(replay)--> pending (new attempt_number, new idempotency_key with :replay: suffix)
```

### Lease Token
- 32-byte hex (64 chars), generated via `encode(gen_random_bytes(32), 'hex')`
- Required for all mutating operations (complete, fail, heartbeat)
- Expired/incorrect token → operation rejected
