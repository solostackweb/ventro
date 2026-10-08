const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const mockJSDOM = function() {
  this.window = {
    document: {
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
      textContent: '',
    },
  };
};

function createQueryBuilder(data, error) {
  const builder = {
    select: function() { return builder; },
    eq: function() { return builder; },
    in: function(column, values) { return builder; },
    order: function() { return builder; },
    limit: function() { return builder; },
    range: function() { return builder; },
    upsert: function() { return builder; },
    update: function() { return builder; },
    single: function() { return Promise.resolve({ data: data, error: error }); },
    maybeSingle: function() { return Promise.resolve({ data: data, error: error }); },
    rpc: function() { return Promise.resolve({ data: null, error: null }); },
    then: function(onFulfilled) { return Promise.resolve({ data: data, error: error }).then(onFulfilled); },
  };
  
  builder.limit = function() { return Promise.resolve({ data: data, error: error }); };
  builder.range = function() { return Promise.resolve({ data: data, error: error }); };
  builder.single = function() { return Promise.resolve({ data: data, error: error }); };
  builder.maybeSingle = function() { return Promise.resolve({ data: data, error: error }); };
  builder.in = function(column, values) { return builder; };
  builder.rpc = function() { return Promise.resolve({ data: null, error: null }); };
  builder.update = function() { return builder; };
  builder.upsert = function() { return builder; };
  builder.select = function() { return builder; };
  builder.then = function(onFulfilled) { return Promise.resolve({ data: data, error: error }).then(onFulfilled); };
  
  return builder;
}

function loadFetcher(supabase, feedItems) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/ingestion/rss-fetcher.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  const Parser = function() {
    this.parseURL = function() { return Promise.resolve({ items: feedItems }); };
  }
  vm.runInNewContext(compiled, {
    exports: exports,
    require: function(id) {
      if (id === '@/lib/supabase/ingestion') return { ingestionSupabase: supabase };
      if (id === '@/lib/r2/client') return { generateR2Key: function() { return ''; }, uploadToR2: function() { return Promise.resolve({ success: true }); } };
      if (id === 'rss-parser') return function() { this.parseURL = function() { return Promise.resolve({ items: feedItems }); }; };
      if (id === './feed-presentation') return { presentFeedItem: function() { return { imageUrl: null, excerpt: '' }; } };
      if (id === 'jsdom') return { JSDOM: mockJSDOM };
      if (id === 'crypto') return require('crypto');
      if (id === '@/lib/intelligence/evidence/with-repository') {
        return {
          evidenceCore: {
            canonicalizeUrl: function(url) {
              try {
                const u = new URL(url);
                u.protocol = 'https:';
                u.hostname = u.hostname.replace(/^www\./, '');
                if ((u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80')) {
                  u.port = '';
                }
                const trackingParams = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref', 'source']);
                const paramsToDelete = [];
                u.searchParams.forEach(function(_, key) {
                  if (trackingParams.has(key.toLowerCase())) paramsToDelete.push(key);
                });
                for (const key of paramsToDelete) u.searchParams.delete(key);
                const sortedParams = Array.from(u.searchParams.entries()).sort(function([a], [b]) { return a.localeCompare(b); });
                u.search = '';
                for (let i = 0; i < sortedParams.length; i++) {
                  u.searchParams.append(sortedParams[i][0], sortedParams[i][1]);
                }
                u.hash = '';
                if (u.pathname !== '/' && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
                const canonicalUrl = u.toString();
                const crypto = require('crypto');
                const urlHash = crypto.createHash('sha256').update(canonicalUrl).digest('hex');
                const domain = u.hostname;
                return { canonicalUrl: canonicalUrl, urlHash: urlHash, domain: domain };
              } catch (e) {
                const crypto = require('crypto');
                return { canonicalUrl: url, urlHash: crypto.createHash('sha256').update(url).digest('hex'), domain: '' };
              }
            },
            normalizeText: function(text) {
              let t = text || '';
              t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
              t = t.replace(/[\u200B-\u200D\uFEFF]/g, '');
              t = t.replace(/\s+/g, ' ');
              t = t.trim();
              const crypto = require('crypto');
              const checksum = crypto.createHash('sha256').update(t).digest('hex');
              return { normalizedText: t, checksum: checksum };
            },
            computeContentHash: function(input) {
              const crypto = require('crypto');
              return crypto.createHash('sha256').update(input || '').digest('hex');
            },
            NORMALIZATION_VERSION: 1,
            repository: {
              persistDocumentVersion: function(input) {
                return supabase.rpc('persist_document_version', input).then(function(result) {
                  if (result.error) {
                    throw new Error('persist_document_version failed: ' + result.error.message);
                  }
                  const data = result.data ? result.data[0] : null;
                  if (!data) {
                    throw new Error('persist_document_version returned no result');
                  }
                  return {
                    sourceDocumentId: data.source_document_id,
                    documentVersionId: data.document_version_id,
                    archiveId: data.archive_id,
                    isNewVersion: data.is_new_version,
                  };
                });
              },
            },
          },
        };
      }
      if (id.startsWith('@exodus') || id === 'html-encoding-sniffer') {
        return {};
      }
      return require(id);
    },
    console: console,
    Date: Date,
    Set: Set,
    Map: Map,
    TextEncoder: require('util').TextEncoder,
    TextDecoder: require('util').TextDecoder,
  });
  return exports;
}

function makeInFunction(batchQueriesRef) {
  return function(column, values) {
    batchQueriesRef.count++;
    return Promise.resolve({
      data: values.map(function(v) { return { content_hash: v }; }),
      error: null
    });
  };
}

function createArchiveMock(batchQueriesRef, preloadedHashes) {
  const preloaded = preloadedHashes || new Set();
  let pendingValues = null;
  const builder = {
    select: function() { return builder; },
    eq: function() { return builder; },
    in: function(column, values) {
      pendingValues = values;
      batchQueriesRef.count++;
      return builder;
    },
    then: function(onFulfilled) {
      const data = pendingValues 
        ? pendingValues.filter(function(v) { return preloaded.has(v); }).map(function(v) { return { content_hash: v }; })
        : [];
      return Promise.resolve({ data: data, error: null }).then(onFulfilled);
    },
  };
  return builder;
}

function createEmptyArchiveMock(batchQueriesRef) {
  return createArchiveMock(batchQueriesRef, new Set());
}

describe('ingestion archive lookups', function() {
  it('checks existing hashes in bounded batches instead of one request per feed item - 250 already-known items', function() {
    const items = [];
    for (let i = 0; i < 250; i++) {
      items.push({ link: 'https://example.com/' + i, title: 'Article ' + i });
    }
    let persistRpcCalls = 0;
    const connector = {
      source_id: 'techcrunch-ai', status: 'approved', access_method: 'rss',
      notes: 'Feed: https://techcrunch.com/tag/artificial-intelligence/feed/', reuse_permission: 'link_only',
    };
    const connectors = createQueryBuilder([connector]);
    connectors.eq = function() { return Promise.resolve({ data: [connector], error: null }); };
    // Ensure select() returns the builder for chaining (loadApprovedConnectors calls .select('*').eq(...))
    if (!connectors.select) {
      connectors.select = function() { return connectors; };
    }
    
    // Pre-populate archive with all 250 hashes so they appear as already-known
    const allHashes = items.map(function(_, index) {
      const u = new URL('https://example.com/' + index);
      u.protocol = 'https:';
      u.hostname = u.hostname.replace(/^www\./, '');
      u.port = '';
      u.hash = '';
      if (u.pathname !== '/' && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
      const canonicalUrl = u.toString();
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(canonicalUrl).digest('hex');
    });
    
    const archiveBatchQueriesRef = { count: 0 };
    const preloadedSet = new Set(allHashes);
    const archive = createArchiveMock(archiveBatchQueriesRef, preloadedSet);
    
    const supabase = {
      from: function(table) { return table === 'source_connectors' ? connectors : archive; },
      rpc: function(fn, params) {
        if (fn === 'persist_document_version') {
          persistRpcCalls++;
          return Promise.resolve({ data: [{ 
            source_document_id: 'doc-1', 
            document_version_id: 'ver-1', 
            archive_id: 'arch-1', 
            is_new_version: false // Already exists
          }], error: null });
        }
        throw new Error('Unexpected RPC: ' + fn);
      },
    };
    
    const loadResult = loadFetcher(supabase, items);
    const runIngestionForSource = loadResult.runIngestionForSource;

    return runIngestionForSource('techcrunch-ai').then(function(result) {
      expect(result.success).toBe(true);
      // 250 already-known items
      expect(result.items_new).toBe(0);
      expect(result.items_updated).toBe(250);
      // 250 unique hashes -> 3 batch queries (100, 100, 50)
      expect(archiveBatchQueriesRef.count).toBe(3);
      // Zero persistence calls because all items already exist
      expect(persistRpcCalls).toBe(0);
    });
  });

  it('inserts a repeated item only once within the same feed response', function() {
    let inserts = 0;
    const connector = {
      source_id: 'techcrunch-ai', status: 'approved', access_method: 'rss',
      notes: 'Feed: https://techcrunch.com/tag/artificial-intelligence/feed/', reuse_permission: 'link_only',
    };
    const connectors = createQueryBuilder([connector]);
    connectors.eq = function() { return Promise.resolve({ data: [connector], error: null }); };
    
    const archiveBatchQueriesRef = { count: 0 };
    const archive = createEmptyArchiveMock(archiveBatchQueriesRef);
    
    const supabase = {
      from: function(table) { return table === 'source_connectors' ? connectors : archive; },
      rpc: function(fn, params) {
        if (fn === 'persist_document_version') {
          inserts++;
          return Promise.resolve({ data: [{ 
            source_document_id: 'doc-1', 
            document_version_id: 'ver-1', 
            archive_id: 'arch-1', 
            is_new_version: inserts === 1 
          }], error: null });
        }
        throw new Error('Unexpected RPC: ' + fn);
      },
    };
    
    const item = { link: 'https://example.com/one', title: 'One' };
    const loadResult = loadFetcher(supabase, [item, item]);
    const runIngestionForSource = loadResult.runIngestionForSource;

    return runIngestionForSource('techcrunch-ai').then(function(result) {
      expect(result.success).toBe(true);
      // Contract: first unique new item -> items_new=1, duplicate -> items_updated=1
      // items_new + items_updated = items_fetched = 2
      expect(result.items_new).toBe(1);
      expect(result.items_updated).toBe(1);
      // Only 1 RPC call because deduplication happens before persistence
      expect(inserts).toBe(1);
    });
  });

  it('two different link_only URLs under the same source produce different identities and cannot collide in source_archive', function() {
    let persistRpcCalls = 0;
    const connector = {
      source_id: 'techcrunch-ai', status: 'approved', access_method: 'rss',
      notes: 'Feed: https://techcrunch.com/tag/artificial-intelligence/feed/', reuse_permission: 'link_only',
    };
    const connectors = createQueryBuilder([connector]);
    connectors.eq = function() { return Promise.resolve({ data: [connector], error: null }); };
    
    const archiveBatchQueriesRef = { count: 0 };
    const archive = createEmptyArchiveMock(archiveBatchQueriesRef);
    
    const supabase = {
      from: function(table) { return table === 'source_connectors' ? connectors : archive; },
      rpc: function(fn, params) {
        if (fn === 'persist_document_version') {
          persistRpcCalls++;
          return Promise.resolve({ data: [{ 
            source_document_id: 'doc-1', 
            document_version_id: 'ver-1', 
            archive_id: 'arch-1', 
            is_new_version: true 
          }], error: null });
        }
        throw new Error('Unexpected RPC: ' + fn);
      },
    };
    
    // Two different URLs, both link_only (empty content)
    const items = [
      { link: 'https://example.com/one', title: 'One' },
      { link: 'https://example.com/two', title: 'Two' },
    ];
    const loadResult = loadFetcher(supabase, items);
    const runIngestionForSource = loadResult.runIngestionForSource;

    return runIngestionForSource('techcrunch-ai').then(function(result) {
      expect(result.success).toBe(true);
      // Two distinct canonical URLs -> different hashes -> both new
      expect(result.items_new).toBe(2);
      expect(result.items_updated).toBe(0);
      expect(persistRpcCalls).toBe(2);
    });
  });
});