const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadClustering(supabase = {
  from: () => ({
    select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }),
  }),
}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/ingestion/story-clustering.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (id) => id === '@/lib/supabase/ingestion'
      ? { ingestionSupabase: supabase }
      : require(id),
    console, Date, Set, Map,
  });
  return exports;
}

// Regression: ISSUE-002 — funding stories were saved without entity links.
// Found by /qa on 2026-10-05.
// Report: AUDIT_REMEDIATION.md
describe('story clustering entity links', () => {
  const entities = {
    companies: [
      { id: 'company-1', canonical_name: 'Acme AI' },
      { id: 'company-2', canonical_name: 'Acme' },
    ],
    funds: [{ id: 'fund-1', canonical_name: 'Northstar Ventures' }],
  };

  it('links the longest exact company name and a mentioned fund without promoting verification', async () => {
    const { clusterStories } = loadClustering();
    const clusters = await clusterStories([{
      url: 'https://publisher.example/acme-round',
      source_id: 'publisher',
      raw_content: 'Northstar Ventures joined the funding round.',
      metadata: { title: 'Acme AI raises a Series A' },
    }], entities);

    expect(clusters[0].companies).toEqual([{ company_id: 'company-1', role: 'primary' }]);
    expect(clusters[0].investors).toEqual([{ fund_id: 'fund-1', role: 'mentioned' }]);
    expect(clusters[0].verification_label).toBe('unverified');
  });

  it('does not match a company name embedded inside a different word', async () => {
    const { clusterStories } = loadClustering();
    const clusters = await clusterStories([{
      url: 'https://publisher.example/other-round',
      source_id: 'publisher',
      raw_content: 'An unrelated announcement.',
      metadata: { title: 'Superacme raises a Series A' },
    }], entities);

    expect(clusters[0].companies).toEqual([]);
    expect(clusters[0].investors).toEqual([]);
  });

  it('leaves duplicate company names unresolved instead of choosing an arbitrary ID', async () => {
    const { clusterStories } = loadClustering();
    const clusters = await clusterStories([{
      url: 'https://publisher.example/acme-round', source_id: 'publisher',
      raw_content: '', metadata: { title: 'Acme AI raises a Series A' },
    }], { companies: [
      { id: 'company-1', canonical_name: 'Acme AI' },
      { id: 'company-duplicate', canonical_name: 'Acme AI' },
    ], funds: [] });

    expect(clusters[0].companies).toEqual([]);
  });

  it('persists entity and source links before acknowledging the archive item', async () => {
    const links = [];
    let acknowledged = false;
    const archive = {
      select: () => archive, eq: () => archive,
      limit: async () => ({ data: [{
        id: 'archive-1', source_id: 'publisher', url: 'https://publisher.example/acme-round',
        raw_content: 'Northstar Ventures joined the round.',
        metadata: { title: 'Acme AI raises a Series A' },
      }], error: null }),
      update: () => archive,
      in: async () => { acknowledged = true; return { error: null }; },
    };
    const story = {
      select: () => story, order: () => story,
      limit: async () => ({ data: [], error: null }),
      upsert: () => story,
      single: async () => ({ data: { id: 'story-1' }, error: null }),
    };
    const catalog = (data) => ({
      select: () => catalog(data), order: () => catalog(data),
      range: async () => ({ data, error: null }),
    });
    const linkTable = (table) => ({
      upsert: async (row) => { links.push({ table, row }); return { error: null }; },
    });
    const supabase = { from: (table) => {
      if (table === 'source_archive') return archive;
      if (table === 'stories') return story;
      if (table === 'companies') return catalog(entities.companies);
      if (table === 'funds') return catalog(entities.funds);
      return linkTable(table);
    } };
    const { runStoryClustering } = loadClustering(supabase);

    await expect(runStoryClustering()).resolves.toBe(1);
    expect(links).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'story_companies', row: expect.objectContaining({ company_id: 'company-1', role: 'primary' }) }),
      expect.objectContaining({ table: 'story_investors', row: expect.objectContaining({ fund_id: 'fund-1', role: 'mentioned' }) }),
      expect.objectContaining({ table: 'story_sources', row: expect.objectContaining({ source_url: 'https://publisher.example/acme-round' }) }),
    ]));
    expect(acknowledged).toBe(true);
  });
});
