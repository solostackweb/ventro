'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { cn, formatRelativeTime, truncate } from '@/lib/utils/helpers';
import { Story, VerificationStatus } from '@/types';

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

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEntitlement, setUserEntitlement] = useState<'preview' | 'student_trial' | 'subscribed'>('preview');
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<FeedResponse['pagination'] | null>(null);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const checkAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login?redirect=/dashboard');
      return;
    }
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('entitlement, trial_expires_at, onboarding_completed_at')
      .eq('id', session.user.id)
      .single();

    let entitlement = profile?.entitlement || 'preview';
    if (entitlement === 'student_trial' && profile?.trial_expires_at) {
      if (new Date(profile.trial_expires_at) < new Date()) {
        entitlement = 'preview';
      }
    }
    setUserEntitlement(entitlement);
    setOnboardingCompleted(!!profile?.onboarding_completed_at);
  }, [router, supabase]);

  const fetchFeed = useCallback(async (pageNum = 1) => {
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20',
        sort: 'latest',
      });
      const response = await fetch(`/api/feed?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to fetch feed');
      const data: FeedResponse = await response.json();
      if (pageNum === 1) {
        setStories(data.stories);
      } else {
        setStories(prev => [...prev, ...data.stories]);
      }
      setPagination(data.pagination);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
    fetchFeed(1);
  }, [checkAuth, fetchFeed]);

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

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Feed Header */}
      <div className="sticky top-16 z-30 bg-bg-primary/95 backdrop-blur-sm border-b border-border-default px-4 py-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold">For You</h1>
              <p className="text-sm text-text-muted">Your personalized AI intelligence feed</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm">Filters</Button>
              <Button variant="ghost" size="sm">Sort: Latest</Button>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            {['foundation_models', 'infrastructure', 'applications', 'robotics', 'hardware'].map((topic) => (
              <Button key={topic} variant="ghost" size="sm" className="gap-1">
                {getTopicBadge(topic)}
              </Button>
            ))}
            <Button variant="ghost" size="sm" className="gap-1">
              <Badge variant="verified" dot>Verified only</Badge>
            </Button>
          </div>
        </div>
      </div>

      {/* Feed List */}
      <div className="mx-auto max-w-5xl px-4 py-6">
        {loading && (
          <div className="space-y-4" role="feed" aria-label="News feed">
            {[1, 2, 3].map((i) => (
              <article key={i} className="group">
                <Card className="overflow-hidden">
                  <CardContent className="p-4 sm:p-5">
                    <div className="space-y-3">
                      <div className="h-4 bg-bg-tertiary animate-pulse rounded w-3/4"></div>
                      <div className="h-6 bg-bg-tertiary animate-pulse rounded w-1/2"></div>
                      <div className="h-4 bg-bg-tertiary animate-pulse rounded w-full"></div>
                      <div className="h-4 bg-bg-tertiary animate-pulse rounded w-3/4"></div>
                      <div className="flex gap-2">
                        <div className="h-6 bg-bg-tertiary animate-pulse rounded w-24"></div>
                        <div className="h-6 bg-bg-tertiary animate-pulse rounded w-24"></div>
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
            <h3 className="text-lg font-medium mb-2">Failed to load feed</h3>
            <p className="text-text-secondary mb-4">{error}</p>
            <Button variant="secondary" onClick={() => fetchFeed(1)}>Retry</Button>
          </div>
        )}

        {!loading && !error && stories.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 00-2-2H9a2 2 0 00-2 2v9a2 2 0 002 2h2m-4-4h.01" />
            </svg>
            <h3 className="text-lg font-medium mb-2">No stories yet</h3>
            {onboardingCompleted ? (
              <>
                <p className="text-text-secondary mb-4">
                  No stories available in the feed yet.  
                  <Link href="/news" className="text-accent-blue hover:underline">Browse the full feed </Link> 
                  or run ingestion to fetch the latest AI news.
                </p>
                <Button variant="secondary" onClick={() => router.push('/news')}>Browse Full Feed</Button>
              </>
            ) : (
              <>
                <p className="text-text-secondary mb-4">
                  Complete onboarding to personalize your feed, 
                  or <Link href="/news" className="text-accent-blue hover:underline">browse the full feed</Link>.
                </p>
                <Button variant="secondary" onClick={() => router.push('/onboarding')}>Complete Onboarding</Button>
              </>
            )}
          </div>
        )}

        {!loading && !error && stories.length > 0 && (
          <div className="space-y-4" role="feed" aria-label="News feed">
            {stories.map((story) => (
              <article key={story.id} className="group">
                <Card className="overflow-hidden transition-shadow hover:shadow-md">
                  <CardContent className="p-4 sm:p-5">
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
                    <p className="text-text-secondary text-sm mb-3 line-clamp-2">
                      {story.summary}
                    </p>

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

            {/* Pagination */}
            {pagination && pagination.hasMore && (
              <div className="text-center pt-4">
                <Button variant="secondary" onClick={() => fetchFeed(page + 1)} loading={loadingMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading...' : 'Load more'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}