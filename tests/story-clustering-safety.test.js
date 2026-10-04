const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

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
  it('retains new source attribution when a story matches an existing story', async () => {
    const headline = 'Company raises a large funding round for AI infrastructure';
    const summary = 'Company raises a large funding round for AI infrastructure today';
    const existing = {
      canonical_url: 'https://a.example/story', headline, summary,
      source_count: 1, source_urls: ['https://a.example/story'],
      supporting_sources: ['source-a'],
    };
    const query = {
      select: () => query,
      order: () => query,
      limit: async () => ({ data: [existing], error: null }),
    };
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
    const query = {
      select: () => query,
      order: () => query,
      limit: async () => ({ data: [existing], error: null }),
    };
    const { clusterStories } = loadClustering({ from: () => query });
    const clusters = await clusterStories([{
      url: 'https://a.example/story', source_id: 'source-a',
      raw_content: '', metadata: { title: 'Updated headline' },
    }]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].headline).toBe('Existing headline');
    expect(clusters[0].source_count).toBe(1);
  });

  it('never acknowledges archive rows when story persistence fails', async () => {
    let acknowledged = false;
    const archive = {
      select: () => archive,
      eq: () => archive,
      limit: async () => ({ data: [{
        id: 'archive-1', source_id: 'source-a', url: 'https://a.example/new',
        raw_content: 'A new AI infrastructure announcement',
        metadata: { title: 'A new AI infrastructure announcement' },
      }], error: null }),
      update: () => { acknowledged = true; return archive; },
      in: async () => ({ error: null }),
    };
    const stories = {
      select: () => stories,
      order: () => stories,
      limit: async () => ({ data: [], error: null }),
      upsert: () => stories,
      single: async () => ({ data: null, error: { message: 'database unavailable' } }),
    };
    const { runStoryClustering } = loadClustering({
      from: (table) => table === 'source_archive' ? archive : stories,
    });

    await expect(runStoryClustering()).rejects.toThrow('database unavailable');
    expect(acknowledged).toBe(false);
  });
});
