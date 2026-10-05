const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadExtractor(supabase) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/ingestion/funding-extractor.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (id) => id === '@/lib/supabase/ingestion'
      ? { ingestionSupabase: supabase }
      : id === 'jsdom' ? { JSDOM: class {} } : require(id),
    fetch: async () => ({ ok: false }), AbortSignal,
    console, Date, Set, Map,
  });
  return exports;
}

function fixture(investorRole) {
  const writes = { rounds: [], participants: [] };
  const funds = [{ id: 'fund-1', canonical_name: 'Northstar Ventures' }];
  const companies = [{ id: 'company-1', canonical_name: 'Acme AI', canonical_domain: 'acme.test' }];
  const stories = [{
    id: 'story-1', headline: 'Acme AI raises a Series A',
    summary: 'Northstar Ventures was an earlier backer, not in this round.',
    event_date: '2026-10-01T00:00:00Z', verification_label: 'partial',
    source_urls: ['https://publisher.example/acme-round'], story_sources: [],
    story_companies: [{ company_id: 'company-1', companies: { canonical_name: 'Acme AI' } }],
    story_investors: [{ fund_id: 'fund-1', role: investorRole,
      funds: { canonical_name: 'Northstar Ventures' } }],
  }];
  const supabase = { from: (table) => {
    if (table === 'funds' || table === 'companies') return {
      select: async () => ({ data: table === 'funds' ? funds : companies, error: null }),
    };
    if (table === 'stories') {
      const query = { select: () => query, eq: () => query, in: () => query,
        order: () => query, limit: async () => ({ data: stories, error: null }) };
      return query;
    }
    if (table === 'funding_rounds') {
      const query = { upsert: (row) => { writes.rounds.push(row); return query; },
        select: () => query, single: async () => ({ data: { id: 'round-1' }, error: null }),
        update: () => query, eq: async () => ({ error: null }) };
      return query;
    }
    if (table === 'round_participants') return {
      upsert: async (row) => { writes.participants.push(row); return { error: null }; },
    };
    throw new Error(`Unexpected table: ${table}`);
  } };
  return { writes, extractFundingEvents: loadExtractor(supabase).extractFundingEvents };
}

// Regression: ISSUE-003 — object-shaped relations discarded funding stories; mentions became investments.
// Found by /qa on 2026-10-05.
// Report: AUDIT_REMEDIATION.md
describe('funding extraction association safety', () => {
  it('uses a linked company from a many-to-one relation and does not turn a mention into a participation', async () => {
    const { writes, extractFundingEvents } = fixture('mentioned');
    await extractFundingEvents();
    expect(writes.rounds).toHaveLength(1);
    expect(writes.rounds[0].company_id).toBe('company-1');
    expect(writes.participants).toHaveLength(0);
  });

  it('persists a participant only when its story association is explicitly reviewed as a lead', async () => {
    const { writes, extractFundingEvents } = fixture('lead');
    await extractFundingEvents();
    expect(writes.participants).toHaveLength(1);
    expect(writes.participants[0].fund_id).toBe('fund-1');
    expect(writes.participants[0].role).toBe('lead');
  });
});
