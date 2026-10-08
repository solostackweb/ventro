'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CircleAlert, FileText, Microscope, RefreshCw, ShieldCheck } from 'lucide-react';
import type { AnswerSection, AnswerSnapshotRecord } from '@/lib/intelligence/answers/types';

interface Payload {
  access: 'preview' | 'full';
  marketDemand: AnswerSnapshotRecord | null;
}

function ThemeRows({ section }: { section?: AnswerSection }) {
  const themes = Array.isArray(section?.metrics.themes) ? section.metrics.themes : [];
  if (!themes.length) return <p className="mt-5 text-sm leading-6 text-ink-500">No theme currently meets the evidence threshold for this research slice.</p>;
  return <div className="mt-5 divide-y divide-rule border-y border-rule">{themes.map((theme, index) => {
    const item = theme as { key?: string; count?: number };
    return <div key={`${item.key}-${index}`} className="flex items-center justify-between gap-4 py-3"><span className="font-medium capitalize text-ink-900">{String(item.key || 'Unknown').replaceAll('_', ' ')}</span><span className="font-numeric text-sm text-ink-500">{Number(item.count || 0)} records</span></div>;
  })}</div>;
}

export default function ThesesPage() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    setError(null);
    fetch('/api/intelligence/answers?kind=market_demand')
      .then(async response => { if (!response.ok) throw new Error('The thesis comparison could not be loaded.'); setPayload(await response.json() as Payload); })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'The thesis comparison could not be loaded.'));
  };
  useEffect(load, []);
  const answer = payload?.marketDemand;
  const stated = answer?.sections.find(section => section.key === 'stated_demand');
  const observed = answer?.sections.find(section => section.key === 'observed_demand');

  return <div className="min-h-screen bg-ink-950 pb-24">
    <header className="engine-masthead mx-auto max-w-7xl px-4 pb-8 pt-8 text-white sm:px-6 lg:px-8"><p className="eyebrow text-cyan-300">Thesis Engine</p><h1 className="mt-2 max-w-4xl text-4xl font-semibold tracking-[-0.035em]">What investors say, separated from what their behavior suggests.</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">Official propositions and observed investment themes never share the same label. Every published claim retains its methodology, sample, coverage, and evidence.</p></header>
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {error && <div className="state-panel state-panel-error"><CircleAlert className="h-5 w-5" /><div className="flex-1"><h2>Thesis Engine unavailable</h2><p>{error}</p></div><button className="research-button" onClick={load}><RefreshCw className="h-4 w-4" /> Retry</button></div>}
      {!payload && !error && <div className="grid gap-px overflow-hidden rounded-sm bg-rule md:grid-cols-2"><div className="h-96 animate-pulse bg-research" /><div className="h-96 animate-pulse bg-research" /></div>}
      {payload && !error && <>
        {payload.access === 'preview' && <div className="access-strip"><ShieldCheck className="h-4 w-4" /><span>Preview depth is active. The 20-day eligible student trial reveals complete thesis sections and evidence.</span><Link href="/pricing">View access</Link></div>}
        <div className="grid gap-px overflow-hidden rounded-sm bg-rule md:grid-cols-2">
          <section className="bg-research p-6 sm:p-8"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><FileText className="h-6 w-6 text-cyan-700" /><div><p className="eyebrow text-cyan-700">Official source</p><h2 className="text-2xl font-semibold text-ink-950">Stated thesis</h2></div></div><span className="signal-label signal-supports">Attributable</span></div><p className="mt-5 text-sm leading-6 text-ink-600">{stated?.narrative || 'No qualifying official thesis evidence is available.'}</p><ThemeRows section={stated} /><p className="mt-5 text-xs text-ink-500">{stated?.citations.length || 0} normalized citations · never presented without an official-source link</p></section>
          <section className="bg-research-muted p-6 sm:p-8"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><Microscope className="h-6 w-6 text-amber-700" /><div><p className="eyebrow text-amber-700">Behavioral analysis</p><h2 className="text-2xl font-semibold text-ink-950">Observed thesis</h2></div></div><span className="signal-label bg-amber-100 text-amber-800">Inference</span></div><p className="mt-5 text-sm leading-6 text-ink-600">{observed?.narrative || 'There is not enough verified investment history for an observed thesis.'}</p><ThemeRows section={observed} /><p className="mt-5 text-xs text-ink-500">Sample: {String(observed?.metrics.sampleSize || 0)} verified investments · methodology {answer?.methodologyVersion || 'not available'}</p></section>
        </div>
        <section className="counter-surface mt-5"><div className="flex items-center gap-2 text-amber-300"><CircleAlert className="h-5 w-5" /><h2>Caveats and counter-evidence</h2></div>{answer?.caveats.length ? <ul>{answer.caveats.map(item => <li key={item}>{item}</li>)}</ul> : <p>No caveat is attached to this snapshot. Coverage should still be treated as incomplete unless shown otherwise.</p>}</section>
        <div className="mt-5 flex flex-wrap gap-3"><Link href="/investors" className="research-button">Compare investor profiles <ArrowRight className="h-4 w-4" /></Link><Link href="/patterns" className="masthead-action">Open Pattern Engine</Link></div>
      </>}
    </main>
  </div>;
}
