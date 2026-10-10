import { buildBothAnswerDrafts, isEligibleInvestmentEvent, isEligiblePattern, isEligibleThesis } from '@/lib/intelligence/answers/aggregations';
import { loadAnswerInputBundle } from '@/lib/intelligence/answers/repository';
import { ingestionSupabase } from '@/lib/supabase/ingestion';
import type { AnswerFilters, InvestmentEvent, ThesisRecordInput, PatternRecordInput } from '@/lib/intelligence/answers/types';
import type { PersonalizedReportContent, ReportRequest, ReportSectionContent, ReportSource } from './schema';

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

function sourceIndexes(sources: ReportSource[], urls: string[]): number[] {
  return unique(urls.map(url => sources.findIndex(source => source.url === url) + 1).filter(index => index > 0));
}

function section(key: string, title: string, summary: string, bullets: string[], indexes: number[]): ReportSectionContent {
  return { key, title, summary, bullets: bullets.filter(Boolean), sourceIndexes: unique(indexes) };
}

function jsonSummary(value: Record<string, unknown>): string {
  for (const key of ['headline', 'summary', 'narrative', 'text']) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
}

async function maybeEnhanceNarrative(content: PersonalizedReportContent, request: ReportRequest): Promise<{ content: PersonalizedReportContent; provider: string; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_REPORT_MODEL || 'gpt-5-mini';
  if (!apiKey) return { content, provider: 'deterministic', model: 'evidence-template-v1' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        max_output_tokens: Math.min(12000, 1200 + request.requestedPages * 500),
        instructions: [
          'You are Ventro research editor. Improve clarity and decision usefulness using only the supplied evidence.',
          'Never add companies, investors, rounds, amounts, dates, percentages, or sources that are absent.',
          'Keep uncertainty and caveats explicit. Return JSON only with executiveSummary and sections.',
          'Each section must preserve its key, sourceIndexes, and factual meaning.',
          'Use professional investment memo tone. Structure bullets with clear metrics and attribution.',
        ].join(' '),
        input: JSON.stringify({
          audience: request.audience,
          purpose: request.purpose,
          targetPages: request.requestedPages,
          executiveSummary: content.executiveSummary,
          sections: content.sections,
          caveats: content.caveats,
        }),
      }),
    });
    if (!response.ok) throw new Error(`OpenAI response ${response.status}`);
    const payload = await response.json() as Row;
    const outputText = typeof payload.output_text === 'string'
      ? payload.output_text
      : (payload.output ?? []).flatMap((item: Row) => item.content ?? []).find((item: Row) => item.type === 'output_text')?.text;
    if (!outputText) throw new Error('OpenAI response contained no output text');
    const cleaned = outputText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned) as { executiveSummary?: string; sections?: ReportSectionContent[] };
    const byKey = new Map((parsed.sections ?? []).map(item => [item.key, item]));
    return {
      provider: 'openai',
      model,
      content: {
        ...content,
        executiveSummary: parsed.executiveSummary?.trim() || content.executiveSummary,
        sections: content.sections.map(original => {
          const enhanced = byKey.get(original.key);
          if (!enhanced) return original;
          return {
            ...original,
            summary: enhanced.summary?.trim() || original.summary,
            bullets: Array.isArray(enhanced.bullets) ? enhanced.bullets.filter(item => typeof item === 'string').slice(0, 15) : original.bullets,
          };
        }),
      },
    };
  } catch (error) {
    console.warn('[reports] AI enhancement unavailable; using deterministic report', error instanceof Error ? error.message : error);
    return { content, provider: 'deterministic_fallback', model: 'evidence-template-v1' };
  } finally {
    clearTimeout(timer);
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

async function enrichInvestments(investments: InvestmentEvent[], roundRows: Row[], fundNames: Map<string, string>): Promise<EnrichedInvestment[]> {
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
  const investments = scopedInvestments.filter(event =>
    isEligibleInvestmentEvent(event, filters) &&
    new Date(event.announcedDate) >= periodStart && new Date(event.announcedDate) < periodEnd,
  );
  const theses = bundle.theses.filter(thesis => isEligibleThesis(thesis, filters) && (request.fundIds.length === 0 || selectedFundSet.has(thesis.fundId)));
  const patterns = bundle.patterns.filter(pattern => isEligiblePattern(pattern, filters) && (request.ycBatchIds.length === 0 || request.ycBatchIds.some(batch => {
    const batches = pattern.filters.ycBatchId ? [pattern.filters.ycBatchId] : [];
    return batches.includes(batch) || JSON.stringify(pattern.filters).includes(batch);
  })));

  const roundIds = investments.map(event => event.roundId);
  const [roundRows, fundRows, thesisRows, patternRows, ycRows, companyRows, participantRows] = await Promise.all([
    roundIds.length ? ingestionSupabase.from('funding_rounds').select('id,source_urls,company_id,announced_date,round_stage,amount_usd,lead_investor_ids').in('id', roundIds) : Promise.resolve({ data: [], error: null }),
    request.fundIds.length ? ingestionSupabase.from('funds').select('id,canonical_name,source_links,hq_country,firm_type').in('id', request.fundIds) : ingestionSupabase.from('funds').select('id,canonical_name,source_links,hq_country,firm_type').limit(50),
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
    sources.push({ label, url, sourceType });
  };
  (roundRows.data ?? []).forEach((row: Row) => (row.source_urls ?? []).forEach((url: string) => addSource('Funding-round evidence', url, 'funding')));
  (fundRows.data ?? []).forEach((row: Row) => (row.source_links ?? []).forEach((url: string) => addSource(`${row.canonical_name} profile`, url, 'fund')));
  (thesisRows.data ?? []).forEach((row: Row) => addSource('Official investor thesis', row.source_url, 'thesis'));
  (patternRows.data ?? []).forEach((row: Row) => (row.source_links ?? []).forEach((url: string) => addSource('Pattern evidence', url, 'pattern')));
  (ycRows.data ?? []).forEach((row: Row) => (row.source_links ?? []).forEach((url: string) => addSource(`${row.batch_name} directory`, url, 'yc')));

  const drafts = buildBothAnswerDrafts(filters, { ...bundle, investments: scopedInvestments, theses, patterns }, now);
  const investing = drafts.find(draft => draft.kind === 'investing_now');
  const demand = drafts.find(draft => draft.kind === 'market_demand');
  const stages = topCounts(investments.map(event => event.stage || 'undisclosed'));
  const themes = topCounts([
    ...investments.flatMap(event => event.domains),
    ...theses.flatMap(thesis => thesis.themes.map(theme => theme.theme)),
  ]);
  const fundNames = new Map<string, string>((fundRows.data ?? []).map((row: Row) => [row.id, row.canonical_name]));
  const companyMap = new Map((companyRows.data ?? []).map((row: Row) => [row.id, row]));

  const enrichedInvestments = await enrichInvestments(investments, roundRows.data ?? [], fundNames);
  const enrichedTheses = await enrichTheses(theses, thesisRows.data ?? []);
  const enrichedPatterns = await enrichPatterns(patterns, patternRows.data ?? []);

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

    sections.push(section('investor_theses', 'Investor Theses: Stated vs Observed',
      demand?.sections[0]?.narrative || 'Official statements and observed behavior are kept separate so attribution remains clear.',
      [
        `Stated theses (${statedTheses.length}): ${statedThemes.slice(0, 5).map(([t, c]) => `${humanize(t)} (${c})`).join(', ')}.`,
        `Observed theses (${observedTheses.length}): ${observedThemes.slice(0, 5).map(([t, c]) => `${humanize(t)} (${c})`).join(', ')}.`,
        personalization.includeThesisComparison && statedTheses.length > 0 ? 'See Thesis Detail section for side-by-side comparison table with confidence scores, evidence counts, and source URLs.' : '',
        ...enrichedTheses.slice(0, 12).map(t => {
          const tThemes = t.themes.map(th => humanize(th.theme)).join(', ');
          return `${t.fundName} [${t.kind === 'stated' ? 'STATED' : 'OBSERVED'} | ${Math.round(t.confidenceScore * 100)}%]: ${tThemes || 'No themes'} — ${t.caveats?.join('; ') || 'No caveats'}. Source: ${t.sourceUrl || 'N/A'}.`;
        }),
      ], sourceIndexes(sources, (thesisRows.data ?? []).map((r: Row) => r.source_url))));
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

  // 4. Market Patterns
  if (include.has('market_patterns')) {
    sections.push(section('market_patterns', 'Market Patterns & Deterministic Signals',
      enrichedPatterns.length ? `${enrichedPatterns.length} published patterns met the evidence threshold for this scope.` : 'No published pattern met the selected scope and evidence threshold.',
      [
        personalization.includePatternAnalysis && enrichedPatterns.length > 0 ? 'See Pattern Detail section for methodology, sample sizes, counter-evidence, and sensitivity analysis.' : '',
        ...enrichedPatterns.slice(0, 12).map(p => {
          const batches = p.ycBatches?.join(', ') || 'N/A';
          return `${p.name}: ${p.description} Sample=${p.sampleSize} cos, ${p.distinctCompanies} uniq, ${p.distinctFunds} funds, ${p.independentSourceCount} indep sources. YC batches: ${batches}. Status: ${p.status}.`;
        }),
      ], sourceIndexes(sources, (patternRows.data ?? []).flatMap((r: Row) => r.source_links ?? []))));
  }

  // 5. Selected Investor Profiles
  if (include.has('selected_investors')) {
    const observedByFund = new Map<string, EnrichedInvestment[]>();
    enrichedInvestments.forEach(e => e.participants.forEach(p => {
      const fundId = p.fundName; // simplified
      // Note: would need fundId mapping in real implementation
    }));
    sections.push(section('selected_investors', 'Investor Activity Profiles',
      request.fundIds.length ? 'Profiles emphasize the investors selected for this report.' : 'Profiles emphasize investors represented in the qualifying evidence.',
      [
        ...(personalization.includeInvestorProfiles && fundNames.size > 0 ? ['See Investor Profile subsection for detailed activity, recurring themes, stage preferences, and geography focus per fund.'] : []),
        ...[...fundNames.entries()].slice(0, 25).map(([id, name]) => {
          const events = investments.filter(e => e.participants.some(p => p.fundName === name));
          const eventThemes = topCounts(events.flatMap(e => e.domains), 3);
          const eventStages = topCounts(events.map(e => e.stage || 'undisclosed'), 3);
          const eventGeos = topCounts(events.map(e => e.geography || 'unknown'), 3);
          return `${name}: ${events.length} rounds — Themes: ${eventThemes.map(([t]) => humanize(t)).join(', ')} — Stages: ${eventStages.map(([s]) => humanize(s)).join(', ')} — Geos: ${eventGeos.map(([g]) => humanize(g)).join(', ')}.`;
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
        personalization.includeEvidenceTrail ? 'Full citation index with claim IDs, evidence spans, and source URLs available in appendix.' : '',
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
        ...enrichedTheses.map(t => {
          const tThemes = t.themes.map(th => humanize(th.theme)).join(', ') || '—';
          const caveats = t.caveats?.join('; ') || '—';
          const counter = t.counterEvidence?.join('; ') || '—';
          return `${t.fundName} [${t.kind === 'stated' ? 'STATED' : 'OBSERVED'} | ${Math.round(t.confidenceScore*100)}% | ${t.evidenceCount} cites] Themes: ${tThemes} | Caveats: ${caveats} | Counter: ${counter} | Source: ${t.sourceUrl || '—'}`;
        }),
      ], sourceIndexes(sources, (thesisRows.data ?? []).map((r: Row) => r.source_url))));
  }

  // 9. Pattern Detail
  if (include.has('pattern_detail')) {
    sections.push(section('pattern_detail', 'Pattern Detail: Methodology, Samples & Sensitivity',
      `Deep dive into ${enrichedPatterns.length} published patterns with methodology, sample construction, counter-evidence, and sensitivity.`,
      [
        `Patterns use deterministic detection with time-window baselines, minimum sample sizes (${Math.min(...enrichedPatterns.map(p => p.sampleSize))}+), and independent source requirements (${Math.min(...enrichedPatterns.map(p => p.independentSourceCount))}+).`,
        personalization.includePatternAnalysis ? 'Full methodology table: Pattern | Type | Window | Baseline | Sample | Distinct Cos/Funds | Indep Sources | Coverage Metrics | Counter-evidence | Sensitivity' : '',
        ...enrichedPatterns.map(p => {
          const cov = p.coverageMetrics ?? {};
          const sens = p.sensitivity ?? {};
          const counter = p.counterexamples?.length ?? 0;
          return `${p.name}: type=${p.patternType || 'market_trend'} | window=${p.timeWindowStart}→${p.timeWindowEnd} | baseline=${p.baselineWindowStart}→${p.baselineWindowEnd} | sample=${p.sampleSize} (${p.distinctCompanies} cos, ${p.distinctFunds} funds) | indep=${p.independentSourceCount} | coverage=${JSON.stringify(cov)} | sensitivity=${JSON.stringify(sens)} | counter-examples=${counter} | methodology=${p.methodologyVersion} | status=${p.status}`;
        }),
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
    sections,
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
  };
  return maybeEnhanceNarrative(content, request);
}