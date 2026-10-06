# Nemotron Prompt: Checkpoint 1 — Evidence Foundation

You are working in the Ventro repository. Implement only Checkpoint 1 of the approved same-day execution plan.

Read before editing:

- `AGENTS.md`
- `docs/plans/intelligence-system-execution-plan.md`
- `docs/designs/intelligence-system-foundation.md`
- `docs/adr/003-canonical-funding-round-identity.md`
- `docs/adr/004-stated-vs-observed-thesis.md`
- `docs/adr/005-claim-evidence-provenance.md`
- `docs/adr/006-pipeline-run-publication-states.md`
- `supabase/migrations/20261006010000_initial_ventro_schema.sql`
- current ingestion modules and their tests

## Outcome

Deliver one working evidence-first vertical slice:

`new source content -> immutable document version -> extraction run -> funding claim -> validated evidence span -> automatic publication decision -> binding to a funding-round or participant field -> bounded evidence lookup`

The existing news ingestion and clustering path must continue working. Routine evidence-backed claims must not wait for manual admin approval.

## Fixed Product Decisions

- Keep the Next.js modular monolith, Supabase/Postgres, R2, and GitHub Actions.
- Payments remain disabled. Do not touch Razorpay or paid entitlement behavior.
- Do not build pipeline leases/retries/dead letters yet; that is Checkpoint 2.
- Do not build bulk historical backfill; the hosted database is clean and empty.
- Do not build new admin pages.
- Do not redesign the UI yet.
- Do not implement thesis, pattern, or answer snapshots yet except for schema contracts genuinely shared by the evidence spine.
- Do not require routine manual approval.
- Manual review remains reserved for high-impact patterns, corrections, material conflicts, and exceptional cases.

## Automatic Publication Policy

An ordinary funding claim may become `published` automatically only when all conditions hold:

1. It has either:
   - at least one official primary source, or
   - at least two independent approved sources.
2. `extraction_confidence >= 0.85`.
3. `resolution_confidence >= 0.90`.
4. It has no active contradictory evidence.
5. Every required supporting evidence span validates against the immutable normalized text.

Otherwise it remains `candidate` and must be excluded from published answers. Callers cannot directly bypass this evaluator by writing `publication_status = 'published'`.

Source independence must use an explicit connector `independence_group`, falling back to normalized publisher/domain only when the group is absent. Multiple URLs or syndications from the same group count once.

## 1. Incremental Migration

Create one new timestamped migration after `20261006010000`. Do not rewrite or rename the applied baseline.

Add the following concepts with UUID primary keys using `gen_random_uuid()`:

### `source_documents`

- connector/source reference
- canonical URL and stable URL hash
- domain, title, publisher
- first-seen and last-fetched timestamps
- latest-version reference added safely after `document_versions` exists
- unique canonical identity appropriate for one connector and URL

### `document_versions`

- source-document reference
- immutable content hash
- normalization version
- normalized text and normalized-text checksum
- fetched and published timestamps
- R2 key/URL where permitted
- rights/retention snapshot and metadata
- supersedes-version reference
- unique document/content-hash identity

Never overwrite version content. A changed hash appends a version; an unchanged hash reuses the existing version.

### `model_runs`

- run kind: deterministic extraction, model extraction, classification, resolution, narration
- provider/model where applicable
- prompt and schema versions
- deterministic implementation version
- input checksum
- document-version reference when applicable
- token, latency, and cost fields
- success/partial/failed status and bounded failure reason
- started/completed timestamps

Represent the current funding parser as a deterministic run. Do not pretend it called an AI model.

### `claims`

- typed subject reference
- claim type and predicate
- typed/JSON value representation suitable for amount, date, stage, and participation claims
- effective time
- extraction and resolution confidence constrained to 0..1
- candidate/published/corrected/retracted/rejected status
- model-run reference
- superseded-claim reference
- publication/correction/retraction reason and timestamps

### `claim_evidence`

- claim and document-version references
- supports/contradicts/context stance
- zero-based start-inclusive/end-exclusive character offsets
- exact excerpt
- excerpt/span checksum
- extractor confidence constrained to 0..1
- uniqueness preventing duplicate evidence links

Offsets must refer to `document_versions.normalized_text`, not HTML, mutable URLs, summaries, or lowercased copies.

### `claim_bindings`

- claim reference
- record type
- record UUID
- field name
- unique record/field/claim binding

This is the contract that proves which claim supports fields such as:

- `funding_rounds.amount_usd`
- `funding_rounds.round_stage`
- `funding_rounds.announced_date`
- `round_participants.role`

### `entity_aliases`

- company/fund entity type and UUID
- original and normalized aliases
- provenance/source
- uniqueness supporting deterministic lookup

Do not delete the existing company aliases. Preserve compatibility and avoid contradictory duplicate sources of truth.

### `resolution_decisions`

- input text and normalized input
- target entity type and resolved UUID
- deterministic/model/manual method
- confidence constrained to 0..1
- model-run/evidence reference where applicable
- accepted/rejected/overridden status
- reason and timestamps

### Connector and compatibility additions

Add only the connector fields required now:

- `trust_tier`
- `is_official`
- `independence_group`

Add `document_version_id` to the current archive and story-source compatibility path where needed. Preserve existing source URLs and API responses.

## 2. Database Security and Atomicity

- Enable RLS on all new tables.
- Revoke direct writes from `anon` and `authenticated`.
- Internal writes must be service-role-only.
- SECURITY DEFINER functions must use `SET search_path = ''`, fully qualify relations, revoke PUBLIC execution, and grant only the required role.
- Do not expose rights-restricted raw text through authenticated APIs or views.

Implement an atomic service-role-only database function that persists or reuses:

1. canonical source document;
2. immutable document version;
3. current `source_archive` queue row/link;
4. latest-version pointer.

Retries with the same connector, canonical URL, and content hash must return the same effective version and must not duplicate queue work.

Implement centralized claim/evidence creation and publication evaluation. It must reject:

- missing authenticated/service identity as applicable;
- invalid confidence ranges;
- out-of-range or reversed spans;
- excerpt/normalized-text mismatch;
- checksum mismatch;
- unsupported direct publication;
- publication with an active contradiction;
- duplicate dependent sources falsely counted as independent.

Preserve correction history; do not silently mutate the meaning of a published claim.

## 3. Deterministic Evidence Module

Create a cohesive module under `src/lib/intelligence/evidence/` or the closest existing project convention. It owns:

- URL canonicalization;
- stable SHA-256 hashing without truncating collision-critical identities;
- versioned text normalization;
- exact span discovery and validation;
- source-independence calculation;
- publication-policy evaluation;
- typed database payloads;
- bounded, rights-aware evidence responses.

Keep pure transformations separate from Supabase writes. Reuse Node standard-library functionality before adding dependencies.

## 4. Ingestion Compatibility

Update the fetch/archive path so every newly stored item receives a canonical document and immutable version through the atomic persistence function.

Requirements:

- Preserve existing RSS, HTML, and API connector behavior.
- Preserve R2 storage and rights checks.
- Preserve the `source_archive` processing queue during this checkpoint.
- Story clustering must retain `document_version_id` when creating source links.
- A failed evidence write is an ingestion failure, not a warning or successful item.
- An unchanged version is idempotent.
- A changed version appends history.

Do not add orchestration leases or retries in this checkpoint.

## 5. Funding Evidence Vertical Slice

Refactor funding extraction to use stored immutable document-version text. It must not fetch the public article URL again.

For amount, stage, announced date, and supported investor participation:

- return exact spans against original normalized text;
- create deterministic model-run metadata;
- create candidate claims and evidence;
- record resolution confidence;
- run the centralized publication evaluator;
- bind published claims to the exact funding-round or participant field;
- leave unsupported or conflicting fields candidate/unbound from published output.

A mere fund-name mention is still not evidence of participation. Preserve the existing regression behavior.

Do not represent an undisclosed amount as zero. Do not invent a span when the source text does not explicitly support the field.

## 6. Evidence Read Contract

Add one bounded server-side repository/API contract that retrieves evidence for a record and field in one query or RPC.

Return only:

- claim and publication state;
- display-safe value;
- source title/publisher/canonical URL;
- fetched/published dates;
- evidence excerpt when rights allow;
- span coordinates/checksum metadata;
- confidence, source count, and contradiction state;
- model/extractor version metadata safe for users.

Never return full restricted raw content, secrets, internal prompts, or service credentials.

## 7. Tests

Add behavior-focused tests for:

- canonical URL normalization;
- stable normalization and checksums;
- exact start-inclusive/end-exclusive spans;
- invalid/out-of-range/mismatched spans;
- unchanged-version idempotency;
- changed-version append/supersession;
- atomic payload and surfaced write failures;
- official-primary-source publication;
- two-independent-source publication;
- same independence group counting once;
- extraction confidence below 0.85;
- resolution confidence below 0.90;
- active contradiction blocking publication;
- candidate records excluded from published evidence lookup;
- correction/supersession history;
- rights-aware excerpts;
- current story ingestion and clustering compatibility;
- funding amount, stage, date, and participant bindings;
- investor mention not becoming participation;
- one complete deterministic funding trace.

Source-text/regex tests do not substitute for behavioral tests. If Docker is unavailable, clearly separate executable unit tests from unexecuted database integration tests. Do not silently skip or fake-pass unavailable integration coverage.

## 8. Performance and Indexing

Add indexes for:

- canonical document lookup;
- document/version content hashes;
- claim subject/type/status/effective time;
- evidence claim/version/stance;
- binding record type/ID/field;
- normalized aliases;
- resolution lookup and status.

Avoid N+1 evidence queries. Paginate/cap evidence lists and excerpts.

## 9. Documentation

- Update `supabase/schema.sql` to match the new migration.
- Update ADR-005 only where implementation details are now settled.
- Document normalization semantics, offset convention, automatic publication policy, rights-aware reads, and the exact manual hosted migration command.
- Do not rewrite unrelated product documents.

## Required Verification

Run:

```text
npm run typecheck
npm run lint
npm test -- --testPathIgnorePatterns="database-integration"
npm run build
```

Do not run destructive hosted resets. Do not run remote migrations. If Docker is unavailable, say so explicitly.

## Exit Gate

Checkpoint 1 is complete only when:

1. Exactly one new incremental migration exists after the applied baseline.
2. Existing news ingestion/clustering contracts remain green.
3. New content persists an immutable version idempotently.
4. Funding extraction consumes archived version text, never a second live fetch.
5. One deterministic fixture traces a funding field through binding, published claim, validated span, document version, R2/archive reference, and run metadata.
6. The conservative automatic-publication policy is centrally enforced.
7. Candidate/conflicting claims cannot leak into the published evidence contract.
8. All available health checks pass with honest executed/skipped counts.

## Final Response Format

1. Root causes corrected
2. Schema and migration created
3. Security and publication policy
4. Existing ingestion compatibility
5. End-to-end evidence trace example
6. Tests added and exact results
7. Files changed
8. Manual hosted migration commands
9. Remaining risks and explicit Checkpoint 2 handoff

Stop after Checkpoint 1. Do not begin pipeline orchestration, answer snapshots, admin UI, or visual redesign in this session.
