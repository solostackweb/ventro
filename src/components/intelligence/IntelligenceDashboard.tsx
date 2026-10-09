'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, ChevronRight, CircleAlert, Database, FileSearch, Filter, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, TrendingUp, X } from 'lucide-react';
import type { AnswerCitation, AnswerSection, AnswerSnapshotRecord } from '@/lib/intelligence/answers/types';
import { buildDashboardAnswerQuery } from '@/lib/intelligence/answers/request-query';

interface AnswersPayload {
  access: 'preview' | 'full';
  state: 'empty' | 'ready';
  investingNow: AnswerSnapshotRecord | null;
  marketDemand: AnswerSnapshotRecord | null;
}

interface CitationPayload {
  access: 'preview' | 'full';
  citation: {
    id: string;
    stance: string;
    label?: string;
    evidence: null | {
      excerpt: string | null;
      excerptRestricted: boolean;
      sourceUrl: string | null;
      publisher: string | null;
      publishedAt: string | null;
      fetchedAt: string | null;
    };
  };
}

const DOMAIN_OPTIONS = [['', 'All AI'], ['foundation_models', 'Foundation models'], ['infrastructure', 'Infrastructure'], ['applications', 'Applications'], ['robotics', 'Robotics'], ['hardware', 'Hardware']];
const GEOGRAPHY_OPTIONS = [['', 'Global'], ['us', 'United States'], ['india', 'India'], ['eu', 'Europe'], ['uk', 'United Kingdom'], ['israel', 'Israel'], ['sea', 'Southeast Asia']];
const STAGE_OPTIONS = [['', 'All stages'], ['pre_seed', 'Pre-seed'], ['seed', 'Seed'], ['series_a', 'Series A'], ['series_b', 'Series B'], ['growth', 'Growth']];

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value ?? 0);
  return `${Math.round(number * (number <= 1 ? 100 : 1))}%`;
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function rankedMetric(section: AnswerSection | undefined, key: string) {
  const value = section?.metrics[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is { key: string; count: number } => Boolean(item && typeof item === 'object' && 'key' in item && 'count' in item)).slice(0, 4);
}

function EvidenceDetail({ term, value }: { term: string; value: string }) {
  return <div className="grid grid-cols-[7rem_1fr] gap-4 py-3"><dt className="text-ink-500">{term}</dt><dd className="font-medium text-ink-800">{value}</dd></div>;
}

function EvidenceDrawer({ citation, onClose }: { citation: AnswerCitation; onClose: () => void }) {
  const [data, setData] = useState<CitationPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!citation.id) return;
    const controller = new AbortController();
    fetch(`/api/intelligence/citations/${citation.id}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('The source detail could not be loaded.');
        setData(await response.json() as CitationPayload);
      })
      .catch(reason => {
        if (reason instanceof Error && reason.name !== 'AbortError') setError(reason.message);
      });
    return () => controller.abort();
  }, [citation.id]);

  const evidence = data?.citation.evidence;
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-ink-950/55 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="evidence-title">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close evidence panel" />
      <aside className="relative h-full w-full max-w-lg overflow-y-auto border-l border-white/10 bg-research px-5 py-6 shadow-2xl sm:px-8">
        <div className="flex items-start justify-between gap-4 border-b border-rule pb-5">
          <div><p className="eyebrow text-cyan-700">Evidence trail</p><h2 id="evidence-title" className="mt-2 text-2xl font-semibold text-ink-950">{citation.label || 'Supporting source'}</h2></div>
          <button onClick={onClose} className="icon-button" aria-label="Close evidence panel"><X className="h-5 w-5" /></button>
        </div>
        {!citation.id && <div className="state-panel mt-8"><FileSearch className="h-5 w-5 text-cyan-700" /><div><h3>Normalized record citation</h3><p>This answer links to a verified record. A source excerpt is not attached to this citation row.</p></div></div>}
        {citation.id && !data && !error && <div className="mt-8 space-y-3" aria-live="polite"><div className="skeleton-line w-2/5" /><div className="skeleton-line h-24 w-full" /><div className="skeleton-line w-3/4" /></div>}
        {error && <div className="state-panel state-panel-error mt-8"><CircleAlert className="h-5 w-5" /><div><h3>Evidence unavailable</h3><p>{error} Try again from the answer after refreshing.</p></div></div>}
        {data && <div className="mt-8 space-y-7">
          <div className="flex flex-wrap gap-2"><span className={`signal-label signal-${data.citation.stance}`}>{data.citation.stance}</span><span className="signal-label">{data.access === 'full' ? 'Full research access' : 'Preview excerpt'}</span></div>
          {evidence ? <>
            <blockquote className="border-l-2 border-cyan-600 pl-5 text-lg leading-8 text-ink-800">{evidence.excerptRestricted ? 'This publisher permits attribution and linking, but not stored excerpts.' : evidence.excerpt || 'No excerpt is available for this source.'}</blockquote>
            <dl className="divide-y divide-rule border-y border-rule text-sm"><EvidenceDetail term="Publisher" value={evidence.publisher || 'Publisher not recorded'} /><EvidenceDetail term="Published" value={evidence.publishedAt ? new Date(evidence.publishedAt).toLocaleString() : 'Date not recorded'} /><EvidenceDetail term="Last checked" value={evidence.fetchedAt ? new Date(evidence.fetchedAt).toLocaleString() : 'Not recorded'} /></dl>
            {evidence.sourceUrl && <a className="research-link" href={evidence.sourceUrl} target="_blank" rel="noreferrer">Open original source <ArrowRight className="h-4 w-4" /></a>}
          </> : <p className="text-sm leading-6 text-ink-600">This citation supports a normalized funding, thesis, or pattern record. No excerpt-level evidence is attached.</p>}
        </div>}
      </aside>
    </div>
  );
}

function SourceStack({ citations, onOpen }: { citations: AnswerCitation[]; onOpen: (citation: AnswerCitation) => void }) {
  if (!citations.length) return <span className="text-xs text-amber-700">Evidence coverage is still sparse</span>;
  return <div className="flex flex-wrap items-center gap-2" aria-label={`${citations.length} supporting citations`}>
    {citations.slice(0, 4).map((citation, index) => <button key={citation.id || `${citation.label}-${index}`} onClick={() => onOpen(citation)} className="citation-chip"><FileSearch className="h-3.5 w-3.5" /> {citation.label || `Source ${index + 1}`}</button>)}
    {citations.length > 4 && <span className="text-xs font-semibold text-ink-500">+{citations.length - 4}</span>}
  </div>;
}

function Confidence({ answer }: { answer: AnswerSnapshotRecord }) {
  const coverage = Number(answer.coverage.sourceCoverage ?? answer.coverage.evidenceCoverage ?? 0);
  return <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-300"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-cyan-300" /> {formatPercent(answer.confidence.score)} confidence</span><span>{formatPercent(coverage)} source coverage</span><span>Updated {relativeTime(answer.computedAt)}</span>{answer.status === 'stale' && <span className="text-amber-300">Stale snapshot</span>}</div>;
}

function Metric({ label, value, detail, accent }: { label: string; value: string; detail?: string; accent?: boolean }) {
  return <div><p className={`font-numeric text-2xl font-semibold ${accent ? 'text-emerald-300' : 'text-white'}`}>{value}</p><p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>{detail && <p className="mt-1 text-[11px] text-slate-500">{detail}</p>}</div>;
}

function ThemeList({ title, label, items, empty }: { title: string; label: string; items: Array<{ key: string; count: number }>; empty: string }) {
  return <div className="border-t border-white/15 pt-3"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-white">{title}</h3><span className="rounded-sm bg-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-cyan-200">{label}</span></div><div className="mt-3 flex flex-wrap gap-2">{items.length ? items.map(item => <span key={item.key} className="rounded-sm border border-white/15 px-2.5 py-1 text-xs text-slate-200">{item.key.replaceAll('_', ' ')} · {item.count}</span>) : <span className="text-xs text-slate-400">{empty}</span>}</div></div>;
}

function AnswerPanel({ eyebrow, answer, emptyText, destination, onCitation, variant }: { eyebrow: string; answer: AnswerSnapshotRecord | null; emptyText: string; destination: string; onCitation: (citation: AnswerCitation) => void; variant: 'capital' | 'demand' }) {
  if (!answer) return <section className="answer-panel"><p className="answer-kicker">{eyebrow}</p><h2 className="answer-title">Evidence is still accumulating.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">{emptyText}</p><Link href={destination} className="answer-link mt-8">Explore the engine <ArrowRight className="h-4 w-4" /></Link></section>;
  const first = answer.sections[0];
  const second = answer.sections[1];
  const trend = answer.summary.rawChangePercent;
  const headline = typeof answer.summary.headline === 'string' && answer.summary.headline.trim() ? answer.summary.headline : first?.narrative || emptyText;
  return <section className="answer-panel"><div className="relative z-10 flex h-full flex-col">
    <p className="answer-kicker">{eyebrow}</p><h2 className="answer-title">{headline}</h2>
    {variant === 'capital' ? <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4"><Metric label="Disclosed capital" value={formatMoney(answer.counts.disclosedAmountUsd)} /><Metric label="Verified rounds" value={String(answer.counts.roundCount)} /><Metric label="Undisclosed" value={String(answer.counts.undisclosedRoundCount)} detail="not counted as $0" /><Metric label="Prior window" value={typeof trend === 'number' ? `${trend > 0 ? '+' : ''}${Math.round(trend)}%` : 'No baseline'} accent={typeof trend === 'number'} /></div> : <div className="mt-6 grid gap-5 sm:grid-cols-2"><ThemeList title="Stated by investors" label="Official" items={rankedMetric(first, 'themes')} empty="No qualifying official thesis" /><ThemeList title="Observed in behavior" label="Inference" items={rankedMetric(second, 'themes')} empty="Insufficient verified history" /></div>}
    <div className="mt-auto pt-6"><Confidence answer={answer} />{first && <div className="mt-4"><SourceStack citations={first.citations} onOpen={onCitation} /></div>}<Link href={destination} className="answer-link mt-5">Open full analysis <ArrowRight className="h-4 w-4" /></Link></div>
  </div></section>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return <label className="filter-control"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function FilterBar({ values, onChange }: { values: { period: string; domain: string; geography: string; stage: string }; onChange: (key: string, value: string) => void }) {
  return <div className="filter-bar" aria-label="Intelligence filters"><span className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-500 lg:flex"><Filter className="h-4 w-4" /> Research slice</span><FilterSelect label="Period" value={values.period} options={[["30", '30 days'], ["90", '90 days'], ["180", '180 days'], ["365", '1 year']]} onChange={value => onChange('period', value)} /><FilterSelect label="Domain" value={values.domain} options={DOMAIN_OPTIONS} onChange={value => onChange('domain', value)} /><FilterSelect label="Geography" value={values.geography} options={GEOGRAPHY_OPTIONS} onChange={value => onChange('geography', value)} /><FilterSelect label="Stage" value={values.stage} options={STAGE_OPTIONS} onChange={value => onChange('stage', value)} /></div>;
}

function ResearchRows({ answer, onCitation }: { answer: AnswerSnapshotRecord | null; onCitation: (citation: AnswerCitation) => void }) {
  if (!answer) return <div className="empty-research"><Database className="h-6 w-6" /><div><h3>No published records match this slice</h3><p>Verified records will appear here without invented placeholders.</p></div></div>;
  return <div className="divide-y divide-rule">{answer.sections.map(section => <article key={section.key} className="research-row"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="signal-label">{section.material ? 'Published' : 'Context'}</span>{section.whyThis.explicitPreferenceMatch === true && <span className="signal-label signal-context">Why this: preference match</span>}</div><h3 className="mt-3 text-lg font-semibold text-ink-950">{section.title}</h3><p className="mt-1 max-w-3xl text-sm leading-6 text-ink-600">{section.narrative}</p><div className="mt-4"><SourceStack citations={section.citations} onOpen={onCitation} /></div></div><ChevronRight className="mt-1 h-5 w-5 flex-none text-ink-400" /></article>)}</div>;
}

export function IntelligenceDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState<AnswersPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [citation, setCitation] = useState<AnswerCitation | null>(null);
  const filters = useMemo(() => ({ period: searchParams.get('period') || '90', domain: searchParams.get('domain') || '', geography: searchParams.get('geography') || '', stage: searchParams.get('stage') || '' }), [searchParams]);
  const requestQuery = useMemo(() => buildDashboardAnswerQuery(filters), [filters]);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const response = await fetch(`/api/intelligence/answers?${requestQuery.toString()}`); if (!response.ok) throw new Error('Ventro could not load this intelligence slice.'); setPayload(await response.json() as AnswersPayload); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The intelligence view could not be loaded.'); }
    finally { setLoading(false); }
  }, [requestQuery]);
  useEffect(() => { load(); }, [load]);
  const updateFilter = (key: string, value: string) => { const query = new URLSearchParams(searchParams.toString()); if (value) query.set(key, value); else query.delete(key); router.replace(`${pathname}?${query.toString()}`, { scroll: false }); };
  const freshest = [payload?.investingNow?.computedAt, payload?.marketDemand?.computedAt].filter((value): value is string => Boolean(value)).sort().at(-1);

  return <div className="intelligence-page">
    <header className="intelligence-masthead"><div><p className="eyebrow text-cyan-300">Today’s AI capital brief</p><h1>AI capital, explained.</h1><p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300"><span className="status-dot" /> {freshest ? `Updated ${relativeTime(freshest)}` : 'Waiting for the first published answer'} <span aria-hidden="true">·</span> Evidence-first, not predictive</p></div><Link href="/saved" className="masthead-action"><BookOpen className="h-4 w-4" /> Open saved research</Link></header>
    <FilterBar values={filters} onChange={updateFilter} />
    <main className="mx-auto w-full max-w-[1540px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      {loading && <div className="grid gap-px overflow-hidden rounded-md border border-slate-700 bg-slate-700 lg:grid-cols-2" aria-live="polite"><div className="answer-panel min-h-[390px] animate-pulse" /><div className="answer-panel min-h-[390px] animate-pulse" /></div>}
      {!loading && error && <div className="state-panel state-panel-error mx-auto max-w-3xl"><CircleAlert className="h-6 w-6" /><div className="flex-1"><h2>Intelligence brief unavailable</h2><p>{error} Your filters are preserved.</p></div><button className="research-button" onClick={load}><RefreshCw className="h-4 w-4" /> Retry</button></div>}
      {!loading && !error && <>
        {payload?.access === 'preview' && <div className="access-strip"><LockKeyhole className="h-4 w-4" /><span><strong>Preview depth.</strong> Start the eligible 20-day student trial to inspect full sections and longer evidence excerpts.</span><Link href="/pricing">View access</Link></div>}
        <div className="answer-grid"><AnswerPanel eyebrow="What are investors investing in now?" answer={payload?.investingNow || null} emptyText="No verified funding evidence matches this period and filter combination yet." destination="/investments" onCitation={setCitation} variant="capital" /><AnswerPanel eyebrow="What are they looking for from the market?" answer={payload?.marketDemand || null} emptyText="Official theses and verified behavioral evidence have not reached the publication threshold for this slice." destination="/theses" onCitation={setCitation} variant="demand" /></div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.75fr)]"><section className="research-surface"><div className="section-heading"><div><p className="eyebrow text-cyan-700">Verified changes</p><h2>Investment flow</h2><p>One economic round once. Disclosed totals exclude unknown amounts.</p></div><Link href="/investments" className="research-link">Explore investments <ArrowRight className="h-4 w-4" /></Link></div><ResearchRows answer={payload?.investingNow || null} onCitation={setCitation} /></section><div className="space-y-5"><section className="research-surface"><div className="section-heading"><div><p className="eyebrow text-cyan-700">Signals, not predictions</p><h2>Patterns worth watching</h2></div></div><ResearchRows answer={payload?.marketDemand || null} onCitation={setCitation} /><Link href="/patterns" className="research-link m-5 mt-1">Open Pattern Engine <ArrowRight className="h-4 w-4" /></Link></section><section className="counter-surface"><div className="flex items-center gap-2 text-amber-300"><CircleAlert className="h-5 w-5" /><h2>Counter-evidence</h2></div>{(payload?.investingNow?.counterEvidence.length || payload?.marketDemand?.counterEvidence.length) ? <ul>{[...(payload?.investingNow?.counterEvidence || []), ...(payload?.marketDemand?.counterEvidence || [])].slice(0, 3).map(item => <li key={item}>{item}</li>)}</ul> : <p>No published counter-signal is attached to this slice. This is not proof that none exists.</p>}</section></div></div>
        <section className="method-strip"><div><CheckCircle2 className="h-5 w-5 text-emerald-600" /><span><strong>Disclosed-only dollars</strong><small>Unknown amounts stay unknown</small></span></div><div><Sparkles className="h-5 w-5 text-cyan-700" /><span><strong>Stated ≠ observed</strong><small>Quotes and inference stay separate</small></span></div><div><CalendarDays className="h-5 w-5 text-amber-700" /><span><strong>Time-bound answers</strong><small>Every view exposes freshness</small></span></div><div><TrendingUp className="h-5 w-5 text-rose-700" /><span><strong>Counter-signals visible</strong><small>Confidence is not certainty</small></span></div></section>
      </>}
    </main>
    {citation && <EvidenceDrawer citation={citation} onClose={() => setCitation(null)} />}
  </div>;
}
