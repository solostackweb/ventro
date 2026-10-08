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

function loadClustering(supabase) {
  const file = path.join(__dirname, '../src/lib/ingestion/story-clustering.ts');
  const source = fs.readFileSync(file, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (id) => id === '@/lib/supabase/ingestion'
      ? { ingestionSupabase: supabase }
      : require(id),
    console,
    Date,
    Set,
    Map,
  });
  return exports;
}

describe('story clustering data safety', () => {
  it('derives verification from official and independent source evidence', () => {
    const { deriveStoryVerification } = loadClustering({ from: jest.fn() });
    const profiles = [
      { source_id: 'official-a', is_official: true, independence_group: 'official.example' },
      { source_id: 'press-a', is_official: false, independence_group: 'press-a.example' },
      { source_id: 'press-b', is_official: false, independence_group: 'press-b.example' },
    ];
    expect(deriveStoryVerification(['official-a'], profiles)).toBe('verified');
    expect(deriveStoryVerification(['press-a', 'press-b'], profiles)).toBe('verified');
    expect(deriveStoryVerification(['press-a'], profiles)).toBe('partial');
    expect(deriveStoryVerification(['unknown'], profiles)).toBe('unverified');
  });

  it('only promotes investor roles when the story uses explicit participation language', () => {
    const { classifyInvestorRole } = loadClustering({ from: jest.fn() });
    expect(classifyInvestorRole('The round was led by Northstar Ventures.', 'Northstar Ventures')).toBe('lead');
    expect(classifyInvestorRole('Northstar Ventures joined the financing.', 'Northstar Ventures')).toBe('participant');
    expect(classifyInvestorRole('The founder previously worked with Northstar Ventures.', 'Northstar Ventures')).toBe('mentioned');
  });

  it('retains new source attribution when a story matches an existing story', async () => {
    const headline = 'Company raises a large funding round for AI infrastructure';
    const summary = 'Company raises a large funding round for AI infrastructure today';
    const existing = {
      canonical_url: 'https://a.example/story', headline, summary,
      source_count: 1, source_urls: ['https://a.example/story'],
      supporting_sources: ['source-a'],
    };
    const query = createQueryBuilder([existing]);
    const { clusterStories } = loadClustering({ from: () => query });
    const clusters = await clusterStories([{
      url: 'https://b.example/story', source_id: 'source-b',
      raw_content: summary, metadata: { title: headline },
    }]);

    expect(clusters).toHaveLength(1);
    expect(Array.from(clusters[0].source_urls)).toEqual(['https://a.example/story', 'https://b.example/story']);
    expect(clusters[0].source_count).toBe(2);
  });

  it('reuses the existing story for the same URL even without stored article text', async () => {
    const existing = {
      canonical_url: 'https://a.example/story', headline: 'Existing headline', summary: '',
      source_count: 1, source_urls: ['https://a.example/story'], supporting_sources: ['source-a'],
    };
    const query = createQueryBuilder([existing]);
    const { clusterStories } = loadClustering({ from: () => query });
    const clusters = await clusterStories([{
      url: 'https://a.example/story', source_id: 'source-a',
      raw_content: '', metadata: { title: 'Updated headline' },
    }]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].headline).toBe('Existing headline');
    expect(clusters[0].source_count).toBe(1);
  });

  it('does not inspect expensive article text when headlines cannot meet the deduplication threshold', async () => {
    const existing = {
      canonical_url: 'https://a.example/story', headline: 'Completely unrelated market update',
      get summary() { throw new Error('content similarity should not run'); },
      source_count: 1, source_urls: ['https://a.example/story'], supporting_sources: ['source-a'],
    };
    const query = createQueryBuilder([existing]);
    const { clusterStories } = loadClustering({ from: () => query });

    await expect(clusterStories([{
      url: 'https://b.example/story', source_id: 'source-b', raw_content: 'A long article body',
      metadata: { title: 'New foundation model launches today' },
    }])).resolves.toHaveLength(1);
  });

  it('never acknowledges archive rows when story persistence fails', async () => {
    let acknowledged = false;
    const archive = createQueryBuilder([{
      id: 'archive-1', source_id: 'source-a', url: 'https://a.example/new',
      raw_content: 'A new AI infrastructure announcement',
      metadata: { title: 'A new AI infrastructure announcement' },
    }]);
    archive.update = () => { acknowledged = true; return archive; };
    
    const stories = createQueryBuilder([]);
    stories.upsert = () => stories;
    stories.single = async () => ({ data: null, error: { message: 'database unavailable' } });
    
    const catalog = createQueryBuilder([]);
    const { runStoryClustering } = loadClustering({
      from: (table) => table === 'source_archive' ? archive
        : table === 'companies' || table === 'funds' ? catalog : stories,
    });

    await expect(runStoryClustering()).rejects.toThrow('database unavailable');
    expect(acknowledged).toBe(false);
  });

  it('persists a source matched to a database story without transient entity arrays', async () => {
    let acknowledged = false;
    const archive = createQueryBuilder([{
      id: 'archive-1', source_id: 'source-a', url: 'https://a.example/story',
      raw_content: '', metadata: { title: 'Existing headline' },
    }]);
    archive.update = () => archive;
    archive.in = () => archive;
    archive.eq = () => { acknowledged = true; return archive; };
    
    const stories = createQueryBuilder([{
      id: 'story-1', canonical_url: 'https://a.example/story',
      headline: 'Existing headline', summary: '', source_count: 1,
      source_urls: ['https://a.example/story'], supporting_sources: ['source-a'],
    }]);
    stories.upsert = () => stories;
    stories.single = async () => ({ data: { id: 'story-1' }, error: null });
    
    const sourceLinks = { upsert: async () => ({ error: null }) };
    const catalog = createQueryBuilder([]);
    const { runStoryClustering } = loadClustering({
      from: (table) => table === 'source_archive' ? archive
        : table === 'story_sources' ? sourceLinks
          : table === 'companies' || table === 'funds' ? catalog : stories,
    });

    await expect(runStoryClustering()).resolves.toBe(1);
    expect(acknowledged).toBe(true);
  });
});
