# ADR-005: Claim/Evidence Provenance

## Status
Accepted

## Date
2026-10-05

## Context
Every published factual claim must be traceable to its source. The intelligence spine requires a chain: Source Document → Extraction Run → Claim → Evidence Span → Published Fact.

## Decision
Core provenance tables:

### Source Documents & Versions (`source_documents`, `document_versions`)
- `source_documents`: Canonical URL, domain, title, publisher, first_seen, last_fetched
- `document_versions`: Immutable snapshots with content_hash, fetched_at, r2_key, raw_content
- Supersession: `superseded_by` links to newer version

### Model/Extraction Runs (`model_runs`)
- `provider`, `model`, `prompt_version`, `schema_version`
- `input_tokens`, `output_tokens`, `latency_ms`, `cost_usd`
- `status`: `success` | `partial` | `failed`
- `failure_reason` for debugging
- Linked to `document_version_id`

### Claims (`claims`)
- Subject-predicate-object triple with effective date
- `claim_type`: `funding_amount` | `investor_participation` | `thesis_statement` | `company_stage` | `yc_batch` | `other`
- `extraction_confidence`: 0-1
- `publication_status`: `candidate` | `published` | `corrected` | `retracted`
- `model_run_id` for traceability

### Claim Evidence (`claim_evidence`)
- Links claim to exact `document_version_id` and character span (start, end)
- `stance`: `supports` | `contradicts` | `context`
- `extractor_confidence`: 0-1
- Enables "Show me the evidence" UI

### Entity Resolution (`entity_aliases`, `resolution_decisions`)
- `entity_aliases`: Known aliases for companies/funds
- `resolution_decisions`: Manual overrides with auditor, reason, timestamp
- Repeatable identity matching

### Claim Bindings (`claim_bindings`)
- Links published claims to specific record fields (`funding_rounds.amount_usd`, `round_participants.role`, etc.)
- Unique constraint on (record_type, record_id, field_name, claim_id)

### Connector Trust Fields (`source_connectors`)
- `trust_tier`: `official` | `approved` | `standard` | `unverified`
- `is_official`: Boolean flag for official primary sources
- `independence_group`: Explicit source independence group for publication policy

## Pipeline Integration
- Every ingestion stage produces `pipeline_runs` + `stage_attempts` (Checkpoint 2)
- Idempotency keys at each stage
- Leases prevent duplicate processing
- Dead-letter state for failed stages

## Automatic Publication Policy (D5 Conservative)
A claim becomes `published` automatically only when ALL conditions hold:
1. **Source support**: At least 1 official primary source OR at least 2 independent approved sources
2. **Extraction confidence**: >= 0.85
3. **Resolution confidence**: >= 0.90
3. **No active contradiction**: No `claim_evidence` with stance `contradicts`
4. **Evidence validation**: Every supporting span validates against immutable normalized text

Source independence uses explicit `independence_group`, falling back to normalized domain. Multiple URLs from same group count once.

## Checkpoint 1 Implementation Details (2026-10-06)

### Migration
- Single incremental migration: `20261006020000_evidence_foundation.sql`
- Adds 8 new tables + connector fields + compatibility column on `source_archive`

### Security & Atomicity
- RLS enabled on all new tables
- Direct writes revoked from `anon` and `authenticated`
- Service-role-only SECURITY DEFINER functions:
  - `persist_document_version()`: Atomic upsert of source_document, document_version, source_archive link, latest_version pointer
  - `create_claim_with_evidence()`: Centralized claim+evidence creation with publication evaluation
  - `get_field_evidence()`: Bounded evidence lookup for published fields (authenticated access)

### Deterministic Evidence Module (`src/lib/intelligence/evidence/`)
- `canonical-url.ts`: URL canonicalization + stable SHA-256
- `normalization.ts`: Versioned text normalization (v1) + checksums
- `spans.ts`: Exact span discovery/validation (zero-based, start-inclusive, end-exclusive)
- `publication.ts`: Conservative publication policy evaluation (pure function)
- `independence.ts`: Source independence calculation
- `payloads.ts`: Typed database payloads
- `repository.ts`: Service-role database operations

### Ingestion Compatibility
- `rss-fetcher.ts`: Now calls `persist_document_version()` for atomic archive+document+version persistence
- `story-clustering.ts`: Stores `document_version_id` on `story_sources` links
- Unchanged content hash → reuses version, no duplicate queue work
- Changed content hash → appends new immutable version, supersedes latest pointer

### Funding Evidence Vertical Slice
- `funding-extractor.ts`: Refactored to consume `document_versions.normalized_text` only
- Creates deterministic `model_runs` (run_kind = `deterministic_extraction`)
- Creates candidate claims + exact evidence spans
- Runs centralized publication evaluator
- Binds published claims to `funding_rounds` / `round_participants` fields via `claim_bindings`
- Never re-fetches live article URLs

### Evidence Read Contract
- `GET /api/evidence/:recordType/:recordId/:fieldName`
- Returns only published claims with rights-aware excerpts
- Bounded single-query RPC: `get_field_evidence()`
- Never returns raw content, secrets, or internal metadata

### Tests Added (`tests/intelligence/evidence/`)
- `canonical-url.test.ts`: URL normalization, hash stability, tracking param stripping
- `normalization.test.ts`: Whitespace collapsing, control char removal, checksum stability
- `spans.test.ts`: Span validation (bounds, excerpt match, checksum), exact span finding
- `publication.test.ts`: D5 policy branches (official, independent, thresholds, contradictions, group dedup)
- `independence.test.ts`: Group counting, fallback to domain, independence checking

### Indexes Added
- Canonical document lookup: `source_documents(source_id, url_hash)`, `source_documents(canonical_url)`
- Document/version content hashes: `document_versions(content_hash)`, `document_versions(normalized_text_checksum)`
- Claim subject/type/status/effective_time: `claims(subject_type, subject_id)`, `claims(claim_type, publication_status)`
- Evidence claim/version/stance: `claim_evidence(claim_id)`, `claim_evidence(document_version_id)`
- Binding record/type/field: `claim_bindings(record_type, record_id, field_name)`
- Normalized aliases: `entity_aliases(entity_type, normalized_alias)`
- Resolution lookup: `resolution_decisions(target_entity_type, normalized_input)`

### Manual Hosted Migration Command
```bash
# Apply the incremental migration
supabase migration up --include-all
# Or specifically:
psql "postgresql://..." -f supabase/migrations/20261006020000_evidence_foundation.sql
```

## Consequences
- 100% traceability: UI fact → claim → evidence span → source bytes
- Correction history preserved (never overwrite silently)
- Model costs and latency tracked per claim
- Replayable: failed stages can be retried with same inputs
- Evaluation: labeled test sets against `claims` ground truth

## Implementation (Checkpoint 1 Complete)
- ✅ Migrations for all tables above
- ✅ Atomic persistence function with idempotent retries
- ✅ Centralized claim/evidence creation with publication gate
- ✅ Evidence read contract (server-side RPC)
- ✅ Deterministic evidence module with pure functions
- ✅ Ingestion compatibility (RSS, HTML, API connectors preserved)
- ✅ Funding extraction vertical slice (archived versions only)
- ✅ Behavior-focused unit tests for all core functions
- ✅ Indexes for all lookup paths
- ⏳ Pipeline orchestration (leases, retries, dead letters) — Checkpoint 2
- ⏳ Bulk historical backfill — deferred (clean DB)
- ⏳ Admin UI — deferred