'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { cn, formatDate, formatNumber, formatCurrency } from '@/lib/utils/helpers';
import { Pattern, PatternEvent, PatternCounterexample } from '@/types';
import { DiscussionSection } from '@/components/DiscussionSection';

interface PatternWithRelations extends Pattern {
  user_profiles?: {
    id: string;
    email: string;
    role: string;
  } | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

const getConfidenceBadge = (confidence: string) => {
  switch (confidence) {
    case 'high':
      return <Badge variant="green" dot>High</Badge>;
    case 'medium':
      return <Badge variant="amber" dot>Medium</Badge>;
    case 'low':
      return <Badge variant="red" dot>Low</Badge>;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'published':
      return <Badge variant="verified" dot>Published</Badge>;
    case 'candidate':
      return <Badge variant="blue" dot>Candidate</Badge>;
    case 'corrected':
      return <Badge variant="amber" dot>Corrected</Badge>;
    case 'retired':
      return <Badge variant="purple" dot>Retired</Badge>;
    case 'rejected':
      return <Badge variant="red" dot>Rejected</Badge>;
    default:
      return <Badge variant="default" dot>{status}</Badge>;
  }
};

const getChangeDisplay = (change: number | null) => {
  if (change === null) return 'N/A';
  if (change > 0) return `+${change.toFixed(1)}%`;
  if (change < 0) return `${change.toFixed(1)}%`;
  return '0%';
};

export default function PatternDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [pattern, setPattern] = useState<PatternWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPattern = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/patterns/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            router.push('/patterns');
            return;
          }
          throw new Error('Failed to fetch pattern');
        }
        const data = await response.json();
        setPattern(data.pattern);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load pattern');
      } finally {
        setLoading(false);
      }
    };
    fetchPattern();
  }, [id, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !pattern) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary mb-4">Pattern not found</p>
          <Button variant="secondary" onClick={() => router.push('/patterns')}>Back to Patterns</Button>
        </div>
      </div>
    );
  }

  const qualifyingEvents = pattern.qualifying_events as PatternEvent[] || [];
  const counterexamples = pattern.counterexamples as PatternCounterexample[] || [];

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="sticky top-0 z-40 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-text-primary">Ventro</Link>
          <div className="flex items-center gap-3">
            <Link href="/patterns" className="px-4 py-2 rounded-lg bg-bg-secondary text-text-secondary hover:bg-bg-tertiary transition-colors text-sm">
              ← Back to Patterns
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {getConfidenceBadge(pattern.confidence)}
            {getStatusBadge(pattern.status)}
            <Badge variant="amber">{getChangeDisplay(pattern.change_percentage)} vs baseline</Badge>
          </div>
          <h1 className="text-3xl font-bold mb-2">{pattern.name}</h1>
          <p className="text-text-secondary">{pattern.description}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted mt-4">
            <span>📅 Window: {formatDate(pattern.time_window_start)} – {formatDate(pattern.time_window_end)}</span>
            <span>🏢 {pattern.distinct_companies} companies</span>
            <span>💰 {pattern.distinct_funds} funds</span>
            <span>📊 {qualifyingEvents.length} qualifying events</span>
            <span>⚠ {counterexamples.length} counterexamples</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Qualifying Events */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Qualifying Events ({qualifyingEvents.length})</h2>
                <Badge variant="blue">{qualifyingEvents.length} events</Badge>
              </div>
              {qualifyingEvents.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {qualifyingEvents.map((event, i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <Link href={`/companies/${event.company_id}`} className="font-semibold hover:text-accent-blue">
                              {event.company_name}
                            </Link>
                            <p className="text-sm text-text-muted">
                              {formatDate(event.date)} · {event.round_stage?.replace('_', ' ')} · {formatCurrency(event.amount_usd)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {event.fund_ids?.map((fid, fi) => (
                              <Link key={fi} href={`/investors/${fid}`} className="px-2 py-1 rounded bg-accent-blue/10 text-accent-blue text-xs hover:bg-accent-blue/20">
                                {event.fund_names?.[fi] || fid}
                              </Link>
                            ))}
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-text-muted">
                          Source: <a href={event.source_url} target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:underline">{event.source_url}</a>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-text-secondary">No qualifying events recorded.</p>
              )}
            </section>

            {/* Counterexamples */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Counterexamples ({counterexamples.length})</h2>
                <Badge variant="amber">{counterexamples.length} counterexamples</Badge>
              </div>
              {counterexamples.length > 0 ? (
                <div className="space-y-3">
                  {counterexamples.map((ce, i) => (
                    <Card key={i} className="border-red-200">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="font-semibold">{ce.entity_name}</span>
                            <Badge variant="red" className="ml-2">{ce.entity_type}</Badge>
                          </div>
                          <Badge variant="red">{ce.reason}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-text-muted">{ce.reason}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-text-secondary">No counterexamples recorded.</p>
              )}
            </section>

            {/* Methodology & Coverage */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Methodology & Coverage</h2>
              <div className="space-y-4">
                {pattern.coverage_notes && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">Coverage Notes</h3>
                      <p className="text-text-secondary">{pattern.coverage_notes}</p>
                    </CardContent>
                  </Card>
                )}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-2">Baseline vs Current</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-text-muted">Baseline Value</p>
                        <p className="text-2xl font-bold">{pattern.baseline_value !== null ? formatNumber(pattern.baseline_value) : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-text-muted">Current Value</p>
                        <p className="text-2xl font-bold">{pattern.current_value !== null ? formatNumber(pattern.current_value) : 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status & Review */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Review Status</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-text-muted">Created by</p>
                    <p className="font-medium">{pattern.user_profiles?.email || 'Unknown'}</p>
                  </div>
                  {pattern.reviewed_by && pattern.user_profiles && (
                    <div>
                      <p className="text-sm text-text-muted">Reviewed by</p>
                      <p className="font-medium">{pattern.user_profiles.email}</p>
                    </div>
                  )}
                  {pattern.reviewed_at && (
                    <div>
                      <p className="text-sm text-text-muted">Reviewed at</p>
                      <p>{formatDate(pattern.reviewed_at)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Source Links */}
            {pattern.source_links && pattern.source_links.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Sources</h3>
                  <ul className="space-y-2">
                    {pattern.source_links.map((link, i) => (
                      <li key={i}>
                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-blue hover:underline truncate block">
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Admin Actions */}
            {pattern.status !== 'published' && (
              <Card className="border-amber-200">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Admin Actions</h3>
                  <div className="space-y-2">
                    <Button 
                      variant="primary" 
                      className="w-full" 
                      onClick={() => updatePatternStatus(pattern.id, 'published')}
                    >
                      Publish Pattern
                    </Button>
                    <Button 
                      variant="secondary" 
                      className="w-full" 
                      onClick={() => updatePatternStatus(pattern.id, 'rejected')}
                    >
                      Reject Pattern
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start" 
                      onClick={() => updatePatternStatus(pattern.id, 'corrected')}
                    >
                      Mark as Corrected
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Discussion */}
            <DiscussionSection entityType="pattern" entityId={pattern.id} />
          </div>
        </div>
      </main>
    </div>
  );
}

async function updatePatternStatus(patternId: string, status: string) {
  try {
    const response = await fetch(`/api/patterns/${patternId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (response.ok) {
      window.location.reload();
    } else {
      alert('Failed to update pattern status');
    }
  } catch (err) {
    alert('Failed to update pattern status');
  }
}