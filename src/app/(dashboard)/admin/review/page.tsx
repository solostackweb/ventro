'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils/helpers';

type Kind = 'story' | 'funding_round' | 'round_participant' | 'pattern';
type ReviewItem = {
  kind: Kind;
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  source_urls: string[];
  details: string;
};
type QueueResponse = {
  stories: Array<{ id: string; headline: string; summary: string | null; publisher: string | null; canonical_url: string; source_urls: string[] | null; verification_label: string; created_at: string }>;
  rounds: Array<{ id: string; company_id: string; round_stage: string | null; amount_usd: number | null; source_urls: string[] | null; verification_status: string; created_at: string }>;
  participants: Array<{ id: string; round_id: string; fund_id: string; role: string | null; source_urls: string[] | null; verification_status: string; created_at: string }>;
  patterns: Array<{ id: string; name: string; description: string | null; source_links: string[] | null; qualifying_events: unknown[] | null; status: string; created_at: string }>;
  history: Array<{ id: string; item_kind: string; previous_status: string; new_status: string; reason: string; reviewed_at: string }>;
};

function itemsFromQueue(queue: QueueResponse): ReviewItem[] {
  return [
    ...queue.stories.map(story => ({
      kind: 'story' as const, id: story.id, title: story.headline,
      description: story.summary || 'No source excerpt yet', status: story.verification_label,
      created_at: story.created_at, source_urls: story.source_urls?.length ? story.source_urls : [story.canonical_url],
      details: story.publisher || 'Publisher unknown',
    })),
    ...queue.rounds.map(round => ({
      kind: 'funding_round' as const, id: round.id,
      title: `${round.round_stage || 'Unknown stage'} funding round`,
      description: round.amount_usd == null ? 'Amount undisclosed' : `$${round.amount_usd.toLocaleString()} reported`,
      status: round.verification_status, created_at: round.created_at,
      source_urls: round.source_urls || [], details: `Company ${round.company_id}`,
    })),
    ...queue.participants.map(participant => ({
      kind: 'round_participant' as const, id: participant.id,
      title: `Investor role: ${participant.role || 'unknown'}`,
      description: `Fund ${participant.fund_id}`, status: participant.verification_status,
      created_at: participant.created_at, source_urls: participant.source_urls || [],
      details: `Round ${participant.round_id}`,
    })),
    ...queue.patterns.map(pattern => ({
      kind: 'pattern' as const, id: pattern.id, title: pattern.name,
      description: pattern.description || 'No description', status: pattern.status,
      created_at: pattern.created_at, source_urls: pattern.source_links || [],
      details: `${Array.isArray(pattern.qualifying_events) ? pattern.qualifying_events.length : 0} qualifying events`,
    })),
  ].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

function actionsFor(item: ReviewItem): Array<{ label: string; status: string }> {
  if (item.kind === 'pattern') {
    return item.status === 'candidate'
      ? [{ label: 'Publish', status: 'published' }, { label: 'Reject', status: 'rejected' }]
      : [{ label: 'Publish correction', status: 'published' }];
  }
  return item.status === 'unverified'
    ? [{ label: 'Verify', status: 'verified' }, { label: 'Mark partial', status: 'partial' }, { label: 'Mark conflicted', status: 'conflicted' }]
    : [{ label: 'Verify', status: 'verified' }, { label: 'Unverify', status: 'unverified' }, { label: 'Mark conflicted', status: 'conflicted' }]
      .filter(action => action.status !== item.status);
}

function sourceLink(url: string) {
  try { return ['http:', 'https:'].includes(new URL(url).protocol); } catch { return false; }
}

async function fetchQueue(): Promise<QueueResponse> {
  const response = await fetch('/api/admin/review', { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to load review queue');
  return data as QueueResponse;
}

export default function ReviewQueuePage() {
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [tab, setTab] = useState<Kind | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ item: ReviewItem; status: string } | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadQueue = useCallback(async () => {
    try {
      setQueue(await fetchQueue());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load review queue');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchQueue().then(data => {
      if (active) { setQueue(data); setError(null); }
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Failed to load review queue');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function submitReview() {
    if (!decision || reason.trim().length < 10) return;
    setSaving(true);
    try {
      const response = await fetch('/api/admin/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: decision.item.kind, id: decision.item.id,
          expectedStatus: decision.item.status, newStatus: decision.status, reason: reason.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Review was not saved');
      setDecision(null);
      setReason('');
      await loadQueue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Review was not saved');
    } finally { setSaving(false); }
  }

  const items = queue ? itemsFromQueue(queue) : [];
  const visible = tab === 'all' ? items : items.filter(item => item.kind === tab);
  const tabs: Array<{ key: Kind | 'all'; label: string }> = [
    { key: 'all', label: 'All' }, { key: 'story', label: 'Stories' },
    { key: 'funding_round', label: 'Rounds' }, { key: 'round_participant', label: 'Investor roles' },
    { key: 'pattern', label: 'Patterns' },
  ];

  return <main className="app-page-content max-w-6xl space-y-6">
    <div className="flex items-center justify-between gap-4">
      <div><h1 className="text-3xl font-bold">Review queue</h1>
        <p className="text-text-secondary">Every decision needs a source and a reviewer reason. Rounds and investor roles are reviewed separately.</p></div>
      <Link href="/admin" className="text-sm text-accent-blue">Admin dashboard</Link>
    </div>
    <nav className="flex flex-wrap gap-2" aria-label="Review types">
      {tabs.map(entry => <Button key={entry.key} size="sm" variant={tab === entry.key ? 'primary' : 'secondary'}
        onClick={() => setTab(entry.key)}>{entry.label} ({entry.key === 'all' ? items.length : items.filter(item => item.kind === entry.key).length})</Button>)}
    </nav>
    {error && <div role="alert" className="rounded-lg border border-accent-red p-4 text-accent-red">{error} <Button size="sm" variant="secondary" onClick={() => void loadQueue()}>Retry</Button></div>}
    {loading && <p className="text-text-secondary">Loading review evidence…</p>}
    {!loading && !error && visible.length === 0 && <Card><CardContent className="p-6">No pending items in this category. This does not imply ingestion is complete.</CardContent></Card>}
    {!loading && visible.map(item => <Card key={`${item.kind}:${item.id}`}><CardContent className="space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-2"><Badge variant="blue">{item.kind.replaceAll('_', ' ')}</Badge><Badge variant="default">{item.status}</Badge><span className="text-xs text-text-muted">{formatDate(item.created_at)}</span></div>
      <div><h2 className="font-semibold">{item.title}</h2><p className="text-sm text-text-secondary">{item.description}</p><p className="text-xs text-text-muted">{item.details}</p></div>
      <div className="space-y-1 text-sm"><p className="font-medium">Original evidence</p>
        {item.source_urls.length === 0 ? <p className="text-accent-red">No source URL recorded; do not approve.</p> : item.source_urls.filter(sourceLink).map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block break-all text-accent-blue underline">{url}</a>)}
      </div>
      <div className="flex flex-wrap gap-2">{actionsFor(item).map(action => (
        <Button 
          key={action.status} 
          size="sm" 
          variant={action.status === 'verified' || action.status === 'published' ? 'primary' : 'secondary'}
          onClick={() => { 
            console.log('Action clicked:', action.label, action.status, item.id);
            setDecision({ item, status: action.status }); 
            setReason(''); 
            setError(null); 
          }}
        >
          {action.label}
        </Button>
      ))}</div>
    </CardContent></Card>)}
    {decision && <Card><CardContent className="space-y-3 p-5">
      <h2 className="font-semibold">{decision.item.title}: {decision.item.status} → {decision.status}</h2>
      <label htmlFor="review-reason" className="block text-sm">Why is this decision supported by the original evidence?</label>
      <textarea id="review-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={1000}
        className="min-h-24 w-full rounded-lg border border-border-default bg-bg-secondary p-3" />
      <div className="flex gap-2"><Button onClick={() => void submitReview()} disabled={saving || reason.trim().length < 10} loading={saving}>Save audited decision</Button>
        <Button variant="secondary" onClick={() => setDecision(null)} disabled={saving}>Cancel</Button></div>
    </CardContent></Card>}
    {queue && <section className="space-y-2"><h2 className="text-xl font-semibold">Recent decisions</h2>
      {queue.history.length === 0 ? <p className="text-text-secondary">No review history yet.</p> : queue.history.map(event => <p key={event.id} className="text-sm text-text-secondary">{formatDate(event.reviewed_at)} · {event.item_kind}: {event.previous_status} → {event.new_status} · {event.reason}</p>)}
    </section>}
    <p className="text-sm text-text-muted">Stated and observed investor theses are not approvable here until their separate evidence and review states are defined.</p>
  </main>;
}
