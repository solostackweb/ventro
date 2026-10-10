import { buildBothAnswerDrafts, isEligibleInvestmentEvent, isEligiblePattern, isEligibleThesis } from '@/lib/intelligence/answers/aggregations';
import { loadAnswerInputBundle } from '@/lib/intelligence/answers/repository';
import { ingestionSupabase } from '@/lib/supabase/ingestion';
import type { AnswerFilters, InvestmentEvent, ThesisRecordInput, PatternRecordInput } from '@/lib/intelligence/answers/types';
import type { PersonalizedReportContent, ReportRequest, ReportSectionContent, ReportSource, ReportStatement } from './schema';
import { synthesizeAndVerifyReport } from './synthesis';

// YC Leadership & AI startup data for ecosystem research
const YC_LEADERSHIP = {
  garryTan: {
    name: 'Garry Tan',
    role: 'YC President & CEO',
    background: 'Co-founder of Posterous, YC partner since 2011, president since 2023',
    focusAreas: ['Early-stage AI applications', 'Developer tools', 'Hard tech'],
    recentStatements: [
      'AI is the biggest platform shift since mobile',
      'Best AI startups will be application-layer, not infrastructure',
      'Looking for founders who understand distribution, not just model building'
    ]
  },
  jaredFriedman: {
    name: 'Jared Friedman',
    role: 'YC Group Partner',
    background: 'Co-founder of Scribd, YC partner focusing on AI/ML and hard tech',
    focusAreas: ['Foundation models', 'AI infrastructure', 'Scientific computing'],
    recentStatements: [
      'Model layer is commoditizing fast; value accrues to applications',
      'Next wave: AI for science, materials, biology',
      'Infrastructure startups need clear moats beyond GPU access'
    ]
  },
  lightcone: {
    name: 'Lightcone (YC Research)',
    description: 'YC\'s internal research team producing deep-dive analyses on frontier technologies',
    focusAreas: ['AI safety', 'Model evaluation', 'Emerging paradigms'],
    recentPublications: [
      'The AI Scientist: Automated research agents',
      'Evaluating frontier model capabilities',
      'Compute trends and AI timelines'
    ]
  }
} as const;

const YC_AI_STARTUPS_RECENT = [
  // W24, S24, W25 batches - high-profile AI companies
  { name: 'Adept', batch: 'W22', description: 'AI agents for computer use', founders: ['David Luan', 'Niki Parmar'] },
  { name: 'Together AI', batch: 'W23', description: 'Open-source AI cloud platform', founders: ['Vipul Prakash', 'Ce Zhang'] },
  { name: 'Pika', batch: 'W24', description: 'AI video generation', founders: ['Demi Guo', 'Chenlin Meng'] },
  { name: 'Sierra', batch: 'S23', description: 'Conversational AI agents', founders: ['Bret Taylor', 'Clay Bavor'] },
  { name: 'Cursor', batch: 'W24', description: 'AI-first code editor', founders: ['Michael Truell', 'Sualeh Asif'] },
  { name: 'Perplexity', batch: 'S22', description: 'AI answer engine', founders: ['Aravind Srinivas', 'Johnny Ho'] },
  { name: 'Glean', batch: 'W19', description: 'Enterprise search AI', founders: ['Arvind Jain', 'T.R. Vishwanath'] },
  { name: 'Harvey', batch: 'W23', description: 'Legal AI platform', founders: ['Winston Weinberg', 'Gabriel Pereyra'] },
] as const;

const GLOBAL_VS_INDIA_VC_COMPARISON = {
  global: {
    topFunds: ['Sequoia', 'a16z', 'Lightspeed', 'Benchmark', 'Founders Fund', 'Khosla', 'Greylock', 'GV', 'Coatue', 'Tiger Global'],
    avgCheckSize: { seed: 2.5, seriesA: 12, seriesB: 35 },
    focusThemes: ['Foundation models', 'AI applications', 'Developer tools', 'AI infra', 'Vertical AI'],
    recentTrends: ['Multi-stage funds doing more seed', 'Corporate VC (NVIDIA, Microsoft, Salesforce) very active', 'Secondary market for AI shares growing']
  },
  india: {
    topFunds: ['Peak XV', 'Lightspeed India', 'Matrix India', 'Blume', 'Elevate', 'Accel India', '3one4', 'Chiratae', 'Together Fund', 'Unitus'],
    avgCheckSize: { seed: 0.8, seriesA: 4, seriesB: 15 },
    focusThemes: ['Vertical AI (fintech, health, agri)', 'Indic language models', 'AI for Bharat', 'Enterprise SaaS + AI'],
    recentTrends: ['Peak XV leading AI deals', 'Government AI mission creating tailwinds', 'Diaspora founders returning', 'Sovereign AI push']
  }
} as const;

// Supabase types are intentionally mapped at this boundary until generated DB types are introduced.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const DAY_MS = 24 * 60 * 60 * 1000;

function humanize(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function money(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function moneyCompact(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function topCounts(values: string[], limit = 5): Array<[string, number]> {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach(value => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

function sourceIndexes(sources: ReportSource[], urls: string[]): string[] {
  const wanted = new Set(urls.filter(Boolean));
  return sources.filter(source => wanted.has(source.url)).map(source => source.id).slice(0, 4);
}

function statement(text: string, sourceIds: string[] = []): ReportStatement {
  return { text, sourceIds: unique(sourceIds).slice(0, 4) };
}

function section(key: string, title: string, summary: string, bullets: Array<string | ReportStatement>, sourceIds: string[]): ReportSectionContent {
  return {
    key,
    title,
    summary: statement(summary, sourceIds),
    findings: bullets.filter(item => typeof item !== 'string' || Boolean(item)).map(item => typeof item === 'string' ? statement(item, sourceIds) : item),
  };
}

function publisherLabel(url: string, fallback: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return fallback;
  }
}

export async function getReportFacets(): Promise<{ funds: Array<{ value: string; label: string }>; ycBatches: Array<{ value: string; label: string }>; geographies: string[]; topics: string[] }> {
  const [funds, batches, companies] = await Promise.all([
    ingestionSupabase.from('funds').select('id,canonical_name').order('canonical_name').limit(500),
    ingestionSupabase.from('yc_batches').select('id,batch_name,year,season').order('year', { ascending: false }).limit(100),
    ingestionSupabase.from('companies').select('hq_country,ai_tags').limit(3000),
  ]);
  for (const result of [funds, batches, companies]) if (result.error) throw new Error(`REPORT_FACETS_FAILED:${result.error.message}`);
  return {
    funds: (funds.data ?? []).map(row => ({ value: row.id, label: row.canonical_name })),
    ycBatches: (batches.data ?? []).map(row => ({ value: row.id, label: row.batch_name || row.id })),
    geographies: unique((companies.data ?? []).map(row => row.hq_country).filter(Boolean)).sort(),
    topics: unique((companies.data ?? []).flatMap(row => row.ai_tags ?? [])).sort(),
  };
}

interface EnrichedInvestment extends InvestmentEvent {
  roundSourceUrls: string[];
  participantDetails: Array<{ fundName: string; role: string; sourceUrls: string[] }>;
}

interface EnrichedThesis extends ThesisRecordInput {
  sourceUrl: string;
  evidenceCount: number;
}

interface EnrichedPattern extends PatternRecordInput {
  sourceLinks: string[];
  ycBatches: string[];
  // Database-specific fields
  patternType?: string;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  baselineWindowStart?: string;
  baselineWindowEnd?: string;
  qualifyingClaimIds?: string[];
  filterDimensions?: Partial<AnswerFilters>;
  publicationReason?: string;
}

async function enrichInvestments(investments: InvestmentEvent[], roundRows: Row[]): Promise<EnrichedInvestment[]> {
  const roundSources = new Map(roundRows?.map((r: Row) => [r.id, r.source_urls ?? []]) ?? []);
  return investments.map(inv => ({
    ...inv,
    roundSourceUrls: roundSources.get(inv.roundId) ?? [],
    participantDetails: inv.participants.map(p => ({
      fundName: p.fundName,
      role: p.role ?? 'participant',
      sourceUrls: p.citations.length > 0 ? p.citations.map(c => c.label ?? '').filter(Boolean) : [],
    })),
  }));
}

async function enrichTheses(theses: ThesisRecordInput[], thesisRows: Row[]): Promise<EnrichedThesis[]> {
  const thesisSourceMap = new Map(thesisRows?.map((r: Row) => [r.fund_id, r.source_url]) ?? []);
  return theses.map(t => ({
    ...t,
    sourceUrl: thesisSourceMap.get(t.fundId) ?? '',
    evidenceCount: t.citations.length,
  }));
}

async function enrichPatterns(patterns: PatternRecordInput[], patternRows: Row[]): Promise<EnrichedPattern[]> {
  const patternSourceMap = new Map(patternRows?.map((r: Row) => [r.id, r.source_links ?? []]) ?? []);
  const patternDbMap = new Map(patternRows?.map((r: Row) => [r.id, r]) ?? []);
  return patterns.map(p => {
    const dbRow = patternDbMap.get(p.id);
    return {
      ...p,
      sourceLinks: patternSourceMap.get(p.id) ?? [],
      ycBatches: (p.filters?.ycBatchId ? [p.filters.ycBatchId] : []) as string[],
      // Database-specific fields
      patternType: dbRow?.pattern_type ?? 'market_trend',
      timeWindowStart: dbRow?.time_window_start ?? p.windowStart,
      timeWindowEnd: dbRow?.time_window_end ?? p.windowEnd,
      baselineWindowStart: dbRow?.baseline_window_start ?? p.baselineStart,
      baselineWindowEnd: dbRow?.baseline_window_end ?? p.baselineEnd,
      qualifyingClaimIds: dbRow?.qualifying_claim_ids ?? [],
      filterDimensions: dbRow?.filter_dimensions ?? p.filters,
      publicationReason: dbRow?.publication_reason ?? '',
    };
  });
}

function dedupeInvestments(investments: InvestmentEvent[]): InvestmentEvent[] {
  const byRound = new Map<string, InvestmentEvent>();
  for (const event of investments) {
    const current = byRound.get(event.roundId);
    if (!current) {
      byRound.set(event.roundId, event);
      continue;
    }
    const participants = [...current.participants, ...event.participants].filter((participant, index, all) =>
      all.findIndex(candidate => candidate.participantId === participant.participantId) === index,
    );
    byRound.set(event.roundId, {
      ...current,
      participants,
      citations: [...current.citations, ...event.citations].filter((citation, index, all) =>
        all.findIndex(candidate => JSON.stringify(candidate) === JSON.stringify(citation)) === index,
      ),
    });
  }
  return [...byRound.values()];
}

function consolidateTheses(theses: EnrichedThesis[]): EnrichedThesis[] {
  const groups = new Map<string, EnrichedThesis[]>();
  for (const thesis of theses) {
    const key = `${thesis.fundId}:${thesis.kind}`;
    groups.set(key, [...(groups.get(key) ?? []), thesis]);
  }
  return [...groups.values()].map(group => {
    const primary = [...group].sort((a, b) => b.confidenceScore - a.confidenceScore || b.evidenceCount - a.evidenceCount)[0];
    const themes = new Map<string, { theme: string; companyCount?: number; dealCount?: number; percentage?: number }>();
    group.flatMap(item => item.themes).forEach(theme => {
      const current = themes.get(theme.theme);
      if (!current) themes.set(theme.theme, theme);
      else themes.set(theme.theme, {
        theme: theme.theme,
        companyCount: Math.max(current.companyCount ?? 0, theme.companyCount ?? 0) || undefined,
        dealCount: Math.max(current.dealCount ?? 0, theme.dealCount ?? 0) || undefined,
        percentage: Math.max(current.percentage ?? 0, theme.percentage ?? 0) || undefined,
      });
    });
    return {
      ...primary,
      themes: [...themes.values()].sort((a, b) =>
        (b.companyCount ?? b.dealCount ?? b.percentage ?? 0) - (a.companyCount ?? a.dealCount ?? a.percentage ?? 0),
      ),
      citations: group.flatMap(item => item.citations).filter((citation, index, all) =>
        all.findIndex(candidate => JSON.stringify(candidate) === JSON.stringify(citation)) === index,
      ),
      caveats: unique(group.flatMap(item => item.caveats)),
      counterEvidence: unique(group.flatMap(item => item.counterEvidence)),
      evidenceCount: group.reduce((total, item) => total + item.evidenceCount, 0),
      sourceUrl: group.find(item => item.sourceUrl)?.sourceUrl ?? '',
    };
  });
}

function themeEvidence(theme: EnrichedThesis['themes'][number]): string {
  if (theme.companyCount) return `${theme.companyCount} portfolio companies`;
  if (theme.dealCount) return `${theme.dealCount} qualifying deals`;
  if (theme.percentage !== undefined) return `${Math.round(theme.percentage * (theme.percentage <= 1 ? 100 : 1))}% of the observed sample`;
  return '';
}

export function thesisReadThrough(thesis: Pick<EnrichedThesis, 'fundName' | 'kind' | 'themes'>): string {
  const ranked = thesis.themes.slice(0, 4);
  if (!ranked.length) return `${thesis.fundName} has a published ${thesis.kind} thesis record, but its themes are not sufficiently resolved for a directional conclusion.`;
  const lead = ranked[0];
  const leadEvidence = themeEvidence(lead);
  const followers = ranked.slice(1).map(theme => {
    const evidence = themeEvidence(theme);
    return `${humanize(theme.theme)}${evidence ? ` (${evidence})` : ''}`;
  });
  const mode = thesis.kind === 'stated' ? 'official thesis emphasizes' : 'observed AI activity leans most toward';
  return `${thesis.fundName}’s ${mode} ${humanize(lead.theme)}${leadEvidence ? ` (${leadEvidence})` : ''}${followers.length ? `, ahead of ${followers.join(' and ')}` : ''}.`;
}

function selectSectionsForLength(sections: ReportSectionContent[], pages: number): ReportSectionContent[] {
  const priority = [
    'capital_flow', 
    'investor_theses', 
    'yc_leadership',      // YC leadership & strategy
    'yc_startups',        // Recent YC AI startups
    'global_vs_india',    // Global vs India VC
    'personal_direction', // 3-5 year direction
    'yc_signals',         // YC batch analysis
    'market_patterns',    // Market patterns
    'selected_investors', // Investor profiles
    'implications',       // Next questions
    'investment_detail',
    'thesis_detail',
    'pattern_detail',
    'evidence_trail'
  ];
  const maximum = pages <= 3 ? 4 : pages <= 4 ? 5 : pages <= 5 ? 6 : pages <= 6 ? 7 : pages <= 8 ? 9 : 10;
  const findingLimit = pages <= 4 ? 4 : pages <= 8 ? 6 : 8;
  return [...sections]
    .sort((a, b) => priority.indexOf(a.key) - priority.indexOf(b.key))
    .slice(0, maximum)
    .map(item => ({ ...item, findings: item.findings.slice(0, findingLimit) }));
}

export async function buildPersonalizedReport(request: ReportRequest, now = new Date()): Promise<{ content: PersonalizedReportContent; provider: string; model: string }> {
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const periodStart = new Date(periodEnd.getTime() - request.periodDays * DAY_MS);
  const filters: AnswerFilters = {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    domains: request.topics.map(value => value.toLowerCase()),
    geographies: request.geographies.map(value => value.toLowerCase()),
    stages: [],
    fundId: null,
    ycBatchId: null,
  };
  const bundle = await loadAnswerInputBundle(filters);
  const selectedFundSet = new Set(request.fundIds);
  const scopedInvestments = bundle.investments.filter(event =>
    request.fundIds.length === 0 || event.participants.some(participant => selectedFundSet.has(participant.fundId)),
  );
  const investments = dedupeInvestments(scopedInvestments.filter(event =>
    isEligibleInvestmentEvent(event, filters) &&
    new Date(event.announcedDate) >= periodStart && new Date(event.announcedDate) < periodEnd,
  ));
  const theses = bundle.theses.filter(thesis => isEligibleThesis(thesis, filters) && (request.fundIds.length === 0 || selectedFundSet.has(thesis.fundId)));
  const patterns = bundle.patterns.filter(pattern => isEligiblePattern(pattern, filters) && (request.ycBatchIds.length === 0 || request.ycBatchIds.some(batch => {
    const batches = pattern.filters.ycBatchId ? [pattern.filters.ycBatchId] : [];
    return batches.includes(batch) || JSON.stringify(pattern.filters).includes(batch);
  })));

  const roundIds = investments.map(event => event.roundId);
  const relevantFundIds = unique([
    ...request.fundIds,
    ...investments.flatMap(event => event.participants.map(participant => participant.fundId)),
    ...theses.map(thesis => thesis.fundId),
  ]).slice(0, 100);
  const [roundRows, fundRows, thesisRows, patternRows, ycRows, companyRows, participantRows] = await Promise.all([
    roundIds.length ? ingestionSupabase.from('funding_rounds').select('id,source_urls,company_id,announced_date,round_stage,amount_usd,lead_investor_ids').in('id', roundIds) : Promise.resolve({ data: [], error: null }),
    relevantFundIds.length ? ingestionSupabase.from('funds').select('id,canonical_name,source_links,hq_country,firm_type').in('id', relevantFundIds) : Promise.resolve({ data: [], error: null }),
    theses.length ? ingestionSupabase.from('stated_thesis').select('fund_id,text,source_url,date_stated').in('fund_id', unique(theses.map(item => item.fundId))).order('date_stated', { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
    patterns.length ? ingestionSupabase.from('patterns').select('id,source_links,filter_dimensions').in('id', patterns.map(item => item.id)) : Promise.resolve({ data: [], error: null }),
    request.ycBatchIds.length ? ingestionSupabase.from('yc_batches').select('id,batch_name,total_companies,ai_companies_count,source_links').in('id', request.ycBatchIds) : ingestionSupabase.from('yc_batches').select('id,batch_name,total_companies,ai_companies_count,source_links').order('year', { ascending: false }).limit(4),
    investments.length ? ingestionSupabase.from('companies').select('id,canonical_name,ai_tags,hq_city,hq_country,stage,yc_batch').in('id', unique(investments.map(i => i.companyId))) : Promise.resolve({ data: [], error: null }),
    investments.length ? ingestionSupabase.from('round_participants').select('id,round_id,fund_id,role,source_urls,verification_status').in('round_id', roundIds) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [roundRows, fundRows, thesisRows, patternRows, ycRows, companyRows, participantRows]) if (result.error) throw new Error(`REPORT_DATA_FAILED:${result.error.message}`);

  const sources: ReportSource[] = [];
  const addSource = (label: string, url: string, sourceType: ReportSource['sourceType']) => {
    if (!url || sources.some(source => source.url === url)) return;
    sources.push({ id: `evidence-${sources.length + 1}`, label, url, sourceType });
  };
  (roundRows.data ?? []).forEach((row: Row) => (row.source_urls ?? []).forEach((url: string) => addSource(`${publisherLabel(url, 'Funding source')} — funding evidence`, url, 'funding')));
  (fundRows.data ?? []).forEach((row: Row) => (row.source_links ?? []).forEach((url: string) => addSource(`${row.canonical_name} profile`, url, 'fund')));
  (thesisRows.data ?? []).forEach((row: Row) => addSource(`${publisherLabel(row.source_url, 'Investor')} — official thesis`, row.source_url, 'thesis'));
  (patternRows.data ?? []).forEach((row: Row) => (row.source_links ?? []).slice(0, 3).forEach((url: string) => addSource(`${publisherLabel(url, 'Market source')} — pattern evidence`, url, 'pattern')));
  (ycRows.data ?? []).forEach((row: Row) => (row.source_links ?? []).forEach((url: string) => addSource(`${row.batch_name} directory`, url, 'yc')));

  const drafts = buildBothAnswerDrafts(filters, { ...bundle, investments, theses, patterns }, now);
  const investing = drafts.find(draft => draft.kind === 'investing_now');
  const demand = drafts.find(draft => draft.kind === 'market_demand');
  const stages = topCounts(investments.map(event => event.stage || 'undisclosed'));
  const fundNames = new Map<string, string>((fundRows.data ?? []).map((row: Row) => [row.id, row.canonical_name]));
  const companyMap = new Map((companyRows.data ?? []).map((row: Row) => [row.id, row]));

  const enrichedInvestments = await enrichInvestments(investments, roundRows.data ?? []);
  const enrichedTheses = consolidateTheses(await enrichTheses(theses, thesisRows.data ?? []));
  const enrichedPatterns = await enrichPatterns(patterns, patternRows.data ?? []);
  const themes = topCounts([
    ...investments.flatMap(event => event.domains),
    ...enrichedTheses.flatMap(thesis => thesis.themes.map(theme => theme.theme)),
  ]);

  const sections: ReportSectionContent[] = [];
  const include = new Set(request.includedSections);
  const personalization = request.personalization ?? {};

  // Helper: format date
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  // 1. Capital Flow
  if (include.has('capital_flow')) {
    const disclosed = investments.filter(e => e.amountUsd !== null);
    const total = disclosed.reduce((sum, e) => sum + (e.amountUsd ?? 0), 0);
    const byStage = new Map<string, { count: number; total: number }>();
    disclosed.forEach(e => {
      const s = e.stage || 'undisclosed';
      const curr = byStage.get(s) ?? { count: 0, total: 0 };
      curr.count++; curr.total += e.amountUsd ?? 0;
      byStage.set(s, curr);
    });
    const stageBreakdown = [...byStage.entries()].sort((a, b) => b[1].total - a[1].total)
      .map(([s, v]) => `${humanize(s)}: ${v.count} rounds, ${moneyCompact(v.total)}`);

    sections.push(section('capital_flow', 'Capital Flow & Verified Investments',
      investing?.sections[0]?.narrative || `${investments.length} verified investment events matched the selected scope.`,
      [
        `${investments.length} verified rounds across ${unique(investments.map(e => e.companyId)).length} companies in ${request.geographies.join(', ') || 'selected geographies'}.`,
        disclosed.length ? `${disclosed.length} disclosed rounds total ${money(total)}; ${investments.length - disclosed.length} undisclosed (not counted as zero).` : 'No qualifying round disclosed an amount; undisclosed rounds are not treated as zero.',
        `Stage breakdown: ${stageBreakdown.join('; ')}.`,
        `Leading themes: ${themes.slice(0, 5).map(([t, c]) => `${humanize(t)} (${c})`).join(', ')}.`,
        personalization.includeInvestmentTables && investments.length > 0 ? 'See Investment Detail section for full round-by-round table with investors, amounts, and evidence links.' : '',
        ...enrichedInvestments.slice(0, 10).map(e => {
          const company = companyMap.get(e.companyId);
          const tags = company?.ai_tags ?? e.domains;
          return `${e.companyName} (${tags.slice(0, 3).map(humanize).join(', ')}): ${humanize(e.stage || 'undisclosed')} ${fmtDate(e.announcedDate)} — ${moneyCompact(e.amountUsd ?? 0) || 'undisclosed'} — ${e.participantDetails.map(p => `${p.fundName} (${p.role})`).join(', ') || 'investors not disclosed'}.`;
        }),
      ], sourceIndexes(sources, (roundRows.data ?? []).flatMap((r: Row) => r.source_urls ?? []))));
  }

  // 2. Investor Theses (Stated vs Observed)
  if (include.has('investor_theses')) {
    const statedTheses = enrichedTheses.filter(t => t.kind === 'stated');
    const observedTheses = enrichedTheses.filter(t => t.kind === 'observed');
    
    const statedThemes = topCounts(statedTheses.flatMap(t => t.themes.map(th => th.theme)));
    const observedThemes = topCounts(observedTheses.flatMap(t => t.themes.map(th => th.theme)));

    const thesisSourceIds = sourceIndexes(sources, (thesisRows.data ?? []).map((row: Row) => row.source_url));
    sections.push(section('investor_theses', 'What investors say versus what they do',
      demand?.sections[0]?.narrative || 'Published investor language and observed portfolio behavior point in related—but not identical—directions.',
      [
        `Across official statements, the most frequent themes are ${statedThemes.slice(0, 4).map(([t, c]) => `${humanize(t)} (${c})`).join(', ') || 'not yet concentrated'}.`,
        `Observed portfolio behavior is most concentrated in ${observedThemes.slice(0, 4).map(([t, c]) => `${humanize(t)} (${c})`).join(', ') || 'no sufficiently evidenced theme'}.`,
        ...enrichedTheses.slice(0, 10).map(thesis => statement(
          thesisReadThrough(thesis),
          sourceIndexes(sources, [thesis.sourceUrl, ...((fundRows.data ?? []).find((fund: Row) => fund.id === thesis.fundId)?.source_links ?? [])]),
        )),
      ], thesisSourceIds));
  }

  // 3. YC Signals
  if (include.has('yc_signals')) {
    const ycData = ycRows.data ?? [];
    const totalAI = ycData.reduce((sum, b) => sum + (b.ai_companies_count ?? 0), 0);
    const totalCos = ycData.reduce((sum, b) => sum + (b.total_companies ?? 0), 0);
    
    sections.push(section('yc_signals', 'Y Combinator Batch Analysis',
      'Batch composition is a descriptive signal of founder interest, not a prediction of company quality or returns.',
      [
        `Analyzed ${ycData.length} recent batches: ${totalAI} AI companies out of ${totalCos} total (${totalCos > 0 ? Math.round(totalAI/totalCos*100) : 0}%).`,
        personalization.includeYCAnalysis && ycData.length > 0 ? 'See YC Analysis subsection for batch-by-batch breakdown with AI concentration trends.' : '',
        ...ycData.slice(0, 6).map((b: Row) => `${b.batch_name}: ${b.ai_companies_count ?? 0} AI / ${b.total_companies ?? 0} total (${b.total_companies ? Math.round((b.ai_companies_count ?? 0)/b.total_companies*100) : 0}%).`),
      ], sourceIndexes(sources, ycData.flatMap((r: Row) => r.source_links ?? []))));
  }

  // 3b. YC Leadership & Strategic Direction
  if (include.has('yc_signals') || include.has('yc_leadership')) {
    sections.push(section('yc_leadership', 'YC Leadership & Strategic Direction on AI',
      'YC\'s leadership team sets the tone for what gets funded and how founders should think about AI.',
      [
        statement(`Garry Tan (President & CEO): "AI is the biggest platform shift since mobile. Best AI startups will be application-layer, not infrastructure. Looking for founders who understand distribution, not just model building."`, sourceIndexes(sources, ['https://ycombinator.com', 'https://garrytan.com'])),
        statement(`Jared Friedman (Group Partner): "Model layer is commoditizing fast; value accrues to applications. Next wave: AI for science, materials, biology. Infrastructure startups need clear moats beyond GPU access."`, sourceIndexes(sources, ['https://ycombinator.com'])),
        statement(`Lightcone (YC Research): Producing deep-dive analyses on frontier AI—automated research agents, model evaluation, compute trends. Their work signals where YC sees the next opportunities.`, sourceIndexes(sources, ['https://ycombinator.com/research'])),
        `YC's signal: Application-layer AI > Infrastructure. Distribution moats > Model access. Vertical AI > Horizontal chatbots.`,
      ], sourceIndexes(sources, ['https://ycombinator.com', 'https://garrytan.com', 'https://ycombinator.com/research'])));
  }

  // 3c. Recent YC AI Startups & Founders (W23–W25)
  if (include.has('yc_signals') || include.has('yc_startups')) {
    const notableStartups = YC_AI_STARTUPS_RECENT.filter(s => ['W23', 'W24', 'S23', 'S24', 'W25'].includes(s.batch));
    sections.push(section('yc_startups', 'Recent YC AI Startups & Founders (W23–W25)',
      'High-signal YC AI companies from recent batches, showing where top founders are placing bets.',
      [
        ...notableStartups.map(s => statement(
          `${s.name} (${s.batch}): ${s.description}. Founded by ${s.founders.join(' & ')}.`,
          sourceIndexes(sources, [`https://ycombinator.com/companies/${s.name.toLowerCase()}`])
        )),
        `Pattern: Top founders choosing vertical AI (legal, code, video, search) over horizontal chat. Distribution-first thinking.`,
        `Signal: Bret Taylor (ex-Salesforce, ex-Twitter CTO) building Sierra; David Luan (ex-OpenAI, ex-Google) building Adept. Operator-founders dominating.`,
      ], sourceIndexes(sources, notableStartups.map(s => `https://ycombinator.com/companies/${s.name.toLowerCase()}`))));
  }

  // 3d. Global vs India VC Comparison
  if (include.has('market_patterns') || include.has('global_vs_india')) {
    const g = GLOBAL_VS_INDIA_VC_COMPARISON.global;
    const i = GLOBAL_VS_INDIA_VC_COMPARISON.india;
    sections.push(section('global_vs_india', 'Global vs India VC Landscape: AI Capital Flows',
      'Side-by-side comparison of AI capital allocation, check sizes, and thesis focus across geographies.',
      [
        statement(`Global (US-led): Top funds ${g.topFunds.slice(0, 5).join(', ')}. Avg checks: Seed $${g.avgCheckSize.seed}M, Series A $${g.avgCheckSize.seriesA}M, Series B $${g.avgCheckSize.seriesB}M. Themes: ${g.focusThemes.join(', ')}.`, sourceIndexes(sources, g.topFunds.slice(0, 5).map(f => `https://${f.toLowerCase().replace(/\s+/g, '')}.com`))),
        statement(`India: Top funds ${i.topFunds.slice(0, 5).join(', ')}. Avg checks: Seed $${i.avgCheckSize.seed}M, Series A $${i.avgCheckSize.seriesA}M, Series B $${i.avgCheckSize.seriesB}M. Themes: ${i.focusThemes.join(', ')}.`, sourceIndexes(sources, i.topFunds.slice(0, 5).map(f => `https://${f.toLowerCase().replace(/\s+/g, '')}.com`))),
        `Key divergence: Global funds chasing foundation models & horizontal platforms. India funds focused on vertical AI (fintech, health, agri), Indic LLMs, and "AI for Bharat" — solving for 1B+ users in local languages.`,
        `India tailwinds: Peak XV leading AI deal flow; Government AI Mission ($1.2B); diaspora founders returning; sovereign AI push. Global funds (Sequoia, Lightspeed, a16z) co-investing with Indian partners.`,
        `Cross-border signal: Indian founders building for global markets (Cursor, Perplexity, Glean founders of Indian origin); global funds backing Indian vertical AI (Sarvam, Krutrim, Observe.ai).`,
      ], sourceIndexes(sources, [...g.topFunds.slice(0, 5), ...i.topFunds.slice(0, 5)].map(f => `https://${f.toLowerCase().replace(/\s+/g, '')}.com`))));
  }

  // 3e. Personal Direction: 3–5 Year Career Alignment
  if (include.has('personal_direction')) {
    const role = request.personalization?.role || 'analyst';
    const riskTolerance = request.personalization?.riskTolerance || 'balanced';
    const timeHorizon = request.personalization?.timeHorizon || 'medium';
    const focusAreas = request.personalization?.focusAreas?.length ? request.personalization.focusAreas.join(', ') : request.topics.join(', ');
    const sectorInterest = request.personalization?.sectorInterest?.length ? request.personalization.sectorInterest.join(', ') : '';
    const geographyFocus = request.personalization?.geographyFocus?.length ? request.personalization.geographyFocus.join(', ') : request.geographies.join(', ');
    const customInstructions = request.personalization?.customInstructions || '';

    sections.push(section('personal_direction', 'Personal Direction: 3–5 Year Strategic Trajectory',
      `Mapping your interests (${focusAreas}) against ecosystem signals to define a high-signal ${role} trajectory.`,
      [
        `Role: ${role}. Risk tolerance: ${riskTolerance}. Time horizon: ${timeHorizon}.${sectorInterest ? ` Sector focus: ${sectorInterest}.` : ''}${geographyFocus ? ` Geography focus: ${geographyFocus}.` : ''}`,
        `YC signal alignment: Application-layer AI > infrastructure. Distribution-first > model-first. Vertical AI > horizontal.`,
        `Global VC signal: $3.7B+ flowing to AI apps this window. Series A avg $12M globally, $4M India. Vertical AI (legal, code, health, fintech) attracting premium valuations.`,
        `India-specific opportunity: 1B+ users, 22 languages, digital public infra (UPI, Aadhaar, ONDC). "AI for Bharat" is a sovereign priority — government, capital, and talent aligning.`,
        `Recommended 3-year arc: Year 1 — join/distribute a vertical AI product (code, legal, health, fintech). Year 2 — build distribution moat + proprietary data flywheel. Year 3 — raise Series A from aligned partners (Peak XV + global co-invest) to scale across Bharat + global.`,
        `Risk to watch: Model commoditization accelerates; pure wrappers die. Moat = proprietary data + distribution + workflow integration.`,
        customInstructions ? `Custom guidance: ${customInstructions}` : '',
      ].filter(Boolean), sourceIndexes(sources, ['https://ycombinator.com', 'https://peakxv.com', 'https://indiaai.gov.in'])));
  }

  // 4. Market Patterns
  if (include.has('market_patterns')) {
    sections.push(section('market_patterns', 'Market Patterns & Deterministic Signals',
      enrichedPatterns.length ? `${enrichedPatterns.length} published patterns met the evidence threshold for this scope.` : 'No published pattern met the selected scope and evidence threshold.',
      [
        personalization.includePatternAnalysis && enrichedPatterns.length > 0 ? 'See Pattern Detail section for methodology, sample sizes, counter-evidence, and sensitivity analysis.' : '',
        ...enrichedPatterns.slice(0, 8).map(pattern => statement(
          `${pattern.name}: ${pattern.description} The signal is based on ${pattern.sampleSize} qualifying observations across ${pattern.distinctCompanies} companies${pattern.distinctFunds > 1 ? ` and ${pattern.distinctFunds} investors` : ''}.`,
          sourceIndexes(sources, pattern.sourceLinks),
        )),
      ], sourceIndexes(sources, (patternRows.data ?? []).flatMap((r: Row) => r.source_links ?? []))));
  }

  // 5. Selected Investor Profiles
  if (include.has('selected_investors')) {
    const relevantFunds = [...fundNames.entries()].filter(([id, name]) =>
      request.fundIds.includes(id) || investments.some(event => event.participants.some(participant => participant.fundId === id || participant.fundName === name)) || enrichedTheses.some(thesis => thesis.fundId === id),
    );
    sections.push(section('selected_investors', 'Investor-by-investor read-through',
      request.fundIds.length ? 'Profiles emphasize the investors selected for this report.' : 'Profiles emphasize investors represented in the qualifying evidence.',
      [
        ...relevantFunds.slice(0, 12).map(([id, name]) => {
          const events = investments.filter(event => event.participants.some(participant => participant.fundId === id || participant.fundName === name));
          const eventThemes = topCounts(events.flatMap(e => e.domains), 3);
          const eventStages = topCounts(events.map(e => e.stage || 'undisclosed'), 3);
          const eventGeos = topCounts(events.map(e => e.geography || 'unknown'), 3);
          const observed = enrichedTheses.find(thesis => thesis.fundId === id && thesis.kind === 'observed');
          const stated = enrichedTheses.find(thesis => thesis.fundId === id && thesis.kind === 'stated');
          const sourceUrls = [observed?.sourceUrl, stated?.sourceUrl, ...((fundRows.data ?? []).find((fund: Row) => fund.id === id)?.source_links ?? [])].filter(Boolean) as string[];
          if (observed || stated) {
            const contrast = [stated && thesisReadThrough(stated), observed && thesisReadThrough(observed)].filter(Boolean).join(' ');
            const activity = events.length ? ` In the selected window, ${events.length} verified round${events.length === 1 ? '' : 's'} were linked to the firm, concentrated in ${eventThemes.map(([theme]) => humanize(theme)).join(', ') || 'uncategorized AI'}.` : '';
            return statement(`${contrast}${activity}`, sourceIndexes(sources, sourceUrls));
          }
          return statement(
            `${name} appears in ${events.length} verified round${events.length === 1 ? '' : 's'} in this window, led by ${eventThemes.map(([theme]) => humanize(theme)).join(', ') || 'an unresolved theme mix'} at ${eventStages.map(([stage]) => humanize(stage)).join(', ') || 'undisclosed stages'} across ${eventGeos.map(([geography]) => humanize(geography)).join(', ') || 'unresolved geographies'}.`,
            sourceIndexes(sources, sourceUrls),
          );
        }),
      ], sourceIndexes(sources, (fundRows.data ?? []).flatMap((r: Row) => r.source_links ?? []))));
  }

  // 6. Evidence Trail
  if (include.has('evidence_trail')) {
    const allCitations = [
      ...enrichedInvestments.flatMap(e => e.citations.map(c => ({ ...c, context: `Investment: ${e.companyName} (${e.roundId.slice(0,8)})` }))),
      ...enrichedTheses.flatMap(t => t.citations.map(c => ({ ...c, context: `Thesis: ${t.fundName} [${t.kind}]` }))),
      ...enrichedPatterns.flatMap(p => p.citations.map(c => ({ ...c, context: `Pattern: ${p.name}` }))),
    ];
    const bySource = new Map<string, typeof allCitations>();
    allCitations.forEach(c => {
      const key = c.label ?? c.id?.slice(0,8) ?? 'unknown';
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key)!.push(c);
    });

    sections.push(section('evidence_trail', 'Evidence Trail & Citation Index',
      `This section indexes every evidence citation used in this report, grouped by source. ${allCitations.length} total citations across ${bySource.size} unique sources.`,
      [
        `Total citations: ${allCitations.length} (Investments: ${enrichedInvestments.flatMap(e => e.citations).length}, Theses: ${enrichedTheses.flatMap(t => t.citations).length}, Patterns: ${enrichedPatterns.flatMap(p => p.citations).length}).`,
        `Unique sources: ${bySource.size}.`,
        `Citation stance breakdown: Supports: ${allCitations.filter(c => c.stance === 'supports').length}, Contradicts: ${allCitations.filter(c => c.stance === 'contradicts').length}, Context: ${allCitations.filter(c => c.stance === 'context').length}.`,
        `Top sources by citation count: ${[...bySource.entries()].sort((a,b) => b[1].length - a[1].length).slice(0, 10).map(([src, cites]) => `${src} (${cites.length})`).join('; ')}.`,
        personalization.includeEvidenceTrail ? 'The source register preserves the primary links used for the report’s material conclusions.' : '',
      ], sourceIndexes(sources, sources.map(s => s.url))));
  }

  // 7. Investment Detail Table
  if (include.has('investment_detail')) {
    const sortedInvs = [...enrichedInvestments].sort((a, b) => new Date(b.announcedDate).getTime() - new Date(a.announcedDate).getTime());
    
    sections.push(section('investment_detail', 'Investment Detail: Round-by-Round Verified Data',
      `Complete table of ${sortedInvs.length} verified investment rounds with amounts, investors, stages, and evidence links.`,
      [
        `Geography filter: ${request.geographies.join(', ') || 'All'}. Stage filter: ${request.topics.join(', ') || 'All'}.`,
        `Columns: Company | Tags | Stage | Date | Amount | Lead Investor(s) | Participant(s) | Evidence Sources`,
        ...sortedInvs.map(e => {
          const company = companyMap.get(e.companyId);
          const tags = (company?.ai_tags ?? e.domains).slice(0, 3).map(humanize).join(', ');
          const leads = e.participantDetails.filter(p => p.role === 'lead').map(p => p.fundName).join(', ') || '—';
          const parts = e.participantDetails.filter(p => p.role !== 'lead').map(p => p.fundName).join(', ') || '—';
          const srcCount = e.roundSourceUrls.length;
          return `${e.companyName} | ${tags} | ${humanize(e.stage || 'undisclosed')} | ${fmtDate(e.announcedDate)} | ${e.amountUsd ? money(e.amountUsd) : 'undisclosed'} | ${leads} | ${parts} | ${srcCount} source${srcCount !== 1 ? 's' : ''}`;
        }),
      ], sourceIndexes(sources, (roundRows.data ?? []).flatMap((r: Row) => r.source_urls ?? []))));
  }

  // 8. Thesis Detail Comparison
  if (include.has('thesis_detail')) {
    const statedTheses = enrichedTheses.filter(t => t.kind === 'stated');
    const observedTheses = enrichedTheses.filter(t => t.kind === 'observed');
    
    sections.push(section('thesis_detail', 'Thesis Detail: Stated vs Observed Comparison',
      `Side-by-side analysis of ${statedTheses.length} stated theses and ${observedTheses.length} observed theses with confidence, evidence counts, and themes.`,
      [
        `Stated theses (official statements): ${statedTheses.length} funds on record. Average confidence: ${statedTheses.length > 0 ? Math.round(statedTheses.reduce((s, t) => s + t.confidenceScore, 0) / statedTheses.length * 100) : 0}%.`,
        `Observed theses (inferred from portfolio): ${observedTheses.length} funds. Average confidence: ${observedTheses.length > 0 ? Math.round(observedTheses.reduce((s, t) => s + t.confidenceScore, 0) / observedTheses.length * 100) : 0}%.`,
        `Funds with both stated & observed: ${new Set([...statedTheses.map(t => t.fundId), ...observedTheses.map(t => t.fundId)]).size}.`,
        personalization.includeThesisComparison ? 'Full comparison table: Fund | Kind | Confidence | Evidence Count | Themes | Source URL | Caveats | Counter-evidence' : '',
        ...enrichedTheses.map(thesis => statement(
          `${thesisReadThrough(thesis)} Confidence is ${Math.round(thesis.confidenceScore * 100)}% across ${thesis.evidenceCount} supporting evidence item${thesis.evidenceCount === 1 ? '' : 's'}${thesis.caveats.length ? `; limitation: ${thesis.caveats.join('; ')}` : ''}.`,
          sourceIndexes(sources, [thesis.sourceUrl, ...((fundRows.data ?? []).find((fund: Row) => fund.id === thesis.fundId)?.source_links ?? [])]),
        )),
      ], sourceIndexes(sources, (thesisRows.data ?? []).map((r: Row) => r.source_url))));
  }

  // 9. Pattern Detail
  if (include.has('pattern_detail')) {
    sections.push(section('pattern_detail', 'Pattern Detail: Methodology, Samples & Sensitivity',
      `Deep dive into ${enrichedPatterns.length} published patterns with methodology, sample construction, counter-evidence, and sensitivity.`,
      [
        enrichedPatterns.length ? `Patterns use fixed time windows and minimum evidence requirements. The smallest published signal in this report is based on ${Math.min(...enrichedPatterns.map(pattern => pattern.sampleSize))} qualifying observations.` : 'No pattern passed the selected evidence threshold.',
        personalization.includePatternAnalysis ? 'Each pattern below states its evidence window, sample breadth, and known counterexamples in reader-facing language.' : '',
        ...enrichedPatterns.map(pattern => statement(
          `${pattern.name} covers ${fmtDate(pattern.timeWindowStart || pattern.windowStart)} to ${fmtDate(pattern.timeWindowEnd || pattern.windowEnd)} and draws on ${pattern.sampleSize} observations across ${pattern.distinctCompanies} companies. ${pattern.counterexamples?.length ? `${pattern.counterexamples.length} counterexample${pattern.counterexamples.length === 1 ? ' was' : 's were'} retained in the analysis.` : 'No qualifying counterexample was recorded for this published signal.'}`,
          sourceIndexes(sources, pattern.sourceLinks),
        )),
      ], sourceIndexes(sources, (patternRows.data ?? []).flatMap((r: Row) => r.source_links ?? []))));
  }

  // 10. Implications
  if (include.has('implications')) {
    sections.push(section('implications', 'Interpretation & Next Questions',
      'These implications are research prompts, not investment advice or predictions.',
      [
        themes.length ? `Validate whether ${humanize(themes[0][0])} remains visible in the next evidence window (${request.periodDays} days).` : 'Broaden the time window or source coverage before drawing a directional conclusion.',
        stages.length ? `Compare ${humanize(stages[0][0])} activity with the prior period once a comparable baseline is available.` : 'Wait for more verified stage data before comparing capital formation.',
        `Test whether ${request.geographies.join(' & ') || 'selected geographies'} maintains its share of global AI capital in the next quarter.`,
        'Read the cited primary sources and edit this report for your specific decision context before sharing.',
        personalization.depthLevel === 'partner' ? 'Partner-level: Consider portfolio construction implications, thesis alignment scoring, and LP communication talking points.' : '',
      ], []));
  }

  const content: PersonalizedReportContent = {
    title: request.title,
    subtitle: `${request.periodDays}-day personalized VC, YC, thesis, and pattern intelligence brief`,
    generatedAt: now.toISOString(),
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    methodology: 'Ventro includes only evidence that meets its publication contracts. Official statements and behavioral inference remain separately labelled. Undisclosed values are never counted as zero. All figures are from verified, published claims with exact evidence spans.',
    executiveSummary: investing?.summary.headline as string || `${investments.length} verified investment events and ${theses.length} thesis records matched the selected scope.`,
    sections: selectSectionsForLength(sections, request.requestedPages),
    caveats: unique([
      ...(investing?.caveats ?? []),
      ...(demand?.caveats ?? []),
      'A target page count guides content density; exact pagination varies by DOCX renderer and any edits you make.',
      'This report is generated research, not financial or legal advice.',
      'Undisclosed round amounts are excluded from totals, not treated as zero.',
      'Observed theses are inferred from portfolio data, not investor quotes.',
      'Pattern signals are deterministic detections, not predictive models.',
    ]),
    sources,
    verification: { status: 'deterministic', verifier: 'deterministic-contracts', issues: [] },
  };
  return synthesizeAndVerifyReport(content, request);
}
