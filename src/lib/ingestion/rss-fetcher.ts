import { ingestionSupabase } from '@/lib/supabase/ingestion';
import { SourceConnector, FetchResult } from '@/types';
import Parser from 'rss-parser';
import { uploadToR2, generateR2Key } from '@/lib/r2/client';
import crypto from 'crypto';

const parser = new Parser();

// Feed URL mapping (in production, could be stored in source_connectors.notes or a separate table)
// Multiple fallback URLs per source - tries each until one works
const FEED_URLS: Record<string, string[]> = {
  'sequoia-capital-blog': ['https://sequoiacap.com/feed/'],
  // 'a16z-blog': ['https://a16z.com/feed/', 'https://a16z.com/blog/feed/', 'https://a16z.com/rss.xml'],
  'techcrunch-ai': ['https://techcrunch.com/tag/artificial-intelligence/feed/'],
  'venturebeat-ai': ['https://venturebeat.com/category/ai/feed/'],
  'crunchbase-news': ['https://news.crunchbase.com/feed/'],
  'openai-blog': ['https://openai.com/blog/rss.xml'],
  'anthropic-blog': ['https://www.anthropic.com/news/feed.xml', 'https://www.anthropic.com/blog/feed.xml', 'https://www.anthropic.com/feed.xml'],
  'deepmind-blog': ['https://deepmind.com/blog/feed.xml', 'https://deepmind.google/blog/rss.xml', 'https://deepmind.com/blog/rss.xml'],
  'meta-ai-blog': ['https://ai.meta.com/blog/rss/', 'https://ai.meta.com/blog/rss.xml', 'https://ai.meta.com/feed/'],
  'mistral-blog': ['https://mistral.ai/news/feed.xml'],
  'cohere-blog': ['https://cohere.com/blog/rss.xml'],
  'huggingface-blog': ['https://huggingface.co/blog/feed.xml'],
  'yc-blog': ['https://www.ycombinator.com/blog/feed.xml'],
  'sebi-rss': ['https://www.sebi.gov.in/sebirss.xml'],
  'pib-rss': ['https://pib.gov.in/RssMain.aspx'],
  'lightspeed-blog': ['https://lsvp.com/feed/'],
  'greylock-blog': ['https://greylock.com/feed/'],
  'index-ventures-blog': ['https://indexventures.com/feed/', 'https://indexventures.com/blog/feed/', 'https://indexventures.com/feed/rss.xml'],
  'khosla-ventures-blog': ['https://khoslaventures.com/feed/', 'https://khoslaventures.com/blog/feed/', 'https://khoslaventures.com/feed/rss.xml'],
  'general-catalyst-blog': ['https://generalcatalyst.com/feed/', 'https://generalcatalyst.com/blog/feed/', 'https://generalcatalyst.com/feed/rss.xml'],
  'm12-blog': ['https://m12.vc/feed/', 'https://m12.vc/blog/feed/'],
  'gv-blog': ['https://gv.com/feed/', 'https://gv.com/blog/feed/'],
};

export async function loadApprovedConnectors(): Promise<SourceConnector[]> {
  const { data, error } = await ingestionSupabase
    .from('source_connectors')
    .select('*')
    .eq('status', 'approved');
  
  if (error) {
    console.error('Failed to load connectors:', error);
    return [];
  }
  
  return (data || []).map(row => ({
    ...row,
    expected_fact_types: row.expected_fact_types || [],
    // Add feed URL from mapping if available
  }));
}

interface IngestionResult {
  source_id: string;
  success: boolean;
  items_fetched: number;
  items_new: number;
  items_updated: number;
  errors: string[];
  latency_ms: number;
}

async function fetchRSS(source: SourceConnector): Promise<FetchResult[]> {
  const configuredFeed = typeof source.notes === 'string'
    ? source.notes.match(/Feed:\s*(https?:\/\/[^\s,;]+)/i)?.[1]
    : undefined;
  const feedUrls = [...new Set([
    ...(configuredFeed ? [configuredFeed] : []),
    ...(FEED_URLS[source.source_id] || []),
  ])];
  if (!feedUrls || feedUrls.length === 0) throw new Error(`No feed URL for ${source.source_id}`);

  let lastError: Error | null = null;
  
  for (const feedUrl of feedUrls) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const results: FetchResult[] = [];

      for (const item of feed.items) {
        const url = item.link || '';
        if (!/^https?:\/\//i.test(url) || !item.title?.trim()) continue;
        const content = source.reuse_permission === 'full_text'
          ? (item.content || item.contentSnippet || '')
          : source.reuse_permission === 'summary_only'
            ? (item.contentSnippet || '')
            : '';
        const contentHash = crypto.createHash('sha256').update(content || url).digest('hex').slice(0, 32);

        results.push({
          source_id: source.source_id,
          url,
          fetched_at: new Date().toISOString(),
          content_hash: contentHash,
          raw_content: content,
          metadata: {
            title: item.title,
            published_at: item.pubDate,
            author: item.creator,
            tags: item.categories,
            language: 'en',
          },
          permissions: {
            can_store_raw: source.reuse_permission === 'full_text' || source.reuse_permission === 'summary_only',
            can_store_full_text: source.reuse_permission === 'full_text',
            max_retention_days: source.retention_max_days,
            attribution_required: source.attribution_required,
          },
        });
      }

      return results;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(`Feed URL failed for ${source.source_id} (${feedUrl}): ${lastError.message}`);
      continue;
    }
  }

  throw lastError || new Error(`All feed URLs failed for ${source.source_id}`);
}

async function fetchHTML(source: SourceConnector): Promise<FetchResult[]> {
  throw new Error(`HTML ingestion is not implemented for ${source.source_id}`);
}

async function storeFetchResults(results: FetchResult[]): Promise<{ new: number; updated: number }> {
  const supabase = ingestionSupabase;
  let newCount = 0;
  let updatedCount = 0;
  const hashesBySource = new Map<string, Set<string>>();

  for (const result of results) {
    if (!hashesBySource.has(result.source_id)) hashesBySource.set(result.source_id, new Set());
    hashesBySource.get(result.source_id)!.add(result.content_hash);
  }

  const archivedHashes = new Map<string, Set<string>>();
  for (const [sourceId, hashes] of hashesBySource) {
    const existingHashes = new Set<string>();
    const allHashes = [...hashes];
    for (let offset = 0; offset < allHashes.length; offset += 100) {
      const { data, error } = await supabase
        .from('source_archive')
        .select('content_hash')
        .eq('source_id', sourceId)
        .in('content_hash', allHashes.slice(offset, offset + 100));
      if (error) throw new Error(`Archive lookup failed for ${sourceId}: ${error.message}`);
      for (const row of data || []) existingHashes.add(row.content_hash);
    }
    archivedHashes.set(sourceId, existingHashes);
  }

  for (const result of results) {
    if (archivedHashes.get(result.source_id)!.has(result.content_hash)) {
      updatedCount++;
      continue;
    }

    const r2Key = generateR2Key(result.source_id, result.content_hash);
    let r2Url: string | null = null;
    let storedR2Key: string | null = null;

    if (result.permissions.can_store_raw && result.raw_content) {
      const archivePayload = JSON.stringify({
        url: result.url,
        fetched_at: result.fetched_at,
        content_hash: result.content_hash,
        raw_content: result.raw_content,
        metadata: result.metadata,
        permissions: result.permissions,
      });

      const uploadResult = await uploadToR2(r2Key, archivePayload, 'application/json', {
        source_id: result.source_id,
        content_hash: result.content_hash,
        fetched_at: result.fetched_at,
      });

      if (uploadResult.success) {
        r2Url = uploadResult.url || null;
        storedR2Key = r2Key;
      } else {
        throw new Error(`R2 upload failed for ${r2Key}: ${uploadResult.error || 'unknown error'}`);
      }
    }

    const { error: insertError } = await supabase.from('source_archive').insert({
      source_id: result.source_id,
      url: result.url,
      content_hash: result.content_hash,
      fetched_at: result.fetched_at,
      r2_key: storedR2Key,
      r2_url: r2Url,
      raw_content: result.permissions.can_store_raw ? result.raw_content : null,
      metadata: result.metadata,
      permissions: result.permissions,
    });
    if (insertError) throw new Error(`Archive insert failed for ${result.source_id}: ${insertError.message}`);
    archivedHashes.get(result.source_id)!.add(result.content_hash);
    newCount++;
  }

  return { new: newCount, updated: updatedCount };
}

async function fetchAPI(source: SourceConnector): Promise<FetchResult[]> {
  throw new Error(`API ingestion is not implemented for ${source.source_id}`);
}

export async function runIngestionForSource(sourceId: string): Promise<IngestionResult> {
  const startTime = Date.now();
  const connectors = await loadApprovedConnectors();
  const source = connectors.find(s => s.source_id === sourceId);
  
  if (!source) {
    return { source_id: sourceId, success: false, items_fetched: 0, items_new: 0, items_updated: 0, errors: ['Source not found'], latency_ms: 0 };
  }
  
  if (source.status !== 'approved') {
    return { source_id: sourceId, success: false, items_fetched: 0, items_new: 0, items_updated: 0, errors: ['Source not approved'], latency_ms: 0 };
  }
  
  try {
    let results: FetchResult[] = [];
    
    switch (source.access_method) {
      case 'rss':
        results = await fetchRSS(source);
        break;
      case 'html':
        results = await fetchHTML(source);
        break;
      case 'api':
        results = await fetchAPI(source);
        break;
      default:
        throw new Error(`Unsupported access method: ${source.access_method}`);
    }
    
    const { new: newCount, updated: updatedCount } = await storeFetchResults(results);
    
    return {
      source_id: sourceId,
      success: true,
      items_fetched: results.length,
      items_new: newCount,
      items_updated: updatedCount,
      errors: [],
      latency_ms: Date.now() - startTime,
    };
  } catch (error) {
    return {
      source_id: sourceId,
      success: false,
      items_fetched: 0,
      items_new: 0,
      items_updated: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      latency_ms: Date.now() - startTime,
    };
  }
}
