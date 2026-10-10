'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { MultiSelect, Select } from '@/components/ui/Select';
import { REPORT_SECTION_OPTIONS } from '@/lib/reports/schema';

interface Facets {
  funds: Array<{ value: string; label: string }>;
  ycBatches: Array<{ value: string; label: string }>;
  geographies: string[];
  topics: string[];
}

interface ReportRow {
  id: string;
  title: string;
  status: 'queued' | 'generating' | 'ready' | 'failed';
  requested_pages: number;
  period_days: number;
  geographies: string[];
  file_name: string | null;
  file_size_bytes: number | null;
  generation_provider: string | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

const SECTION_LABELS: Record<(typeof REPORT_SECTION_OPTIONS)[number], string> = {
  executive_summary: 'Executive summary',
  capital_flow: 'Capital flow',
  investor_theses: 'Investor theses',
  yc_signals: 'YC signals',
  market_patterns: 'Market patterns',
  selected_investors: 'Selected investors',
  implications: 'Implications & next questions',
  sources: 'Source register',
  evidence_trail: 'Evidence trail',
  investment_detail: 'Investment detail',
  thesis_detail: 'Thesis detail',
  pattern_detail: 'Pattern detail',
};

const DEFAULT_SECTIONS = [...REPORT_SECTION_OPTIONS];

function fileSize(bytes: number | null): string {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [facets, setFacets] = useState<Facets>({ funds: [], ycBatches: [], geographies: [], topics: [] });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('My AI Capital Intelligence Brief');
  const [requestedPages, setRequestedPages] = useState('6');
  const [periodDays, setPeriodDays] = useState('90');
  const [geographies, setGeographies] = useState<string[]>([]);
  const [fundIds, setFundIds] = useState<string[]>([]);
  const [ycBatchIds, setYcBatchIds] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [includedSections, setIncludedSections] = useState<string[]>(DEFAULT_SECTIONS);
  const [audience, setAudience] = useState('');
  const [purpose, setPurpose] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/reports', { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load the report workspace');
      const data = await response.json();
      setReports(data.reports ?? []);
      setFacets(data.facets);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleSection = (key: string) => {
    if (key === 'executive_summary' || key === 'sources') return;
    setIncludedSections(current => current.includes(key) ? current.filter(value => value !== key) : [...current, key]);
  };

  const generate = async () => {
    setError('');
    if (includedSections.length < 3) {
      setError('Choose at least three report sections.');
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          requestedPages: Number(requestedPages),
          periodDays: Number(periodDays),
          geographies,
          fundIds,
          ycBatchIds,
          topics,
          includedSections,
          audience,
          purpose,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Report generation failed');
      await load();
      window.location.href = `/api/reports/${data.report.id}/download`;
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Report generation failed');
      await load();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="app-page">
      <main className="app-page-content">
        <div className="app-page-heading flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Personalized intelligence</p>
            <h1 className="text-3xl font-bold text-ink-950">Build your research report</h1>
            <p className="mt-2 max-w-3xl text-text-secondary">Choose the evidence window, markets, investors, YC batches, and questions that matter to you. Ventro assembles a cited Word document from published evidence.</p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-cyan-700/20 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">
            <ShieldCheck className="h-5 w-5 text-cyan-700" /> Private file · stored in R2
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
          <Card>
            <CardContent className="space-y-7 p-6 sm:p-8">
              <div>
                <h2 className="text-xl font-bold text-ink-950">1. Define the assignment</h2>
                <p className="mt-1 text-sm text-text-muted">Page count is a content target; Word pagination can shift after edits.</p>
              </div>
              <div className="grid gap-5 md:grid-cols-3">
                <div className="md:col-span-2"><Input label="Report title" value={title} maxLength={140} onChange={event => setTitle(event.target.value)} /></div>
                <Select label="Target pages" value={requestedPages} onChange={event => setRequestedPages(event.target.value)} options={[3, 4, 6, 8, 10, 12, 15].map(value => ({ value: String(value), label: `${value} pages` }))} />
                <Select label="Evidence window" value={periodDays} onChange={event => setPeriodDays(event.target.value)} options={[30, 90, 180, 365].map(value => ({ value: String(value), label: `Past ${value} days` }))} />
                <div className="md:col-span-2"><Input label="Intended audience (optional)" value={audience} maxLength={240} placeholder="Investment committee, founder strategy team…" onChange={event => setAudience(event.target.value)} /></div>
              </div>
              <Textarea label="Purpose or decision to support (optional)" value={purpose} maxLength={500} placeholder="What should this report help you understand or decide?" onChange={event => setPurpose(event.target.value)} />

              <div className="border-t border-rule pt-7">
                <h2 className="text-xl font-bold text-ink-950">2. Personalize the evidence scope</h2>
                <p className="mt-1 text-sm text-text-muted">Leave a field empty to include every qualifying item.</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <MultiSelect label="Geographies" options={facets.geographies.map(value => ({ value, label: value }))} value={geographies} onChange={setGeographies} placeholder="Global" maxSelections={12} />
                <MultiSelect label="AI topics" options={facets.topics.map(value => ({ value, label: value.replaceAll('_', ' ') }))} value={topics} onChange={setTopics} placeholder="All AI topics" maxSelections={16} />
                <MultiSelect label="VC firms" options={facets.funds} value={fundIds} onChange={setFundIds} placeholder="All qualifying investors" maxSelections={20} />
                <MultiSelect label="YC batches" options={facets.ycBatches} value={ycBatchIds} onChange={setYcBatchIds} placeholder="Latest qualifying batches" maxSelections={12} />
              </div>

              <div className="border-t border-rule pt-7">
                <h2 className="text-xl font-bold text-ink-950">3. Choose sections</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {REPORT_SECTION_OPTIONS.map(key => (
                    <label key={key} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-rule bg-white px-4 py-3 text-sm font-medium text-ink-900 hover:border-cyan-600">
                      <input type="checkbox" checked={includedSections.includes(key)} disabled={key === 'executive_summary' || key === 'sources'} onChange={() => toggleSection(key)} className="h-4 w-4 accent-cyan-700" />
                      {SECTION_LABELS[key]}{(key === 'executive_summary' || key === 'sources') && <span className="ml-auto text-xs font-normal text-text-muted">Required</span>}
                    </label>
                  ))}
                </div>
              </div>

              {error && <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div>}
              <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950">
                <strong>Edit before sharing.</strong> The file is an AI-assisted, evidence-grounded starting point. Verify cited sources, add your own judgment, and rewrite conclusions so the final report is distinct and appropriate for your audience.
              </div>
              <Button size="lg" loading={generating} disabled={loading || title.trim().length < 3} onClick={generate} className="w-full sm:w-auto">
                <Sparkles className="h-4 w-4" /> {generating ? 'Building cited DOCX…' : 'Generate personalized DOCX'}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-ink-950">Your reports</h2>
              <p className="mt-1 text-sm text-text-muted">Private links expire after five minutes.</p>
            </div>
            {loading ? <Card><CardContent className="p-6 text-sm text-text-muted">Loading reports…</CardContent></Card> : reports.length === 0 ? (
              <Card><CardContent className="flex flex-col items-center px-6 py-12 text-center"><FileText className="h-9 w-9 text-ink-400" /><h3 className="mt-4 font-bold text-ink-950">No reports yet</h3><p className="mt-2 text-sm text-text-muted">Your generated Word documents will appear here.</p></CardContent></Card>
            ) : reports.map(report => (
              <Card key={report.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="font-bold text-ink-950">{report.title}</h3><p className="mt-1 text-xs text-text-muted">{report.period_days} days · {report.requested_pages} target pages · {new Date(report.created_at).toLocaleDateString()}</p></div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${report.status === 'ready' ? 'bg-emerald-100 text-emerald-800' : report.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{report.status}</span>
                  </div>
                  {report.status === 'ready' && <a href={`/api/reports/${report.id}/download`} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-900"><Download className="h-4 w-4" /> Download DOCX {fileSize(report.file_size_bytes) && `· ${fileSize(report.file_size_bytes)}`}</a>}
                  {report.status === 'failed' && <p className="mt-3 text-xs text-red-700">Generation failed. Your settings were saved; create a fresh report to retry.</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
