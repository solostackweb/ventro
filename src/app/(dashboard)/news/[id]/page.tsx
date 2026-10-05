'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { cn, formatDate, formatRelativeTime, truncate } from '@/lib/utils/helpers';
import { Story, VerificationStatus, AITheme, Geography } from '@/types';

interface StoryWithSources extends Story {
  story_sources?: {
    id: string;
    source_url: string;
    publisher: string | null;
    published_at: string | null;
    fetched_at: string;
    content_hash: string | null;
    supports_claims: Record<string, unknown> | null;
  }[];
}

function sourceLabel(source: { publisher: string | null; source_url: string }): string {
  if (source.publisher) return source.publisher;
  try {
    return new URL(source.source_url).hostname.replace(/^www\./, '');
  } catch {
    return 'Original source';
  }
}

const getVerificationBadge = (status: VerificationStatus) => {
  switch (status) {
    case 'verified':
      return <Badge variant="verified" dot>Verified</Badge>;
    case 'partial':
      return <Badge variant="partial" dot>Partial</Badge>;
    case 'unverified':
      return <Badge variant="unverified" dot>Unverified</Badge>;
    case 'conflicted':
      return <Badge variant="conflicted" dot>Conflicted</Badge>;
  }
};

const getTopicBadge = (topic: string) => {
  const colors: Record<string, 'blue' | 'green' | 'amber' | 'red' | 'purple'> = {
    foundation_models: 'purple',
    infrastructure: 'blue',
    applications: 'green',
    robotics: 'amber',
    hardware: 'red',
    research: 'blue',
    other: 'purple',
  };
  return <Badge variant={colors[topic] || 'purple'}>{topic.replace('_', ' ')}</Badge>;
};

const getEventTypeBadge = (type: string) => {
  const colors: Record<string, 'blue' | 'green' | 'amber' | 'red' | 'purple'> = {
    funding: 'green',
    launch: 'blue',
    partnership: 'amber',
    research: 'purple',
    acquisition: 'red',
    other: 'blue',
  };
  return <Badge variant={colors[type] || 'blue'}>{type}</Badge>;
};

export default function StoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [story, setStory] = useState<StoryWithSources | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionField, setCorrectionField] = useState('');
  const [correctionValue, setCorrectionValue] = useState('');
  const [correctionEvidence, setCorrectionEvidence] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [correctionSuccess, setCorrectionSuccess] = useState(false);

  useEffect(() => {
    const fetchStory = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/stories/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            router.push('/news');
            return;
          }
          throw new Error('Failed to fetch story');
        }
        const data = await response.json();
        setStory(data.story);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load story');
      } finally {
        setLoading(false);
      }
    };
    fetchStory();
  }, [id, router]);

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!story || !correctionField || !correctionValue) return;
    
    setSubmittingCorrection(true);
    try {
      const response = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: 'story',
          entity_id: story.id,
          field: correctionField,
          suggested_value: correctionValue,
          evidence_text: correctionEvidence,
        }),
      });
      
      if (response.ok) {
        setCorrectionSuccess(true);
        setShowCorrection(false);
        setCorrectionField('');
        setCorrectionValue('');
        setCorrectionEvidence('');
      }
    } catch (err) {
      console.error('Failed to submit correction:', err);
    } finally {
      setSubmittingCorrection(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary mb-4">Story not found</p>
          <Button variant="secondary" onClick={() => router.push('/news')}>Back to News</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="sticky top-0 z-40 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-text-primary">Ventro</Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/news')}>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back
            </Button>
            <Button variant="ghost" size="sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              Share
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCorrection(true)}>
              Report Correction
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/news" className="text-sm text-text-muted hover:text-text-primary">
            ← Back to News Feed
          </Link>
        </div>

        <article className="space-y-6">
          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-2">
            {story.ai_topics.slice(0, 3).map((topic) => (
              <Badge key={topic} variant="blue" className="text-xs">{topic.replace('_', ' ')}</Badge>
            ))}
            {getVerificationBadge(story.verification_label)}
            {getEventTypeBadge(story.event_type)}
            <span className="text-xs text-text-muted ml-auto">
              {formatRelativeTime(story.event_date)} · {story.source_count} source{story.source_count !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl font-bold text-text-primary">{story.headline}</h1>

          {story.image_url && (
            <div className="overflow-hidden rounded-xl bg-bg-tertiary">
              {/* External feed image domains are intentionally not proxied through Next Image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={story.image_url} alt="" className="max-h-[28rem] w-full object-cover" />
            </div>
          )}

          {/* Publisher info */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
            {story.publisher && <><span>Source: {story.publisher}</span><span>•</span></>}
            <span>{formatDate(story.event_date)}</span>
            {story.geography && (
              <Badge variant="blue" className="text-xs">🌍 {story.geography.toUpperCase()}</Badge>
            )}
          </div>

          {/* Source excerpt or independently produced article summary */}
          <div className="prose prose-invert max-w-none">
            <h2 className="text-sm font-medium text-text-muted">
              {story.summary_kind === 'article_summary' ? 'Article summary' : 'Source excerpt'}
            </h2>
            <p className="text-text-secondary text-lg leading-relaxed">
              {story.summary || 'No excerpt available from this source.'}
            </p>
            <a href={story.canonical_url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-accent-blue hover:underline">Read the original article ↗</a>
          </div>

          {/* Entities */}
          <div className="grid sm:grid-cols-2 gap-6">
            {story.companies.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Companies ({story.companies.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {story.companies.map((c) => (
                      <Link key={c.company_id} href={`/companies/${c.company_id}`} className="px-3 py-1.5 rounded-lg bg-bg-secondary border border-border-default text-sm hover:bg-bg-tertiary transition-colors">
                        🏢 {c.name}{c.role === 'primary' && ' (primary)'}
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {story.investors.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Investors ({story.investors.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {story.investors.map((i) => (
                      <Link key={i.fund_id} href={`/investors/${i.fund_id}`} className="px-3 py-1.5 rounded-lg bg-accent-blue/10 text-accent-blue text-sm hover:bg-accent-blue/20 transition-colors">
                        💰 {i.name}{i.role === 'lead' && ' (lead)'}
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Source Timeline */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Source Timeline</h2>
              <Badge variant="blue">{story.story_sources?.length || 0} sources</Badge>
            </div>

            {story.story_sources && story.story_sources.length > 0 ? (
              <div className="space-y-3">
                {story.story_sources.map((source, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-text-muted font-mono">{i + 1}</span>
                          <div>
                            <a href={source.source_url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-blue hover:underline">
                              {sourceLabel(source)}
                            </a>
                            <p className="text-sm text-text-muted">
                              {source.published_at ? formatDate(source.published_at) : 'Date unknown'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 rounded bg-bg-tertiary text-sm font-mono">
                            {sourceLabel(source)}
                          </span>
                          <a href={source.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-blue hover:underline">
                            Open source →
                          </a>
                        </div>
                      </div>
                      {source.supports_claims && (
                        <details className="mt-3">
                          <summary className="text-sm text-text-muted cursor-pointer">Supported claims</summary>
                          <pre className="mt-2 p-3 bg-bg-tertiary rounded text-xs overflow-x-auto text-text-secondary">
                            {JSON.stringify(source.supports_claims, null, 2)}
                          </pre>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-text-muted">
                  No source details available for this story.
                </CardContent>
              </Card>
            )}
          </section>

          {/* Metadata */}
          <section className="border-t border-border-default pt-6">
            <h2 className="text-lg font-semibold mb-3">Story Metadata</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-text-muted">Canonical URL</p>
                <p className="font-mono text-accent-blue truncate">{story.canonical_url}</p>
              </div>
              <div>
                <p className="text-text-muted">Content Hash</p>
                <p className="font-mono text-text-secondary">{story.content_hash}</p>
              </div>
              <div>
                <p className="text-text-muted">Last Checked</p>
                <p>{formatDate(story.last_checked_at)}</p>
              </div>
              <div>
                <p className="text-text-muted">Created</p>
                <p>{formatDate(story.created_at)}</p>
              </div>
            </div>
          </section>
        </article>

        {/* Correction Modal */}
        {showCorrection && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCorrection(false)}>
            <div className="bg-bg-primary rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              {correctionSuccess ? (
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <h3 className="text-lg font-semibold mb-2">Correction Submitted</h3>
                  <p className="text-text-secondary mb-4">Thank you for reporting this. Our team will review it shortly.</p>
                  <Button variant="primary" onClick={() => { setShowCorrection(false); setCorrectionSuccess(false); }}>
                    Close
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Report Correction</h3>
                    <button onClick={() => setShowCorrection(false)} className="text-text-muted hover:text-text-primary">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <p className="text-text-secondary text-sm mb-4">Help us improve by reporting inaccuracies. All corrections are reviewed by our team.</p>
                  <form onSubmit={handleSubmitCorrection} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Field to correct</label>
                      <select
                        value={correctionField}
                        onChange={(e) => setCorrectionField(e.target.value)}
                        className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                      >
                        <option value="">Select field</option>
                        <option value="headline">Headline</option>
                        <option value="summary">Summary</option>
                        <option value="event_date">Event Date</option>
                        <option value="publisher">Publisher</option>
                        <option value="ai_topics">AI Topics</option>
                        <option value="geography">Geography</option>
                        <option value="event_type">Event Type</option>
                        <option value="verification_label">Verification Label</option>
                        <option value="companies">Companies</option>
                        <option value="investors">Investors</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Suggested Value</label>
                      <Input
                        value={correctionValue}
                        onChange={(e) => setCorrectionValue(e.target.value)}
                        placeholder="Enter the correct value"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Evidence (optional)</label>
                      <textarea
                        value={correctionEvidence}
                        onChange={(e) => setCorrectionEvidence(e.target.value)}
                        placeholder="Provide evidence or source URL supporting this correction"
                        rows={3}
                        className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue text-text-primary"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="secondary" onClick={() => setShowCorrection(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" variant="primary" disabled={submittingCorrection}>
                        {submittingCorrection ? 'Submitting...' : 'Submit Correction'}
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
