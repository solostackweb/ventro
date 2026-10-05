# Ingestion-to-funding QA, 2026-10-05

Scope: local story clustering and funding extraction only. No production database or external API was mutated.

| Issue | Before | After | Verification |
|---|---|---|---|
| ISSUE-002: no entity links | A funding headline produced `companies: []` and `investors: []`; archived items therefore could not supply a company to extraction. | Exact, unambiguous headline company names become `primary` links. Fund name matches become `mentioned` links only. Archive acknowledgement remains after persistence. | New regression failed before repair, then passed; clustering safety tests passed. |
| ISSUE-003: relation shape and unsafe investor promotion | A linked company read as `companies[0]` became `Unknown`; any fund name anywhere in article text became a participant. | Many-to-one relation objects are read correctly. Only explicit `lead`/`participant` associations create participation edges. | Two new regressions failed before repair, then passed. |

Local final checks: 16 Jest suites / 51 tests passed; TypeScript `--noEmit --incremental false` passed. No live ingestion or database round-trip was run.

Remaining: new stories stay `unverified`; there is no claim review/promotion stage, and funding extraction is not scheduled. The nullable `fund_vehicle_id` uniqueness defect still needs a reviewed migration and duplicate audit before automatic extraction. Existing production rows are not backfilled by these code changes alone.
