import { ingestionSupabase } from '@/lib/supabase/ingestion';

type FetchLike = typeof fetch;

interface YcHit {
  name?: string;
  slug?: string;
  website?: string;
  one_liner?: string;
  batch?: string;
  all_locations?: string;
  tags?: string[];
  industry?: string;
  subindustry?: string;
  status?: string;
}

interface CompanyCandidate {
  name: string;
  website?: string;
  sourceUrl: string;
  verification: 'verified' | 'partial';
}

export interface EntitySyncResult {
  ycCompanies: number;
  ycBatches: number;
  portfolioCompanies: number;
  fundsProcessed: number;
  fundsFailed: number;
}

const AI_KEYWORDS = [
  'artificial intelligence', 'machine learning', 'generative ai', 'large language model',
  'llm', 'computer vision', 'natural language processing', 'deep learning', 'robotics',
  'autonomous', 'ai-powered', 'ai powered', 'foundation model', 'voice ai',
];

const SKIP_DOMAINS = new Set([
  'linkedin.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'youtube.com',
  'medium.com', 'substack.com', 'github.com', 'crunchbase.com', 'wellfound.com',
]);

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function domainOf(value?: string): string | null {
  if (!value) return null;
  try { return new URL(value.startsWith('http') ? value : `https://${value}`).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return null; }
}

export function parseYcAlgoliaConfig(html: string): { app: string; key: string } {
  const match = html.match(/window\.AlgoliaOpts\s*=\s*(\{[^;]+\})/);
  if (!match) throw new Error('YC directory did not expose its search configuration');
  const value = JSON.parse(match[1]) as { app?: string; key?: string };
  if (!value.app || !value.key) throw new Error('YC directory search configuration is incomplete');
  return { app: value.app, key: value.key };
}

export function normalizeYcBatch(batch?: string): { id: string; name: string; season: 'W' | 'P' | 'S' | 'F'; year: number } | null {
  if (!batch) return null;
  const compact = batch.trim().match(/^(Winter|Spring|Summer|Fall)\s+(\d{4})$/i);
  const short = batch.trim().match(/^([WPSF])\s*(\d{2}|\d{4})$/i);
  let season: 'W' | 'P' | 'S' | 'F';
  let year: number;
  let name: string;
  if (compact) {
    const seasonMap = { winter: 'W', spring: 'P', summer: 'S', fall: 'F' } as const;
    season = seasonMap[compact[1].toLowerCase() as keyof typeof seasonMap];
    year = Number(compact[2]);
    name = `${compact[1][0].toUpperCase()}${compact[1].slice(1).toLowerCase()} ${year}`;
  } else if (short) {
    season = short[1].toUpperCase() as 'W' | 'P' | 'S' | 'F';
    year = Number(short[2]);
    if (year < 100) year += 2000;
    const names = { W: 'Winter', P: 'Spring', S: 'Summer', F: 'Fall' };
    name = `${names[season]} ${year}`;
  } else return null;
  return { id: `${season}${String(year).slice(-2)}`, name, season, year };
}

export function classifyYcAiTags(hit: YcHit): string[] {
  const haystack = [hit.name, hit.one_liner, hit.industry, hit.subindustry, ...(hit.tags ?? [])].filter(Boolean).join(' ').toLowerCase();
  if (!AI_KEYWORDS.some(keyword => haystack.includes(keyword))) return [];
  const tags = new Set<string>();
  if (/robot|autonom/.test(haystack)) tags.add('robotics');
  if (/chip|semiconductor|hardware/.test(haystack)) tags.add('hardware');
  if (/foundation model|large language|\bllm\b|model lab/.test(haystack)) tags.add('foundation_models');
  if (/infrastructure|developer|database|cloud|security|observability/.test(haystack)) tags.add('infrastructure');
  if (/research|science|lab/.test(haystack)) tags.add('research');
  if (tags.size === 0) tags.add('applications');
  return [...tags];
}

function mapCountry(locations?: string): string {
  const value = (locations ?? '').toLowerCase();
  if (/india|bengaluru|bangalore|delhi|mumbai/.test(value)) return 'india';
  if (/israel|tel aviv/.test(value)) return 'israel';
  if (/canada|toronto|vancouver|montreal/.test(value)) return 'canada';
  if (/united kingdom|london|england/.test(value)) return 'uk';
  if (/singapore|indonesia|vietnam|thailand|malaysia/.test(value)) return 'sea';
  if (/germany|france|spain|italy|netherlands|sweden|finland|denmark|europe/.test(value)) return 'eu';
  if (/united states|san francisco|new york|boston|seattle|austin|california/.test(value)) return 'us';
  return 'global';
}

async function fetchAllYcHits(fetchImpl: FetchLike): Promise<YcHit[]> {
  const directoryUrl = 'https://www.ycombinator.com/companies';
  const page = await fetchImpl(directoryUrl, { headers: { 'User-Agent': 'Ventro research indexer/1.0' } });
  if (!page.ok) throw new Error(`YC directory request failed (${page.status})`);
  const config = parseYcAlgoliaConfig(await page.text());
  const endpoint = `https://${config.app}-dsn.algolia.net/1/indexes/YCCompany_production/query`;
  const headers = { 'content-type': 'application/json', 'x-algolia-application-id': config.app, 'x-algolia-api-key': config.key };
  const hits: YcHit[] = [];
  let pageNumber = 0;
  let pages = 1;
  while (pageNumber < pages) {
    const response = await fetchImpl(endpoint, { method: 'POST', headers, body: JSON.stringify({ params: `hitsPerPage=1000&page=${pageNumber}` }) });
    if (!response.ok) throw new Error(`YC search request failed (${response.status})`);
    const payload = await response.json() as { hits?: YcHit[]; nbPages?: number };
    hits.push(...(payload.hits ?? []));
    pages = Math.max(1, payload.nbPages ?? 1);
    pageNumber++;
  }
  return hits;
}

async function findOrCreateCompany(candidate: { name: string; website?: string; sourceUrl: string; description?: string; tags?: string[]; country?: string; batch?: string; verification?: 'verified' | 'partial' }): Promise<string> {
  const name = normalizeName(candidate.name);
  const domain = domainOf(candidate.website);
  const query = ingestionSupabase.from('companies').select('id, source_links, ai_tags').ilike('canonical_name', name).limit(1);
  const { data: matches, error: findError } = await query;
  if (findError) throw new Error(`Company lookup failed for ${name}: ${findError.message}`);
  const existing = matches?.[0] as { id: string; source_links?: string[]; ai_tags?: string[] } | undefined;
  const sourceLinks = [...new Set([...(existing?.source_links ?? []), candidate.sourceUrl, candidate.website].filter((v): v is string => Boolean(v)))];
  const aiTags = [...new Set([...(existing?.ai_tags ?? []), ...(candidate.tags ?? [])])];
  if (existing) {
    const { error } = await ingestionSupabase.from('companies').update({
      canonical_domain: domain ?? undefined, short_description: candidate.description ?? undefined,
      ai_tags: aiTags, hq_country: candidate.country ?? undefined, yc_batch: candidate.batch ?? undefined,
      source_links: sourceLinks, verification_status: candidate.verification ?? 'partial', last_verified_at: new Date().toISOString(),
    }).eq('id', existing.id);
    if (error) throw new Error(`Company update failed for ${name}: ${error.message}`);
    return existing.id;
  }
  const { data, error } = await ingestionSupabase.from('companies').insert({
    canonical_name: name, canonical_domain: domain, short_description: candidate.description ?? null,
    ai_tags: aiTags, hq_country: candidate.country ?? 'global', stage: candidate.batch ? 'seed' : null,
    yc_batch: candidate.batch ?? null, source_links: sourceLinks, verification_status: candidate.verification ?? 'partial', last_verified_at: new Date().toISOString(),
  }).select('id').single();
  if (error || !data) throw new Error(`Company insert failed for ${name}: ${error?.message ?? 'missing row'}`);
  return data.id;
}

export async function syncYcDirectory(fetchImpl: FetchLike = fetch): Promise<{ companies: number; batches: number }> {
  const hits = await fetchAllYcHits(fetchImpl);
  const batchTotals = new Map<string, { batch: NonNullable<ReturnType<typeof normalizeYcBatch>>; total: number; ai: number }>();
  const aiHits: Array<{ hit: YcHit; batch: NonNullable<ReturnType<typeof normalizeYcBatch>>; tags: string[] }> = [];
  for (const hit of hits) {
    const batch = normalizeYcBatch(hit.batch);
    if (!batch || !hit.name) continue;
    const aggregate = batchTotals.get(batch.id) ?? { batch, total: 0, ai: 0 };
    aggregate.total++;
    const tags = classifyYcAiTags(hit);
    if (tags.length) { aggregate.ai++; aiHits.push({ hit, batch, tags }); }
    batchTotals.set(batch.id, aggregate);
  }
  for (const { batch, total, ai } of batchTotals.values()) {
    const { error } = await ingestionSupabase.from('yc_batches').upsert({
      id: batch.id, batch_name: batch.name, season: batch.season, year: batch.year,
      total_companies: total, ai_companies_count: ai,
      source_links: [`https://www.ycombinator.com/companies?batch=${batch.id}`], updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (error) throw new Error(`YC batch ${batch.id} upsert failed: ${error.message}`);
  }
  let stored = 0;
  for (const { hit, batch, tags } of aiHits) {
    const sourceUrl = `https://www.ycombinator.com/companies/${hit.slug ?? ''}`;
    const companyId = await findOrCreateCompany({ name: hit.name!, website: hit.website, sourceUrl, description: hit.one_liner, tags, country: mapCountry(hit.all_locations), batch: batch.id, verification: 'verified' });
    const { error } = await ingestionSupabase.from('yc_batch_companies').upsert({ batch_id: batch.id, company_id: companyId, is_ai_company: true }, { onConflict: 'batch_id,company_id' });
    if (error) throw new Error(`YC company link failed for ${hit.name}: ${error.message}`);
    stored++;
  }
  return { companies: stored, batches: batchTotals.size };
}

export function extractPortfolioCandidates(data: { markdown?: string; links?: string[]; json?: { companies?: Array<{ name?: string; website?: string; profile_url?: string }> } }, sourceUrl: string): CompanyCandidate[] {
  const markdown = data.markdown ?? '';
  const candidates: CompanyCandidate[] = [];
  for (const item of data.json?.companies ?? []) {
    const name = normalizeName(item.name ?? '');
    if (name.length < 2 || name.length > 100 || !markdown.toLowerCase().includes(name.toLowerCase())) continue;
    candidates.push({ name, website: item.website, sourceUrl: item.profile_url || sourceUrl, verification: 'verified' });
  }
  if (!candidates.length) {
    for (const match of markdown.matchAll(/\[([^\]]{2,100})\]\((https?:\/\/[^)]+)\)/g)) {
      const name = normalizeName(match[1]);
      const url = match[2];
      const domain = domainOf(url);
      if (!domain || SKIP_DOMAINS.has(domain) || /^(learn more|read more|website|home|portfolio|contact|careers)$/i.test(name)) continue;
      const sourceDomain = domainOf(sourceUrl);
      const internalPortfolioLink = domain === sourceDomain && /\/(portfolio|companies|investments)\//i.test(url);
      if (domain !== sourceDomain || internalPortfolioLink) candidates.push({ name, website: domain !== sourceDomain ? url : undefined, sourceUrl: url, verification: 'partial' });
    }
  }
  return [...new Map(candidates.map(item => [`${item.name.toLowerCase()}:${domainOf(item.website) ?? ''}`, item])).values()].slice(0, 300);
}

async function syncOneFund(fund: { id: string; canonical_name: string; canonical_domain: string | null; source_links: string[] | null }, firecrawlKey: string, fetchImpl: FetchLike): Promise<number> {
  const portfolioUrl = fund.source_links?.find(url => /portfolio|companies|investments/i.test(url))
    ?? (fund.canonical_domain ? `https://${fund.canonical_domain}/portfolio` : null);
  if (!portfolioUrl) return 0;
  const response = await fetchImpl('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST', headers: { authorization: `Bearer ${firecrawlKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ url: portfolioUrl, onlyMainContent: true, timeout: 45000, formats: [
      'markdown', 'links',
      { type: 'json', prompt: 'List only portfolio companies explicitly shown on this official investment firm portfolio page. Do not infer companies.', schema: { type: 'object', properties: { companies: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, website: { type: 'string' }, profile_url: { type: 'string' } }, required: ['name'] } } }, required: ['companies'] } },
    ] }),
  });
  if (!response.ok) throw new Error(`Firecrawl failed for ${fund.canonical_name} (${response.status})`);
  const payload = await response.json() as { success?: boolean; data?: { markdown?: string; links?: string[]; json?: { companies?: Array<{ name?: string; website?: string; profile_url?: string }> } } };
  if (!payload.success || !payload.data) throw new Error(`Firecrawl returned no portfolio data for ${fund.canonical_name}`);
  const candidates = extractPortfolioCandidates(payload.data, portfolioUrl);
  let stored = 0;
  for (const candidate of candidates) {
    const companyId = await findOrCreateCompany(candidate);
    const { error } = await ingestionSupabase.from('fund_portfolio').upsert({
      fund_id: fund.id, company_id: companyId, source_url: candidate.sourceUrl,
      verification_status: candidate.verification, last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: 'fund_id,company_id' });
    if (error) throw new Error(`Portfolio link failed for ${fund.canonical_name}/${candidate.name}: ${error.message}`);
    stored++;
  }
  const hasVerifiedPortfolioEvidence = candidates.some(candidate => candidate.verification === 'verified');
  await ingestionSupabase.from('funds').update({ verification_status: hasVerifiedPortfolioEvidence ? 'verified' : candidates.length || fund.source_links?.length ? 'partial' : 'unverified', last_verified_at: new Date().toISOString() }).eq('id', fund.id);
  return stored;
}

export async function syncVcPortfolios(fetchImpl: FetchLike = fetch, scope = 'all'): Promise<{ companies: number; processed: number; failed: number }> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlKey) throw new Error('FIRECRAWL_API_KEY is required for VC portfolio synchronization');
  let query = ingestionSupabase.from('funds').select('id, canonical_name, canonical_domain, source_links').order('canonical_name').limit(Number(process.env.ENTITY_SYNC_MAX_FUNDS || 100));
  if (scope !== 'all' && scope !== 'vc') query = query.eq('id', scope);
  const { data, error } = await query;
  if (error) throw new Error(`Fund catalog lookup failed: ${error.message}`);
  const funds = (data ?? []) as Array<{ id: string; canonical_name: string; canonical_domain: string | null; source_links: string[] | null }>;
  let companies = 0, processed = 0, failed = 0, cursor = 0;
  const workers = Array.from({ length: Math.min(3, funds.length) }, async () => {
    while (cursor < funds.length) {
      const fund = funds[cursor++];
      try { companies += await syncOneFund(fund, firecrawlKey, fetchImpl); processed++; }
      catch (error) { failed++; console.error(`VC portfolio sync failed for ${fund.canonical_name}:`, error instanceof Error ? error.message : error); }
    }
  });
  await Promise.all(workers);
  return { companies, processed, failed };
}

export async function syncTrackedEntities(scope = 'all', fetchImpl: FetchLike = fetch): Promise<EntitySyncResult> {
  let yc = { companies: 0, batches: 0 };
  let vc = { companies: 0, processed: 0, failed: 0 };
  if (scope === 'all' || scope === 'yc') yc = await syncYcDirectory(fetchImpl);
  if (scope !== 'yc') vc = await syncVcPortfolios(fetchImpl, scope);
  return { ycCompanies: yc.companies, ycBatches: yc.batches, portfolioCompanies: vc.companies, fundsProcessed: vc.processed, fundsFailed: vc.failed };
}
