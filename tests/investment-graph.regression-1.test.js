const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function loadGraphHelpers() {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/lib/utils/investment-graph.ts'), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const compiledModule = { exports: {} };
  new Function('exports', 'module', output)(compiledModule.exports, compiledModule);
  return compiledModule.exports;
}

const baseRow = {
  round_id: 'round-1', company_id: 'company-1', company_name: 'Acme', company_domain: 'acme.test',
  company_ai_tags: ['infrastructure'], company_country: 'US', yc_batch: null,
  announced_date: '2026-10-01', round_stage: 'seed', amount_usd: 10000000, amount_currency: 'USD',
  round_verification: 'verified', fund_id: 'fund-1', fund_name: 'Fund One', firm_type: 'vc',
  fund_vehicle_id: null, vehicle_name: null, vintage_year: null, participant_role: 'lead',
  participant_verification: 'partial', participant_sources: ['https://fund.test/deal'],
  round_sources: ['https://company.test/round', 'https://fund.test/deal'],
};

// Regression: ISSUE-001 — graph rows represent investor participations, not unique rounds.
// Found by /qa on 2026-10-05.
// Report: AUDIT_REMEDIATION.md
describe('investment graph response contract', () => {
  it('requires both round and participant verification for verified-only results', () => {
    const route = fs.readFileSync(
      path.resolve(__dirname, '../src/app/api/investment-graph/route.ts'),
      'utf8'
    );
    expect(route).toContain(".eq('participant_verification', 'verified')");
  });

  it('maps graph rows through the shared participation normalizer', () => {
    const route = fs.readFileSync(
      path.resolve(__dirname, '../src/app/api/investment-graph/route.ts'),
      'utf8'
    );
    expect(route).toContain('mapInvestmentGraphRow');
  });

  it('gives each investor participation a distinct ID and includes both source sets', () => {
    const { mapInvestmentGraphRow } = loadGraphHelpers();
    const first = mapInvestmentGraphRow(baseRow);
    const second = mapInvestmentGraphRow({ ...baseRow, fund_id: 'fund-2' });
    expect(first.id).not.toBe(second.id);
    expect(first.round_id).toBe(second.round_id);
    expect(first.verification_status).toBe('partial');
    expect(first.source_urls).toEqual(['https://company.test/round', 'https://fund.test/deal']);
  });

  it('counts a disclosed round once when it has multiple investors', () => {
    const { mapInvestmentGraphRow, summarizeVisibleInvestments } = loadGraphHelpers();
    const rows = [baseRow, { ...baseRow, fund_id: 'fund-2', participant_verification: 'verified' }]
      .map(mapInvestmentGraphRow);
    expect(summarizeVisibleInvestments(rows)).toEqual({
      verifiedParticipations: 1,
      disclosedRoundValueUsd: 10000000,
      uniqueCompanies: 1,
    });
  });
});
