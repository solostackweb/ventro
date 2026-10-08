const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function createQueryBuilder(data, error = null) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    upsert: () => builder,
    update: () => builder,
    single: async () => ({ data, error }),
    maybeSingle: async () => ({ data, error }),
    rpc: async () => ({ data: null, error: null }),
    then: (onFulfilled) => Promise.resolve({ data, error }).then(onFulfilled),
  };
  
  builder.limit = async () => ({ data, error });
  builder.range = async () => ({ data, error });
  builder.single = async () => ({ data, error });
  builder.maybeSingle = async () => ({ data, error });
  builder.in = () => builder;
  builder.rpc = async () => ({ data: null, error: null });
  builder.update = () => builder;
  builder.then = (onFulfilled) => Promise.resolve({ data, error }).then(onFulfilled);
  
  return builder;
}

function loadClustering(supabase = {
  from: () => createQueryBuilder([]),
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

const entities = {
  companies: [
    { id: 'company-1', canonical_name: 'Acme AI' },
    { id: 'company-2', canonical_name: 'Acme' },
  ],
  funds: [{ id: 'fund-1', canonical_name: 'Northstar Ventures' }],
};

describe('story clustering entity links', () => {
  it('links the longest exact company name and an explicitly participating fund without promoting verification', async () => {
    const { clusterStories } = loadClustering();
    const clusters = await clusterStories([{
      url: 'https://publisher.example/acme-round',
      source_id: 'publisher',
      raw_content: 'Northstar Ventures joined the funding round.',
      metadata: { title: 'Acme AI raises a Series A' },
    }], entities);

    expect(clusters[0].companies).toEqual([{ company_id: 'company-1', role: 'primary' }]);
    expect(clusters[0].investors).toEqual([{ fund_id: 'fund-1', role: 'participant' }]);
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
    const archive = createQueryBuilder([{
      id: 'archive-1', source_id: 'publisher', url: 'https://publisher.example/acme-round',
      raw_content: 'Northstar Ventures joined the round.',
      metadata: { title: 'Acme AI raises a Series A' },
    }]);
    archive.update = () => archive;
    archive.in = () => archive;
    archive.eq = () => { acknowledged = true; return archive; };
    
    const story = createQueryBuilder([]);
    story.upsert = () => story;
    story.single = async () => ({ data: { id: 'story-1' }, error: null });
    
    const catalog = (data) => createQueryBuilder(data);
    const linkTable = (table) => ({
      upsert: async (row) => { links.push({ table, row }); return { error: null }; },
    });
    const supabase = { from: (table) => {
      if (table === 'source_archive') return archive;
      if (table === 'stories') return story;
      if (table === 'companies') return catalog(entities.companies);
      if (table === 'funds') return catalog(entities.funds);
      if (table === 'source_connectors') return catalog([]);
      return linkTable(table);
    } };
    const { runStoryClustering } = loadClustering(supabase);

    await expect(runStoryClustering()).resolves.toBe(1);
    expect(links).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'story_companies', row: expect.objectContaining({ company_id: 'company-1', role: 'primary' }) }),
      expect.objectContaining({ table: 'story_investors', row: expect.objectContaining({ fund_id: 'fund-1', role: 'participant' }) }),
      expect.objectContaining({ table: 'story_sources', row: expect.objectContaining({ source_url: 'https://publisher.example/acme-round' }) }),
    ]));
    expect(acknowledged).toBe(true);
  });
});
