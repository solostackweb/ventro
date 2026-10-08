# ADR-004: Stated Versus Observed Thesis Records

## Status
Accepted

## Date
2026-10-05

## Context
Investor theses come from two fundamentally different sources:
1. **Stated**: Official public statements (blog posts, interviews, podcasts, SEC filings)
2. **Observed**: Inferred from actual investment behavior (portfolio clustering)

These must NEVER be conflated. Presenting inferred behavior as the investor's own words is misleading.

## Decision
Two separate tables with clear type distinction:

### Stated Thesis (`stated_thesis`)
- Extracted from attributable source spans with exact evidence
- Fields: `fund_id`, `text`, `source_url`, `source_type`, `date_stated`, `extracted_at`
- Source types: `blog`, `interview`, `podcast`, `twitter`, `sec_filing`, `other`
- Each excerpt linked to exact source location (future: evidence spans)

### Observed Thesis (`observed_thesis`)
- Computed from verified investments over explicit time windows
- Fields: `fund_id`, `methodology`, `period_start`, `period_end`, `sample_size`, `themes` (JSONB), `confidence`, `caveats`
- `themes`: `[{"theme": "...", "company_count": N, "deal_count": N, "percentage": N}]`
- Confidence: `high`/`medium`/`low` based on sample size, source independence, recency
- Explicitly labeled as inference in ALL UI

## Comparison View
- API provides `/api/funds/:id/thesis/comparison` endpoint
- Shows stated excerpts alongside observed themes
- Coverage caveats: "Based on X investments over Y period; Z% of portfolio"
- Never claims contradiction when coverage incomplete

## Extraction Pipeline (Checkpoint 3)
- Stated: only published `thesis_statement` claims with exact evidence spans from official source connectors are materialized into `thesis_records`.
- Observed: deterministic theme computation uses verified rounds that themselves have published claim evidence.
- Both kinds use input fingerprints, confidence/coverage fields, caveats, theme-change summaries, normalized claim links, and supersession history.
- Automatic publication is evidence-policy driven; it does not depend on routine manual approval.

## Consequences
- Zero stated theses from non-official sources
- Clear labeling in UI: "Stated" vs "Observed (inferred)"
- Audit trail: extraction methodology, period, sample, confidence
- Prevents "investor said X" when they only did X

## Implementation Files
- Legacy compatibility: `stated_thesis` and `observed_thesis` remain for existing pages.
- Canonical intelligence history: `thesis_records` and `thesis_record_claims`.
- Materializer: `src/lib/intelligence/answers/thesis-materializer.ts`.
- Answer APIs keep stated and observed sections visibly separate.
