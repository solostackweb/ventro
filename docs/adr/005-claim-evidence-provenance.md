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

## Pipeline Integration
- Every ingestion stage produces `pipeline_runs` + `stage_attempts`
- Idempotency keys at each stage
- Leases prevent duplicate processing
- Dead-letter state for failed stages

## Consequences
- 100% traceability: UI fact → claim → evidence span → source bytes
- Correction history preserved (never overwrite silently)
- Model costs and latency tracked per claim
- Replayable: failed stages can be retried with same inputs
- Evaluation: labeled test sets against `claims` ground truth

## Implementation (Milestone 1)
- Migrations for all tables above
- Backfill existing stories/investments/theses
- Pipeline orchestration with leases/idempotency
- Admin views for source health, model costs, publication rejection rates