import { ingestionSupabase } from '@/lib/supabase/ingestion';
import { SourceConnector, FetchResult } from '@/types';
import Parser from 'rss-parser';
import { uploadToR2, generateR2Key } from '@/lib/r2/client';
import crypto from 'crypto';
import { JSDOM } from 'jsdom';
import { presentFeedItem } from './feed-presentation';

const parser = new Parser({ customFields: { item: [
  ['media:content', 'media:content', { keepArray: true }],
  'media:thumbnail',
] } });

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

// HTML extraction using readability-like approach
interface HTMLExtractionResult {
  title: string;
  content: string;
  excerpt: string;
  imageUrl: string | null;
  publishedAt: string | null;
}

function extractFromHTML(html: string, url: string): HTMLExtractionResult {
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;

  // Try to find article content using common selectors
  const articleSelectors = [
    'article',
    '[role="article"]',
    '.post-content',
    '.entry-content',
    '.article-body',
    '.post-body',
    '.content',
    'main',
    '.article',
    '[data-testid="article-body"]',
  ];

  let articleElement: Element | null = null;
  for (const selector of articleSelectors) {
    articleElement = document.querySelector(selector);
    if (articleElement) break;
  }

  // Fallback: get all paragraph text
  let content = '';
  if (articleElement) {
    content = articleElement.textContent || '';
  } else {
    const paragraphs = document.querySelectorAll('p');
    content = Array.from(paragraphs).map(p => p.textContent).join('\n');
  }

  // Extract title
  const title = document.querySelector('h1')?.textContent
    || document.querySelector('title')?.textContent
    || '';

  // Extract excerpt (first 500 chars)
  const excerpt = content.slice(0, 500).trim();

  // Extract image
  const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content')
    || document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
  const articleImage = articleElement?.querySelector('img')?.getAttribute('src');
  const imageUrl = ogImage || articleImage || null;

  // Extract published date
  const publishedAt = document.querySelector('meta[property="article:published_time"]')?.getAttribute('content')
    || document.querySelector('meta[name="publish_date"]')?.getAttribute('content')
    || document.querySelector('time[datetime]')?.getAttribute('datetime')
    || null;

  return {
    title: title.trim(),
    content: content.trim(),
    excerpt: excerpt.trim(),
    imageUrl: imageUrl ? new URL(imageUrl, url).href : null,
    publishedAt,
  };
}

async function fetchHTML(source: SourceConnector): Promise<FetchResult[]> {
  const urls = typeof source.notes === 'string'
    ? source.notes.match(/HTML:\s*(https?:\/\/[^\s,;]+)/gi)?.map(m => m.replace(/HTML:\s*/i, '')) || []
    : [];

  if (!urls.length) {
    // Try base_url as fallback
    if (source.base_url) urls.push(source.base_url);
  }

  if (!urls.length) {
    throw new Error(`No HTML URLs configured for ${source.source_id}`);
  }

  const results: FetchResult[] = [];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'VentroBot/1.0 (+https://ventro.ai/bot)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.warn(`HTML fetch failed for ${source.source_id} (${url}): ${response.status}`);
        continue;
      }

      const html = await response.text();
      const extracted = extractFromHTML(html, url);

      if (!extracted.title || !extracted.content) {
        console.warn(`No content extracted from ${url}`);
        continue;
      }

      const contentHash = crypto.createHash('sha256').update(extracted.content).digest('hex').slice(0, 32);

      results.push({
        source_id: source.source_id,
        url,
        fetched_at: new Date().toISOString(),
        content_hash: contentHash,
        raw_content: extracted.content,
        metadata: {
          title: extracted.title,
          published_at: extracted.publishedAt || undefined,
          publisher: source.name,
          image_url: extracted.imageUrl,
          excerpt: extracted.excerpt,
          language: 'en',
        },
        permissions: {
          can_store_raw: source.reuse_permission === 'full_text' || source.reuse_permission === 'summary_only',
          can_store_full_text: source.reuse_permission === 'full_text',
          max_retention_days: source.retention_max_days,
          attribution_required: source.attribution_required,
        },
      });
    } catch (error) {
      console.warn(`HTML fetch error for ${source.source_id} (${url}):`, error);
      continue;
    }
  }

  if (!results.length) {
    throw new Error(`All HTML URLs failed for ${source.source_id}`);
  }

  return results;
}

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
        const presentation = presentFeedItem(item, source.reuse_permission);
        const content = source.reuse_permission === 'full_text'
          ? (item.content || item.contentSnippet || '')
          : source.reuse_permission === 'summary_only'
            ? presentation.excerpt
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
            publisher: source.name,
            image_url: presentation.imageUrl,
            excerpt: presentation.excerpt,
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
  const apiConfig = typeof source.notes === 'string'
    ? JSON.parse(source.notes)
    : {};

  const apiType = apiConfig.type || source.source_id;
  const results: FetchResult[] = [];

  switch (apiType) {
    case 'github':
      results.push(...await fetchGitHubAPI(source, apiConfig));
      break;
    case 'hackernews':
      results.push(...await fetchHackerNewsAPI(source, apiConfig));
      break;
    case 'huggingface':
      results.push(...await fetchHuggingFaceAPI(source, apiConfig));
      break;
    case 'sec':
      results.push(...await fetchSECAPI(source, apiConfig));
      break;
    case 'tavily':
      results.push(...await fetchTavilyAPI(source, apiConfig));
      break;
    default:
      throw new Error(`Unknown API type: ${apiType} for ${source.source_id}`);
  }

  if (!results.length) {
    throw new Error(`No results from API ${apiType} for ${source.source_id}`);
  }

  return results;
}

async function fetchGitHubAPI(source: SourceConnector, config: GitHubAPIConfig): Promise<FetchResult[]> {
  const { repos = [], event_types = ['ReleaseEvent', 'PushEvent'] } = config;
  const token = process.env.GITHUB_TOKEN;
  const results: FetchResult[] = [];

  for (const repo of repos) {
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/events`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) continue;

      const events = await response.json();
      for (const event of events.slice(0, 10)) {
        if (!event_types.includes(event.type)) continue;

        const title = `${event.repo?.name}: ${event.type.replace('Event', '')}`;
        const content = JSON.stringify(event.payload, null, 2);
        const contentHash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 32);
        const url = `https://github.com/${event.repo?.name}`;

        results.push({
          source_id: source.source_id,
          url,
          fetched_at: new Date().toISOString(),
          content_hash: contentHash,
          raw_content: content,
          metadata: {
            title,
            published_at: event.created_at,
            publisher: 'GitHub',
            excerpt: `${event.actor?.login} ${event.type.replace('Event', '').toLowerCase()} on ${event.repo?.name}`,
            language: 'en',
          },
          permissions: {
            can_store_raw: true,
            can_store_full_text: true,
            max_retention_days: source.retention_max_days,
            attribution_required: true,
          },
        });
      }
    } catch (error) {
      console.warn(`GitHub API error for ${repo}:`, error);
    }
  }

  return results;
}

interface GitHubAPIConfig {
  repos?: string[];
  event_types?: string[];
}

interface HackerNewsAPIConfig {
  tags?: string[];
}

interface HuggingFaceAPIConfig {
  types?: string[];
}

interface SECAPIConfig {
  ciks?: string[];
  forms?: string[];
}

interface TavilyAPIConfig {
  queries?: string[];
  maxResults?: number;
}

async function fetchHackerNewsAPI(source: SourceConnector, config: HackerNewsAPIConfig): Promise<FetchResult[]> {
  const { tags = ['ai', 'machine-learning', 'llm'] } = config;
  const results: FetchResult[] = [];

  try {
    // Search for recent stories with AI tags
    const response = await fetch('https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=50', {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error('HN API failed');

    const data = await response.json();

    for (const hit of data.hits) {
      const title = hit.title || '';
      const text = (hit.story_text || '').toLowerCase();
      const hasAITag = tags.some((tag: string) => 
        title.toLowerCase().includes(tag) || text.includes(tag)
      );

      if (!hasAITag && !hit._tags?.some((t: string) => tags.includes(t))) continue;

      const contentHash = crypto.createHash('sha256').update(hit.story_text || title).digest('hex').slice(0, 32);
      const url = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;

      results.push({
        source_id: source.source_id,
        url,
        fetched_at: new Date().toISOString(),
        content_hash: contentHash,
        raw_content: hit.story_text || title,
        metadata: {
          title,
          published_at: hit.created_at,
          publisher: 'Hacker News',
          image_url: null,
          excerpt: (hit.story_text || title).slice(0, 500),
          language: 'en',
        },
        permissions: {
          can_store_raw: true,
          can_store_full_text: true,
          max_retention_days: source.retention_max_days,
          attribution_required: true,
        },
      });
    }
  } catch (error) {
    console.warn('Hacker News API error:', error);
  }

  return results;
}

async function fetchHuggingFaceAPI(source: SourceConnector, config: HuggingFaceAPIConfig): Promise<FetchResult[]> {
  const { types = ['models', 'datasets', 'spaces'] } = config;
  const results: FetchResult[] = [];

  for (const type of types) {
    try {
      const response = await fetch(`https://huggingface.co/api/${type}?limit=20&sort=lastModified`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) continue;

      const items = await response.json();

      for (const item of items) {
        const title = `${type.slice(0, -1)}: ${item.id}`;
        const content = JSON.stringify(item, null, 2);
        const contentHash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 32);
        const url = `https://huggingface.co/${item.id}`;

        results.push({
          source_id: source.source_id,
          url,
          fetched_at: new Date().toISOString(),
          content_hash: contentHash,
          raw_content: content,
          metadata: {
            title,
            published_at: item.lastModified,
            publisher: 'Hugging Face',
            excerpt: item.description || title,
            tags: item.tags,
            language: 'en',
          },
          permissions: {
            can_store_raw: true,
            can_store_full_text: true,
            max_retention_days: source.retention_max_days,
            attribution_required: true,
          },
        });
      }
    } catch (error) {
      console.warn(`Hugging Face API error for ${type}:`, error);
    }
  }

  return results;
}

async function fetchSECAPI(source: SourceConnector, config: SECAPIConfig): Promise<FetchResult[]> {
  const { ciks = [], forms = ['D'] } = config;
  const results: FetchResult[] = [];

  for (const cik of ciks) {
    try {
      const response = await fetch(`https://data.sec.gov/submissions/CIK${cik.padStart(10, '0')}.json`, {
        headers: {
          'User-Agent': 'VentroBot/1.0 (contact@ventro.ai)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) continue;

      const data = await response.json();

      for (const filing of (data.filings?.recent || []).slice(0, 20)) {
        if (!forms.includes(filing.form)) continue;

        const title = `SEC Filing: ${filing.form} - ${data.name}`;
        const content = JSON.stringify(filing, null, 2);
        const contentHash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 32);
        const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${filing.accessionNumber.replace(/-/g, '')}/${filing.primaryDocument}`;

        results.push({
          source_id: source.source_id,
          url,
          fetched_at: new Date().toISOString(),
          content_hash: contentHash,
          raw_content: content,
          metadata: {
            title,
            published_at: filing.filingDate,
            publisher: 'SEC EDGAR',
            excerpt: `${filing.form} filed by ${data.name} on ${filing.filingDate}`,
            language: 'en',
          },
          permissions: {
            can_store_raw: true,
            can_store_full_text: true,
            max_retention_days: source.retention_max_days,
            attribution_required: true,
          },
        });
      }
    } catch (error) {
      console.warn(`SEC API error for CIK ${cik}:`, error);
    }
  }

  return results;
}

async function fetchTavilyAPI(source: SourceConnector, config: TavilyAPIConfig): Promise<FetchResult[]> {
  const { queries = [], maxResults = 5 } = config;
  const apiKey = process.env.TAVILY_API_KEY;
  const results: FetchResult[] = [];

  if (!apiKey) {
    console.warn('TAVILY_API_KEY not set');
    return results;
  }

  for (const query of queries) {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'basic',
          max_results: maxResults,
          include_answer: false,
          include_raw_content: true,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) continue;

      const data = await response.json();

      for (const result of data.results || []) {
        const contentHash = crypto.createHash('sha256').update(result.content || '').digest('hex').slice(0, 32);

        results.push({
          source_id: source.source_id,
          url: result.url,
          fetched_at: new Date().toISOString(),
          content_hash: contentHash,
          raw_content: result.raw_content || result.content || '',
          metadata: {
            title: result.title,
            published_at: result.published_date,
            publisher: 'Tavily Search',
            excerpt: result.content?.slice(0, 500) || '',
            language: 'en',
          },
          permissions: {
            can_store_raw: true,
            can_store_full_text: true,
            max_retention_days: source.retention_max_days,
            attribution_required: true,
          },
        });
      }
    } catch (error) {
      console.warn(`Tavily API error for query "${query}":`, error);
    }
  }

  return results;
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
