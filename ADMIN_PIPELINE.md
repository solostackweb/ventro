# Ventro admin and verification pipeline

This describes the intended operating contract and the current implementation as of 2026-10-05. It is not a claim that all review stages are built.

## End-to-end flow

| Stage | Admin sees and controls | Public result |
|---|---|---|
| 1. Source registry | Approve/pause connectors, permission to reuse text, cadence, last success, failures, yield | None until ingestion succeeds |
| 2. Collection | Fetch log, URL, original publication time, content rights, image URL, source excerpt, backlog | A cited news item can appear, labelled unverified |
| 3. Deduplication and entity matching | Clustered articles, independent source count, tentative company/fund matches and ambiguities | Story page and original source links; tentative mentions are not investments |
| 4. Story verification | Review original URLs, material claim, date, primary evidence, contradictions and named entities | `verified`, `partial`, `unverified`, or `conflicted` claim state |
| 5. Funding review | Confirm company, amount/currency, stage/date, each fund's role, supporting URL and conflicting reports | One canonical round and separately reviewed participation edges |
| 6. Investor intelligence | Inspect cited rounds and official thesis excerpts; compare stated versus observed thesis, sample size and caveats | Investor profile answers where a firm invests and what it says it seeks |
| 7. Pattern publication | Inspect time window, baseline, qualifying events, counterexamples and source coverage | Published patterns only, with linked evidence; gaps and hypotheses remain explicitly tentative |
| 8. Operations | Job health, backlog, stage counts, spend/tokens, review queue, reviewer history and corrections | Clear freshness and insufficient-data states |

## Required review contract

- A connector's approval is permission to ingest, **not** verification of its claims. A second article from the same publisher is not an independent source.
- Entity-name matching yields `primary` or `mentioned` candidates. A fund mention must never become a round participant without an explicit reviewed `lead` or `participant` decision.
- Review must happen through an authenticated server endpoint or database function that checks `user_profiles.role = 'admin'`. The decision must atomically record reviewer ID, timestamp, previous/new state, reason, evidence URLs and any corrected fields. A second reviewer or correction path is needed for disputed high-impact claims.
- Story, funding round, and each participant have separate decisions. Approving a round alone must not silently approve its investors. Reject/conflict states do not enter `investment_graph`.
- Official stated thesis needs its exact quoted source and date; observed thesis needs cited portfolio rounds, sample size, period, and counterexamples. Pattern publication requires a second review after computation.
- Public UI must distinguish `source excerpt` from a complete-article summary, and source verification from claim verification. A missing excerpt or image is a legitimate state, not a reason to invent either.

## Current code versus missing work

Present locally: approved-source ingestion and fetch logs; source archive; story clustering; exact-name entity links; cited source URLs; preliminary story verification labels; funding/participant schema and graph; stated/observed thesis and pattern extractors; an admin page and a review-page shell.

Not complete: a claim-level verification job; independent-source/contradiction checks; a server-side review queue with atomic decisions and audit history; reviewed investor-role assignment; safe extraction scheduling; nullable participant uniqueness repair; thesis review states; pattern evidence/publishing controls; job-stage and cost dashboards. New stories remain `unverified`, so merely running ingestion does **not** populate the investment graph.

The current review page is not authoritative. It reads through the browser client, while row-level security hides unverified funding rounds and candidate patterns; it also writes directly from the browser and routes stated-thesis actions to `observed_thesis`. Do not use its Publish/Reject/Correct controls as the production review mechanism until replaced with server-checked, audited transitions.

## Manual rollout order (later)

1. Apply and verify database migrations, beginning with story presentation fields. Check the database version and audit duplicate nullable `round_participants` keys before changing that constraint.
2. Re-run bounded ingestion, drain the archive backlog, then backfill images/excerpts/entity links for already-processed stories without changing verification labels.
3. Build/test the server review queue and audit log. Review sample stories and participant roles against original sources.
4. Only then enable bounded funding extraction. Confirm the same round ID appears in Investments, company timeline, and investor portfolio. Continue to thesis/pattern jobs only when cited graph coverage is sufficient.

## Directory presentation standard

News card: image when supplied by a permitted source, headline, dated publisher, clearly labelled excerpt or article summary, verification state, original link. Full-article summaries require a separate authorized fetch-and-summarize stage; RSS snippets alone do not meet that standard.

Company/investor pages: verified identity and canonical website, logo or source-licensed image, concise cited description, dated events, funding rounds, investor/portfolio relationships, source links, freshness, coverage gaps and explicit unknown values. Investment views must use canonical round/participant records and show amount provenance and role, not decorative completeness or uncited totals.
