# Investments graph QA — 2026-10-05

Target: local `/api/investment-graph` response and Investments page. No production data was changed or used as a test fixture. The standard `.gstack/qa-reports` directory was not writable in this session, so this report is stored at the repository root.

## Contract outcomes

| Contract | Evidence | Result |
|---|---|---|
| UI reads canonical graph | `src/app/(dashboard)/investments/page.tsx` calls `/api/investment-graph`; migration defines the view from `funding_rounds` and `round_participants` | Pass; earlier audit claim about `/api/investments` corrected |
| Verified-only requires verified round **and** participant | Regression test failed before repair; active route now applies both filters | Pass (static contract) |
| Each investor participation has a distinct UI key, combined sources, and truthful verification | Synthetic mapper tests in `tests/investment-graph.regression-1.test.js` | Pass |
| Disclosed round value is not multiplied by investor count | Synthetic two-investor, one-round test | Pass |
| Build-time type contract | `tsc --noEmit --incremental false` | Pass |
| Native test suite | `jest --runInBand` | 14 suites, 45 tests passed |
| Production database behavior | No isolated database fixture or production write authorization used | Not run; requires a deployed build and verified graph rows |

## Remaining risk

The empty live Investments page is an upstream data gap: ingestion does not yet produce verified, company-linked funding evidence for extraction. The graph mapping repair prevents wrong IDs, missing participant citations, misleading verification badges, and double-counted page statistics once rows exist. It does not fabricate or backfill rounds.

The `round_participants` unique constraint includes nullable `fund_vehicle_id`; standard PostgreSQL uniqueness permits duplicate null-bearing keys. Audit existing rows and deploy a reviewed uniqueness migration before scheduling repeat extraction.
