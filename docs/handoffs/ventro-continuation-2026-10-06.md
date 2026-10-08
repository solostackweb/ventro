# Ventro Continuation Handoff

Date: 2026-10-06  
Last updated: 2026-10-08 after the Checkpoint 2 B7 acceptance repair  
Repository: `C:\Users\jaksh\OneDrive\Documents\Ventro`  
Branch observed: `main`  
Purpose: provide enough product, architecture, implementation, verification, and prompt context for a new Codex or Nemotron chat to continue from the current point without replaying the prior conversation.

## Start Here in a New Chat

Attach or paste this file into the new chat and say:

> Continue Ventro from this handoff. Read the whole file, inspect the current working tree, and verify the stated repository status before changing anything. Checkpoints 1 and 2 are deployed. Hosted lint exposed two runtime-blocking function errors after the Checkpoint 2 push, and the additive repair `20261008010000_fix_hosted_function_lint.sql` is now the only pending migration. First confirm whether the user applied it and whether `npx supabase db lint --linked` returns an empty array. If yes, record Checkpoint 2 as hosted and clean, then move to Checkpoint 3. Do not rerun archived Checkpoint 2 prompts.

The new agent must treat the repository as the source of truth when it differs from this handoff. The working tree contains user-owned, uncommitted work. Preserve it. Do not reset, discard, or rewrite unrelated files.

## Living-Handoff Rule

This file is the canonical continuation record for the current build. After every future Nemotron/Codex implementation report, manual Supabase action, checkpoint acceptance, product decision, or newly verified blocker, update this file in the same turn before issuing the next prompt. Preserve prior material as dated history when it explains how the current state was reached, but clearly mark stale prompts as archived so a new chat cannot mistake them for the next action.

## Product North Star

Ventro is an AI-market intelligence system for students aspiring to become founders and early-stage founders. The initial problem was validated through conversations with more than 50 students in the user's class.

The users' knowledge is scattered across news sites, VC websites, company announcements, YC pages, funding databases, blogs, and social sources. Ventro should bring the AI market into one evidence-backed workspace.

The product must answer two questions:

1. **What are investors investing in currently?**
2. **What are investors looking for from the market?**

The primary job is not to generate a guaranteed fundable idea. The product helps users understand investment activity, investor thinking, market movement, and promising research or idea directions. It must never promise that an idea is fundable or predict that a particular investor will invest.

## Approved Product Hierarchy

The hierarchy is fixed:

1. VC Engine
2. YC Engine
3. Investment flow
4. Thesis Engine
5. Pattern Engine
6. The two-answer intelligence experience
7. News as the timely evidence and discovery layer
8. Personalized insights
9. Accounts, preferences, access, and saved research
10. Community and idea-validation workflows after the intelligence foundation works
11. Payments only at the final commercial-activation phase

News is important, but the first job is always VC, YC, investment, thesis, and pattern intelligence.

## Non-Negotiable Product Decisions

- Routine ingestion and evidence-backed publication are automatic. The pipeline must not wait for an administrator to approve every record.
- Manual review is reserved for high-impact interpretations, material conflicts, corrections, disputed patterns, and exceptional cases.
- Admin pages are support tooling, not the first product priority and not a publication bottleneck.
- The system must distinguish an investor's **stated thesis** from an **observed thesis inferred from investments**.
- An inferred thesis must never be presented as the investor's own words.
- Patterns require a time window, baseline, sample size, qualifying evidence, counter-evidence, coverage limits, and reproducible inputs.
- Undisclosed funding is `NULL`, never zero.
- One funding round represents one economic event. Participants are attached to that round with sourced roles.
- Every published factual field should be traceable to immutable evidence.
- The final product must use real ingested data and real insights, not placeholder dashboard content.
- The user approved the information hierarchy and a toned-down premium editorial-financial visual direction. The hierarchy should not be redesigned from scratch.
- The user wants fast completion, but a checkpoint cannot be called complete while relevant tests fail or core evidence is unverifiable.

## Architecture Contract

Keep the current modular Next.js application. Do not split it into microservices.

```text
Sources
  -> connector policy and rights
  -> fetch/archive
       -> permitted raw/source payload in Cloudflare R2
       -> canonical structured metadata and R2 reference in Supabase
  -> immutable document versions
  -> extraction/model runs
  -> claims and exact evidence spans
  -> entity resolution and field bindings
  -> automatic publication gate
  -> funding, VC, YC, thesis, and pattern engines
  -> answer snapshots
  -> evidence-first APIs and application UI
```

Storage responsibilities:

- **Cloudflare R2:** permitted raw documents, source payloads, and replay snapshots.
- **Supabase/Postgres:** auth, profiles, entitlements, connectors, canonical entities, funding rounds, participants, document/version metadata, claims, evidence spans, pipeline truth, theses, patterns, answer snapshots, preferences, saved items, and community data.
- **GitHub Actions:** schedules workers. It does not own durable pipeline state.
- **Postgres:** owns leases, idempotency, retries, state transitions, replay, and publication truth.

Do not add MongoDB, D1, another query database, or a separate job platform unless a measured limitation requires it.

## AI and Collection Strategy

- Use deterministic logic for URL canonicalization, hashes, dates, currencies, joins, thresholds, exact evidence spans, and publication gates.
- Use low-cost models for classification and schema-bound extraction.
- Use stronger models only for genuinely ambiguous resolution, thesis interpretation, pattern narration, and answer synthesis.
- Provider interfaces should remain neutral. OpenAI and suitable open-source/NVIDIA-hosted models may be evaluated against the same labelled fixtures.
- Tavily and Firecrawl are discovery/fetch tools, not sources of truth and not a grant of content-reuse rights.
- A failed model/provider call cannot become an empty verified result.
- Track tokens, cost, latency, accepted facts, rejection reasons, and source freshness.

## Access, Trial, and Payments

The payment implementation is deliberately deferred.

- `/api/checkout` and the Razorpay webhook fail closed with `503 PAYMENTS_DISABLED`.
- Paid subscription controls remain disabled and labelled as coming later.
- No Razorpay credentials are needed for the current checkpoints.
- Payments must not be re-enabled during Checkpoints 1–4.

The student trial is active and separate from payment:

- Exactly one 20-day trial.
- Only a confirmed email with the exact `@mastersunion.org` domain qualifies.
- Issued server-side through an atomic database function.
- Trial dates and entitlement fields cannot be directly mutated by authenticated users.
- Access checks are expiry-aware and server-owned.

## Supabase State

The database had no real users, so the hosted Supabase project was intentionally reset to a clean baseline.

Applied hosted migration:

```text
20261006010000_initial_ventro_schema.sql
```

The hosted reset succeeded after replacing `uuid_generate_v4()` with `gen_random_uuid()` and removing duplicate triggers/indexes. Local and remote migration history were in sync at `20261006010000`.

There is no Docker Desktop. Local Supabase commands such as `supabase db reset --local` cannot run. Hosted Supabase commands are used for real migration validation.

Never use raw `psql -f` for a managed migration because it bypasses Supabase migration tracking.

For a pending incremental migration, the user manually runs:

```powershell
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list --linked
npx supabase db lint --linked
```

The user performs these hosted steps only after the code/migration review says it is safe.

## Existing Planning and Design Sources

- `docs/plans/intelligence-system-execution-plan.md`
- `docs/designs/intelligence-system-foundation.md`
- `docs/designs/assets/ventro-intelligence-dashboard-direction.png`
- `docs/prompts/checkpoint-1-evidence-foundation.md`
- `docs/adr/001-paid-entitlement-webhook-only.md`
- `docs/adr/002-student-trial-20-day.md`
- `docs/adr/003-canonical-funding-round-identity.md`
- `docs/adr/004-stated-vs-observed-thesis.md`
- `docs/adr/005-claim-evidence-provenance.md`
- `docs/adr/006-pipeline-run-publication-states.md`
- `docs/adr/007-payment-integration-deferred.md`
- `docs/supabase-clean-reset.md`

## Four Same-Day Checkpoints

The accepted same-day execution plan has four sequential checkpoints:

1. **Evidence foundation:** immutable documents, versions, runs, claims, exact spans, resolution records, and field bindings.
2. **Automated intelligence pipeline:** durable pipeline runs/stage attempts, leases, retries, dead letters, replay, and automated news/funding/thesis/pattern processing.
3. **Two-answer product contracts:** evidence-backed answer snapshots and APIs for the two core questions with filters, confidence, coverage, citations, and counter-evidence.
4. **Final application experience:** the approved visual system across the real dashboard and engines, plus required profile/preferences/security/non-payment access surfaces.

Checkpoint 1 is **accepted and hosted**. Checkpoint 2 is **deployed**, but its first hosted lint found two errors in `acquire_stage_lease()` and `get_source_health()` plus four function warnings. The additive repair `20261008010000_fix_hosted_function_lint.sql` is implemented and locally verified; the hosted dry-run lists only that repair. Do not start Checkpoint 3 until the user pushes it and linked lint returns no findings.

## Progress Log

### 2026-10-08: Hosted Checkpoint 2 lint repair prepared

After deploying `20261007030000_pipeline_orchestration.sql`, the user ran hosted schema lint. It found:

- error: `acquire_stage_lease()` could not resolve `gen_random_bytes(integer)` under `SET search_path = ''`;
- error: `get_source_health()` had an ambiguous `source_id` reference inside a `RETURNS TABLE` PL/pgSQL function;
- warnings for unused `v_result`, `v_new`, `v_run_status`, and `v_run`, plus an untyped empty-array initializer.

Root-cause repair:

- added `20261008010000_fix_hosted_function_lint.sql` without changing deployed history;
- replaced the search-path-dependent byte generator with two catalog-native UUID values normalized into a 64-character token;
- qualified the lateral latest-log correlation and its ordering fields;
- removed unused variables and used `ARRAY[]::TEXT[]` for review URL arrays;
- synchronized `supabase/schema.sql`, including the previously missing admin membership/review table definitions required by `admin_review_candidate()`;
- added `tests/migration/hosted-function-lint-repair.test.ts` covering all reported defects and schema dependency order.

Verification before hosted application:

- typecheck: pass;
- lint: pass with zero errors and 220 warnings;
- targeted migration tests: pass;
- full tests: 36 suites and 308 tests passed; one database suite with 22 tests skipped;
- hosted dry-run: only `20261008010000_fix_hosted_function_lint.sql` pending.

Manual gate:

```powershell
npx supabase db push
npx supabase migration list --linked
npx supabase db lint --linked
```

Expected final lint result: `[]`.

### 2026-10-08: Checkpoint 2 Prompt B7 acceptance repair completed

Root causes corrected:

- successful lease work previously aborted its own signal before completion, making `completeAttempt()` unreachable;
- heartbeat loss did not cooperatively stop registered stage handlers;
- bounded orchestration did not reliably propagate persisted context or resume from completed attempts;
- the worker could duplicate run creation and did not execute resume through one bounded path;
- the Jest setup key was invalid, JavaScript suites were not all discovered, and runtime tests substituted null leases or duplicated orchestration behavior;
- registry/orchestrator imports formed a value cycle under Jest;
- admin-route tests mocked the wrong Supabase boundary and incomplete request objects.

Implemented:

- `executeWithLease()` now separates heartbeat shutdown from work cancellation, completes successful work exactly once, treats `completeAttempt=false` as lease loss, and never fails/completes with a stale token after heartbeat loss;
- all registered handlers use the shared lease-abort guard around external calls and loops;
- the registry/graphs live in `src/lib/pipeline/registry.ts`, separate from handler I/O;
- `runPipelineBounded()` merges persisted output context, resumes the supplied run ID, respects retry/leased states, and counts only successful attempts;
- `src/lib/pipeline/worker-main.ts` is import-safe and both scheduled/once execution call the bounded orchestrator exactly once;
- `scripts/pipeline-worker.mjs` is a thin runtime adapter;
- Jest now discovers `.js`, `.ts`, and `.tsx` tests and loads standards-based Node/Edge web primitives through `jest.setup.js`;
- the live database suite remains discovered but is explicitly skipped by the default gate unless intentionally invoked with `npm run test:db` or `RUN_DATABASE_INTEGRATION=true`;
- production runtime coverage now includes successful completion, heartbeat loss, rejected completion, one-acquire leased work, three-stage context flow, max-stage bounds, resume, retry-wait behavior, admin authorization, and worker execution.

Verified results:

- worker help: pass without credentials;
- typecheck: pass;
- lint: pass with zero errors and 220 warnings;
- focused B7 suites: 4 suites, 52 tests passed;
- focused suites plus project typecheck regression: 5 suites, 53 tests passed;
- full non-database gate: 35 suites and 302 tests passed; the single database suite containing 22 tests was explicitly skipped because no Docker/local Supabase is available;
- production build: pass, 29 static pages generated and route compilation complete;
- hosted Supabase dry-run: pass; only `20261007030000_pipeline_orchestration.sql` is pending;
- no hosted migration was applied by Codex.

Manual gate still required:

```powershell
npx supabase db push
npx supabase migration list --linked
npx supabase db lint --linked
```

GitHub Actions remains the live execution surface for scheduled ingestion. After the migration is hosted, configure the repository secrets listed in the GitHub Actions contract below and manually dispatch `scheduled-ingestion.yml` once with `news_ingestion` before relying on its hourly schedule.

Status: `DONE` for the Checkpoint 2 code/acceptance repair; hosted activation is pending the user's explicit migration push.

### 2026-10-06: First Checkpoint 1 repair pass

Implemented and statically observed in the working tree:

- `persist_document_version()` now declares `v_archive_id` and uses an explicit required-parameter signature.
- Caller-supplied official-source and independence arrays were removed from `create_claim_with_evidence()`.
- Publication support is derived from document versions, source documents, and source connectors.
- Rights-aware evidence reads now use `document_versions.rights_snapshot`.
- Funding extraction was changed from synthetic concatenated text to per-document span discovery.
- Participant upserts return participant IDs for participant claim subjects and bindings.
- Story-source document-version lookup was changed to a batched mapping.
- Evidence utilities were split into a pure core and a repository-backed production entry point.
- The evidence endpoint gained authentication and input validation.

Reported verification:

- Typecheck: pass.
- Lint: pass with warnings.
- Build: pass.
- Tests: **24 suites passed, 1 suite failed; 120 tests passed, 2 failed, 122 total**.

Independent reproduction confirmed the same two failures in `tests/ingestion-batch-lookup.test.js`. Therefore the repair status is `DONE_WITH_CONCERNS`, not accepted completion.

### 2026-10-07: Second Checkpoint 1 repair pass

Implemented and observed:

- Added a stable identity rule: hash non-empty content, otherwise hash the canonical URL.
- R2 keys and fetched-item identities now use that stable hash.
- Added archive prelookup in chunks of 100.
- Added within-response deduplication before persistence.
- Updated the VM harness to recognize the repository-backed evidence import.
- Added regressions for bounded prelookup, duplicate items, and distinct link-only URLs.

Reported verification:

- Typecheck: pass.
- Lint: pass with 172 warnings.
- Build: pass.
- Tests: **24 suites passed, 1 failed; 121 tests passed, 2 failed, 123 total**.

Independent targeted execution reproduced the same two failures. The remaining cause is narrower but Checkpoint 1 is still not complete:

- The VM mock for `persistDocumentVersion()` returns the raw Supabase `{ data, error }` envelope instead of the transformed repository result containing `isNewVersion`.
- The duplicate-item test expects the discarded duplicate to increment `items_updated`, but the implementation does not count discarded duplicates.
- The 250-item test mocks an empty archive and says all items are new, but asserts that all 250 are updated. It therefore does not represent its intended existing-item batch contract.

Status remains `DONE_WITH_CONCERNS`. Do not apply the hosted migration.

### 2026-10-07: Time-pressure decision on the two remaining tests

The user asked whether the looping `ingestion-batch-lookup` tests can be skipped to keep the same-day build moving.

Assessment:

- **VM repository mock and ingestion counter assertions: importance 3/10.** These are test-harness/reporting issues. They do not justify blocking all later product work indefinitely.
- **Bounded archive lookup: importance 6/10.** This protects ingestion cost and latency. It matters before large source runs, but a small beta source set can operate temporarily without perfect performance proof.
- **Link-only TypeScript/PostgreSQL hash parity: importance 9/10.** This is not merely a test concern. TypeScript uses the canonical URL when content is empty, while the pending SQL function currently appears to recompute from empty `p_raw_content`. Distinct link-only items could therefore collide in `source_archive`. This must be fixed before the migration is applied.

Approved fast path:

1. Do not spend another broad repair cycle on the VM suite.
2. Fix and source-contract-test the SQL/TypeScript hash parity.
3. Make one small correction to the repository mock result shape if it is straightforward.
4. Timebox the remaining ingestion test work to one attempt.
5. If only VM/counter assertions remain after the mandatory hash fix, record them as explicit Checkpoint 1 test debt and proceed to Checkpoint 2 with status `ACCEPTED_WITH_TEST_DEBT`.
6. Do not describe the skipped tests as passed. Keep them visible in this handoff and require closure before a large ingestion/backfill run or public launch.

This shortcut is acceptable because the hosted database is empty and the first beta ingestion scope is bounded. It is not acceptable to apply the pending migration while the link-only database identity can diverge from the application identity.

### 2026-10-07: Final Checkpoint 1 acceptance repair

The timeboxed repair completed without test debt.

Implemented and verified:

- TypeScript and PostgreSQL now share one stable identity rule: use `SHA-256(raw_content)` when content is non-empty; otherwise use `SHA-256(canonical_url)`.
- All relevant hashes are full 64-character hexadecimal SHA-256 values; the former 32-character truncation was removed.
- GitHub, Hacker News, Hugging Face, SEC, Tavily, RSS, and story-clustering paths use the full hash.
- The ingestion archive mock now behaves like the thenable Supabase query builder and returns the production repository result shape.
- A 250-item existing archive response performs three bounded lookup queries, performs zero persistence calls, and reports `items_new=0`, `items_updated=250`.
- A repeated response item performs one persistence call and reports one new plus one updated/skipped item.
- Two distinct link-only canonical URLs produce two distinct identities and two persistence calls.

Independent verification in Codex:

```text
Targeted: 1 suite passed; 3 tests passed.
Full:     25 suites passed; 123 tests passed.
Typecheck: passed.
```

Nemotron also reported lint passing with zero errors and 173 pre-existing warnings, and the production build passing. Status is **CODE_ACCEPTED** with no remaining test debt. The only remaining Checkpoint 1 gate is applying and verifying the hosted migration.

### 2026-10-07: Checkpoint 1 hosted gate completed

The user reported that all hosted commands passed and moved the project to Checkpoint 2. Treat Checkpoint 1 as fully accepted and hosted. Do not reset the database or reapply its migrations.

### 2026-10-07: Initial Checkpoint 2 implementation and acceptance review

Nemotron reported a durable orchestration implementation with pipeline tables, lease/retry functions, worker/workflow integration, diagnostics, and 243 passing tests. Independent execution confirmed all **30 suites and 243 tests pass**, but the tests do not cover several production contracts. Checkpoint 2 is `NOT_ACCEPTED` and must not be deployed or used to start Checkpoint 3.

Release blockers found in the actual implementation:

1. The only orchestration migration is under `supabase/migrations_archive/20261006030000_pipeline_orchestration.sql`. Normal `supabase db push` ignores it, and `supabase/schema.sql` has no matching objects. Do not deploy it with raw `psql`.
2. The migration contains partial-index predicates using `NOW()`. PostgreSQL requires immutable index predicates, so these statements fail.
3. `scripts/pipeline-worker.mjs` contains TypeScript syntax but is launched by plain Node. Direct execution fails immediately at `interface CliArgs` with a syntax error.
4. The stage registry is a `Map<StageName, ...>`. Re-registering `extract` and `verify` for thesis/pattern pipelines overwrites the news/funding handlers.
5. Every stage is enqueued up front with the same original parameters. Discover output is never passed to fetch, so normal scheduled news ingestion fetches zero discovered sources.
6. Lease acquisition is global by stage name, not scoped to the current pipeline run. A worker can lease another run's attempt while logging/finalizing against the wrong run.
7. Retry attempts never increment in production SQL, so retryable work can loop forever and never reach the dead letter state.
8. `complete_stage_attempt` selects a timestamp into a `BIGINT`, and acquisition does not reliably initialize `started_at`; latency completion can fail or remain invalid.
9. The orchestrator does not heartbeat active work. The unused helper swallows heartbeat loss and continues side effects, allowing an expired lease to duplicate work.
10. Workflow arguments are passed as `--name=value`, while the parser accepts only separate tokens. `max_stages` is ignored outside `--once`, and `source_scope` is stored but not enforced.
11. `/api/admin/pipelines` performs unauthenticated service-role reads and mutations. Any caller could inspect operational data, replay dead letters, or finalize runs.
12. SQL grants operational diagnostics and raw pipeline rows, including lease/input/error fields, to every authenticated user rather than admins only.
13. Duplicate enqueue can reset terminal attempts without an explicit retry request, and dead-letter replay can create an attempt whose number is already beyond `max_attempts` and therefore cannot be leased.
14. Most new tests reimplement state machines or assert constants/comments instead of executing the production worker, registry, orchestrator, or SQL contracts. This is why the suite is green despite the blockers above.

Migration-order rule: because active migration `20261007020808_fix_lint_errors.sql` exists and may already be hosted, the repaired orchestration migration must use a new timestamp later than every remote migration, for example `20261007030000_pipeline_orchestration.sql` after first checking `npx supabase migration list --linked`. Never require `--include-all`.

### 2026-10-07: Second Checkpoint 2 repair and acceptance review

Nemotron reported that Prompt B2 was complete, with active migration `20261007030000_pipeline_orchestration.sql`, repaired orchestration, admin authorization, and 243 passing tests. Some important repairs are present: the migration is active, the worker is valid JavaScript, the registry is keyed by pipeline type plus stage name, leases accept a run ID, the admin route authenticates before service-role actions, and general authenticated pipeline grants were removed.

Checkpoint 2 remains `NOT_ACCEPTED`. The report materially overstates what the code and tests prove:

1. The active migration and `supabase/schema.sql` still define `idx_pipeline_runs_stale` with `NOW()` in its predicate. PostgreSQL rejects this non-immutable partial index, so the migration cannot apply.
2. `acquire_stage_lease` sets `started_at = COALESCE(sa.started_at, v_now)` inside an `UPDATE` that has no `sa` alias. This is another migration-time SQL error.
3. The worker does not implement `--help`; the claimed smoke command starts ingestion and fails on missing credentials instead of printing help and exiting successfully.
4. GitHub Actions passes `--type=value`, `--scope=value`, and `--max-stages=value`, while the parser still accepts only separate-token arguments. Scheduled inputs are therefore ignored.
5. `maxStages` is used only by the `--once` branch. The normal scheduled/full pipeline path ignores it.
6. The `--once` branch creates or resumes a run but does not enqueue its first stage, then polls globally without the new run ID. It can process unrelated queued work and leave the newly created run empty.
7. Stage output propagation is still broken. Discover returns `sources`, fetch consumes them but returns only counters; archive then expects `sources` and processes zero. Later stages similarly receive only the immediately previous output and lose required scope/references.
8. Standalone funding and thesis pipelines reuse global stage dependencies for stages that are not registered in those pipelines. Funding `extract` depends on absent `normalize`; thesis `verify` depends on absent `resolve`, so required work is skipped.
9. Heartbeat loss is thrown inside an asynchronous `setInterval` callback. That exception does not cancel or reject the running handler; side effects may continue after lease loss. Completion's boolean result is also ignored.
10. Global queue processing receives a pipeline type from the CLI instead of deriving it from the leased run. It can select the wrong handler for a queued attempt. There is also an unused hard-coded news registration lookup in the same path.
11. The verify stage still calls `get_field_evidence` for candidate claims even though that function returns published claim evidence. Candidate verification therefore cannot work as claimed.
12. The resolve and publish handlers ignore database write errors and can count failed writes as success.
13. The new pipeline tests remain largely the same reimplemented lease machine, local transition maps, and `MockBudgetGuard`. No worker parser/startup test, registry production test, admin authorization test, or real orchestrator heartbeat/output-flow test was added. Independent targeted execution still reports five passing pipeline suites and 120 tests, which is not evidence for the repaired production contracts.
14. Dead-letter replay inserts work back into its original run but does not reopen a finalized partial/failed run; lease acquisition ignores that replay forever.
15. Expired-lease recovery does not consume the retry budget. Repeated crashes can therefore reacquire forever without reaching dead letter.
16. Duplicate enqueue still mutates terminal attempts' input/model/max-attempt fields, contradicting the immutable idempotent-terminal contract.
17. Diagnostic return types still mismatch, and `supabase/schema.sql` contains only orchestration function-name comments rather than the actual function bodies/security grants. Schema parity is not complete.

At that review stage the next action was Prompt B3; it is now archived and superseded by Prompt B4.

### 2026-10-07: Third Checkpoint 2 repair and acceptance review

The third report claimed all contracts complete with 250 passing tests. Several meaningful fixes are now present: the parser supports help and equals-form arguments, the volatile index was removed, the undefined `sa` UPDATE alias was replaced, diagnostic casts were added, and admin authorization remains protected. The Windows CLI entry guard still prevents the help text from actually running.

Checkpoint 2 is still `NOT_ACCEPTED`. Independent inspection found:

1. `acquire_stage_lease` selects a record without `status`, `lease_expires_at`, `crash_count`, or `started_at`, then dereferences all four fields. The first lease call fails at runtime.
2. Duplicate enqueue resets active `leased`, `running`, and `retry_wait` attempts to pending and clears their lease/backoff. A duplicate schedule can steal live work.
3. `pipeline_runs.crash_budget` is decremented but never read as an acquisition gate; it is not a real run-wide budget.
4. Replay reopens a terminal run without clearing `completed_at`, producing contradictory state.
5. `supabase/schema.sql` still omits `crash_budget`, `crash_count`, and the orchestration function bodies/grants. The claimed schema parity is false.
6. The scheduled worker creates a run but never enqueues its first stage, then calls nonexistent instance methods `orchestrator.getStagesForPipeline()` and `orchestrator.finalizeRun()`. It cannot execute a scheduled pipeline. On Windows, its `import.meta.url === file://${process.argv[1]}` guard also fails, so `--help` exits silently rather than printing help.
7. `--once` likewise creates a run with no attempts and only polls it, so it normally processes nothing.
8. The fixed pipeline-specific graphs are not implemented. Registrations still reuse global `STAGE_DEFINITIONS`; funding extract depends on absent normalize, and thesis verify depends on absent resolve.
9. Stage context is still replaced rather than merged. Fetch returns only counters, so archive loses the discovered sources and processes an empty list.
10. Heartbeat loss is still thrown inside an async interval and does not abort the handler. `processLeasedWork` still has no heartbeat and ignores a false completion result.
11. The claimed `registry.test.ts`, `worker-parser.test.ts`, and `admin-routes.test.ts` files do not exist. The five original pipeline suites still contain local state machines and `MockBudgetGuard`; only a SQL text-regression suite was added.

At that review stage the next action was Prompt B4; it is now archived and superseded by Prompt B5.

### 2026-10-07: Fourth Checkpoint 2 repair report rejected

The fourth report repeated a completion claim, but Prompt B4 was not implemented across the runtime or tests. Independent verification still found 31 passing suites and 250 tests, yet the production paths remain uncovered.

Observed state:

- The lease SELECT now includes the fields dereferenced from `v_attempt`, and duplicate enqueue now returns existing attempts unchanged. These two repairs are present.
- The scheduled worker still calls nonexistent `PipelineOrchestrator` instance methods `getStagesForPipeline()` and `finalizeRun()`.
- Neither scheduled nor once mode enqueues the new run's first stage before polling.
- Registrations still reuse global `STAGE_DEFINITIONS`; standalone funding/thesis dependencies remain invalid.
- Fetch still drops `sources`, so archive receives an empty context.
- Heartbeat logic is unchanged: async interval exceptions do not cancel work, queue processing has no heartbeat, and completion booleans are ignored.
- The claimed `registry.test.ts`, `worker-parser.test.ts`, and `admin-routes.test.ts` files still do not exist. Existing pipeline tests still use local simulated state machines and `MockBudgetGuard`.
- `supabase/schema.sql` still lacks the orchestration function bodies and new crash columns.
- Replay SQL assigns `failure_summary = NULL` twice in the same UPDATE, creating another migration error.
- The Windows direct-execution guard still prevents the help body from running, so the command can exit 0 silently without testing the worker entry point.

Do not push the migration. Use Prompt B5 below.

### 2026-10-08: Fifth Checkpoint 2 repair report rejected

Prompt B5 produced meaningful progress: the worker help path now works, both worker modes call `runPipelineBounded`, explicit pipeline graphs exist, database-write failures are checked in the reviewed handlers, orchestration function bodies are present in `supabase/schema.sql`, and the four requested test files now exist. These improvements do not satisfy the release gate.

Independent verification found the following release blockers:

1. `npm run typecheck` fails at `tests/pipeline/admin-routes.test.ts:76` with `TS1005: ')' expected`. The helper introduced by Prompt B5 is closed with `}` instead of `});`. This is newly introduced code, not a pre-existing Jest/configuration issue. The production build consequently cannot pass its TypeScript gate.
2. The four new focused suites execute zero useful acceptance tests: the admin test has the syntax error; the worker parser cannot be loaded by the current Jest path; registry/runtime tests hit the AWS SDK ESM import boundary; and `orchestrator-runtime.test.ts` mocks lease acquisition to return `null`, so it never exercises handler execution, context chaining, completion, heartbeat loss, or a meaningful `maxStages` boundary.
3. `executeWithLease` writes the entire `StageResult` object as `output_ref`, while the next stage expects the fields inside `StageResult.outputRef`. `runPipelineBounded` forwards that wrapper verbatim and never merges immutable run context. Even after correcting the wrapper, normalize/extract replace earlier source context. The claimed discover -> fetch -> archive proof is absent.
4. `processLeasedWork` acquires a lease itself and then calls `executeWithLease`, which acquires a second lease. The first attempt is stranded in `leased` state.
5. Heartbeat loss aborts an internal `AbortSignal`, but `StageHandlerContext` does not expose that signal and handlers never check it. Side effects can continue after lease loss. `processStage` also attempts to fail the attempt with the stale token after lease loss.
6. The worker parses `--resume`, but does not pass the supplied run ID into `runPipelineBounded`; resume therefore creates/looks up a different run by a generated idempotency key.
7. `supabase/schema.sql` is not a self-contained schema snapshot. It references Evidence Foundation objects such as `public.model_runs` without creating them, so a clean schema application fails before orchestration is usable.
8. `acquire_stage_lease` can consume crash budget twice for one third expired-lease recovery when a run has a budget above three, and ordinary non-retryable/max-attempt failures also decrement the crash-only budget. Crash budget must be consumed exactly once per expired lease recovery and not by ordinary stage failures.
9. `enqueue_stage_attempt` uses SELECT-then-INSERT. Two concurrent identical enqueues can both miss the row and one receives a unique-constraint error rather than both obtaining the unchanged canonical attempt.
10. `verifyNewsHandler` remains an explicitly labeled placeholder. It counts candidates as verified/rejected from two confidence fields but does not apply or mutate the central publication policy. It must report an honest non-publishing/skipped result or call the real policy; it must not imply candidate verification occurred.

Checkpoint 2 remains `NOT_ACCEPTED`. Do not push the migration. Run Prompt B6 below. Prompt B5 is now archived.

### 2026-10-08: Sixth Checkpoint 2 completion report rejected

The next report was still labeled Prompt B5 and declared `DONE`, but explicitly admitted that the admin, registry, and orchestrator runtime suites do not execute. Independent commands and source inspection found:

1. The required focused command fails: 3 suites fail to load, 1 suite passes, and only 19 parser tests run. `admin-routes.test.ts` fails because `Request` is undefined; registry and orchestrator runtime fail because `TextDecoder` is undefined.
2. `jest.config.js` uses the nonexistent key `setupFilesAfterEnvironment` instead of `setupFilesAfterEnv`, so `jest.setup.ts` never runs. Jest prints a validation warning that identifies this typo.
3. `jest.config.js` restricts `testMatch` to TypeScript tests only. The full command now runs only 15 suites, with 12 passing, 3 failing, and 197 tests passing. The prior JavaScript regression suites are silently excluded, so the reported test gate is a regression rather than a complete health check.
4. `executeWithLease` has a production-stopping self-abort bug. After successful work it sets `completed = true`, calls `controller.abort()`, and then checks `controller.signal.aborted`. That condition is therefore always true, so it returns lease-lost and never calls `completeAttempt` for any successful stage.
5. `processStage` still calls `failAttempt` with the old token after confirmed lease loss, contrary to Prompt B6 and the report's claim.
6. Adding `signal` to `StageHandlerContext` did not make work cooperatively cancellable. No stage handler reads `ctx.signal`, checks `signal.aborted`, or calls a shared abort guard. Fetch/archive/model/database loops can continue side effects after a lost lease.
7. Context is still replaced, not merged. `runPipelineBounded` forwards `attempt.output_ref` directly. Normalize returns only clustering counters and extract returns only its completion flag, erasing the run's source scope and bounded references.
8. `orchestrator-runtime.test.ts` still returns `null` from lease acquisition. Its `maxStages` assertion is only `processed <= 1`, and its context test checks the first enqueue rather than a real discover -> fetch -> archive chain. It cannot detect the self-abort, context-loss, lease-loss, or completion bugs.
9. The worker parser suite tests only parsing/help. It does not execute scheduled/once modes or prove `--resume` reaches the orchestrator. The worker also creates/gets the run once before calling `runPipelineBounded`, which creates/gets it again in non-resume mode.
10. The admin success mocks are not aligned with the route: the route calls top-level `ingestionSupabase.rpc`, but tests attach some RPC mocks to the object returned by `from`. The request mock also does not provide the `nextUrl` used by the GET route.
11. Typecheck and lint pass. The worker help output is correct. The hosted Supabase dry-run was independently verified and lists only `20261007030000_pipeline_orchestration.sql`.
12. The local production build was inconclusive in this review environment because Windows/OneDrive returned `EPERM` while Next tried to create `.next` directories. This does not explain or waive the deterministic runtime and test failures above.

Checkpoint 2 remains `NOT_ACCEPTED`. Do not push the migration. Run Prompt B7 below.

## Completed Work Before Checkpoint 1

### Milestone 0 and 0.1

- Secure, atomic 20-day student trial activation.
- Exact-domain and confirmed-email eligibility checks.
- One-time issuance with audit trail and concurrency protection.
- Centralized expiry-aware `has_full_access()`.
- Sensitive entitlement/trial columns protected from direct authenticated updates.
- Payments and Razorpay webhook disabled.
- Clean consolidated baseline migration.
- Hosted Supabase reset completed and migration history synchronized.
- Dashboard pagination and standardized API errors.
- Architecture decision records created.

The user does not need to revisit these unless a later change breaks them.

## Current Working Tree: Checkpoint 2 Repair

Reported additions include:

- `supabase/migrations/20261006020000_evidence_foundation.sql`
- `src/lib/intelligence/evidence/canonical-url.ts`
- `src/lib/intelligence/evidence/normalization.ts`
- `src/lib/intelligence/evidence/spans.ts`
- `src/lib/intelligence/evidence/publication.ts`
- `src/lib/intelligence/evidence/independence.ts`
- `src/lib/intelligence/evidence/payloads.ts`
- `src/lib/intelligence/evidence/repository.ts`
- `src/lib/intelligence/evidence/index.ts`
- `src/lib/intelligence/evidence/core.ts`
- `src/lib/intelligence/evidence/with-repository.ts`
- `src/app/api/evidence/[recordType]/[recordId]/[fieldName]/route.ts`
- tests under `tests/intelligence/evidence/`

Modified ingestion code includes:

- `src/lib/ingestion/rss-fetcher.ts`
- `src/lib/ingestion/story-clustering.ts`
- `src/lib/ingestion/funding-extractor.ts`
- `src/app/api/admin/extract/route.ts`
- `src/lib/supabase/ingestion.ts`
- `supabase/schema.sql`
- Jest/TypeScript package configuration
- the four ingestion/funding/story regression test files touched by the repair

The working tree is uncommitted and belongs to the user. Preserve all changes.

## Independently Reproduced Checkpoint 1 Status

The final repair resolved the remaining ingestion test-contract failures. The latest independently reproduced result is:

```text
Test suites: 25 passed, 25 total
Tests:       123 passed, 123 total
Targeted:    tests/ingestion-batch-lookup.test.js — 3 passed, 3 total
```

The SQL and TypeScript implementations were also inspected directly. Both use canonical URL fallback for empty or whitespace-only raw content and emit full 64-character hashes.

TypeScript passed when invoked directly through the installed TypeScript binary. In one Codex environment, the `npm` launcher itself pointed to a missing roaming npm installation, so direct Node entry points were used for verification. The user's own terminal previously ran `npm` normally.

## Checkpoint 1 Final Hosted Gate — Completed

The code gate is accepted. Do not rerun Prompt A4, A3, A2, or the initial Prompt A.

The user reported that hosted deployment and verification passed. No Checkpoint 1 action remains. Do not use `--include-all`, paste migrations manually into the dashboard, or reset the hosted database.

## Archived Prompt A4: Timeboxed Checkpoint 1 Closure

This prompt produced the final successful repair. It is retained for history only; do not rerun it.

```text
Timebox this Checkpoint 1 closure. Do not begin Checkpoint 2 and do not apply the hosted migration.

The two remaining failures are in tests/ingestion-batch-lookup.test.js. We will not allow another broad mock-rewrite loop. Make only the mandatory correctness fix and one bounded test repair attempt.

Mandatory P0 fix:

- TypeScript selects SHA-256(raw content) when content is non-empty and SHA-256(canonical URL) when stored content is empty/link-only.
- Ensure persist_document_version stores exactly the same content hash in document_versions and source_archive.
- The pending SQL currently appears to recompute from p_raw_content, which is empty for link-only items. Fix this by either passing the selected content hash as an explicit RPC parameter and validating it, or by implementing the identical content-or-canonical-URL fallback in PostgreSQL.
- Synchronize migration 20261006020000, supabase/schema.sql, GRANT/REVOKE signatures, repository payloads, and source-contract tests.
- Add a deterministic test proving two distinct link-only canonical URLs produce distinct database archive identities.

One timeboxed test-harness attempt:

- Change the VM repository mock so persistDocumentVersion unwraps the RPC response and returns the production shape with isNewVersion.
- Make the 250-existing-items fixture return the requested hashes from the archive batch query and assert three queries, zero persistence calls, items_new=0, items_updated=250.
- Count an in-response duplicate as updated/skipped without a second persistence call, or document one consistent alternative.
- Run the targeted ingestion-batch-lookup suite once.

If the targeted suite passes, run all health checks and report normal Checkpoint 1 completion.

If it still fails only because of VM/counter simulation after the hash-parity fix:

- Do not keep rewriting production code.
- Preserve the failing tests or mark only those exact cases as skipped with a dated TODO: close before bulk ingestion/public launch.
- Do not add a broad Jest ignore pattern.
- Run typecheck, lint, build, and all other non-database tests.
- Report the exact skipped/failed counts honestly.
- Mark status ACCEPTED_WITH_TEST_DEBT, not DONE.

Stop after this timeboxed closure. Do not apply Supabase remotely. Return the exact SQL/TypeScript identity rule, files changed, targeted result, remaining skipped debt, and manual hosted migration commands.
```

## Archived Prompt A3: Full Checkpoint 1 Test-Contract Repair

Retained for history only; do not rerun it.

```text
Continue in the current Ventro working tree. Finish Checkpoint 1 acceptance only. Do not start Checkpoint 2 and do not apply the hosted migration.

The second repair added the stable content-or-canonical-URL identity rule, bounded archive prelookup, within-response deduplication, explicit VM module mocking, and three ingestion regressions. Preserve these changes.

Current independently reproduced targeted result:

- tests/ingestion-batch-lookup.test.js: 1 test passed, 2 failed.
- Duplicate test expected items_new=1 but received 0.
- Two-link-only-URL test expected items_new=2 but received 0.
- The full reported suite is 24/25 suites and 121/123 tests passing.

Root cause 1: incorrect repository mock shape.

Production evidenceRepository.persistDocumentVersion() unwraps Supabase RPC data and returns:

{
  sourceDocumentId,
  documentVersionId,
  archiveId,
  isNewVersion
}

The VM mock currently returns supabase.rpc(...) directly as `{ data: [...], error: null }`. Therefore `persistResult.isNewVersion` is undefined and every new persistence is counted as updated.

Fix the mock adapter so it faithfully performs the same unwrap, error propagation, and missing-result behavior as production repository.ts. Do not change correct production behavior to accommodate an inaccurate mock.

Root cause 2: the 250-item test is internally inconsistent.

It mocks an empty source_archive and comments that all 250 items are new, but asserts items_updated=250. It also expects 250 persistence calls, so it does not prove that already-known items avoid persistence.

Rewrite it to model 250 already-known items:

- The mocked `.in('content_hash', chunk)` chain returns the requested hashes as existing rows.
- Assert exactly three archive batch queries with chunk sizes [100, 100, 50].
- Assert items_new=0 and items_updated=250.
- Assert persistRpcCalls=0.

Root cause 3: duplicate counter semantics are unspecified.

The implementation deduplicates before persistence, which is correct, but the duplicate copy disappears from both result counters.

Use this contract unless an existing documented contract proves otherwise:

- The first unique new item increments items_new.
- Every duplicate copy skipped within the same successful response increments items_updated.
- The duplicate is counted without a second R2 upload or persistence RPC.
- For successfully handled items, items_new + items_updated equals items_fetched.

Verify the link-only identity regression:

- Two distinct canonical URLs with empty content have different hashes.
- Both call persistence once.
- The faithful repository mock returns isNewVersion=true for both.
- Assert items_new=2, items_updated=0, persistRpcCalls=2.

Inspect stable identity parity end to end:

- fetch result content_hash;
- archive prelookup;
- R2 key;
- repository payload;
- SQL persist_document_version hash.

The migration currently appears to recompute its hash from p_raw_content. For link-only empty content, that can disagree with the TypeScript canonical-URL fallback even though metadata contains the TypeScript hash. Fix the database contract so the stored document/archive hash equals the selected TypeScript hash, or implement the exact same content-or-canonical-URL fallback in PostgreSQL. Synchronize the RPC signature, repository payload, GRANT/REVOKE statements, schema mirror, and tests. Add a source-contract test proving parity.

Run:

- npm run typecheck
- npm run lint
- npm test -- --runInBand
- npm run build

Acceptance requires zero failed non-database suites and tests. Do not add skips, ignores, fake credentials, or weaker assertions. The database-integration suite may remain explicitly skipped only because Docker is unavailable.

Finish with the counter contract, mock adapter behavior, SQL/TypeScript hash parity, exact files changed, exact suite/test counts, proof for all three ingestion regressions, remaining risks, and manual hosted commands. State DONE_WITH_CONCERNS if any non-database test fails. Stop after Checkpoint 1.
```

## Archived Prompt A2: Ingestion Acceptance Repair

Prompt A2 produced the second repair pass. It is retained for history only. The later Prompt A4 completed the repair; do not rerun either prompt.

Archived prompt:

```text
Continue in the current Ventro working tree. Finish Checkpoint 1 acceptance only. Do not start Checkpoint 2 and do not apply the hosted migration.

The first repair pass fixed the migration signatures, database-derived source trust, rights lookup, per-document spans, participant IDs, story-source batching, pure evidence imports, and evidence API validation. Preserve those repairs.

Current independently reproduced result:

- 24 test suites passed, 1 failed, 25 total.
- 120 tests passed, 2 failed, 122 total.
- Both failures are in tests/ingestion-batch-lookup.test.js.
- Both receive result.success === false.

Do not classify this as a harmless mock limitation. The acceptance gate requires zero failed non-database tests, and inspection found real contract drift between the implementation and test:

1. rss-fetcher.ts imports @/lib/intelligence/evidence/with-repository, but the VM test harness does not provide that module.
2. The implementation now performs one persist_document_version RPC per item and removed the bounded existing-hash lookup behavior the test was designed to protect.
3. Duplicate items in the same feed response are not deduplicated before persistence.
4. storeFetchResults() hashes result.raw_content || ''. Every link_only item has empty raw content, so distinct URLs receive the same empty-string content hash. source_archive is unique on (source_id, content_hash), making this a correctness bug, not just a test problem.
5. The rewritten test increments a variable named lookups for RPC calls while asserting at most three lookups across 250 items, and its first mock reports every RPC as a new version while expecting all 250 items to be updated. Repair the contract and the test so they agree.

Required outcome:

- Define one stable content/version identity rule shared by fetch, R2 key generation, the persistence RPC, archive uniqueness, and tests.
- For non-empty permitted content, hash the content.
- For link-only or otherwise empty stored content, use a deterministic URL-based fallback so distinct canonical URLs cannot collide.
- Ensure TypeScript and PostgreSQL compute/accept the same identity. Do not pass one hash to R2 while the database silently recomputes a different hash.
- Prefer making the database function accept and validate an explicit content hash or implement the same documented fallback in the database. Keep the trust boundary deterministic and tested.
- Restore a bounded prelookup for existing archive identities in chunks, or provide another bounded bulk persistence design. Do not issue hundreds of avoidable sequential RPCs for a feed.
- Deduplicate identical logical items within one fetch response before database/R2 persistence.
- Count the first unique new item as new and repeated copies as updated/skipped according to the existing API contract, without duplicate persistence.
- Preserve changed-content behavior: the same canonical URL with a different content identity appends an immutable document version.
- Preserve idempotent retry behavior and document-version/archive linking.
- Update the VM harness to mock the repository-backed evidence import explicitly. Do not bypass production credential checks globally.
- Rewrite the two tests so their mocks faithfully model the selected contract and their counters have unambiguous names such as archiveBatchQueries and persistRpcCalls.
- Add a regression test proving two different link_only URLs under the same source produce different identities and cannot collide in source_archive.
- Add a regression test proving a duplicate URL/item in one feed response causes one persistence operation.
- Add a regression test proving 250 already-known items use bounded batch queries rather than 250 persistence calls.

Inspect migration 20261006020000_evidence_foundation.sql and keep its RPC signature, GRANT/REVOKE statements, repository payload, schema mirror, and new identity behavior synchronized. Do not modify the deployed 20261006010000 baseline.

Run:

- npm run typecheck
- npm run lint
- npm test -- --runInBand
- npm run build

Acceptance is zero failed non-database suites and tests. Do not add ignore patterns, skips, fake global credentials, or weaker assertions. The database-integration suite may remain explicitly skipped only because Docker is unavailable.

Finish with the exact identity rule, batch/dedup algorithm, files changed, exact suite/test counts, proof for the three new regressions, migration/RPC signature changes if any, remaining risks, and the manual hosted commands. State DONE_WITH_CONCERNS if any non-database test fails. Stop after Checkpoint 1.
```

## Archived Prompt A: Initial Checkpoint 1 Acceptance Repair

This prompt produced the first repair pass. It is retained for history and context only. The later Prompt A4 completed the repair; do not rerun this prompt.

Archived prompt:

```text
Continue working in the existing Ventro repository. Repair Checkpoint 1 only. Do not begin Checkpoint 2, redesign the UI, implement admin pages, payments, or unrelated cleanup.

The architecture and product decisions remain fixed:

- Cloudflare R2 stores permitted raw/source payloads.
- Supabase stores canonical structured records, immutable document versions, evidence, claims, provenance, and R2 references.
- Routine publication is automatic under the conservative evidence policy; it must not require manual admin approval.
- The publication threshold is one official primary source OR at least two genuinely independent approved sources, extraction confidence >= 0.85, resolution confidence >= 0.90, and no active contradiction.
- Funding extraction operates only on immutable document_versions.normalized_text and never re-fetches a live URL.
- Do not modify the already-deployed baseline migration 20261006010000_initial_ventro_schema.sql.
- Repair the still-pending incremental migration 20261006020000_evidence_foundation.sql.
- Do not apply anything to hosted Supabase. The user will run the final hosted commands manually.
- Do not use raw psql -f.
- Payments remain disabled and out of scope.

The previous completion report was incorrect. Four non-database suites currently fail:

1. tests/story-clustering-safety.test.js
2. tests/ingestion-batch-lookup.test.js
3. tests/funding-extractor.regression-1.test.js
4. tests/story-clustering.regression-1.test.js

Required repairs:

1. Make the incremental migration executable.

- Declare every PL/pgSQL variable, including v_archive_id.
- Fix persist_document_version parameter ordering. PostgreSQL cannot place required input parameters after defaulted parameters. Prefer an explicit service-role RPC signature without optional ambiguity.
- Update every matching REVOKE, GRANT, repository RPC payload, schema mirror, test, and comment.
- Read excerpt permissions from document_versions.rights_snapshot through a null-safe Boolean expression.
- Fully qualify security-sensitive relations and functions under SECURITY DEFINER SET search_path = ''.
- Validate enum casts, JSON types, null behavior, array handling, return-column ambiguity, and conflict paths.
- An unchanged content hash must reuse the version deterministically.
- The returned archive ID must be correct on insert and conflict/retry paths.

2. Remove caller-controlled publication authority.

- Delete the p_source_independence_groups and p_is_official_sources RPC parameters.
- Derive authority in the database by joining every evidence document version to source_documents and source_connectors.
- Count official support from source_connectors.is_official.
- Count distinct independence using a non-empty independence_group, falling back to source_documents.domain.
- Count only supporting evidence.
- Require at least one valid supporting evidence item.
- Detect contradictory evidence and reject malformed evidence atomically.
- An application bug must not be able to mark a source official or fabricate source independence.

3. Restore exact document/span integrity.

- Process every document version independently.
- Calculate span offsets against the exact document_versions.normalized_text containing the excerpt.
- Allow one claim to have evidence from multiple documents, while preserving each document's local offsets.
- Never create offsets against concatenated synthetic text.
- Add a regression fixture where support exists only in the second document version.

4. Fix round-participant identities.

- Upsert and return the actual round_participants row.
- Use participant.id for participant claim subject_id and claim binding record_id.
- Never use funding_round.id as a participant identity.
- A name mention is not participation. Require an explicit lead, co_lead, or participant association.
- Add tests proving the binding resolves to the participant record.

5. Make publication control trusted field visibility.

- Candidate claims may be stored.
- A field is evidence-backed only when a published claim is bound to it.
- Do not upgrade a round or participant to verified from a candidate, conflicting, or below-threshold claim.
- Only write or expose trusted values after the corresponding publication decision.
- Use the smallest schema/API change needed to ensure product reads cannot present candidate assertions as verified facts.

6. Repair story-source linking.

- Replace the per-URL lookup based on cluster.supporting_sources[0] with a bounded batch lookup mapping the real source identity and URL to document_version_id.
- Do not assume every URL belongs to the first source.
- Avoid N+1 queries.
- Handle missing matches conservatively.
- Restore both story-clustering regression suites.

7. Restore unit-test isolation.

- Pure evidence helpers must be importable without Supabase credentials.
- Do not re-export the infrastructure repository from a pure barrel that utility tests load.
- Keep the production ingestion-client credential check intact.
- Do not add fake global credentials, ignore patterns, skipped suites, or weakened assertions.

8. Preserve R2/Supabase semantics.

- Use deterministic R2 keys and idempotent database writes so retries do not create duplicate logical versions.
- Do not claim R2 and Postgres are transactionally atomic together.
- A database failure after an upload must be visible and safely retryable.
- Store and return content only when immutable source rights allow it.
- Never infer reuse rights from Tavily, Firecrawl, or successful fetching.

9. Secure the evidence endpoint.

- Return 401 for unauthenticated callers.
- Apply the existing entitlement rule for protected evidence.
- Allowlist record types and field names; validate UUIDs.
- Use standardized API error envelopes.
- Return only published supporting evidence.
- Suppress forbidden excerpts and cap results.

10. Add tests.

Cover SQL signatures, database-derived source trust, spoof attempts, multi-document exact spans, malformed-span rollback, actual participant bindings, candidate/conflict visibility, rights-aware excerpts, evidence API auth, idempotent retries, and all four current regression suites.

Run:

- npm run typecheck
- npm run lint
- npm test -- --runInBand
- npm run build

Acceptance:

- zero TypeScript errors;
- zero ESLint errors;
- zero failed non-database suites;
- production build succeeds;
- the database integration suite may remain explicitly skipped only because Docker is unavailable;
- no test depends on archived migrations;
- only 20261006020000_evidence_foundation.sql is pending after the deployed baseline.

Do not execute a hosted migration. Finish with root causes, exact files changed, final RPC signatures, publication data flow, exact executed/passed/failed/skipped counts, proof for all four regression suites, remaining risks, and the user's hosted commands. State DONE_WITH_CONCERNS if any non-database suite fails or any SQL defect remains unverified.
```

### Archived manual gate: Checkpoint 1 hosted deployment

The user runs:

```powershell
npx supabase db push --dry-run
```

The dry run must list only `20261006020000_evidence_foundation.sql`.

Then:

```powershell
npx supabase db push
npx supabase migration list --linked
npx supabase db lint --linked
```

The user reported this gate passed. Do not reset the hosted database or rerun it.

## Archived Prompt B7: Checkpoint 2 Acceptance Enforcement

Prompt B7 was completed by Codex on 2026-10-08. It is retained for history only; do not rerun it.

```text
Finish Checkpoint 2 in the current Ventro working tree. Do not deploy Supabase, start Checkpoint 3, redesign UI, or write another summary before changing code and running the gates. The last report is rejected: three required suites execute zero tests, the Jest configuration excludes legacy JavaScript suites, and the lease executor cannot complete any successful stage.

Preserve the verified-good pieces: the worker help output, shared parser, explicit graphs, preAcquiredLease option, resumeRunId parameter, atomic enqueue SQL, corrected crash-budget SQL, self-contained schema additions, admin auth-before-service ordering, and dry-run migration order.

P0 runtime repair:

1. Fix src/lib/pipeline/lease-client.ts. Today it does:
   completed = true;
   controller.abort();
   if (leaseLost || controller.signal.aborted) ...
   That makes every successful handler look lease-lost and makes completeAttempt unreachable. Check leaseLost/signal state before any local cleanup abort. Stop the heartbeat without turning a successful local shutdown into lease loss. A successful handler must call completeAttempt exactly once and may return success only when completeAttempt returns true.
2. On heartbeat false/error, abort cooperatively, do not call completeAttempt, and do not call failAttempt with the stale token. Remove the stale-token failAttempt path from PipelineOrchestrator.processStage.
3. Implement real cooperative cancellation. Add one shared guard such as throwIfLeaseAborted(signal), then check it before and after every external call and within loops in all registered stage handlers. Merely attaching an abort listener that logs is insufficient. Do not start new source ingestion, database writes, model calls, or publication bindings after the signal is aborted.
4. Keep processLeasedWork on exactly one acquired lease using preAcquiredLease. Test the acquire call count and exact attempt ID passed to completion.

P0 bounded orchestration repair:

5. Maintain a bounded runContext initialized from parameters. After every completed stage, set runContext = { ...runContext, ...attempt.output_ref } and enqueue the next stage with runContext. Preserve source_scope/scope, source IDs, archive/document-version IDs, and counters; never place raw source/document text in stage JSON.
6. A real three-stage test must execute production PipelineOrchestrator with real registered mock handlers or an explicit injectable registry and prove discover -> fetch -> archive. It must assert the selected source reaches archive and an unrelated source does not. Do not satisfy this by checking only the first enqueue.
7. On resume, load completed attempts/context for that run, do not restart the first terminal stage, and continue from the next runnable stage. If another worker owns the runnable lease or it is waiting for retry, do not mark the entire run failed.
8. maxStages must count only successfully executed attempts. maxStages=1 must execute exactly one handler and must leave subsequent work pending rather than finalizing the run.
9. Simplify scripts/pipeline-worker.mjs so non-resume mode does not call createOrGetRun before runPipelineBounded calls it again. Both once and scheduled paths must call the same bounded API exactly once. --resume must pass the exact UUID and must not create a new run.

P0 test infrastructure repair:

10. In jest.config.js, replace the invalid setupFilesAfterEnvironment key with the supported setupFilesAfterEnv key. Make the setup load before modules that require Request, Response, TextEncoder, and TextDecoder. Use correct standards-compatible polyfills where Next/AWS behavior requires them.
11. Restore discovery of both legacy JavaScript tests and new TypeScript tests. The current testMatch '**/tests/**/*.test.(ts|tsx)' silently excludes the earlier .test.js suites. Configure .js/.jsx/.ts/.tsx or remove the narrowing override in favor of the established project pattern.
12. Fix admin-routes.test.ts to use a request object with nextUrl/searchParams and json(), and mock the actual top-level ingestionSupabase.from and ingestionSupabase.rpc calls. Prove no service-role from/RPC occurs for 401. Prove the admin GET and replay POST success paths use the correct RPCs.
13. Make registry and orchestrator runtime tests import production modules without loading real R2/AWS clients. Mock the I/O boundary before import, not the production orchestration logic.
14. Replace the current null-lease runtime tests. Required assertions:
    - successful executeWithLease calls completeAttempt once with outputRef and counters and returns success;
    - heartbeat false aborts an abort-aware handler and causes zero completion/downstream calls;
    - completeAttempt=false returns leaseLost and no downstream enqueue;
    - processLeasedWork acquires exactly once;
    - fresh run executes first stage;
    - maxStages=1 executes exactly one stage;
    - three-stage context flow reaches archive;
    - resume continues from persisted completed state;
    - retry-wait/no-acquirable-work leaves the run nonterminal.
15. Add worker execution tests, not parser-only tests. Export an import-safe main/dependency-injected run function if needed. Prove once and scheduled modes invoke runPipelineBounded once, and --resume passes the exact run ID without createOrGetRun outside the orchestrator.

Truthful verification:

Run these commands exactly and include their final summary lines:

node scripts/pipeline-worker.mjs --help
npm run typecheck
npm run lint
npm test -- --runInBand tests/pipeline/admin-routes.test.ts tests/pipeline/worker-parser.test.ts tests/pipeline/registry.test.ts tests/pipeline/orchestrator-runtime.test.ts
npm test -- --runInBand
npm run build
npx supabase db push --dry-run

Acceptance rules:

- Jest prints no configuration warnings.
- All four focused suites pass and execute the required behavior, not zero-work substitutes.
- The full suite includes both .js and .ts suites. Compare the final suite/test count with the prior healthy baseline; explain any intentional count difference by filename.
- Typecheck, lint, full tests, and build all exit 0.
- Dry-run lists only 20261007030000_pipeline_orchestration.sql. Do not push it.
- Include literal rg evidence showing stage handlers actually read ctx.signal or call the shared abort guard.
- Include one deterministic successful-lease trace showing work -> completeAttempt(true) -> success, and one heartbeat-loss trace showing abort -> no complete/fail/downstream.
- Include one real context test trace with all three stage names and their input/output refs.

Do not describe a failing suite as a pre-existing environment issue. Fix the repository-owned Jest configuration and mocks. Do not mark DONE if any required command fails, warns about invalid configuration, excludes legacy suites, or any required test is skipped. Use DONE_WITH_CONCERNS with exact failures instead. Stop after Checkpoint 2 and do not deploy.
```

## Archived Prompt B6: Final Checkpoint 2 Runtime, SQL, and Test Repair

Prompt B6 was not completed. The next report remained labeled B5, admitted required suites could not execute, and introduced an always-lease-lost executor path. It is retained for history only; use Prompt B7 above.

Paste this into Nemotron. This is a narrow acceptance repair. Do not deploy Supabase or begin Checkpoint 3.

```text
Continue in the current Ventro working tree and finish Checkpoint 2 only. Prompt B5 made real progress, but its final report is rejected because typecheck/build are red and the new tests do not exercise the claimed production paths. Do not call any failure "pre-existing" without proving it from git history. Preserve correct worker help parsing, explicit graph definitions, admin authorization ordering, run-scoped lease filtering, handler write-error checks, replay field clearing, grants/revokes, and all Checkpoint 1 behavior.

First reproduce and acknowledge these blockers before editing:

1. npm run typecheck fails at tests/pipeline/admin-routes.test.ts:76 because createMockSupabaseClient is closed incorrectly. This file was introduced by Prompt B5.
2. executeWithLease persists the StageResult wrapper, but downstream stages expect StageResult.outputRef.
3. processLeasedWork acquires a lease and then calls executeWithLease, which acquires another lease and strands the first.
4. StageHandlerContext has no AbortSignal, so heartbeat loss does not cooperatively stop handlers.
5. --resume is parsed but its run ID is not passed into the execution API.
6. schema.sql references Evidence Foundation tables such as model_runs without creating them.
7. crash_budget can be decremented twice for one expiry and is also decremented by ordinary failures.
8. enqueue_stage_attempt is SELECT-then-INSERT and is not concurrency-idempotent.
9. The new focused suites currently do not execute the real runtime paths.

Make these repairs:

A. Restore a green test/build gate.
- Fix tests/pipeline/admin-routes.test.ts syntax and mock the actual ingestionSupabase.from and ingestionSupabase.rpc calls made by the route.
- Configure/import the real .mjs worker parser in a Jest-compatible way without copying its parsing logic into the test. A tiny import-safe shared parser module used by both worker and test is acceptable.
- Mock external AWS/Supabase boundaries narrowly so registry/orchestrator tests can import production modules. Do not reimplement orchestration logic inside tests.

B. Repair the lease executor and both call sites.
- Give executeWithLease an optional already-acquired LeaseResult, or split acquisition from execution. processLeasedWork must execute exactly the lease it acquired; there must be no second acquire and no stranded attempt.
- Persist only handlerResult.outputRef as completion output, while passing its counters/cost to completeAttempt. Do not serialize the whole StageResult wrapper into output_ref.
- Add signal: AbortSignal to StageHandlerContext. Pass the executor signal into every handler.
- Add reusable throwIfAborted/checkpoints before and after each external read/write and inside loops. On abort, stop before further side effects.
- After work returns, check leaseLost/signal.aborted before completeAttempt. Never complete or enqueue downstream after heartbeat loss.
- Do not call failAttempt with a stale lease token after confirmed lease loss. Return a lease-lost result and allow expiry recovery.
- completeAttempt=false must be treated as lease loss and not success.

C. Repair bounded orchestration and resume.
- Maintain immutable bounded run context initialized from parameters, including source_scope/scope and bounded IDs only.
- After each stage, merge prior context with handlerResult.outputRef and enqueue that merged context. Never include raw document/source text in stage JSON.
- Ensure discover -> fetch -> archive receives top-level sources and scope. Normalize/extract may add fields but must not erase the bounded context required downstream.
- maxStages counts successfully leased/executed attempts, not skipped graph entries or no-work results.
- Support resumeRunId in runPipelineBounded (or a separate real resume API), validate that the run exists and matches pipelineType, and make worker --resume pass it. Do not create a new run when resuming.
- Do not finalize a run while pending, retry_wait, leased, or runnable stages remain.

D. Repair SQL semantics in the active migration and schema snapshot.
- Rewrite enqueue_stage_attempt as atomic concurrency-safe idempotency: INSERT ... ON CONFLICT DO NOTHING followed by SELECT of the canonical row, or an equivalent exception-safe pattern. A duplicate must return the unchanged active/retry/terminal attempt.
- Consume crash_budget exactly once for each expired-lease recovery. Do not decrement it again at the per-attempt threshold. Do not consume crash_budget for normal non-retryable or max-attempt failures.
- When either the per-attempt crash threshold or the run crash budget blocks recovery, dead-letter consistently without issuing a lease.
- Make supabase/schema.sql a self-contained clean schema snapshot in dependency order, containing the baseline, Evidence Foundation objects, and orchestration objects. It must create every table/type/function it references, including model_runs, claims, document_versions, and related evidence tables. Do not merely append orchestration SQL to an incomplete snapshot.
- Keep migration history incremental: do not copy earlier table creation into 20261007030000_pipeline_orchestration.sql. Only schema.sql is the consolidated snapshot.

E. Make verification honest.
- The placeholder verify handler must not report candidates as genuinely verified/rejected from two nullable confidence fields. Either call the existing central publication evaluator using evidence/independence/contradiction inputs, or return an explicit non-publishing/skipped result such as verification_mode='creation_time_policy' and candidate_recheck_skipped=true. Publish may bind only claims already marked published by the central policy.

F. Replace weak acceptance tests with tests of production code.

Required tests must import the real modules and execute these paths with only I/O mocked:
- admin route: 401, 403, invalid 400, admin success, and no service-role query/RPC before authorization;
- worker: visible help, equals/separated args, once/scheduled call real bounded API, and --resume passes the exact run ID;
- runtime: fresh run enqueues first stage; at least three real mock-handler stages execute and prove scoped source context reaches archive while unrelated source is absent; maxStages=1 executes exactly one attempt;
- lease: processLeasedWork acquires once; heartbeat false during an abort-aware handler prevents completion and downstream enqueue; completeAttempt=false is not success;
- SQL: concurrent-safe enqueue shape, immutable duplicate state, exactly-once crash decrement, no crash decrement in fail_stage_attempt, replay clearing, and schema dependency completeness/order;
- graph: each pipeline starts with zero dependencies and follows only its own graph.

Do not make tests pass by returning null leases, asserting zero work, duplicating state machines, or searching for superficial strings while the real behavior remains unexecuted.

Run and report literal concise output for:

node scripts/pipeline-worker.mjs --help
node scripts/pipeline-worker.mjs --help | Select-String "Usage:"
npm run typecheck
npm run lint
npm test -- --runInBand tests/pipeline/admin-routes.test.ts tests/pipeline/worker-parser.test.ts tests/pipeline/registry.test.ts tests/pipeline/orchestrator-runtime.test.ts
npm test -- --runInBand
npm run build
npx supabase db push --dry-run

Also show targeted proof with rg that:
- processLeasedWork does not acquire before calling an executor that reacquires;
- StageHandlerContext contains signal;
- worker passes resumeRunId;
- fail_stage_attempt does not decrement crash_budget;
- schema.sql contains CREATE TABLE definitions for model_runs, claims, document_versions, pipeline_runs, and stage_attempts.

The dry run must list only 20261007030000_pipeline_orchestration.sql. Do not run the hosted push. Final report must state exact executed/passed/failed/skipped suite and test counts and include a short deterministic trace of one three-stage context flow and one lease-loss flow. Mark DONE only if every command is green and every proof exists; otherwise use DONE_WITH_CONCERNS and list the exact failures.
```

## Archived Prompt B5: Verification-First Checkpoint 2 Repair

Prompt B5 made material progress but failed acceptance. It is retained for history only; do not rerun it. Use Prompt B6 above.

Paste this into Nemotron. Do not accept a completion report unless every named file and proof command exists in the checkout:

```text
The previous Prompt B4 was not implemented. Do not write another summary first. Make the exact file-level changes below, run the exact evidence commands, and include their literal concise outputs in the final report. Do not deploy Supabase or start Checkpoint 3.

Step 1 — prove current blockers before editing:

Run and inspect:

rg -n "getStagesForPipeline\(|finalizeRun\(" scripts/pipeline-worker.mjs src/lib/pipeline/orchestrator.ts
rg -n "failure_summary = NULL" supabase/migrations/20261007030000_pipeline_orchestration.sql
Get-ChildItem tests/pipeline -File | Select-Object -ExpandProperty Name

Your report must acknowledge that the worker calls nonexistent instance methods, failure_summary is assigned twice, and the claimed registry/worker/admin tests are absent before fixing them.

Step 2 — make the migration executable and schema identical:

1. Remove the duplicate `failure_summary = NULL` assignment from replay_dead_letter.
2. Keep the repaired acquire SELECT fields and immutable duplicate-enqueue behavior.
3. Make crash_budget a real run-wide gate with atomic decrement on each expired-lease recovery. Avoid hard-coded behavior disconnected from the column. When exhausted, dead-letter the recovered attempt without returning a lease.
4. Reopen replayed terminal runs consistently: status running, completed_at NULL, failure_summary NULL, heartbeat refreshed, original dead letter retained.
5. Copy the complete final orchestration DDL into supabase/schema.sql: crash_budget, crash_count, enums, indexes, RLS, all function bodies, SET search_path='', PUBLIC revokes, and service_role grants. Verify with rg that CREATE OR REPLACE FUNCTION bodies exist in schema.sql.

Step 3 — replace the broken worker path with one real API:

6. Add a public bounded method on PipelineOrchestrator, for example `runPipelineBounded(...)`, that:
   - creates/gets or resumes the run;
   - enqueues the first graph stage if missing;
   - processes no more than maxStages;
   - propagates merged context to the next stage;
   - does not finalize while pending/retry/leased work remains;
   - returns run ID plus processed count/status.
7. Make both scheduled and --once worker modes call that real method. Delete calls to nonexistent `orchestrator.getStagesForPipeline()` and `orchestrator.finalizeRun()`.
8. Fix the Windows/Linux entry guard using `pathToFileURL(process.argv[1]).href === import.meta.url`. `node scripts/pipeline-worker.mjs --help` must visibly print Usage and exit 0 without importing credentials.

Step 4 — implement real per-pipeline graphs:

9. Define and export explicit graph definitions, including per-pipeline dependencies:
   news/full: discover, fetch, archive, normalize, extract, resolve, verify, publish
   funding: extract, resolve, verify, publish
   thesis: extract, verify
   pattern: extract
10. Registration must use the graph-specific definition, not global STAGE_DEFINITIONS for standalone pipelines. `canStageRun` must receive pipelineType/registration and evaluate that registration's dependencies.
11. Test that the first stage of every pipeline has zero unmet dependencies.

Step 5 — preserve bounded context:

12. Maintain a run context object containing source_scope and bounded IDs/references. Merge prior context with each StageResult.outputRef before enqueueing the next stage.
13. Discover emits sources. Fetch preserves sources plus counters and bounded archive/document version IDs. Archive preserves required IDs/sources. Never include raw source text in stage JSON.
14. Prove a scoped source survives discover -> fetch -> archive while an unrelated source is absent.

Step 6 — one safe lease executor:

15. Implement a single executor used by runPipelineBounded and processLeasedWork.
16. Heartbeat with Promise.race/AbortController or an equivalent cancellation signal. An interval callback must never throw independently.
17. On heartbeat false/error: set lease-lost, abort cooperative work, never call completeAttempt, never enqueue downstream publish work, and return/fail safely.
18. Check completeAttempt's boolean. False is lease loss, not success.
19. Remove or rewrite runWithLease so it cannot swallow heartbeat failures.

Step 7 — handlers must not claim failed writes:

20. Check and throw on resolution_decisions upsert, claims update, and claim_bindings upsert errors before incrementing success counters.
21. Do not use published-only get_field_evidence to verify candidate claims. Use the existing publication policy/evidence data correctly, or mark the stage honestly non-publishing until a real candidate evaluator exists.

Step 8 — create the missing production tests, exactly at these paths:

- tests/pipeline/worker-parser.test.ts
- tests/pipeline/registry.test.ts
- tests/pipeline/admin-routes.test.ts
- tests/pipeline/orchestrator-runtime.test.ts

These files must import the real worker parser, registry/graphs, admin route, and PipelineOrchestrator. External Supabase/network I/O may be mocked; orchestration/state logic may not be reimplemented in the test.

Required cases:

- help prints Usage with no credential import;
- equals and separated CLI args parse identically;
- fresh scheduled and once runs enqueue their first attempt;
- maxStages is enforced;
- every pipeline graph starts and follows its own dependencies;
- scoped source context reaches archive;
- heartbeat loss prevents completion/downstream enqueue;
- completeAttempt=false is not counted as success;
- duplicate enqueue preserves active lease/backoff;
- crash budget is consumed and bounded;
- replay clears completed_at and produces leaseable work;
- signed-out admin route returns 401, non-admin 403, invalid request 400, admin success, and service-role operations never occur before authorization.

Step 9 — literal verification evidence:

Run:

node scripts/pipeline-worker.mjs --help
rg -n "getStagesForPipeline\(|finalizeRun\(" scripts/pipeline-worker.mjs
rg -n "CREATE OR REPLACE FUNCTION public\.(acquire_stage_lease|replay_dead_letter)" supabase/schema.sql
Get-ChildItem tests/pipeline -File | Select-Object -ExpandProperty Name
npm run typecheck
npm run lint
npm test -- --runInBand
npm run build
npx supabase db push --dry-run

Acceptance evidence:

- Help output visibly contains `Usage:`.
- The worker rg command returns no calls to nonexistent instance methods.
- schema.sql rg returns real function definitions.
- The four required new test filenames appear in the directory listing.
- Dry run lists only 20261007030000_pipeline_orchestration.sql.

Do not run the hosted push. Final report must include the literal evidence above, exact suite/test counts, files changed, and remaining risks. If any named file or evidence line is absent, say DONE_WITH_CONCERNS instead of DONE.
```

## Archived Prompt B4: Narrow Checkpoint 2 Release-Blocker Repair

This prompt was not implemented across the runtime/tests. It is retained for history only; do not rerun it. Use Prompt B5 above.

```text
Repair only the remaining Checkpoint 2 release blockers. Do not deploy Supabase, start Checkpoint 3, or rewrite already-correct areas. Preserve worker help/equals parsing, active migration timestamp, registry keying, run-id lease filter, admin authentication, and service-role-only access.

P0 SQL:

1. In acquire_stage_lease, include `sa.status`, `sa.lease_expires_at`, `sa.crash_count`, and `sa.started_at` in the SELECT that populates `v_attempt`. Add a regression that verifies every `v_attempt.<field>` dereference is selected.
2. Duplicate enqueue must never reset pending, leased, running, or retry_wait work. For any existing key, return the existing attempt unchanged. Explicit fail/recovery/replay functions alone may transition it.
3. Enforce the run crash budget: acquisition must refuse/dead-letter work when crash_budget is exhausted, and each expired-lease recovery must atomically consume the documented budget exactly once. Avoid both infinite crash recovery and double counting.
4. When replay reopens a terminal run, clear `completed_at`, reset failure/finalization fields consistently, and preserve the original dead letter.
5. Define terminal status consistently, including `partial`, before checking/returning existing terminal attempts.
6. Fully synchronize `supabase/schema.sql`: include crash_budget, crash_count, every orchestration/diagnostic function body, SECURITY DEFINER search_path settings, revokes/grants, indexes, and RLS. Do not substitute comments for function definitions.

P0 worker/runtime:

7. The worker must use real exported APIs. It currently calls nonexistent instance methods `orchestrator.getStagesForPipeline()` and `orchestrator.finalizeRun()`. Either add tested instance methods or import/use the real registry function and pipeline client explicitly.
   Fix the direct-execution guard portably with `pathToFileURL(process.argv[1]).href` (or equivalent) so Windows and Linux both execute `--help`, while importing the module remains side-effect free.
8. Both scheduled and `--once` modes must enqueue the first stage for the created/resumed run before polling. Prefer one orchestrator entry point that creates/gets the run, enqueues the first stage, processes at most maxStages, propagates outputs, and finalizes only when no runnable/retry work remains.
9. Implement explicit per-pipeline graphs/dependencies rather than global STAGE_DEFINITIONS for every registration:
   - news_ingestion/full_refresh: discover -> fetch -> archive -> normalize -> extract -> resolve -> verify -> publish
   - funding_extraction: extract -> resolve -> verify -> publish
   - thesis_extraction: extract -> verify
   - pattern_detection: extract
   The first registered stage in every graph must be runnable.
10. Merge immutable run context with each stage output. Fetch must preserve sources/source_scope for archive, and archive/normalize must pass bounded archive/document/version references downstream. Never replace the entire context with counters.
11. Implement lease-loss cancellation with a shared safe stage executor used by both normal and processLeasedWork paths. Do not throw from setInterval. Race work with heartbeat failure or use AbortController; after lease loss, do not complete or publish. Treat completeAttempt=false as failure.
12. Remove or fix runWithLease so no public helper swallows heartbeat errors.

P0 tests and proof:

13. Actually create these claimed tests:
   - tests/pipeline/worker-parser.test.ts importing the real parser/help-safe entry point;
   - tests/pipeline/registry.test.ts importing real registrations/graphs;
   - tests/pipeline/admin-routes.test.ts exercising 401/403/400/admin success and proving no service client before auth;
   - production orchestrator tests importing PipelineOrchestrator with injectable clients/handlers.
14. Replace local lease/state-machine and MockBudgetGuard assertions wherever they are used as proof of production behavior. Tests may use mocks for external I/O, but the state transition/orchestration code under test must be production code.
15. Add deterministic tests proving:
   - created scheduled run enqueues and executes its first stage;
   - maxStages limits execution;
   - each pipeline graph starts and follows only its own dependencies;
   - discover source identity survives through fetch and archive;
   - two duplicate enqueues cannot clear an active lease/backoff;
   - three expired leases exhaust the configured crash budget and dead-letter;
   - replayed terminal run has running status with completed_at NULL and leaseable work;
   - heartbeat loss prevents completion/downstream publication in both execution paths;
   - completeAttempt=false is never logged/counted as success;
   - schema.sql contains the actual function bodies and new columns.

Required commands/proof:

- `node scripts/pipeline-worker.mjs --help` exits 0 without credentials.
- A no-network unit test imports the worker module without execution.
- `npm run typecheck`
- `npm run lint`
- `npm test -- --runInBand`
- `npm run build`
- `npx supabase db push --dry-run` lists only 20261007030000_pipeline_orchestration.sql.

Do not run the hosted push. In the final report list the exact test filenames that exist, exact suite/test totals, worker call graph showing how a fresh run gets its first attempt, the SELECT fields backing every v_attempt dereference, schema parity proof, and remaining risks. If any requested test file or runtime proof is absent, report DONE_WITH_CONCERNS rather than complete.
```

## Archived Prompt B3: Final Checkpoint 2 Contract Repair

This produced the third rejected implementation pass. It is retained for history only; do not rerun it. Use Prompt B4 above.

```text
Continue in the current Ventro working tree. Finish Checkpoint 2 only. Do not deploy Supabase, start Checkpoint 3, redesign UI, or touch payments.

Your previous completion report is not accepted. Preserve the valid improvements: active later-timestamp migration, pure-JavaScript worker, `(pipeline_type, stage_name)` registry keys, run-id lease parameter, admin authentication before service-role use, and service-role-only orchestration tables. Repair the remaining production contracts below and prove them with tests that import/execute the real code.

1. Make the active migration executable.

- Remove `NOW()` from `idx_pipeline_runs_stale` in both `supabase/migrations/20261007030000_pipeline_orchestration.sql` and `supabase/schema.sql`. No partial-index predicate may contain current-time expressions.
- Fix `started_at = COALESCE(sa.started_at, v_now)` in `acquire_stage_lease`; there is no `sa` alias in that UPDATE.
- Add a static migration regression that would have failed on both exact defects.
- Fix diagnostic return-type mismatches explicitly: `get_stale_leases.minutes_stale` must match INTEGER, and `get_source_health.health_score` must match NUMERIC.
- Synchronize the full orchestration function bodies, grants/revokes, RLS, tables, enums, and indexes into `supabase/schema.sql`. Function-name comments are not schema parity.

2. Make retry, crash, enqueue, and replay semantics bounded and auditable.

- An expired lease recovery must consume a bounded attempt/crash budget. Repeated worker crashes must eventually dead-letter instead of reacquiring forever.
- Duplicate enqueue for a terminal attempt must not mutate its input_ref, model_run_id, max_attempts, counters, or audit history.
- Dead-letter replay must atomically create leaseable work and reopen the parent run to pending/running, or create a new linked replay run. A replay under a finalized partial/failed parent must be acquirable.
- Keep the original dead letter immutable and link replayed_from/replayed_to.

3. Repair worker CLI and scheduling behavior.

- Export the argument parser from an import-safe module that does not execute the worker on import.
- Support both `--name value` and the workflow's actual `--name=value` syntax, or change the workflow and test the exact final command.
- Implement `--help` as a no-credential, zero-side-effect success path.
- Validate pipeline type, positive finite max-stages, scope, and resume UUID. Unknown/missing values must fail clearly.
- Make `max_stages` limit the normal scheduled path, not only `--once`.
- In `--once`, enqueue/resume the intended run and pass its run ID to lease acquisition. Never poll unrelated global work after creating a run.

4. Make pipeline graphs valid per pipeline type.

- Do not apply the full news dependency chain to standalone funding, thesis, or pattern pipelines when prerequisite stages are absent.
- Define explicit per-pipeline ordered graphs/dependencies. Prove funding extraction runs extract -> resolve -> verify -> publish; thesis runs its intended extraction/computation sequence; pattern runs detection; full refresh/news use their complete graphs.
- Keep duplicate `(pipeline_type, stage_name)` registration rejection.

5. Preserve a real stage context instead of replacing it with counters.

- Every next-stage input must merge immutable run parameters plus bounded outputs/references from prior stages.
- Discover sources must remain available to fetch and archive. Fetch/archive must emit document/archive/version references needed downstream. Do not pass large raw text through JSONB stage inputs.
- Add a deterministic production-orchestrator test proving a scoped source discovered in stage 1 reaches fetch/archive and unrelated sources do not.

6. Make lease loss actually stop completion/publication.

- Do not throw inside an async setInterval callback and assume it cancels the awaited handler.
- Use an abort signal or a raced heartbeat promise. Once heartbeat returns false/errors or the lease expires, mark execution lease-lost, prevent later publish/completion calls, and surface a retryable failure only if the token still permits it.
- Check the boolean result from completeAttempt. False means stale/lost lease and must not be reported as success.
- Add the same heartbeat protection to global/processLeasedWork execution or route both paths through one shared safe executor.
- Remove or repair runWithLease so no helper silently swallows heartbeat loss.

7. Make handlers honest and error-aware.

- `verify` must not call published-only `get_field_evidence` for candidate claims. Either implement a candidate-evidence evaluation RPC/service that can update publication state under the established evidence policy, or make verification an explicit non-successful/skipped stage that cannot unlock publish.
- `resolve` must validate deterministic matches and check every resolution_decisions/claims write result. Do not assign 0.95 merely because value_json already contains a fund_id without proving the entity match.
- Check all Supabase write errors in resolve/publish; never increment success counters after failed writes.
- Keep ordinary qualifying publication automatic and evidence-backed, without admin approval.

8. Make global queue routing correct.

- A globally leased attempt must derive pipeline_type from its parent pipeline run, not from a CLI guess or hard-coded news type.
- Delete the unused hard-coded news registration lookup.
- Test two queued runs of different pipeline types and prove each resolves the correct handler.

9. Replace false-positive tests with production-contract tests.

- Rewrite `tests/pipeline/lease-logic.test.ts`, `state-machine.test.ts`, `idempotency.test.ts`, and `budget.test.ts` where they use local state machines, constant assertions, comments, or MockBudgetGuard instead of production code.
- Add worker parser/help tests against the exported real parser/entry point.
- Add registry/graph tests against real registrations.
- Add orchestrator tests against the real class with injectable production interfaces, covering output merge, max_stages, run-scoped once mode, mixed pipeline types, lease-loss abort, stale completion false, and dependency blocking.
- Add admin route tests: signed-out 401, non-admin 403, invalid input 400, admin success, and no service-role RPC before authorization.
- Add SQL source-contract tests for every migration defect above.
- Prepare a user-run hosted smoke test for create/get run, duplicate enqueue immutability, run-scoped lease, heartbeat, complete, bounded failure/crash recovery, dead letter, replay under finalized run, and cleanup. Do not run it remotely yourself.

Required local proof:

- `node scripts/pipeline-worker.mjs --help` exits 0 without credentials or ingestion.
- A parser test uses the exact GitHub Actions `--type=value --scope=value --max-stages=value` form.
- No `NOW()` occurs in any CREATE INDEX predicate.
- No undefined SQL alias remains.
- All registered pipeline graphs execute their first stage instead of immediately skipping on absent dependencies.
- Discover -> fetch -> archive retains scoped source identity.
- Heartbeat loss prevents completion and downstream publish.
- Retry/crash recovery reaches dead_letter within the configured bound; replay is leaseable from a finalized run.
- Tests import production pipeline modules; passing assertions are not copies of expected logic.
- `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, and `npm run build` pass with exact suite/test counts.
- `npx supabase db push --dry-run` shows only `20261007030000_pipeline_orchestration.sql`.

Do not run `npx supabase db push`. Stop with exact files changed, SQL/RPC signatures, pipeline graphs, context propagation shape, lease-loss mechanism, retry/replay transitions, security proof, worker help output, exact test counts, remaining risks, and the user's dry-run/push commands. State DONE_WITH_CONCERNS if any required production proof is absent.
```

## Archived Prompt B2: Checkpoint 2 Acceptance Repair

This produced the second rejected implementation pass. It is retained for history only; do not rerun it. Use Prompt B3 above.

```text
Continue in the current Ventro working tree. Repair Checkpoint 2 only. Do not start Checkpoint 3, redesign the UI, enable payments, or deploy any orchestration SQL remotely.

Checkpoint 1 is accepted and hosted. Preserve its evidence model and active migrations. The current Checkpoint 2 implementation reports 243 passing tests, but an independent review found production-blocking defects that the tests do not exercise. Fix the production contracts first, then replace tautological tests with tests against the real code.

P0 migration and SQL repair:

1. Do not deploy or directly execute `supabase/migrations_archive/20261006030000_pipeline_orchestration.sql`.
2. Inspect `npx supabase migration list --linked` only to determine the latest applied timestamp. Create exactly one active orchestration migration with a timestamp later than every active/remote migration, expected to be `supabase/migrations/20261007030000_pipeline_orchestration.sql` if `20261007020808` is the latest. Keep the old archived file only as history or remove the duplicate after preserving history in the archive README. Never require `--include-all` or raw `psql`.
3. Synchronize `supabase/schema.sql` with the final pipeline tables, enums, indexes, RLS, grants, and function signatures.
4. Remove every partial-index predicate containing `NOW()` or another non-immutable expression. Index stable columns such as status, lease_expires_at, retry_after, and pipeline_run_id; perform current-time comparisons in queries.
5. Repair `complete_stage_attempt`: use a `TIMESTAMPTZ` variable for started_at, initialize started_at on first acquisition, and compute latency milliseconds with an explicit numeric expression/cast.
6. Make retry state real: each reacquisition/retry must increment attempt_number exactly once, bounded by max_attempts. A retryable failure must eventually dead-letter. Define whether increment happens on failure scheduling or reacquisition and test that exact rule.
7. Separate idempotent enqueue from explicit retry/replay. Re-enqueuing the same completed key must return the existing terminal attempt unchanged. Only an explicit replay operation may create new work.
8. Make dead-letter replay leaseable. Create a new auditable attempt with reset/bounded attempt semantics and replayed_from metadata while preserving the original dead letter.
9. When acquire_stage_lease finds no row, return zero rows immediately. Do not emit a null row and continue.
10. Fix diagnostic return types and aggregation: cast NUMERIC/BIGINT fields correctly and aggregate 24-hour source logs independently from the latest-log row.

P0 runtime repair:

11. Make the worker executable by its package script. Either convert `scripts/pipeline-worker.mjs` to valid JavaScript or use a real TypeScript execution path. Prove `npm run pipeline:worker -- --help` or an equivalent no-side-effect smoke command starts without a syntax error.
12. Key the stage registry by `(pipeline_type, stage_name)` or store multiple registrations per stage. News/funding, thesis, pattern, and full-refresh handlers must coexist without overwriting one another. Reject duplicate registration for the same pair.
13. Propagate outputs between stages. Discover output must become fetch input, fetch output must feed archive/normalize, and later stages must receive the bounded document/version references they need. Do not enqueue every stage with the same original parameters and then pretend dependencies carry data.
14. Scope lease acquisition to the intended pipeline_run_id when executing a specific run. A worker processing run A must never lease run B's attempt. Keep a separate global queue-polling mode only when it deliberately uses the leased attempt's own run_id throughout.
15. Add active heartbeats to every potentially long-running handler path. Lease loss or heartbeat false/error must stop further publish-side effects and must prevent completion with a stale token. Do not swallow lease loss.
16. Make command-line parsing accept the exact GitHub Actions format, or change the workflow to pass separate arguments. Validate pipeline type, max stages, scope, and resume IDs. Ensure max_stages actually limits work in the scheduled path.
17. Enforce source_scope in discovery/fetch. A scoped run must not load or process unrelated connectors.
18. Replace placeholder success. The resolve stage must not count unresolved claims as resolved without writing a real resolution decision. The verify stage must not query a published-only evidence function for candidate claims and call that verification. Either implement the real operation or report an honest skipped/no-op state that cannot unlock publication.

P0 security repair:

19. Protect every `/api/admin/pipelines` GET and POST action using the established admin authentication pattern from `src/app/api/admin/review/route.ts` or a shared server-only helper. Require an authenticated user present in `admin_users` before constructing/using service-role operations. Return 401 for signed-out and 403 for non-admin users.
20. Validate action names, UUIDs, enums, integer limits/ranges, dates, reason length, and request JSON before RPC calls. Do not return raw internal error messages to clients.
21. Remove pipeline-table SELECT policies and diagnostic EXECUTE grants for general `authenticated`. Keep orchestration tables and sensitive diagnostics service-role-only, or enforce admin membership inside narrowly scoped SECURITY DEFINER diagnostics. Never expose lease_token, raw input/output refs, or error metadata to ordinary users.
22. Keep every SECURITY DEFINER function on `SET search_path = ''`, schema-qualify relations/functions, revoke PUBLIC, and grant only the minimum role.

Required tests against production code:

23. Delete or rewrite tests that merely restate constants, use local fake transition maps, or implement a separate MockBudgetGuard/lease machine. Tests must import the real registry, orchestrator helpers, parser, budget guard, and clients, or execute the SQL contract.
24. Add a worker startup/parser test covering the exact GitHub Actions arguments.
25. Add registry tests proving every required `(pipeline_type, stage_name)` resolves to the intended handler and cannot be overwritten.
26. Add orchestration tests with mocked production clients proving output propagation, run-scoped leasing, dependency blocking, heartbeat/lease-loss abort, max_stages, and source_scope.
27. Add source-contract tests for the final migration: no `NOW()` in index predicates; retry increment exists; terminal enqueue is unchanged; replay is leaseable; completion latency types are correct; no authenticated operational grants/policies remain.
28. Add an executable hosted smoke script/test for after migration deployment. It must use a unique test idempotency key and verify create/get run, duplicate schedule idempotency, enqueue, run-scoped acquisition, heartbeat, completion, bounded retry to dead letter, replay, and cleanup. Do not run it remotely yourself.
29. Add API tests proving signed-out=401, non-admin=403, admin success, invalid action/input=400, and that no service-role mutation occurs before authorization.

Acceptance gate:

- The active migration and `supabase/schema.sql` match.
- `node scripts/pipeline-worker.mjs ...` or the selected package command starts successfully.
- A deterministic news run passes discovered source references downstream instead of fetching zero sources.
- News/funding, thesis, pattern, and full-refresh registrations coexist.
- Two runs cannot lease each other's attempts.
- A simulated long stage heartbeats; lease loss aborts it.
- Retry reaches dead_letter at max_attempts; replay creates leaseable work; duplicate enqueue does not replay terminal work.
- Ordinary authenticated users cannot read or mutate orchestration state.
- No production orchestration guarantee is justified only by comments or a separately reimplemented test helper.
- `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, and `npm run build` pass with exact counts reported.

Do not apply the hosted migration. Finish with exact root causes, files changed, final migration filename, SQL/RPC signatures, registry key design, data propagation flow, lease/retry state machine, auth boundary, exact executed/pass/fail/skip counts, worker startup proof, remaining risks, and these user-run commands:

npx supabase migration list --linked
npx supabase db push --dry-run

The dry run must show only the new active Checkpoint 2 migration. Stop after the repair and report DONE_WITH_CONCERNS if any production contract, worker smoke test, non-database test, build, or static SQL acceptance check remains unresolved.
```

## Archived Prompt B: Initial Checkpoint 2 Automated Intelligence Pipeline

This prompt produced the initial rejected Checkpoint 2 implementation. It is retained for history only; do not rerun it. Use Prompt B2 above.

```text
Continue in the existing Ventro repository. Implement only Checkpoint 2: the durable automated intelligence pipeline. Do not start the two-answer UI, final visual redesign, payments, or a large admin dashboard.

Preconditions:

- Hosted migrations 20261006010000 and 20261006020000 are applied and in sync.
- Checkpoint 1 health checks have zero failed non-database suites.
- Immutable documents, versions, model runs, claims, evidence spans, and field bindings are the only accepted evidence path.
- Cloudflare R2 remains the permitted raw/archive store. Supabase remains the canonical structured and pipeline-state store.
- Ordinary supported records publish automatically. Routine admin approval is forbidden as a dependency.

Goal:

Make GitHub Actions and manual triggers thin schedulers around a Postgres-owned, resumable pipeline. A timed-out worker or duplicate schedule must not lose work, duplicate facts, or publish an empty result.

Scope:

1. Add one incremental migration after 20261006020000.

Create durable pipeline structures based on ADR-006:

- pipeline_runs:
  - id
  - pipeline_type: news_ingestion, funding_extraction, thesis_extraction, pattern_detection, full_refresh
  - trigger: scheduled, manual, webhook, retry
  - status: pending, running, completed, failed, partial, cancelled
  - parameters JSONB
  - deterministic request/idempotency identity where applicable
  - requested_at, started_at, heartbeat_at, completed_at
  - aggregate counts and total_latency_ms
  - failure summary

- stage_attempts:
  - pipeline_run_id
  - stage_name: discover, fetch, archive, normalize, extract, resolve, verify, publish
  - status: pending, leased, running, completed, retry_wait, failed, dead_letter, skipped
  - attempt_number
  - max_attempts, default 3
  - idempotency_key
  - lease_owner, lease_token, leased_at, lease_expires_at, heartbeat_at
  - retry_after
  - input_ref and output_ref JSONB
  - model_run_id where relevant
  - error_code, safe error message, error metadata
  - started_at, completed_at, latency_ms
  - item and cost counters

Use constraints and partial indexes that make invalid transitions and duplicate active work difficult. Do not store secrets, raw provider responses, or prohibited source text in error metadata.

2. Implement service-role-only database orchestration functions.

At minimum:

- create_or_get_pipeline_run(...)
- enqueue_stage_attempt(...)
- acquire_stage_lease(worker_id, lease_seconds, allowed_stage_names)
- heartbeat_stage_lease(attempt_id, lease_token, lease_seconds)
- complete_stage_attempt(attempt_id, lease_token, output_ref, counters)
- fail_stage_attempt(attempt_id, lease_token, error_code, safe_message, retryability)
- replay_dead_letter(attempt_id, reason)
- finalize_pipeline_run(run_id)

Requirements:

- Use SELECT ... FOR UPDATE SKIP LOCKED for acquisition.
- Lease ownership requires an unguessable token, not only a worker name.
- Default lease TTL is five minutes and is renewable.
- Completion/failure must reject an expired or incorrect lease token.
- Retry delays are bounded exponential backoff: approximately 1, 5, and 15 minutes.
- After max attempts, move the item to dead_letter.
- Replaying creates an auditable new attempt or transition without deleting history.
- Idempotency keys follow pipeline type, stage, source/input identity, content hash/version, and schema/implementation version.
- Repeated scheduling returns the existing logical run/attempt instead of duplicating work.
- SECURITY DEFINER functions use search_path = '', qualified relations, least privilege, and explicit grants.

3. Build a typed orchestration module.

Create a server-only pipeline package with:

- state and payload types;
- stage registry;
- lease client;
- retry classification;
- safe error serialization;
- run finalization;
- metrics aggregation;
- provider/model budget guards;
- structured logs carrying run_id, attempt_id, stage, source_id, document_version_id, and model_run_id when available.

Do not import the service-role client into browser code or pure deterministic helpers.

4. Convert ingestion into stages without rewriting working extraction logic unnecessarily.

Wire the existing modules into this sequence:

discover -> fetch -> archive/version -> normalize/cluster -> extract -> resolve -> verify -> publish

Rules:

- Stages exchange references and IDs, not large raw payloads.
- Every stage reads immutable input produced by the previous stage.
- Archive/version persistence remains the Checkpoint 1 path.
- Funding extraction reads document versions only.
- Publication remains centralized and evidence-gated.
- A failed stage cannot mark downstream stages successful.
- A provider timeout cannot produce an empty verified record.
- Duplicate schedules, worker crashes, expired leases, and retries must be safe.
- One failing source should produce a partial run when other independent sources succeed.

5. Wire GitHub Actions and the scheduled runner.

- Keep GitHub Actions as the clock and worker launcher.
- The action creates or resumes a run, drains a bounded number of attempts, heartbeats leases, and exits cleanly before platform timeout.
- A later action resumes pending/retryable/expired work.
- Add concurrency protection without relying on GitHub Actions as the source of truth.
- Preserve a manual dispatch with bounded parameters for pipeline type and source scope.
- Never expose service-role, R2, provider, or model secrets in logs.

6. Add automatic thesis and pattern candidate paths without pretending they are complete intelligence engines.

- Stated-thesis extraction accepts official-source document versions and exact attributable spans only.
- Observed-thesis computation consumes published investment evidence over an explicit time window and labels the output inferred.
- Pattern processing uses deterministic measures before narration and stores candidates with baseline/window/sample/counterexample placeholders required for later promotion.
- Weak outputs remain candidates.
- No routine administrator approval is required for ordinary funding facts meeting the policy.
- High-impact thesis interpretations and patterns may remain candidate pending later quality gates.

7. Add operational read contracts, not a large admin UI.

Provide secure, bounded diagnostics for:

- recent pipeline runs and statuses;
- stage waterfall for one run;
- pending/retry/dead-letter counts;
- stale leases;
- source success/yield/freshness;
- model tokens, latency, and cost;
- publication accepted/candidate/rejected counts and reasons.

These may be server queries or minimal protected endpoints. Do not spend the checkpoint building a polished admin dashboard.

8. Tests.

Add deterministic tests for:

- duplicate schedule idempotency;
- two workers competing for one attempt;
- lease expiry and safe reacquisition;
- invalid lease token rejection;
- heartbeat extension;
- retry timing and max attempts;
- non-retryable failure to dead letter;
- replay audit history;
- worker crash and later resume;
- partial pipeline completion;
- stage dependency enforcement;
- no downstream publication after upstream failure;
- unchanged document replay creating no duplicate claim/round;
- changed document version creating bounded new work;
- provider failure never becoming verified empty output;
- automatic publication continuing without an admin gate;
- secrets and prohibited raw text absent from logs/errors;
- cost/item counters;
- existing Checkpoint 1 evidence and ingestion regressions.

If Docker is unavailable, keep database integration tests executable and explicitly skipped, but add strong unit/source-contract coverage. Do not label skipped database behavior as executed.

9. Documentation.

- Update ADR-006 with actual states, transitions, lease/token behavior, retries, and replay semantics.
- Document the GitHub Actions contract and required environment variables without values.
- Add a short operator runbook for resuming runs, viewing dead letters, and replaying one item.
- Keep admin UI deferred.

10. Health and exit gate.

Run typecheck, lint, the complete non-database Jest suite, and production build.

Checkpoint 2 is complete only when a deterministic run survives duplicate scheduling, concurrent workers, a simulated crash, lease expiry, retry, and resume without duplicate published facts; every stage has durable status and a visible failure reason; ordinary supported funding facts publish without admin approval; and Checkpoint 1 evidence traceability remains intact.

Do not push the hosted migration. Finish with exact files, migration name, final state machine, RPC signatures, worker flow, executed/pass/fail/skip counts, a sample run trace, remaining risks, and manual hosted migration commands. Stop after Checkpoint 2.
```

## Prompt C: Checkpoint 3 Two-Answer Product Contracts

Use this only after Checkpoint 2 is accepted and its migration is applied.

```text
Continue in the existing Ventro repository. Implement only Checkpoint 3: the two-answer intelligence contracts. Do not perform the final visual redesign, enable payments, or build a general idea generator.

Product contract:

Answer these for a selected time window, AI domain, geography, and funding stage:

1. What are investors investing in now?
2. What are investors looking for from the market?

The answer engine must summarize evidence-backed investment and thesis activity. It may suggest research hypotheses, but it must not promise fundability or predict a specific investment.

Preconditions:

- Checkpoint 1 evidence and Checkpoint 2 durable pipeline are accepted.
- Answers consume only published claims, verified canonical rounds/participants, valid stated theses, observed-thesis computations, and published/eligible patterns.
- Candidate, rejected, retracted, unsupported, and materially conflicting claims are excluded from positive conclusions but may contribute explicit counter-evidence.
- No answer may depend on manual approval of ordinary funding facts.

1. Add an incremental answer-snapshot migration.

Design answer_snapshots and related citation/section structures with:

- answer_kind: investing_now or market_demand
- normalized filter dimensions: window, domain, geography, stage, optional fund/YC scope
- period_start, period_end, computed_at, data_cutoff_at
- status: computing, published, stale, failed, superseded
- deterministic input fingerprint/idempotency key
- schema_version, methodology_version, narration/model run reference
- structured summary and sections
- disclosed deal count and disclosed USD totals kept distinct
- undisclosed-round count
- company, fund, round, thesis, and pattern counts
- coverage metrics and denominators
- confidence score/label with deterministic inputs
- freshness state
- caveats and counter-evidence summary
- supersedes_snapshot_id

Store citations as normalized references to claims, claim bindings, funding rounds, participants, thesis records, patterns, and evidence records. Do not store unsupported free-form citations.

Use RLS and explicit server-side access rules. Public previews may show a bounded factual subset; premium depth follows the existing entitlement contract.

2. Implement deterministic aggregations first.

For “investing now,” calculate at minimum:

- verified/published deal count;
- disclosed USD total, never treating undisclosed as zero;
- undisclosed-round count;
- unique companies and investors;
- leading domains, stages, geographies, YC participation, and active funds;
- period-over-period comparison using equal-length windows;
- coverage changes so increased crawling is not mislabelled as increased investment;
- concentration and breadth indicators;
- top evidence-backed rounds.

For “market demand,” separate:

- stated thesis signals from official attributable sources;
- observed thesis signals inferred from published investments;
- thesis changes over time;
- recurring domains, stages, geographies, technical themes, and company archetypes;
- supporting and counter-evidence;
- methodology, sample size, time window, and coverage caveats.

Never merge stated and observed thesis into one unlabeled claim.

3. Implement thesis records needed by the answer.

- Stated thesis must come from official sources with exact spans and published claim evidence.
- Observed thesis must be computed deterministically from published investment records over explicit periods.
- Store methodology version, sample size, coverage, confidence, themes, caveats, and version history.
- Compare stated versus observed without claiming contradiction when public coverage is incomplete.
- Do not publish keyword-selected sentences as high-confidence thesis evidence without attributable extraction validation.

4. Implement valid pattern inputs.

Patterns used in answers must include:

- explicit segment and filter definition;
- current and comparison windows;
- baseline;
- sample size and distinct company/fund counts;
- qualifying published events/claims;
- source-independence and coverage notes;
- counterexamples;
- sensitivity or threshold notes;
- reproducible calculation/methodology version;
- candidate, published, corrected, retired, or rejected state.

An LLM may narrate a deterministic result. It cannot invent the result or publish a pattern by itself.

5. Build the answer composer.

- Generate structured answer data before prose.
- Every material sentence/section must cite one or more normalized supporting records.
- Keep citation completeness measurable.
- Use a provider-neutral narration interface.
- Reject malformed or uncited generated output.
- Fall back to deterministic templated language when model narration fails.
- Preserve counter-evidence, uncertainty, and caveats beside the conclusion.
- Recompute only when the relevant published-evidence fingerprint changes.
- Supersede prior snapshots; do not silently mutate historical answers.

6. Add server APIs.

Implement bounded, validated APIs for:

- latest answer snapshot by answer kind and filters;
- both answers in one dashboard request;
- snapshot detail with sections, metrics, caveats, and citations;
- evidence drill-down;
- available filter facets and coverage;
- recomputation request restricted to authorized server/worker paths.

Requirements:

- Use URL-shareable filters.
- Validate time-window bounds and enums.
- Prevent arbitrary SQL/filter injection.
- Use standardized API errors.
- Apply authentication and entitlement consistently.
- Avoid per-card N+1 evidence queries.
- Set sensible cache/revalidation semantics based on snapshot identity.

7. Personalization contract.

Use existing user preferences for domain, geography, and stage to select/rank snapshots. Store shared snapshots once; do not copy the corpus per user.

Return a machine-readable “why this answer” explanation showing which preferences affected ranking. Users must be able to reset preferences. Do not create opaque investor-fit scores.

8. Real-data seed/run path.

- Provide a bounded command or pipeline mode that ingests a small approved source set and produces at least one real answer snapshot when credentials are available.
- Keep deterministic fixtures for tests.
- Do not hardcode fabricated production answers, dollar totals, testimonials, or market counters.
- Empty, sparse, stale, partial, and conflicting datasets must produce honest states rather than invented content.

9. Tests and evaluation.

Add tests for:

- filters and equal-window comparison;
- disclosed totals versus undisclosed counts;
- source coverage-change adjustment;
- stated/observed thesis separation;
- candidate/retracted claims excluded;
- counter-evidence surfaced;
- patterns without baseline/sample/citations rejected;
- citation completeness for every answer section;
- deterministic fallback when narration fails;
- idempotent snapshot recomputation;
- supersession/history;
- stale and sparse states;
- entitlement and public-preview boundaries;
- no N+1 evidence access in primary answer APIs;
- provider cost/error recording;
- regression coverage for Checkpoints 1 and 2.

Create a small labelled fixture set for answer citation completeness and summary faithfulness. Report measured results honestly.

10. Exit gate.

Run typecheck, lint, full non-database tests, and production build.

Checkpoint 3 is complete only when both questions return structured snapshots for the same filter model; each conclusion exposes citations, time window, coverage, confidence, freshness, and counter-evidence; undisclosed values are not counted as zero; stated and observed thesis remain distinct; failed narration has a deterministic fallback; and historical snapshots remain inspectable.

Do not begin the final visual redesign. Do not push the hosted migration. Finish with exact files, migration name, API contracts, snapshot schema, example response shapes using clearly labelled fixture data, executed/pass/fail/skip counts, evaluation results, risks, and manual migration/run steps. Stop after Checkpoint 3.
```

## Prompt D: Checkpoint 4 Final Application and Visual Pass

Use this only after the two-answer contracts work with real or honestly sparse data.

```text
Continue in the existing Ventro repository. Implement Checkpoint 4: the final evidence-backed application experience and large visual pass. This is not a static mockup. Use the real Checkpoint 1–3 APIs and states.

Approved design reference:

- docs/designs/assets/ventro-intelligence-dashboard-direction.png
- docs/designs/intelligence-system-foundation.md

The information hierarchy is already approved. Preserve it. The desired visual tone is premium editorial-financial intelligence, slightly restrained: dark ink/navy framing, warm ivory research surfaces, dense but calm information, confident typography, restrained cyan/green/amber/red for meaning, fewer generic cards, and visible evidence/coverage/counter-evidence at scan level.

Do not turn the product into generic admin SaaS, a neon crypto terminal, or a collection of identical rounded cards.

Payments remain disabled. Do not implement Razorpay, checkout, subscriptions, invoices, or billing provider webhooks in this checkpoint. A non-interactive “payments coming later” state is acceptable. Preserve the working 20-day trial.

1. Establish the UI system.

- Audit existing tokens, typography, layout, navigation, cards, tables, charts, forms, empty states, and responsive behavior.
- Define semantic design tokens for background layers, research surfaces, ink, secondary text, dividers, focus, confidence, positive/negative movement, warning, conflicts, candidates, stale data, and citations.
- Create a consistent type scale and number formatting for money, deal counts, percentages, dates, windows, confidence, and coverage.
- Use composition, dividers, tables, and typography before adding containers.
- Create shared evidence-first primitives: metric, trend, confidence/coverage label, source stack, citation link, freshness indicator, disclosed/undisclosed legend, counter-evidence block, conflict state, engine tabs, filter bar, timeline, dense data row, skeleton, and error/empty/partial/stale/corrected state.
- Keep dependencies minimal and reuse the existing component system.

2. Rebuild the dashboard around the two questions.

The first screen must show:

- filter context: period, AI domain, geography, stage;
- “What are investors investing in now?” answer;
- “What are investors looking for from the market?” answer;
- key metrics with disclosed-only semantics;
- supporting rounds, investors, stated theses, observed themes, and patterns;
- coverage, freshness, confidence, citations, and counter-evidence;
- clear drill-down into the relevant engine pages;
- personalized “why this” context when preferences affect ranking.

Use real API data. Honest empty/sparse states are better than invented examples.

3. Finish the core engines.

News:

- latest AI news with image provenance, concise summary, publisher/source count, ingestion/last-checked history, entity links, verification label, source timeline, corrections, and original links;
- deduplicated story clusters;
- filters that remain in the URL;
- no full third-party content when rights forbid it.

Investments:

- current round flow, disclosed dollars, undisclosed counts, stage/domain/geography filters, VC/YC relationships, conflicts, and evidence drill-down;
- do not count undisclosed rounds as zero;
- show one economic round once.

VC Engine:

- directory and stable profile pages;
- recent evidence-backed investments and activity timeline;
- stage/domain/geography behavior;
- clearly separate stated thesis and observed thesis;
- methodology, sample, period, confidence, coverage, sources, and caveats;
- follow/save/compare actions using existing contracts.

YC Engine:

- batch navigation, tracked AI companies, company profiles, funding/activity timeline, membership evidence, source coverage, and related patterns;
- label incomplete coverage honestly.

Thesis Engine:

- stated propositions with official citations;
- observed themes with methodology and sample;
- comparison and change-over-time views;
- no inferred statement presented as a quote or official view.

Pattern Engine:

- baseline, time window, segment, sample size, qualifying events, distinct entities, confidence, coverage, counterexamples, sensitivity notes, methodology, and citation drill-down;
- candidate patterns excluded from ordinary user-facing published results unless explicitly in an authorized internal view.

4. Complete entity profile experiences.

Company profiles:

- stable identity and canonical website;
- sourced description and AI topics;
- geography/stage/YC status when known;
- funding timeline, investors, news, related patterns, sources, last update, sparse/unknown labels;
- never invent valuation, revenue, employees, customers, or funding.

Fund profiles:

- firm identity and official sources;
- fund vehicles/partners only where relevant and verified;
- investment timeline;
- stated and observed thesis;
- activity, domains, stages, geographies, related patterns, coverage, evidence, and caveats.

5. Complete mandatory account surfaces.

Profile:

- identity, role, short biography, interests, geography, stage, followed entities, export request, and account deletion entry point.

Preferences:

- AI domains, geographies, stages, engine weighting, alert cadence, explanation of personalization, and reset controls.

Security:

- email verification status;
- password change/reset flow;
- active sessions if supported by current Supabase capabilities;
- sign out and sign out all where supported;
- OAuth connections only if already configured;
- account deletion with explicit confirmation.

Access:

- current preview/student-trial state;
- trial start/expiry and eligibility explanation;
- paid plan marked unavailable/coming later;
- no provider call or enabled payment CTA.

Use server-side authorization and preserve private preferences, notes, saves, and follows.

6. Personalization and saved research.

- Use shared intelligence plus user filters/preferences; do not duplicate shared data per user.
- Show “why this appears” explanations.
- Make filters shareable.
- Complete save/follow behavior for stories, companies, funds, patterns, and research hypotheses.
- Keep community discussion separate from verified evidence.

7. Interaction and state quality.

Every major page must intentionally handle:

- loading;
- empty;
- sparse/partial coverage;
- stale data;
- conflicting evidence;
- corrected/retracted data;
- permission/paywall boundary;
- recoverable API error;
- unrecoverable error;
- mobile layout;
- keyboard navigation;
- screen-reader labels;
- reduced motion;
- long titles, missing images, and missing optional fields.

Do not use fake counters, fake live activity, fabricated testimonials, or placeholder investment data.

8. Performance and implementation constraints.

- Prefer server-rendered data where it improves first load.
- Avoid chained client fetches and N+1 evidence calls.
- Keep primary dashboard requests bounded.
- Optimize images and prevent layout shift.
- Use pagination or virtualization for large lists.
- Preserve URL filters and back-button behavior.
- Avoid unnecessary animation and large client-only component trees.
- Keep service-role credentials server-only.

9. Visual/browser QA.

Run the application and inspect at least:

- public landing page;
- authenticated dashboard;
- news list and detail;
- investments;
- VC directory and profile;
- YC page and company profile;
- thesis comparison;
- pattern list and detail;
- profile;
- preferences;
- security/access settings.

Test desktop and mobile widths. Check console errors, broken navigation, keyboard focus, overflow, contrast, skeleton transitions, empty states, evidence links, and filter persistence. Fix material issues found during the pass.

10. Tests and exit gate.

Add or update tests for:

- rendering real answer contracts;
- correct disclosed/undisclosed labels;
- stated/observed thesis separation;
- citation and evidence drill-down;
- entitlement-aware protected depth;
- trial expiry display;
- disabled payment surfaces;
- profile/preference persistence;
- filter URL persistence;
- empty/partial/stale/conflict/error states;
- key accessibility behavior;
- mobile navigation;
- regression coverage for all earlier checkpoints.

Run typecheck, lint, all non-database tests, production build, and browser QA.

Checkpoint 4 is complete only when the dashboard and all core engines use real evidence-backed contracts, the visual result converges on the approved reference without becoming visually loud, the two questions dominate the hierarchy, evidence is reachable within one interaction, account/preference/security/trial surfaces work, payments remain disabled, and desktop/mobile QA has no blocking issue.

Finish with exact files, routes reviewed, browser sizes, screenshots or paths, health-check counts, accessibility/performance findings, remaining risks, manual environment steps, and an explicit list of anything deferred to community or payment activation. Do not enable payments.
```

## Manual Workflow Between Checkpoints

For every incremental migration:

1. Have Nemotron stop before applying it remotely.
2. Review its completion report for zero failed non-database suites.
3. Run:

   ```powershell
   npx supabase db push --dry-run
   ```

4. Confirm only the expected next migration is pending.
5. Run:

   ```powershell
   npx supabase db push
   npx supabase migration list --linked
   npx supabase db lint --linked
   ```

6. Return the exact output to the reviewing chat before starting the next checkpoint.

Do not use `db reset --linked` again unless the user explicitly decides to destroy all hosted data and rebuild from the baseline.

## Completion Reporting Rules for Coding Agents

Every checkpoint report must include:

- exact root causes addressed;
- exact files created/modified;
- database migration filename and whether it was actually executed;
- data flow and security boundaries;
- exact typecheck/lint/test/build commands and results;
- executed, passed, failed, and skipped suite/test counts;
- proof that relevant regression tests pass;
- manual external steps;
- remaining risks;
- honest status: `DONE`, `DONE_WITH_CONCERNS`, or `BLOCKED`.

“Pre-existing failure” is not enough. The agent must show the failure existed before its diff or fix it if its changes exposed/caused it. A skipped database suite is not an executed database verification.

## Work Explicitly Deferred

- Razorpay/payment-provider setup and webhooks.
- Paid entitlement activation, invoices, renewals, cancellations, refunds, and billing portal.
- Large admin dashboard polish.
- Large community expansion.
- Guaranteed fundable-idea generation.
- A native mobile application.
- Microservices.
- A second query database.
- Exhaustive private-market coverage claims.

## Final Product Test

The final beta should let a student choose an AI domain, geography, stage, and time window, then answer both core questions in under five minutes. The student should be able to explain why the answer was produced, inspect the investments/theses/patterns behind it, open the original sources, recognize uncertainty and missing coverage, save useful research, and return later without juggling multiple external sources.

## Continuation Update — Checkpoint 3 Implementation (2026-10-08)

Checkpoint 3 implementation is complete locally in the main Codex chat. Do not rerun Prompt C in another coding agent against this working tree.

Implemented locally so far:

- Added pending migration `supabase/migrations/20261008020000_answer_intelligence_contracts.sql`.
- Added immutable answer snapshots, structured sections, normalized citations, thesis history, pattern evidence metadata, RLS/service-role boundaries, idempotent persistence, and supersession.
- Added deterministic investing-now and market-demand aggregation with equal-window comparison, disclosed/undisclosed separation, coverage adjustment, confidence, caveats, and counter-evidence.
- Added strict stated-versus-observed thesis eligibility and evidence-backed automatic pattern publication.
- Added optional provider-neutral narration with deterministic fallback and citation-completeness validation.
- Added both-answer, detail, citation drill-down, facets, admin recompute, and preference-reset APIs.
- Added a bounded `answers:compute` command and GitHub Actions refresh so production operation does not depend on the local machine.
- Added Checkpoint 3 unit/contract/evaluation suites. Current targeted result: 6 suites and 41 tests passing.

Verification completed:

- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and 220 existing warnings.
- `npx jest --runInBand`: 41 suites passed, 1 Docker-only database suite skipped; 338 tests passed and 22 database tests skipped.
- `npm run build`: passed; 32 pages generated. The first sandboxed attempts hit a disposable `.next` OneDrive lock and blocked Google Fonts network access; the clean escalated build passed.
- `node scripts/compute-answer-snapshots.mjs --help`: passed without credentials.
- `npx supabase db push --dry-run`: passed and lists only `20261008020000_answer_intelligence_contracts.sql`.
- `npx supabase db lint --linked`: passed with `No schema errors found`, confirming the hosted Checkpoint 2 repair is clean.
- `npx supabase migration list --linked` was separately attempted but Supabase's temporary login role hit repeated SASL authentication failures/circuit breaking. This does not contradict the successful linked dry-run and linked lint, but the user should rerun it after the temporary block clears.

Status: `DONE_WITH_CONCERNS`. The Checkpoint 3 migration has not been pushed, and its database function cannot be executed locally because Docker is unavailable. The user must run the hosted push, linked lint, and a bounded real-data computation before Checkpoint 4. The successful dry-run proves the Checkpoint 2 hosted repair is already applied because only the Checkpoint 3 migration remains pending.

Manual next steps:

```powershell
npx supabase db push
npx supabase migration list --linked
npx supabase db lint --linked
npm run pipeline:worker -- --once --type=thesis_extraction --max-stages=2
npm run pipeline:worker -- --once --type=pattern_detection --max-stages=1
npm run answers:compute -- --period-start="2026-07-01T00:00:00Z" --period-end="2026-10-01T00:00:00Z"
```

Use dates appropriate to the current 90-day window. Confirm both rows exist in `answer_snapshots`, every material section has citations, and no production fixture/fabricated data was inserted. Payments remain disabled. Checkpoint 4 visual redesign has not started.

## Continuation Update — Checkpoint 4 Application Pass (2026-10-08)

Checkpoint 4 has been implemented locally on top of committed Checkpoint 3. Do not rerun Prompt D blindly against this working tree.

Implemented:

- Replaced the old feed-only dashboard with the real `/api/intelligence/answers` two-answer experience.
- Added URL-persistent period, domain, geography, and stage filters.
- Preserved answer citation row IDs through the repository mapper and added a rights-aware evidence drawer using `/api/intelligence/citations/[id]`.
- Added disclosed-only capital metrics, explicit undisclosed counts, confidence, coverage, freshness, stale labels, caveats, counter-evidence, sparse and error states, and personalization explanations.
- Added the approved persistent engine navigation, mobile bottom navigation, semantic ink/ivory design tokens, 44px controls, focus-visible, reduced-motion, safe-area, and tabular-number behavior.
- Added `/theses` with a strict stated-versus-observed comparison using real Checkpoint 3 output.
- Replaced the public landing page's static deal example and generic feature-card grid with a product-truth composition that contains no fabricated investment data.
- Added settings deep links, email-verification status, password-reset entry, global sign-out, and explicit-confirmation account deletion via `/api/account/delete`.
- Kept checkout and payment provider surfaces disabled and changed the billing tab language to non-payment access language.
- Added `tests/checkpoint4-application.test.js` with 10 UI contract tests.
- Added `docs/designs/checkpoint-4-application-audit.md`.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and 215 warnings.
- `npm test`: 42 suites passed and 348 tests passed; 1 Docker-only database suite and 22 tests skipped.
- `npm run build`: passed; 34 routes generated.
- Focused Checkpoint 4 suite: 10/10 passed.
- The dependency folder was found incomplete (missing Next.js and JSDOM package files) and was repaired with `npm ci`; package versions were not changed.

Browser QA concern:

- The Codex in-app browser could not reach the Windows-hosted development server at `localhost` or the LAN address.
- Installed Chrome and Edge headless processes were also attempted but produced no screenshots in this environment.
- Therefore no rendered-browser screenshot is claimed. Use the route and viewport checklist in `docs/designs/checkpoint-4-application-audit.md` in a normal browser or deployed preview.

Status: `DONE_WITH_CONCERNS`. Code, tests, lint, typecheck, and production build pass. The remaining concern is rendered browser verification. Checkpoint 3's hosted migration and real-data answer computation still need to be completed before the dashboard can show real published answers; honest empty states appear until then. Payments remain deferred.
## Continuation Update — Hosted ingestion rollout diagnosis (2026-10-08)

- Read-only hosted checks confirmed: `source_connectors=0`, `source_archive=0`, `document_versions=0`, `stories=0`, `funding_rounds=0`, `funds=0`, `yc_batches=0`, `answer_snapshots=2`, and the configured Cloudflare R2 bucket contains `0` objects.
- Root cause: the hosted database was reset with `--no-seed`. The worker loads only `approved` rows from `source_connectors`, so an empty connector table produces no fetches and therefore no R2 uploads.
- The repository seed chain is enabled in `supabase/config.toml` and ordered as companies → funds → source connectors → extended source connectors → YC batches. It defines 40 unique connector IDs, of which the approved connectors are eligible for ingestion.
- Production bootstrap order after seeding: manually dispatch `full_refresh` with blank source scope and `max_stages=8`; then `thesis_extraction` with `max_stages=2`; then `pattern_detection` with `max_stages=1`. A separate `funding_extraction` dispatch is not required because `full_refresh` already runs extract → resolve → verify → publish. Every dispatch currently refreshes the 90-day answer snapshots.
- Runtime concurrency is fixed at one stage per worker and GitHub Actions uses one concurrency group per pipeline type. There is no `max_instances` input. Do not launch duplicate runs of the same pipeline type; let each finish before starting the next.
- Rollout concern: API connector seed `notes` are human-readable strings, while `fetchAPI()` parses every string as JSON. Hacker News, GitHub, Hugging Face, Tavily, and Firecrawl sources can therefore fail until that contract is repaired. Firecrawl also has no fetcher case. RSS sources can still populate the initial feed after seeding.
- GitHub Actions secret presence could not be inspected because GitHub CLI is not installed on this machine. Before dispatch, manually confirm the repository Actions secrets listed in `.github/workflows/scheduled-ingestion.yml`, especially Supabase and R2 credentials.

## Continuation Update — Hosted seed stage repair (2026-10-08)

- The first seeded hosted reset failed on `companies_latest_round_stage_check` because `seed_companies.sql` contains legitimate Series D/E values while the legacy company constraints stopped at Series C.
- Added active migration `20261008030000_align_company_stage_constraints.sql`. It aligns `companies.stage`, `companies.latest_round_stage`, and `company_fund_relationships.round_stage` with the canonical application/funding-stage vocabulary.
- Normalized the two seed-only labels: Run:ai uses canonical `acquisition` instead of `acquired`; Midjourney uses `other` while retaining its bootstrapped status in the description.
- Synchronized `supabase/schema.sql` and added company-stage seed regression coverage to `tests/sql-seeds.test.js`.
- Verification: direct seed/migration contract passed; focused SQL seed suite passed 12/12; `git diff --check` found no whitespace errors. The linked Supabase dry run was not executed because the command approval service hit its usage limit.
- Next manual action: rerun `npx supabase db reset --linked`. The new migration runs before the configured seed chain.
- Follow-up correction: the first repair draft targeted a nonexistent `company_fund_relationships` relation. The baseline relation is `public.investments`; migration `20261008030000` now drops/recreates `investments_round_stage_check` on that actual table, and the regression assertion requires the real relation name.

## Continuation Update — Extended connector seed repair (2026-10-08)

- The next hosted reset reached `seed_source_connectors_extended.sql` and failed because its corporate-investor sources use category `corporate`, which the legacy `source_connectors_category_check` omitted.
- Added migration `20261008040000_align_source_connector_categories.sql`, synchronized `supabase/schema.sql`, and made `corporate` a first-class source category.
- Expanded `tests/sql-seeds.test.js` to validate both the primary and extended connector seed files; previously it only checked the primary file and could not catch this mismatch.
- Next manual action remains `npx supabase db reset --linked`; migration `20261008040000` must appear before seeding begins.
- Follow-up seed correction: `yc-directory` in the extended seed used `commercial_use_allowed='unknown'`; the canonical constraint uses `unclear`, matching the primary seed. The extended row now uses `unclear`.
- Root test defect fixed: the connector-seed parser previously treated a semicolon inside a quoted notes field as the end of the SQL statement, so it silently validated only the first part of the extended seed. It now finds only an unquoted statement terminator and therefore validates all connector rows.

## Continuation Update — Authenticated App Visual System Pass (2026-10-08)

The authenticated application has received a cross-route UI repair. The public landing page was intentionally left unchanged for a later pass.

Implemented:

- Replaced the mismatched 236px/256px desktop offsets with one 256px sidebar contract and added a fixed 72px workspace bar.
- Added a functional global research search that sends queries into the News feed.
- Removed the fragile global rule that hid every legacy nested header, which had also hidden important follow/share/report actions on detail routes.
- Added shared application canvas, content-width, narrow-reading, page-heading, filter-panel, tab, empty-state, and detail-toolbar treatments.
- Migrated admin, alerts, community, companies, investments, investors, news, patterns, saved, settings, YC, and all corresponding detail routes onto the shared app canvas.
- Preserved the stronger dashboard and Thesis Engine compositions while aligning them with the same navigation frame.
- Restyled shared Card, Button, Input, Textarea, Select, MultiSelect, and Badge primitives around the approved ink/ivory, restrained-cyan editorial system and 44px interaction targets.
- Repaired the Community route, which previously rendered only `Community page content here` despite having data logic. It now has loading, error, empty, populated, pagination, composer, and thread-detail states.
- Added `tests/application-visual-system.test.js` covering the shared canvas across 16 routes, shell alignment, integrated detail toolbars, functional workspace search, and Community rendering states.

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and 197 existing warnings. Focused ESLint for the changed Community, shell, and shared UI files also had 0 errors.
- Focused UI contracts: 2 suites, 30 tests passed.
- Full Jest run: 43 suites passed, 1 Docker-only database suite skipped; 371 tests passed and 22 database tests skipped.
- `npm run build`: passed after clearing the disposable `.next` cache and allowing Google Fonts network access; 34 application routes generated.
- `git diff --check`: passed.

Remaining verification concern:

- Authenticated rendered-browser QA still requires a valid signed-in browser session or deployed preview. The development server was healthy on Windows, but the Codex in-app browser timed out against both `localhost:3000` and the advertised LAN address, matching the earlier environment limitation. Static contracts, TypeScript, Jest, Tailwind/webpack compilation, and the production route build pass, but no new authenticated screenshot is claimed from this environment.

## Continuation Update — Hosted publication pipeline repair (2026-10-08)

Read-only hosted diagnostics established that ingestion did fetch and archive real material: `source_archive=2331`, `document_versions=2331`, and Cloudflare R2 contained roughly 1.32k objects. The empty product was caused downstream, not by an empty crawler.

Confirmed root causes:

- The latest `news_ingestion` run reached `normalize` but failed with `column source_archive.processed does not exist`.
- The deployed feed query failed with `column stories.summary_kind does not exist`.
- Story clustering also writes `image_url`, `source_urls`, `supporting_sources`, and `updated_at`; those fields were absent from the hosted baseline as well.
- Thesis extraction failed because PostgREST found more than one relationship path between `claims` and `claim_evidence`.
- A cancelled GitHub worker left the full-refresh fetch attempt leased. The SQL lease function can reclaim expired leases and due retries, but the TypeScript orchestrator stopped before calling it whenever an attempt was `leased` or `retry_wait`.
- The GitHub job timeout was 25 minutes, which was insufficient for the initial multi-thousand-object hosted bootstrap.

Implemented locally:

- Added pending migration `supabase/migrations/20261008050000_repair_research_publication_contracts.sql` with the missing archive/story fields, the unprocessed-work index, constraints, and a PostgREST schema reload notification.
- Synchronized the relevant story and source-archive contracts in `supabase/schema.sql`.
- Disambiguated both thesis evidence embeds with `claim_evidence!claim_evidence_claim_id_fkey`.
- Changed bounded orchestration so the database lease function decides whether leased/retry-wait work is eligible; expired leases and due retries can now resume after worker cancellation.
- Increased the hosted ingestion workflow timeout from 25 to 60 minutes.
- Increased one normalize stage's bounded drain from 1,000 to 3,000 archive items so the current 2,331-item cold-start backlog can publish in one successful hosted run.
- Aligned news-ingestion idempotency with the hourly schedule; news now receives one stable run identity per UTC hour while expensive derived pipelines remain daily.
- Added regression coverage for expired-lease recovery, due/future retries, required publication columns, relationship disambiguation, and workflow headroom.

Verification:

- Focused pipeline suite: 13/13 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and 197 existing warnings.
- Full Jest run: 43 suites passed, 1 Docker-only database suite skipped; 376 tests passed and 22 skipped.
- `npm run build`: passed after clearing the disposable `.next` cache and allowing Google Fonts network access; 34 application pages generated.
- `npx supabase db push --dry-run`: passed and showed only `20261008050000_repair_research_publication_contracts.sql` pending.

Manual rollout order:

1. Run `npx supabase db push`.
2. Commit/push the repair so GitHub Actions and Vercel deploy the updated orchestrator/materializer/workflow.
3. After deployment, manually dispatch `Scheduled Ingestion Pipeline` with `pipeline_type=full_refresh`, blank `source_scope`, and `max_stages=8`. Do not start another same-type run in parallel.
4. When it succeeds, dispatch `thesis_extraction` with blank scope and `max_stages=2`.
5. When it succeeds, dispatch `pattern_detection` with blank scope and `max_stages=1`.
6. Verify News, Investments, Theses, Patterns, and Today. The workflow refreshes the 90-day answer snapshots after each successful dispatch.

Status: `DONE_WITH_CONCERNS`. The code repair is complete and verified, but the hosted migration has not been pushed and the fixed commit has not been deployed. The live app will remain empty until those two external rollout steps and the workflow sequence complete.

## Continuation Update — Hosted archive replay and publication repair 2 (2026-10-08)

The user applied the prior migration and reran the hosted workflows, but the product still showed one unverified story, no investments, no theses, no patterns, and empty dashboard answers. A fresh read-only hosted diagnostic confirmed that collection is healthy while publication is blocked: `source_archive=2340`, `document_versions=2340`, `archive_pending=2340`, `stories=1`, `story_sources=0`, `claims=0`, `funding_rounds=0`, `round_participants=0`, `thesis_records=0`, and `patterns=0`.

Confirmed root causes:

- The latest full-refresh normalize stage dead-lettered because `story_sources.document_version_id` did not exist, although normalization writes that immutable evidence link.
- All 40 seeded connectors still had `is_official=false`; therefore every newly clustered story was forced to `unverified`, regardless of being an official company, VC, YC, or government source.
- The News page emits comma-delimited query parameters and string booleans, while `feedFilterSchema` expected arrays and a native boolean. Selecting `Verified only` or another filter could therefore fail validation instead of filtering.
- The remaining stated-thesis PostgREST embed was ambiguous between `document_versions` and `source_documents`; the explicit relationship form was validated read-only against the hosted API and returned no relationship error.
- Story clustering assigned every matched fund the role `mentioned`, while funding extraction intentionally accepts only explicit `lead` or `participant` roles. Consequently the investment graph could never receive participants.
- Funding extraction upserted rounds before applying its deterministic stage/amount parsing, so every round was initially stored as stage `other` with no amount.

Implemented locally:

- Added pending migration `supabase/migrations/20261008060000_repair_story_publication_links.sql` to add/index `story_sources.document_version_id`, populate official-source trust metadata, derive independence groups, and reload the PostgREST schema cache.
- Synchronized the story-source contract in `supabase/schema.sql`.
- Made feed query validation accept the exact comma-separated arrays and `true`/`false` strings emitted by the UI.
- Made story verification evidence-derived: one official connector or two independent connectors becomes `verified`; one known approved connector becomes `partial`; unknown sources remain `unverified`.
- Added conservative investor-role extraction for explicit `led by`, `joined`, `participated`, `backed by`, `investment from`, and related language; ordinary mentions remain `mentioned`.
- Made funding rounds persist the deterministic majority stage and amount extracted from their immutable document versions before the round upsert.
- Added `scripts/diagnose-hosted-pipeline.ts` for read-only hosted counts, recent pipeline/stage failures, pending archive samples, official-source count, and relationship-contract validation.
- Added/updated regression coverage for UI filter parsing, migration contracts, explicit thesis relationship paths, source-derived verification, investor-role safety, and round-stage persistence.

Verification:

- Hosted read-only contract check: explicit thesis relationship query passes; current official-source count is `0` until migration `20261008060000` is applied.
- `npx supabase db push --dry-run`: passed and shows only `20261008060000_repair_story_publication_links.sql` pending.
- Focused repair suites: 4 suites and 15 tests passed.
- Full Jest run before the final two assertion-only additions: 44 suites and 383 tests passed; 1 Docker-only suite and 22 tests skipped. The focused suites passed again after those additions.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and 199 warnings.
- `npm run build`: passed; all 34 application pages generated.
- `git diff --check`: passed.

Required rollout order (no recrawl is needed):

1. Apply the one pending migration with `npx supabase db push`.
2. Commit and push this code so both GitHub Actions and Vercel deploy the repaired normalization, verification, filtering, funding, and thesis contracts.
3. After deployment, manually dispatch `Scheduled Ingestion Pipeline` with `pipeline_type=news_ingestion`, blank `source_scope`, and `max_stages=8`. This replays all 2,340 pending hosted archive rows and is preferable to another expensive full refresh.
4. After that run completes, verify that `source_archive.processed` rises, `stories` and `story_sources` populate, and News contains verified/partial items.
5. Dispatch `thesis_extraction` with blank scope and `max_stages=2`.
6. Dispatch `pattern_detection` with blank scope and `max_stages=1`.
7. Refresh News, Investments, VC profiles, Theses, Patterns, and Today. Do not run two workflows of the same pipeline type concurrently. The eight-stage `news_ingestion` graph already includes funding extraction; use a separate `funding_extraction` run with `max_stages=4` only as an idempotent recovery run if the news replay succeeds but Investments remains empty.

Status: `DONE_WITH_EXTERNAL_ROLLOUT_REQUIRED`. The code and migration are ready and verified. The live app will remain in its current sparse state until the hosted migration is pushed, the code is deployed, and the archive-replay workflow sequence completes.
