'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { MultiSelect } from '@/components/ui/Select';
import { cn, formatRelativeTime, truncate } from '@/lib/utils/helpers';
import { Story, VerificationStatus, AITheme, Geography } from '@/types';

interface FeedResponse {
  stories: Story[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const TOPIC_OPTIONS = [
  { value: 'foundation_models', label: 'Foundation Models' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'applications', label: 'Applications' },
  { value: 'robotics', label: 'Robotics' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'research', label: 'Research' },
];

const GEOGRAPHY_OPTIONS = [
  { value: 'us', label: 'United States' },
  { value: 'india', label: 'India' },
  { value: 'eu', label: 'European Union' },
  { value: 'israel', label: 'Israel' },
  { value: 'canada', label: 'Canada' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'sea', label: 'Southeast Asia' },
  { value: 'global', label: 'Global' },
];

const EVENT_TYPE_OPTIONS = [
  { value: 'funding', label: 'Funding' },
  { value: 'launch', label: 'Product Launch' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'research', label: 'Research' },
  { value: 'acquisition', label: 'Acquisition' },
];

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
  };
  return <Badge variant={colors[topic] || 'purple'}>{topic.replace('_', ' ')}</Badge>;
};

export default function NewsPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [totalStories, setTotalStories] = useState(0);
  const [search, setSearch] = useState('');
  const [topics, setTopics] = useState<AITheme[]>([]);
  const [geographies, setGeographies] = useState<Geography[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchStories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { q: search }),
        ...(topics.length > 0 && { topics: topics.join(',') }),
        ...(geographies.length > 0 && { geographies: geographies.join(',') }),
        ...(eventTypes.length > 0 && { event_types: eventTypes.join(',') }),
        ...(verifiedOnly && { verified_only: 'true' }),
      });
      const response = await fetch(`/api/feed?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to fetch stories');
      const data: FeedResponse = await response.json();
      setStories(data.stories);
      setTotalStories(data.pagination.total);
      setHasMore(data.pagination.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stories');
    } finally {
      setLoading(false);
    }
  }, [page, search, topics, geographies, eventTypes, verifiedOnly]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const applyFilters = useCallback(() => {
    setPage(1);
    fetchStories();
  }, [fetchStories]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const clearFilters = () => {
    setSearch('');
    setTopics([]);
    setGeographies([]);
    setEventTypes([]);
    setVerifiedOnly(false);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="sticky top-0 z-40 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-text-primary">Ventro</Link>
          <Link href="/news" className="hidden sm:block px-4 py-2 rounded-lg bg-accent-blue/10 text-accent-blue text-sm font-medium">
            News
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">News Feed</h1>
          <p className="text-text-secondary">Real-time AI intelligence from verified sources</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 min-w-[250px]">
                <Input
                  label="Search"
                  placeholder="Search headlines, companies, investors..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                />
              </div>
              <div className="w-full sm:w-[180px]">
                <MultiSelect
                  label="Topics"
                  options={TOPIC_OPTIONS}
                  value={topics}
                  onChange={setTopics}
                  placeholder="All topics"
                  maxSelections={7}
                />
              </div>
              <div className="w-full sm:w-[180px]">
                <MultiSelect
                  label="Geography"
                  options={GEOGRAPHY_OPTIONS}
                  value={geographies}
                  onChange={setGeographies}
                  placeholder="All regions"
                  maxSelections={8}
                />
              </div>
              <div className="w-full sm:w-[180px]">
                <MultiSelect
                  label="Event Type"
                  options={EVENT_TYPE_OPTIONS}
                  value={eventTypes}
                  onChange={setEventTypes}
                  placeholder="All types"
                  maxSelections={5}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={(e) => setVerifiedOnly(e.target.checked)}
                    className="rounded border-border-default text-accent-blue focus:ring-accent-blue"
                  />
                  <span className="text-sm">Verified only</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-text-secondary">
            Showing {stories.length} of {totalStories} stories
          </p>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>

        {loading && (
          <div className="space-y-4" role="feed" aria-label="News feed">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <article key={i} className="group">
                <Card className="h-64 animate-pulse">
                  <CardContent className="p-4 sm:p-5">
                    <div className="space-y-3">
                      <div className="h-4 bg-bg-tertiary rounded w-3/4"></div>
                      <div className="h-6 bg-bg-tertiary rounded w-1/2"></div>
                      <div className="h-4 bg-bg-tertiary rounded w-full"></div>
                      <div className="h-4 bg-bg-tertiary rounded w-3/4"></div>
                      <div className="flex gap-2">
                        <div className="h-6 bg-bg-tertiary rounded w-24"></div>
                        <div className="h-6 bg-bg-tertiary rounded w-24"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </article>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-accent-red mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-lg font-medium mb-2">Failed to load stories</h3>
            <p className="text-text-secondary mb-4">{error}</p>
            <Button variant="secondary" onClick={fetchStories}>Retry</Button>
          </div>
        )}

        {!loading && !error && stories.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium mb-2">No stories found</h3>
            <p className="text-text-secondary mb-4">Try adjusting your filters or search terms</p>
            <Button variant="secondary" onClick={clearFilters}>
              Clear all filters
            </Button>
          </div>
        )}

        {!loading && !error && stories.length > 0 && (
          <>
            <div className="space-y-4" role="feed" aria-label="News feed">
              {stories.map((story) => (
                <article key={story.id} className="group">
                  <Card className="overflow-hidden transition-shadow hover:shadow-md">
                    <CardContent className="p-4 sm:p-5">
                      {story.image_url && (
                        <Link href={`/news/${story.id}`} className="mb-4 block overflow-hidden rounded-lg bg-bg-tertiary">
                          {/* Feed-provided image hosts are not a fixed Next Image allowlist. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={story.image_url} alt="" loading="lazy" className="h-48 w-full object-cover sm:h-60" />
                        </Link>
                      )}
                      {/* Header row */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {story.ai_topics.slice(0, 2).map((topic) => (
                          <Badge key={topic} variant="blue" className="text-xs">{topic.replace('_', ' ')}</Badge>
                        ))}
                        {getVerificationBadge(story.verification_label)}
                        <span className="text-xs text-text-muted ml-auto">
                          {formatRelativeTime(story.event_date)} · {story.source_count} source{story.source_count !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Headline */}
                      <Link href={`/news/${story.id}`} className="block group">
                        <h2 className="text-lg sm:text-xl font-semibold text-text-primary group-hover:text-accent-blue transition-colors mb-2">
                          {story.headline}
                        </h2>
                      </Link>

                      {/* Summary */}
                      <div className="mb-3">
                        <span className="text-xs text-text-muted">
                          {story.summary_kind === 'article_summary' ? 'Article summary' : 'Source excerpt'}
                        </span>
                        <p className="text-text-secondary text-sm line-clamp-3">
                          {story.summary || 'No excerpt available from this source.'}
                        </p>
                        <a href={story.canonical_url} target="_blank" rel="noopener noreferrer"
                          className="mt-2 inline-block text-sm text-accent-blue hover:underline">
                          Read original at {story.publisher || 'source'} ↗
                        </a>
                      </div>

                      {/* Entities row */}
                      <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted mb-3">
                        {story.companies.slice(0, 3).map((c) => (
                          <span key={c.company_id} className="px-2 py-0.5 rounded bg-bg-tertiary">
                            🏢 {c.name}{c.role === 'primary' && ' (primary)'}
                          </span>
                        ))}
                        {story.investors.slice(0, 3).map((i) => (
                          <span key={i.fund_id} className="px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue">
                            💰 {i.name}{i.role === 'lead' && ' (lead)'}
                          </span>
                        ))}
                        {story.ai_topics.length > 2 && (
                          <span className="px-2 py-0.5 rounded bg-bg-tertiary">+{story.ai_topics.length - 2} topics</span>
                        )}
                        {story.geography && (
                          <span className="px-2 py-0.5 rounded bg-bg-tertiary">🌍 {story.geography.toUpperCase()}</span>
                        )}
                      </div>

                      {/* Action row */}
                      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border-default">
                        <Button variant="ghost" size="sm" className="gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                          Save
                        </Button>
                        {story.companies[0] && (
                          <Button variant="ghost" size="sm" className="gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            Follow {story.companies[0].name}
                          </Button>
                        )}
                        {story.investors[0] && (
                          <Button variant="ghost" size="sm" className="gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            Follow {story.investors[0].name}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="gap-1 ml-auto">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                          Share
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1">
                          Why this?
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </article>
              ))}
            </div>

            {hasMore && (
              <div className="mt-6 flex justify-center gap-2">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => handlePageChange(page - 1)} 
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <span className="flex items-center text-text-secondary">
                  Page {page}
                </span>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => handlePageChange(page + 1)} 
                  disabled={!hasMore}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
