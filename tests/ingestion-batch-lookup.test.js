const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadFetcher(supabase, feedItems) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/ingestion/rss-fetcher.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  class Parser {
    async parseURL() { return { items: feedItems }; }
  }
  vm.runInNewContext(compiled, {
    exports,
    require: (id) => {
      if (id === '@/lib/supabase/ingestion') return { ingestionSupabase: supabase };
      if (id === '@/lib/r2/client') return { generateR2Key: () => '', uploadToR2: async () => ({ success: true }) };
      if (id === 'rss-parser') return Parser;
      if (id === './feed-presentation') return { presentFeedItem: () => ({ imageUrl: null, excerpt: '' }) };
      return require(id);
    },
    console,
    Date,
    Set,
  });
  return exports;
}

describe('ingestion archive lookups', () => {
  it('checks existing hashes in bounded batches instead of one request per feed item', async () => {
    const items = Array.from({ length: 250 }, (_, index) => ({
      link: `https://example.com/${index}`,
      title: `Article ${index}`,
    }));
    let lookups = 0;
    const connector = {
      source_id: 'test-feed', status: 'approved', access_method: 'rss',
      notes: 'Feed: https://example.com/feed', reuse_permission: 'link_only',
    };
    const connectors = {
      select: () => connectors,
      eq: async () => ({ data: [connector], error: null }),
    };
    const archive = {
      select: () => archive,
      eq: () => archive,
      in: async (_column, hashes) => {
        lookups++;
        return { data: hashes.map(content_hash => ({ content_hash })), error: null };
      },
      maybeSingle: async () => {
        lookups++;
        return { data: { id: 'existing' }, error: null };
      },
    };
    const { runIngestionForSource } = loadFetcher({
      from: table => table === 'source_connectors' ? connectors : archive,
    }, items);

    const result = await runIngestionForSource('test-feed');
    expect(result.success).toBe(true);
    expect(result.items_updated).toBe(250);
    expect(lookups).toBeLessThanOrEqual(3);
  });

  it('inserts a repeated item only once within the same feed response', async () => {
    let inserts = 0;
    const connector = {
      source_id: 'test-feed', status: 'approved', access_method: 'rss',
      notes: 'Feed: https://example.com/feed', reuse_permission: 'link_only',
    };
    const connectors = {
      select: () => connectors,
      eq: async () => ({ data: [connector], error: null }),
    };
    const archive = {
      select: () => archive,
      eq: () => archive,
      in: async () => ({ data: [], error: null }),
      insert: async () => { inserts++; return { error: null }; },
    };
    const item = { link: 'https://example.com/one', title: 'One' };
    const { runIngestionForSource } = loadFetcher({
      from: table => table === 'source_connectors' ? connectors : archive,
    }, [item, item]);

    const result = await runIngestionForSource('test-feed');
    expect(result.success).toBe(true);
    expect(result.items_new).toBe(1);
    expect(result.items_updated).toBe(1);
    expect(inserts).toBe(1);
  });
});
