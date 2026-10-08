import { ingestionSupabase } from '@/lib/supabase/ingestion';
import { FetchResult } from '@/types';
import crypto from 'crypto';

const EVENT_TYPE_KEYWORDS: Record<string, string[]> = {
  funding: ['raises', 'raised', 'funding', 'round', 'series', 'investment', 'investors', 'venture', 'capital', 'valuation', 'pre-seed', 'seed', 'series a', 'series b', 'series c', 'growth round', 'led by', 'backs', 'backed', 'invests', 'financing', 'closes'],
  launch: ['launches', 'launch', 'released', 'release', 'announces', 'announce', 'unveils', 'unveil', 'introduces', 'introduce', 'debut', 'preview', 'beta', 'general availability', 'ga', 'ships', 'shipping'],
  partnership: ['partners', 'partnership', 'collaboration', 'collaborate', 'alliance', 'joint venture', 'integration', 'integrates', 'teams up', 'ally', 'allies'],
  research: ['research', 'paper', 'study', 'benchmark', 'model', 'architecture', 'training', 'dataset', 'arxiv', 'published', 'findings', 'analyzes', 'analysis'],
  acquisition: ['acquires', 'acquisition', 'acquired', 'merger', 'mergers', 'buys', 'buyout', 'takeover', 'acquihire'],
};

const AI_TOPIC_KEYWORDS: Record<string, string[]> = {
  foundation_models: ['foundation model', 'llm', 'large language model', 'gpt', 'claude', 'gemini', 'llama', 'mistral', 'transformer', 'pretraining', 'fine-tuning', 'instruction tuning', 'rlhf', 'model release', 'model launch', 'openai', 'anthropic', 'google deepmind', 'meta ai'],
  infrastructure: ['infrastructure', 'mlops', 'kubernetes', 'gpu', 'training cluster', 'inference', 'serving', 'deployment', 'monitoring', 'observability', 'vector database', 'embeddings', 'rag', 'retrieval', 'hugging face', 'weights & biases', 'wandb', 'mlflow'],
  applications: ['application', 'copilot', 'assistant', 'chatbot', 'agent', 'workflow', 'automation', 'productivity', 'coding assistant', 'code generation', 'developer tool', 'ide', 'plugin', 'saas', 'enterprise ai', 'ai startup', 'ai company'],
  robotics: ['robotics', 'robot', 'autonomous', 'navigation', 'manipulation', 'humanoid', 'simulation', 'reinforcement learning', 'embodied ai', 'figure ai', 'tesla bot'],
  hardware: ['chip', 'semiconductor', 'gpu', 'tpu', 'asic', 'accelerator', 'hardware', 'processor', 'nvidia', 'amd', 'intel', 'groq', 'cerebras', 'samba', 'etched', 'tenstorrent'],
  research: ['research', 'paper', 'arxiv', 'benchmark', 'evaluation', 'theory', 'algorithm', 'novel', 'state-of-the-art', 'sota', 'iclr', 'neurips', 'icml', 'acl'],
  funding: ['funding', 'series a', 'series b', 'series c', 'seed', 'pre-seed', 'venture capital', 'vc', 'investment', 'raises', 'raised', 'led by', 'backs', 'capital', 'valuation'],
};

function classifyEventType(text: string): string {
  const lower = text.toLowerCase();
  let bestType = 'other';
  let bestScore = 0;
  
  for (const [type, keywords] of Object.entries(EVENT_TYPE_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }
  
  return bestType;
}

function classifyAITopics(text: string): string[] {
  const lower = text.toLowerCase();
  const topics: string[] = [];
  
  for (const [topic, keywords] of Object.entries(AI_TOPIC_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score >= 1) { // At least one keyword match
      topics.push(topic);
    }
  }
  
  return topics;
}

interface ClusteredStory {
  canonical_url: string;
  content_hash: string;
  headline: string;
  summary: string;
  summary_kind: 'none' | 'source_excerpt' | 'article_summary';
  image_url: string | null;
  event_date: string | null;
  publisher: string;
  source_count: number;
  companies: Array<{ company_id: string; role: 'primary' | 'mentioned' }>;
  investors: Array<{ fund_id: string; role: 'mentioned' }>;
  ai_topics: string[];
  geography: string | null;
  event_type: string;
  verification_label: string;
  last_checked_at: string;
  created_at: string;
  source_urls: string[];
  supporting_sources: string[];
}

interface NamedEntity { id: string; canonical_name: string }
interface EntityCatalog { companies: NamedEntity[]; funds: NamedEntity[] }

function matchNames(text: string, entities: NamedEntity[]): NamedEntity[] {
  const matches: { entity: NamedEntity; start: number; end: number }[] = [];
  const ambiguous = new Set<string>();
  const counts = new Map<string, number>();
  for (const entity of entities) {
    const name = entity.canonical_name?.trim();
    if (!name || name.length < 4) continue;
    const key = name.toLocaleLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const [name, count] of counts) if (count > 1) ambiguous.add(name);

  for (const entity of entities) {
    const name = entity.canonical_name?.trim();
    if (!name || name.length < 4 || ambiguous.has(name.toLocaleLowerCase())) continue;
    const pattern = name.split(/\s+/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
    const expression = new RegExp(`(^|[^\\p{L}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{N}])`, 'giu');
    for (const match of text.matchAll(expression)) {
      const start = (match.index || 0) + match[1].length;
      matches.push({ entity, start, end: start + match[2].length });
    }
  }

  matches.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const selected: typeof matches = [];
  for (const match of matches) {
    if (!selected.some(item => item.start < match.end && match.start < item.end)
        && !selected.some(item => item.entity.id === match.entity.id)) selected.push(match);
  }
  return selected.sort((a, b) => a.start - b.start).map(item => item.entity);
}

async function loadNamedEntities(table: 'companies' | 'funds'): Promise<NamedEntity[]> {
  const rows: NamedEntity[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await ingestionSupabase.from(table)
      .select('id, canonical_name').order('id').range(offset, offset + 999);
    if (error) throw new Error(`${table} catalog lookup failed: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function computeContentHash(content: string): Promise<string> {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function calculateTitleSimilarity(title1: string, title2: string): number {
  const words1 = new Set(title1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(title2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

function calculateContentSimilarity(content1: string, content2: string): number {
  // Simple Jaccard similarity on word trigrams
  const trigrams1 = new Set<string>();
  const trigrams2 = new Set<string>();

  const words1 = content1.toLowerCase().split(/\s+/);
  const words2 = content2.toLowerCase().split(/\s+/);

  for (let i = 0; i < words1.length - 2; i++) {
    trigrams1.add(words1.slice(i, i + 3).join(' '));
  }
  for (let i = 0; i < words2.length - 2; i++) {
    trigrams2.add(words2.slice(i, i + 3).join(' '));
  }

  const intersection = new Set([...trigrams1].filter(t => trigrams2.has(t)));
  const union = new Set([...trigrams1, ...trigrams2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

export async function clusterStories(newStories: FetchResult[], entities: EntityCatalog = { companies: [], funds: [] }): Promise<ClusteredStory[]> {
  const supabase = ingestionSupabase;
  const clusters: ClusteredStory[] = [];

  // Fetch existing stories for deduplication
  const { data: existingStories, error: existingError } = await supabase
    .from('stories')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (existingError) throw new Error(`Story lookup failed: ${existingError.message}`);

  const existingMap = new Map<string, ClusteredStory>();
  for (const story of existingStories || []) {
    existingMap.set(story.canonical_url, story as ClusteredStory);
  }

  for (const newStory of newStories) {
    let matchedStory: ClusteredStory | null = null;
    let bestSimilarity = 0;

    const sameUrl = clusters.find(c => c.canonical_url === newStory.url)
      || existingMap.get(newStory.url);
    if (sameUrl) {
      matchedStory = {
        ...sameUrl,
        source_urls: [...new Set([sameUrl.canonical_url, ...(sameUrl.source_urls ?? []), newStory.url])],
        supporting_sources: [...new Set([...(sameUrl.supporting_sources ?? []), newStory.source_id])],
      };
      matchedStory.source_count = matchedStory.source_urls.length;
      bestSimilarity = 1;
    }

    // Check against existing stories
    for (const existing of existingMap.values()) {
      const titleSim = calculateTitleSimilarity(newStory.metadata.title || '', existing.headline || '');
      const contentSim = calculateContentSimilarity(newStory.raw_content || '', existing.summary || '');

      const combinedSim = (titleSim * 0.6) + (contentSim * 0.4);

      if (combinedSim > bestSimilarity && combinedSim > 0.9) {
        bestSimilarity = combinedSim;
        matchedStory = {
          ...existing,
          source_urls: [...new Set([existing.canonical_url, ...(existing.source_urls ?? []), newStory.url])],
          supporting_sources: [...new Set([...(existing.supporting_sources ?? []), newStory.source_id])],
        };
        matchedStory.source_count = matchedStory.source_urls.length;
      }
    }

    // Check against other new stories in this batch
    for (const cluster of clusters) {
      const titleSim = calculateTitleSimilarity(newStory.metadata.title || '', cluster.headline || '');
      const contentSim = calculateContentSimilarity(newStory.raw_content || '', cluster.summary || '');

      const combinedSim = (titleSim * 0.6) + (contentSim * 0.4);

      if (combinedSim > bestSimilarity && combinedSim > 0.9) {
        bestSimilarity = combinedSim;
        matchedStory = {
          ...cluster,
          source_urls: [...new Set([...(cluster.source_urls ?? []), newStory.url])],
          supporting_sources: [...new Set([...(cluster.supporting_sources ?? []), newStory.source_id])],
        };
        matchedStory.source_count = matchedStory.source_urls.length;
      }
    }

    if (matchedStory) {
      matchedStory.image_url = matchedStory.image_url || newStory.metadata.image_url || null;
      if (!matchedStory.summary && newStory.metadata.excerpt) {
        matchedStory.summary = newStory.metadata.excerpt;
        matchedStory.summary_kind = 'source_excerpt';
      }
      matchedStory.publisher = matchedStory.publisher || newStory.metadata.publisher || '';
      // Update existing cluster
      const idx = clusters.findIndex(c => c.canonical_url === matchedStory!.canonical_url);
      if (idx >= 0) {
        clusters[idx] = matchedStory;
      } else {
        clusters.push(matchedStory);
      }
    } else {
      // Create new cluster
      const fullText = `${newStory.metadata.title || ''} ${newStory.raw_content || ''}`;
      clusters.push({
        canonical_url: newStory.url,
        content_hash: await computeContentHash(newStory.raw_content || newStory.url),
        headline: newStory.metadata.title || '',
        summary: newStory.metadata.excerpt || newStory.raw_content || '',
        summary_kind: newStory.metadata.excerpt || newStory.raw_content ? 'source_excerpt' : 'none',
        image_url: newStory.metadata.image_url || null,
        event_date: newStory.metadata.published_at || null,
        publisher: newStory.metadata.publisher || '',
        source_count: 1,
        companies: [],
        investors: [],
        ai_topics: classifyAITopics(fullText),
        geography: null,
        event_type: classifyEventType(fullText),
        verification_label: 'unverified',
        last_checked_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        source_urls: [newStory.url],
        supporting_sources: [newStory.source_id],
      });
    }
  }

  for (const cluster of clusters) {
    const companyMatches = matchNames(cluster.headline || '', entities.companies);
    const fundMatches = matchNames(`${cluster.headline || ''} ${cluster.summary || ''}`, entities.funds);
    cluster.companies = companyMatches.map((company, index) => ({
      company_id: company.id, role: index === 0 ? 'primary' : 'mentioned',
    }));
    cluster.investors = fundMatches.map(fund => ({ fund_id: fund.id, role: 'mentioned' }));
  }

  return clusters;
}

async function saveClusteredStories(clusters: ClusteredStory[]): Promise<void> {
  const supabase = ingestionSupabase;

  for (const cluster of clusters) {
    // Upsert story
    const { data: story, error } = await supabase
      .from('stories')
      .upsert({
        canonical_url: cluster.canonical_url,
        content_hash: cluster.content_hash,
        headline: cluster.headline,
        summary: cluster.summary,
        summary_kind: cluster.summary_kind || (cluster.summary ? 'source_excerpt' : 'none'),
        image_url: cluster.image_url || null,
        event_date: cluster.event_date,
        publisher: cluster.publisher,
        source_count: cluster.source_count,
        ai_topics: cluster.ai_topics,
        geography: cluster.geography,
        event_type: cluster.event_type,
        verification_label: cluster.verification_label,
        last_checked_at: cluster.last_checked_at,
        source_urls: cluster.source_urls,
        supporting_sources: cluster.supporting_sources,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'canonical_url' })
      .select()
      .single();

    if (error || !story) throw new Error(`Story upsert failed: ${error?.message || 'no row returned'}`);

    // Link companies
    for (const company of cluster.companies) {
      const { error: linkError } = await supabase
        .from('story_companies')
        .upsert({
          story_id: story.id,
          company_id: company.company_id,
          role: company.role,
        }, { onConflict: 'story_id,company_id' });
      if (linkError) throw new Error(`Story company link failed: ${linkError.message}`);
    }

    // Link investors
    for (const investor of cluster.investors) {
      const { error: linkError } = await supabase
        .from('story_investors')
        .upsert({
          story_id: story.id,
          fund_id: investor.fund_id,
          role: investor.role,
        }, { onConflict: 'story_id,fund_id' });
      if (linkError) throw new Error(`Story investor link failed: ${linkError.message}`);
    }

    // Store source URLs with batched document_version_id lookup
    // Build a map of (source_id, url) -> document_version_id from source_archive
    const sourceUrlPairs = cluster.source_urls.map((url, idx) => ({
      url,
      source_id: cluster.supporting_sources[idx],
    })).filter(p => p.source_id);

    if (sourceUrlPairs.length > 0) {
      const { data: archiveItems } = await supabase
        .from('source_archive')
        .select('source_id, url, document_version_id')
        .in('source_id', [...new Set(sourceUrlPairs.map(p => p.source_id))])
        .in('url', [...new Set(sourceUrlPairs.map(p => p.url))]);

      const archiveMap = new Map<string, string>();
      for (const item of archiveItems || []) {
        archiveMap.set(`${item.source_id}|${item.url}`, item.document_version_id);
      }

      for (const pair of sourceUrlPairs) {
        const key = `${pair.source_id}|${pair.url}`;
        const document_version_id = archiveMap.get(key) || null;

        const { error: linkError } = await supabase
          .from('story_sources')
          .upsert({
            story_id: story.id,
            source_url: pair.url,
            document_version_id,
          }, { onConflict: 'story_id,source_url' });
        if (linkError) throw new Error(`Story source link failed: ${linkError.message}`);
      }
    }
  }
}

export async function runStoryClustering(): Promise<number> {
  const supabase = ingestionSupabase;

  // Fetch unprocessed items from source_archive
  const { data: archiveItems, error } = await supabase
    .from('source_archive')
    .select('*')
    .eq('processed', false)
    .limit(100);

  if (error) throw new Error(`Archive read failed: ${error.message}`);
  if (!archiveItems?.length) {
    console.log('No unprocessed archive items found');
    return 0;
  }

  // Convert to FetchResult format
  const newStories: FetchResult[] = archiveItems.map(item => ({
    source_id: item.source_id,
    url: item.url,
    fetched_at: item.fetched_at,
    content_hash: item.content_hash,
    raw_content: item.raw_content,
    metadata: item.metadata,
    permissions: item.permissions,
  }));

  // Cluster stories
  const [companies, funds] = await Promise.all([
    loadNamedEntities('companies'), loadNamedEntities('funds'),
  ]);
  const clusters = await clusterStories(newStories, { companies, funds });

  // Save clustered stories
  await saveClusteredStories(clusters);

  // Only acknowledge archive items once their story and source links are durable.
  const { error: updateError } = await supabase
    .from('source_archive')
    .update({ processed: true })
    .in('id', archiveItems.map(i => i.id));
  if (updateError) throw new Error(`Archive acknowledgement failed: ${updateError.message}`);

  console.log(`Clustered ${newStories.length} items into ${clusters.length} stories`);
  return newStories.length;
}