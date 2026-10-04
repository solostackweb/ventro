import { ingestionSupabase } from '@/lib/supabase/ingestion';
import { Story } from '@/types';
import { JSDOM } from 'jsdom';

interface StatedThesisExcerpt {
  text: string;
  source_url: string;
  source_type: 'blog' | 'interview' | 'podcast' | 'twitter' | 'sec_filing' | 'other';
  date_stated: string;
  attribution: string;
}

interface ObservedThesis {
  methodology: string;
  period_start: string;
  period_end: string;
  sample_size: number;
  themes: Array<{
    theme: string;
    company_count: number;
    deal_count: number;
    percentage: number;
  }>;
  confidence: 'high' | 'medium' | 'low';
  caveats: string;
}

const AI_THEMES = [
  'foundation_models',
  'infrastructure',
  'applications',
  'robotics',
  'hardware',
  'research',
] as const;

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function classifySourceType(url: string, html: string): 'blog' | 'interview' | 'podcast' | 'twitter' | 'sec_filing' | 'other' {
  const domain = extractDomain(url);
  const lowerHtml = html.toLowerCase();
  
  if (domain.includes('twitter.com') || domain.includes('x.com')) return 'twitter';
  if (domain.includes('sec.gov') || lowerHtml.includes('form d') || lowerHtml.includes('edgar')) return 'sec_filing';
  if (lowerHtml.includes('podcast') || domain.includes('spotify.com') || domain.includes('apple.com/podcasts')) return 'podcast';
  if (lowerHtml.includes('interview') || lowerHtml.includes('q&a') || lowerHtml.includes('q and a')) return 'interview';
  if (domain.includes('blog') || lowerHtml.includes('blog post') || lowerHtml.includes('article')) return 'blog';
  
  return 'other';
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
    
    const article = document.querySelector('article') || 
                    document.querySelector('[role="article"]') ||
                    document.querySelector('.post-content') ||
                    document.querySelector('.entry-content') ||
                    document.querySelector('.article-body') ||
                    document.querySelector('main');
    
    if (article) {
      return article.textContent || '';
    }
    
    const paragraphs = document.querySelectorAll('p');
    return Array.from(paragraphs).map(p => p.textContent).join('\n');
  } catch {
    return '';
  }
}

async function extractStatedThesisFromSource(fundId: string, sourceUrl: string): Promise<StatedThesisExcerpt | null> {
  const content = await fetchArticleContent(sourceUrl);
  if (!content || content.length < 200) return null;
  
  // Look for thesis-related keywords
  const thesisKeywords = [
    'thesis', 'focus', 'invest in', 'looking for', 'interested in',
    'seeking', 'believe', 'strategy', 'approach', 'criteria',
    'vertical', 'horizontal', 'stage', 'geography', 'check size',
    'lead', 'follow', 'valuation', 'ownership', 'portfolio construction'
  ];
  
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 50);
  const thesisSentences = sentences.filter(sentence => {
    const lower = sentence.toLowerCase();
    return thesisKeywords.some(kw => lower.includes(kw));
  });
  
  if (thesisSentences.length === 0) return null;
  
  // Take top 3 most relevant sentences
  const excerpt = thesisSentences.slice(0, 3).join('. ').trim() + '.';
  
  // Extract date from content or use current
  const dateMatch = content.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},\s+\d{4})/);
  const dateStated = dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString();
  
  // Extract attribution (author name)
  const attributionMatch = content.match(/(?:by|author|written by)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
  const attribution = attributionMatch ? attributionMatch[1] : 'Unknown';
  
  return {
    text: excerpt,
    source_url: sourceUrl,
    source_type: classifySourceType(sourceUrl, content),
    date_stated: dateStated,
    attribution,
  };
}

export async function extractStatedThesis(fundId: string): Promise<void> {
  const supabase = ingestionSupabase;
  
  // Get fund's source links
  const { data: fund } = await supabase
    .from('funds')
    .select('id, canonical_name, source_links')
    .eq('id', fundId)
    .single();
  
  if (!fund || !fund.source_links?.length) {
    console.log(`No source links for fund ${fundId}`);
    return;
  }
  
  const excerpts: StatedThesisExcerpt[] = [];
  
  for (const sourceUrl of fund.source_links) {
    try {
      const excerpt = await extractStatedThesisFromSource(fundId, sourceUrl);
      if (excerpt) {
        excerpts.push(excerpt);
      }
    } catch (err) {
      console.error(`Failed to extract thesis from ${sourceUrl}:`, err);
    }
  }
  
  if (excerpts.length === 0) {
    console.log(`No thesis excerpts found for fund ${fundId}`);
    return;
  }
  
  // Upsert stated thesis excerpts
  for (const excerpt of excerpts) {
    await supabase
      .from('stated_thesis')
      .upsert({
        fund_id: fundId,
        text: excerpt.text,
        source_url: excerpt.source_url,
        source_type: excerpt.source_type,
        date_stated: excerpt.date_stated,
      }, { onConflict: 'fund_id,source_url' });
  }
  
  console.log(`Extracted ${excerpts.length} thesis excerpts for fund ${fundId}`);
}

export async function computeObservedThesis(fundId: string): Promise<void> {
  const supabase = ingestionSupabase;
  
  // Get verified investments for this fund
  const { data: investments } = await supabase
    .from('investment_graph')
    .select(`
      company_id,
      company_name,
      company_ai_tags,
      company_country,
      announced_date,
      round_stage,
      amount_usd,
      participant_role
    `)
    .eq('fund_id', fundId)
    .eq('round_verification', 'verified')
    .eq('participant_verification', 'verified');
  
  if (!investments || investments.length < 3) {
    console.log(`Insufficient verified investments for fund ${fundId} (need >=3, have ${investments?.length || 0})`);
    return;
  }
  
  // Compute theme distribution
  const themeCounts: Record<string, { companies: Set<string>; deals: number }> = {};
  
  for (const inv of investments) {
    const tags = inv.company_ai_tags || [];
    for (const tag of tags) {
      if (!themeCounts[tag]) {
        themeCounts[tag] = { companies: new Set(), deals: 0 };
      }
      themeCounts[tag].companies.add(inv.company_id);
      themeCounts[tag].deals++;
    }
  }
  
  const totalDeals = investments.length;
  const themes = Object.entries(themeCounts)
    .map(([theme, data]) => ({
      theme,
      company_count: data.companies.size,
      deal_count: data.deals,
      percentage: Math.round((data.deals / totalDeals) * 100),
    }))
    .filter(t => t.percentage >= 5) // Only themes with >=5% of deals
    .sort((a, b) => b.percentage - a.percentage);
  
  // Determine confidence based on sample size
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (totalDeals >= 20) confidence = 'high';
  else if (totalDeals >= 10) confidence = 'medium';
  
  // Period
  const dates = investments.map(i => new Date(i.announced_date)).sort((a, b) => a.getTime() - b.getTime());
  const periodStart = dates[0].toISOString();
  const periodEnd = dates[dates.length - 1].toISOString();
  
  // Caveats
  const caveats = [
    `Based on ${totalDeals} disclosed AI investments`,
    'Private deals not visible',
    'Only includes verified rounds with source evidence',
  ].join('. ');
  
  const observedThesis: ObservedThesis = {
    methodology: 'Portfolio clustering analysis of verified AI investments using AI theme taxonomy',
    period_start: periodStart,
    period_end: periodEnd,
    sample_size: totalDeals,
    themes,
    confidence,
    caveats,
  };
  
  await supabase
    .from('observed_thesis')
    .upsert({
      fund_id: fundId,
      methodology: observedThesis.methodology,
      period_start: observedThesis.period_start,
      period_end: observedThesis.period_end,
      sample_size: observedThesis.sample_size,
      themes: observedThesis.themes,
      confidence: observedThesis.confidence,
      caveats: observedThesis.caveats,
      last_computed: new Date().toISOString(),
    }, { onConflict: 'fund_id' });
  
  console.log(`Computed observed thesis for fund ${fundId}: ${themes.length} themes, ${totalDeals} deals`);
}

export async function extractStatedThesisForAllFunds(): Promise<void> {
  const supabase = ingestionSupabase;
  
  const { data: funds } = await supabase
    .from('funds')
    .select('id, canonical_name, source_links')
    .not('source_links', 'is', null);
  
  for (const fund of funds || []) {
    if (fund.source_links?.length) {
      await extractStatedThesis(fund.id);
    }
  }
}

export async function computeObservedThesisForAllFunds(): Promise<void> {
  const supabase = ingestionSupabase;
  
  // Get funds with verified investments
  const { data: funds } = await supabase
    .from('funds')
    .select('id')
    .eq('verification_status', 'verified');
  
  for (const fund of funds || []) {
    await computeObservedThesis(fund.id);
  }
}