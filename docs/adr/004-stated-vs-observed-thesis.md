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

## Extraction Pipeline (Future)
- Stated: LLM with schema-bound extraction → attributable claims → human review → publish
- Observed: Deterministic computation on verified `fund_portfolio` + `investments`
- Version history for both types

## Consequences
- Zero stated theses from non-official sources
- Clear labeling in UI: "Stated" vs "Observed (inferred)"
- Audit trail: extraction methodology, period, sample, confidence
- Prevents "investor said X" when they only did X

## Implementation Files
- Existing: `supabase/schema.sql` tables `stated_thesis`, `observed_thesis`
- Future: `src/lib/ingestion/thesis-extractor.ts` rewrite for attributable claims
- API: New comparison endpoint