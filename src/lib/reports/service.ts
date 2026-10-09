import { buildBothAnswerDrafts, isEligibleInvestmentEvent, isEligiblePattern, isEligibleThesis } from '@/lib/intelligence/answers/aggregations';
import { loadAnswerInputBundle } from '@/lib/intelligence/answers/repository';
import { ingestionSupabase } from '@/lib/supabase/ingestion';
import type { AnswerFilters, InvestmentEvent, ThesisRecordInput } from '@/lib/intelligence/answers/types';
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
        max_output_tokens: Math.min(7000, 1200 + request.requestedPages * 350),
        instructions: [
          'You are Ventro research editor. Improve clarity and decision usefulness using only the supplied evidence.',
          'Never add companies, investors, rounds, amounts, dates, percentages, or sources that are absent.',
          'Keep uncertainty and caveats explicit. Return JSON only with executiveSummary and sections.',
          'Each section must preserve its key, sourceIndexes, and factual meaning.',
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
            bullets: Array.isArray(enhanced.bullets) ? enhanced.bullets.filter(item => typeof item === 'string').slice(0, 10) : original.bullets,
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
  const [roundRows, fundRows, thesisRows, patternRows, ycRows] = await Promise.all([
    roundIds.length ? ingestionSupabase.from('funding_rounds').select('id,source_urls').in('id', roundIds) : Promise.resolve({ data: [], error: null }),
    request.fundIds.length ? ingestionSupabase.from('funds').select('id,canonical_name,source_links,hq_country,firm_type').in('id', request.fundIds) : ingestionSupabase.from('funds').select('id,canonical_name,source_links,hq_country,firm_type').limit(20),
    theses.length ? ingestionSupabase.from('stated_thesis').select('fund_id,text,source_url,date_stated').in('fund_id', unique(theses.map(item => item.fundId))).order('date_stated', { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
    patterns.length ? ingestionSupabase.from('patterns').select('id,source_links').in('id', patterns.map(item => item.id)) : Promise.resolve({ data: [], error: null }),
    request.ycBatchIds.length ? ingestionSupabase.from('yc_batches').select('id,batch_name,total_companies,ai_companies_count,source_links').in('id', request.ycBatchIds) : ingestionSupabase.from('yc_batches').select('id,batch_name,total_companies,ai_companies_count,source_links').order('year', { ascending: false }).limit(4),
  ]);
  for (const result of [roundRows, fundRows, thesisRows, patternRows, ycRows]) if (result.error) throw new Error(`REPORT_DATA_FAILED:${result.error.message}`);

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
  const sections: ReportSectionContent[] = [];
  const include = new Set(request.includedSections);

  if (include.has('capital_flow')) {
    const disclosed = investments.filter(event => event.amountUsd !== null);
    const total = disclosed.reduce((sum, event) => sum + (event.amountUsd ?? 0), 0);
    sections.push(section('capital_flow', 'Capital flow and verified investments',
      investing?.sections[0]?.narrative || `${investments.length} verified investment events matched the selected scope.`,
      [
        `${investments.length} verified rounds across ${unique(investments.map(event => event.companyId)).length} companies.`,
        disclosed.length ? `${disclosed.length} disclosed rounds total ${money(total)}; undisclosed rounds are counted separately.` : 'No qualifying round disclosed an amount; undisclosed rounds are not treated as zero.',
        stages.length ? `Leading stages: ${stages.map(([name, count]) => `${humanize(name)} (${count})`).join(', ')}.` : '',
        ...investments.slice(0, 8).map(event => `${event.companyName}: ${humanize(event.stage || 'undisclosed stage')} on ${new Date(event.announcedDate).toLocaleDateString('en-US')}; ${event.participants.map(participant => participant.fundName).join(', ') || 'investor not disclosed'}.`),
      ], sourceIndexes(sources, (roundRows.data ?? []).flatMap((row: Row) => row.source_urls ?? []))));
  }

  if (include.has('investor_theses')) {
    sections.push(section('investor_theses', 'What investors say and what behavior suggests',
      demand?.sections[0]?.narrative || 'Official statements and observed behavior are kept separate so attribution remains clear.',
      [
        themes.length ? `Most frequent evidence-backed themes: ${themes.map(([name, count]) => `${humanize(name)} (${count})`).join(', ')}.` : 'No theme reached the selected evidence threshold.',
        ...theses.slice(0, 10).map((thesis: ThesisRecordInput) => `${thesis.fundName} — ${thesis.kind === 'stated' ? 'stated' : 'observed'} thesis: ${jsonSummary(thesis.summary) || thesis.themes.map(theme => humanize(theme.theme)).join(', ')} (${Math.round(thesis.confidenceScore * 100)}% confidence).`),
      ], sourceIndexes(sources, (thesisRows.data ?? []).map((row: Row) => row.source_url))));
  }

  if (include.has('yc_signals')) {
    sections.push(section('yc_signals', 'Y Combinator signals',
      'Selected batch composition is presented as a descriptive signal, not a prediction of company quality or returns.',
      (ycRows.data ?? []).map((batch: Row) => `${batch.batch_name}: ${batch.ai_companies_count ?? 0} AI-tagged companies out of ${batch.total_companies ?? 0} catalogued companies.`),
      sourceIndexes(sources, (ycRows.data ?? []).flatMap((row: Row) => row.source_links ?? []))));
  }

  if (include.has('market_patterns')) {
    sections.push(section('market_patterns', 'Market patterns',
      patterns.length ? `${patterns.length} published patterns matched the report scope.` : 'No published pattern met the selected scope and evidence threshold.',
      patterns.slice(0, 10).map(pattern => `${pattern.name}: ${pattern.description} Sample size ${pattern.sampleSize}; status ${pattern.status}.`),
      sourceIndexes(sources, (patternRows.data ?? []).flatMap((row: Row) => row.source_links ?? []))));
  }

  if (include.has('selected_investors')) {
    const observedByFund = new Map<string, InvestmentEvent[]>();
    investments.forEach(event => event.participants.forEach(participant => observedByFund.set(participant.fundId, [...(observedByFund.get(participant.fundId) ?? []), event])));
    sections.push(section('selected_investors', 'Selected investor profiles',
      request.fundIds.length ? 'Profiles emphasize the investors selected for this report.' : 'Profiles emphasize investors represented in the qualifying evidence.',
      [...fundNames.entries()].slice(0, 20).map(([id, name]) => {
        const events = observedByFund.get(id) ?? [];
        const fundThemes = topCounts(events.flatMap(event => event.domains), 3);
        return `${name}: ${events.length} qualifying investments${fundThemes.length ? `; recurring themes ${fundThemes.map(([theme]) => humanize(theme)).join(', ')}` : ''}.`;
      }), sourceIndexes(sources, (fundRows.data ?? []).flatMap((row: Row) => row.source_links ?? []))));
  }

  if (include.has('implications')) {
    sections.push(section('implications', 'Interpretation and next questions',
      'These implications are research prompts, not investment advice or predictions.',
      [
        themes.length ? `Validate whether ${humanize(themes[0][0])} remains visible in the next evidence window.` : 'Broaden the time window or source coverage before drawing a directional conclusion.',
        stages.length ? `Compare ${humanize(stages[0][0])} activity with the prior period once a comparable baseline is available.` : 'Wait for more verified stage data before comparing capital formation.',
        'Read the cited primary sources and edit this report for your specific decision context before sharing.',
      ], []));
  }

  const content: PersonalizedReportContent = {
    title: request.title,
    subtitle: `${request.periodDays}-day personalized VC, YC, thesis, and pattern intelligence brief`,
    generatedAt: now.toISOString(),
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    methodology: 'Ventro includes only evidence that meets its publication contracts. Official statements and behavioral inference remain separately labelled. Undisclosed values are never counted as zero.',
    executiveSummary: investing?.summary.headline as string || `${investments.length} verified investment events and ${theses.length} thesis records matched the selected scope.`,
    sections,
    caveats: unique([
      ...(investing?.caveats ?? []),
      ...(demand?.caveats ?? []),
      'A target page count guides content density; exact pagination varies by DOCX renderer and any edits you make.',
      'This report is generated research, not financial or legal advice.',
    ]),
    sources,
  };
  return maybeEnhanceNarrative(content, request);
}
