# ADR-008: Versioned Two-Answer Intelligence Snapshots

## Status

Accepted and implemented locally in Checkpoint 3. The hosted migration has not been pushed.

## Context

Ventro must answer two questions from the same evidence spine:

1. What are investors investing in now?
2. What are investors looking for from the market?

Live aggregation inside a page request would be slow, difficult to reproduce, and vulnerable to changing source coverage. Free-form model answers would also allow uncited conclusions. The product instead needs inspectable historical answers whose inputs, window, coverage, confidence, counter-evidence, and citations remain stable.

## Decision

- Compute deterministic structured data before optional model narration.
- Store shared immutable `answer_snapshots`; personalization only reorders their sections and emits machine-readable `whyThis` reasons.
- Use one normalized filter contract for domain, geography, stage, fund, YC batch, and period.
- Give identical inputs a deterministic SHA-256 fingerprint. A database advisory lock and unique constraint make persistence idempotent under concurrency.
- Supersede an older published snapshot rather than mutating or deleting it.
- Store material sections separately and require every material section to have a normalized citation.
- Cite claims, claim bindings, exact evidence spans, rounds, participants, thesis records, and patterns—not arbitrary free-form URLs.
- Count disclosed dollar amounts and undisclosed rounds separately. An undisclosed amount is never treated as zero.
- Keep stated thesis (official published claim evidence) separate from observed thesis (deterministic inference from verified published investments).
- Publish patterns automatically only after deterministic sample, breadth, source-independence, and evidence thresholds pass. Manual approval is not required.
- Treat model narration as optional. Malformed, incomplete, or failed narration falls back to deterministic cited prose.
- Restrict writes and direct table reads to the service role. Server APIs provide bounded previews and entitlement-aware depth.

## Data Flow

```text
Cloudflare R2 archive
  -> immutable document_versions
  -> published claims + exact claim_evidence
  -> verified funding rounds / participants
  -> versioned stated + observed thesis records
  -> eligible deterministic patterns
  -> deterministic answer drafts
  -> citation completeness validation
  -> optional provider-neutral narration
  -> immutable answer snapshots
  -> preview/full APIs and evidence drill-down
```

## API Contracts

- `GET /api/intelligence/answers` returns both latest answers for one filter model; `kind` can select one.
- `GET /api/intelligence/answers/:id` returns a historical published, stale, or superseded snapshot.
- `GET /api/intelligence/citations/:id` returns a bounded, rights-aware evidence drill-down.
- `GET /api/intelligence/facets` returns bounded available filter dimensions.
- `POST /api/intelligence/recompute` is admin-only and computes both answers server-side.
- `DELETE /api/intelligence/preferences` resets ranking preferences without deleting shared snapshots.

## Hosted Operation

GitHub Actions refreshes the canonical 90-day snapshot after ingestion. At 02:00 UTC it also runs thesis and pattern materialization before composing answers. The bounded manual command is:

```powershell
npm run answers:compute -- --period-start="2026-07-01T00:00:00Z" --period-end="2026-10-01T00:00:00Z"
```

## Consequences

- The frontend can render fast, reproducible historical answers without running models in request paths.
- Sparse data produces an honest low-confidence/empty state rather than fabricated conclusions.
- Snapshot creation needs the service-role key and the Checkpoint 3 migration.
- Database integration remains unexecuted without a local Docker stack; the hosted dry-run/lint/push sequence is the release gate.
