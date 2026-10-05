import { ingestionSupabase } from '@/lib/supabase/ingestion';
import type { Story } from '@/types';
import { JSDOM } from 'jsdom';

const STAGE_MAP: Record<string, string> = {
  'pre-seed': 'pre_seed',
  'pre_seed': 'pre_seed',
  'seed': 'seed',
  'series a': 'series_a',
  'series-a': 'series_a',
  'series b': 'series_b',
  'series-b': 'series_b',
  'series c': 'series_c',
  'series-c': 'series_c',
  'series d': 'series_d',
  'series-d': 'series_d',
  'series e': 'series_e',
  'series-e': 'series_e',
  'growth': 'growth',
  'late stage': 'growth',
  'late-stage': 'growth',
  'ipo': 'public',
  'public': 'public',
  'acquisition': 'acquisition',
  'grant': 'grant',
  'debt': 'debt',
  'convertible': 'convertible',
  'safe': 'safe',
};

interface FundingEvent {
  company_name: string;
  announced_date: string;
  round_stage: string;
  amount_usd?: number;
  amount_currency: string;
  lead_investors: string[];
  participant_investors: string[];
  source_urls: string[];
  verification_status: 'verified' | 'partial' | 'unverified' | 'conflicted';
  conflicts: any[];
}

function normalizeStage(stage: string): string {
  const normalized = stage.toLowerCase().trim();
  return STAGE_MAP[normalized] || 'other';
}

function parseAmount(text: string): { amount: number; currency: string } | null {
  const patterns = [
    /\$(\d+(?:\.\d+)?)\s*(?:million|M|m)\b/i,
    /\$(\d+(?:\.\d+)?)\s*(?:billion|B|b)\b/i,
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\b/,
    /(\d+(?:\.\d+)?)\s*(?:million|M|m)\s*(?:USD|dollars?)\b/i,
    /(\d+(?:\.\d+)?)\s*(?:billion|B|b)\s*(?:USD|dollars?)\b/i,
    /USD\s*(\d+(?:\.\d+)?)\s*(?:million|M|m)\b/i,
    /(\d+(?:\.\d+)?)\s*(?:million|billion)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let value = parseFloat(match[1].replace(/,/g, ''));
      if (pattern.source.includes('million|M|m') || pattern.source.includes('billion|B|b')) {
        if (pattern.source.includes('billion|B|b')) {
          value *= 1_000_000_000;
        } else {
          value *= 1_000_000;
        }
      }
      return { amount: Math.round(value), currency: 'USD' };
    }
  }
  return null;
}

function relatedName(relation: { canonical_name: string } | { canonical_name: string }[] | null): string | undefined {
  return Array.isArray(relation) ? relation[0]?.canonical_name : relation?.canonical_name;
}

async function fetchArticleContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'VentroBot/1.0 (+https://ventro.ai/bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!response.ok) return '';
    
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Try to find article content
    const article = document.querySelector('article') || 
                    document.querySelector('[role="article"]') ||
                    document.querySelector('.post-content') ||
                    document.querySelector('.entry-content') ||
                    document.querySelector('.article-body') ||
                    document.querySelector('main');
    
    if (article) {
      return article.textContent || '';
    }
    
    // Fallback: get all paragraph text
    const paragraphs = document.querySelectorAll('p');
    return Array.from(paragraphs).map(p => p.textContent).join('\n');
  } catch {
    return '';
  }
}

function detectConflicts(events: FundingEvent[]): any[] {
  const conflicts: any[] = [];
  
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      
      if (a.company_name.toLowerCase() === b.company_name.toLowerCase() &&
          a.announced_date === b.announced_date &&
          a.round_stage === b.round_stage) {
        
        if (a.amount_usd !== b.amount_usd && a.amount_usd && b.amount_usd) {
          conflicts.push({
            field: 'amount_usd',
            source_a: a.source_urls[0],
            source_b: b.source_urls[0],
            values: [a.amount_usd, b.amount_usd],
          });
        }
        
        const allInvestorsA = [...a.lead_investors, ...a.participant_investors];
        const allInvestorsB = [...b.lead_investors, ...b.participant_investors];
        const setA = new Set(allInvestorsA.map(x => x.toLowerCase()));
        const setB = new Set(allInvestorsB.map(x => x.toLowerCase()));
        
        const diffA = [...setA].filter(x => !setB.has(x));
        const diffB = [...setB].filter(x => !setA.has(x));
        
        if (diffA.length > 0 || diffB.length > 0) {
          conflicts.push({
            field: 'investors',
            source_a: a.source_urls[0],
            source_b: b.source_urls[0],
            values: { only_in_a: diffA, only_in_b: diffB },
          });
        }
      }
    }
  }
  
  return conflicts;
}

export async function extractFundingEvents(): Promise<void> {
  const supabase = ingestionSupabase;
  
  // Fetch known funds for matching
  const { data: funds } = await supabase
    .from('funds')
    .select('id, canonical_name');
  // Fetch known companies for matching
  const { data: companies } = await supabase
    .from('companies')
    .select('id, canonical_name, canonical_domain');
  const knownCompanies = new Map<string, string>();
  for (const c of companies || []) {
    knownCompanies.set(c.canonical_name.toLowerCase(), c.id);
    if (c.canonical_domain) {
      knownCompanies.set(c.canonical_domain.toLowerCase(), c.id);
    }
  }
  
  // Fetch verified stories with funding event type
  const { data: stories } = await supabase
    .from('stories')
    .select(`
      id,
      headline,
      summary,
      event_date,
      publisher,
      source_urls,
      verification_label,
      story_sources (source_url, publisher, published_at),
      story_companies (company_id, companies!inner (canonical_name)),
      story_investors (fund_id, role, funds!inner (canonical_name))
    `)
    .eq('event_type', 'funding')
    .in('verification_label', ['verified', 'partial'])
    .order('event_date', { ascending: false })
    .limit(200);
  
  if (!stories?.length) {
    console.log('No funding stories found');
    return;
  }
  
  const extractedEvents: FundingEvent[] = [];
  
  for (const story of stories) {
    const baseText = `${story.headline} ${story.summary}`.toLowerCase();
    
    // Fetch full article content from first source for funded events
    const firstSourceUrl = story.source_urls?.[0] || (story.story_sources?.[0]?.source_url);
    const articleContent = firstSourceUrl ? await fetchArticleContent(firstSourceUrl) : '';
    const fullText = `${baseText} ${articleContent.toLowerCase()}`;
    
    const allUrls = [...new Set([
      ...story.source_urls || [],
      ...(story.story_sources || []).map(s => s.source_url).filter(Boolean)
    ])];
    
    // Match companies
    const companyNames = (story.story_companies || []).map((sc: any) => relatedName(sc.companies)).filter(Boolean);
    const companyName = companyNames[0] || 'Unknown';
    
    // A name mention is not evidence of participation in this particular round.
    const storyInvestors = story.story_investors || [];
    const leadInvestors = storyInvestors.filter((si: any) => si.role === 'lead')
      .map((si: any) => relatedName(si.funds)).filter(Boolean) as string[];
    const participantInvestors = storyInvestors.filter((si: any) => si.role === 'participant')
      .map((si: any) => relatedName(si.funds)).filter(Boolean) as string[];
    
    // Parse amount
    const amountInfo = parseAmount(fullText);
    
    // Normalize stage
    const stageMatch = fullText.match(/(pre-?seed|seed|series [a-e]|growth|late.?stage|ipo|public|acquisition|grant|debt|convertible|safe)/i);
    const roundStage = stageMatch ? normalizeStage(stageMatch[1]) : 'other';
    
    const event: FundingEvent = {
      company_name: companyName,
      announced_date: story.event_date || new Date().toISOString(),
      round_stage: roundStage,
      amount_usd: amountInfo?.amount,
      amount_currency: amountInfo?.currency || 'USD',
      lead_investors: leadInvestors,
      participant_investors: participantInvestors,
      source_urls: allUrls,
      verification_status: story.verification_label === 'verified' ? 'verified' : 'partial',
      conflicts: [],
    };
    
    extractedEvents.push(event);
  }
  
  // Detect conflicts
  const conflicts = detectConflicts(extractedEvents);
  for (const conflict of conflicts) {
    // Add to relevant events
    for (const event of extractedEvents) {
      if (event.source_urls[0] === conflict.source_a || event.source_urls[0] === conflict.source_b) {
        event.conflicts.push(conflict);
        event.verification_status = 'conflicted';
      }
    }
  }
  
  // Upsert funding rounds and participants
  for (const event of extractedEvents) {
    const companyId = knownCompanies.get(event.company_name.toLowerCase());
    if (!companyId) {
      console.log(`Company not found: ${event.company_name}`);
      continue;
    }
    
    // Upsert funding round
    const { data: round, error: roundError } = await supabase
      .from('funding_rounds')
      .upsert({
        company_id: companyId,
        announced_date: event.announced_date,
        round_stage: event.round_stage,
        amount_usd: event.amount_usd,
        amount_currency: event.amount_currency,
        amount_source_url: event.source_urls[0],
        lead_investor_ids: [], // Will populate after participants
        source_urls: event.source_urls,
        verification_status: event.verification_status,
        conflicts: event.conflicts.length > 0 ? event.conflicts : null,
      }, { onConflict: 'company_id,announced_date,round_stage' })
      .select()
      .single();
    
    if (roundError) {
      console.error('Failed to upsert round:', roundError.message);
      continue;
    }
    
    // Upsert participants
    const allInvestors = [...event.lead_investors, ...event.participant_investors];
    const leadInvestorIds: string[] = [];
    
    for (const investorName of allInvestors) {
      const fund = funds?.find(f => f.canonical_name === investorName);
      if (!fund) continue;
      
      const role = event.lead_investors.includes(investorName) ? 'lead' : 'participant';
      if (role === 'lead') leadInvestorIds.push(fund.id);
      
      await supabase
        .from('round_participants')
        .upsert({
          round_id: round.id,
          fund_id: fund.id,
          role,
          source_urls: event.source_urls,
          verification_status: event.verification_status,
        }, { onConflict: 'round_id,fund_id,fund_vehicle_id' });
    }
    
    // Update round with lead investor IDs
    await supabase
      .from('funding_rounds')
      .update({ lead_investor_ids: leadInvestorIds })
      .eq('id', round.id);
  }
  
  console.log(`Extracted ${extractedEvents.length} funding events, ${conflicts.length} conflicts`);
}

export async function computeInvestorGraph(): Promise<void> {
  // Materialized view is automatic via investment_graph
  console.log('Investment graph view ready');
}
