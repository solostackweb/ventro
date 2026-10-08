import Link from 'next/link';
import { ArrowRight, CheckCircle2, CircleAlert, FileSearch, Radar, ShieldCheck } from 'lucide-react';

export default function LandingPage() {
  return <div className="bg-research text-ink-950">
    <section className="landing-hero">
      <div className="landing-hero-grid" aria-hidden="true" />
      <div className="relative mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,.82fr)_minmax(520px,1.18fr)] lg:px-8">
        <div>
          <p className="eyebrow text-cyan-300">AI investment intelligence</p>
          <h1 className="mt-5 max-w-3xl text-balance text-5xl font-semibold leading-[.98] tracking-[-0.055em] text-white sm:text-6xl">Know where AI capital is moving, and why.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">Ventro connects verified rounds, investor theses, YC activity, news, and market patterns into two inspectable answers for aspiring founders.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/signup" className="landing-primary">Start 20-day student access <ArrowRight className="h-4 w-4" /></Link><Link href="/login" className="landing-secondary">Open your workspace</Link></div>
          <p className="mt-5 text-xs text-slate-400">No card required for eligible verified students. Payments are not enabled.</p>
        </div>

        <div className="landing-intelligence" aria-label="Ventro intelligence preview">
          <div className="border-b border-white/10 px-5 py-4"><p className="flex items-center gap-2 text-xs text-slate-300"><span className="status-dot" /> Evidence refreshes on a published-data cadence</p></div>
          <div className="grid gap-px bg-white/10 md:grid-cols-2">
            <article className="bg-ink-900 p-5"><p className="answer-kicker">What are investors investing in now?</p><h2 className="mt-4 text-2xl font-semibold leading-tight text-white">Verified capital flow, without treating undisclosed rounds as zero.</h2><div className="mt-7 flex items-center gap-3 text-xs text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> Round evidence · source coverage · prior-window baseline</div></article>
            <article className="bg-ink-900 p-5"><p className="answer-kicker">What are they looking for?</p><h2 className="mt-4 text-2xl font-semibold leading-tight text-white">Official statements kept separate from observed investment behavior.</h2><div className="mt-7 flex items-center gap-3 text-xs text-slate-300"><Radar className="h-4 w-4 text-cyan-300" /> Stated thesis · observed themes · counter-signals</div></article>
          </div>
          <div className="bg-research p-5 text-ink-950"><div className="flex items-center justify-between border-b border-rule pb-4"><div><p className="eyebrow text-cyan-700">Research contract</p><h3 className="mt-1 text-xl font-semibold">Every conclusion keeps its trail.</h3></div><FileSearch className="h-6 w-6 text-cyan-700" /></div><div className="grid gap-4 pt-5 sm:grid-cols-3"><ContractPoint title="Published evidence" text="Exact citations and original links." /><ContractPoint title="Honest limits" text="Coverage, conflicts, and stale states." /><ContractPoint title="Reproducible" text="Window, sample, baseline, methodology." /></div></div>
        </div>
      </div>
    </section>

    <section className="border-b border-rule"><div className="mx-auto grid max-w-7xl gap-px bg-rule px-0 md:grid-cols-3"><ValueStrip icon={<ShieldCheck />} title="Evidence before narrative" text="Claims publish only after provenance and verification gates pass." /><ValueStrip icon={<Radar />} title="Signals, not predictions" text="Patterns expose sample, baseline, sensitivity, and counterexamples." /><ValueStrip icon={<CircleAlert />} title="Unknown stays unknown" text="Ventro does not invent valuations, revenue, customers, or deal amounts." /></div></section>

    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]"><div><p className="eyebrow text-cyan-700">One research workspace</p><h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">Stop rebuilding the market from scattered tabs.</h2><p className="mt-5 max-w-lg leading-7 text-ink-600">News is the evidence stream. VC and YC profiles supply the actors. Investments show capital movement. Thesis and Pattern Engines explain what may be changing. The two-answer brief connects them.</p></div><ol className="divide-y divide-rule border-y border-rule"><ResearchStep number="01" title="See the market change" text="Read deduplicated AI news and normalized funding events with source history." /><ResearchStep number="02" title="Inspect investor behavior" text="Compare verified investments with stated and observed theses." /><ResearchStep number="03" title="Test your founder hypothesis" text="Use patterns and counter-evidence to assess a market idea without a funding guarantee." /></ol></div></section>

    <section className="bg-ink-950 px-4 py-16 text-white sm:px-6"><div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-8 md:flex-row md:items-center"><div><p className="eyebrow text-cyan-300">Built for aspiring student founders</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Enter the market with a research trail, not a hunch.</h2></div><Link href="/signup" className="landing-primary">Create your workspace <ArrowRight className="h-4 w-4" /></Link></div></section>
  </div>;
}

function ContractPoint({ title, text }: { title: string; text: string }) {
  return <div><h4 className="text-sm font-semibold">{title}</h4><p className="mt-1 text-xs leading-5 text-ink-500">{text}</p></div>;
}

function ValueStrip({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <article className="bg-research px-6 py-8"><div className="h-5 w-5 text-cyan-700">{icon}</div><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-ink-600">{text}</p></article>;
}

function ResearchStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <li className="grid grid-cols-[3.5rem_1fr] gap-4 py-6"><span className="font-numeric text-sm text-cyan-700">{number}</span><div><h3 className="text-xl font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-ink-600">{text}</p></div></li>;
}
