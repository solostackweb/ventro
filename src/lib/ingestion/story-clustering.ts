import { ingestionSupabase } from '@/lib/supabase/ingestion';
import { SourceConnector, FetchResult } from '@/types';
import crypto from 'crypto';

// Similarity threshold for content deduplication
const CONTENT_SIMILARITY_THRESHOLD = 0.85;
const TITLE_SIMILARITY_THRESHOLD = 0.9;

const EVENT_TYPE_KEYWORDS: Record<string, string[]> = {
  funding: ['raises', 'raised', 'funding', 'round', 'series', 'investment', 'investors', 'venture', 'capital', 'valuation', 'pre-seed', 'seed', 'series a', 'series b', 'series c', 'growth round', 'led by', 'backs', 'backed', 'invests', 'financing', 'closes'],
  launch: ['launches', 'launch', 'released', 'release', 'announces', 'announce', 'unveils', 'unveil', 'introduces', 'introduce', 'debut', 'preview', 'beta', 'general availability', 'ga', 'ships', 'shipping'],
  partnership: ['partners', 'partnership', 'collaboration', 'collaborate', 'alliance', 'joint venture', 'integration', 'integrates', 'teams up', 'ally', 'allies'],
  research: ['research', 'paper', 'study', 'benchmark', 'model', 'architecture', 'training', 'dataset', 'arxiv', 'published', 'findings', 'analyzes', 'analysis'],
  acquisition: ['acquires', 'acquisition', 'acquired', 'merger', 'mergers', 'buys', 'buyout', 'takeover', 'acquihire'],
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

interface ClusteredStory {
  canonical_url: string;
  content_hash: string;
  headline: string;
  summary: string;
  event_date: string | null;
  publisher: string;
  source_count: number;
  companies: any[];
  investors: any[];
  ai_topics: string[];
  geography: string | null;
  event_type: string;
  verification_label: string;
  last_checked_at: string;
  created_at: string;
  source_urls: string[];
  supporting_sources: string[];
}

async function computeContentHash(content: string): Promise<string> {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 32);
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

export async function clusterStories(newStories: any[]): Promise<any[]> {
  const supabase = ingestionSupabase;
  const clusters: any[] = [];
  
  // Fetch existing stories for deduplication
  const { data: existingStories, error: existingError } = await supabase
    .from('stories')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (existingError) throw new Error(`Story lookup failed: ${existingError.message}`);
  
  const existingMap = new Map<string, any>();
  for (const story of existingStories || []) {
    existingMap.set(story.canonical_url, story);
  }
  
  for (const newStory of newStories) {
    let matchedStory: any = null;
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
        summary: newStory.raw_content || '',
        event_date: newStory.metadata.published_at || null,
        publisher: newStory.metadata.publisher || '',
        source_count: 1,
        companies: [],
        investors: [],
        ai_topics: [],
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
  
  return clusters;
}

async function saveClusteredStories(clusters: any[]): Promise<void> {
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
    for (const company of Array.isArray(cluster.companies) ? cluster.companies : []) {
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
    for (const investor of Array.isArray(cluster.investors) ? cluster.investors : []) {
      const { error: linkError } = await supabase
        .from('story_investors')
        .upsert({
          story_id: story.id,
          fund_id: investor.fund_id,
          role: investor.role,
        }, { onConflict: 'story_id,fund_id' });
      if (linkError) throw new Error(`Story investor link failed: ${linkError.message}`);
    }
    
    // Store source URLs
    for (const url of cluster.source_urls) {
      const { error: linkError } = await supabase
        .from('story_sources')
        .upsert({
          story_id: story.id,
          source_url: url,
        }, { onConflict: 'story_id,source_url' });
      if (linkError) throw new Error(`Story source link failed: ${linkError.message}`);
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
  const newStories = archiveItems.map(item => ({
    source_id: item.source_id,
    url: item.url,
    fetched_at: item.fetched_at,
    content_hash: item.content_hash,
    raw_content: item.raw_content,
    metadata: item.metadata,
    permissions: item.permissions,
  }));
  
  // Cluster stories
  const clusters = await clusterStories(newStories);
  
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
