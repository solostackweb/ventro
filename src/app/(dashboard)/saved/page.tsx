'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { cn, formatRelativeTime } from '@/lib/utils/helpers';

interface SavedItem {
  id: string;
  item_type: string;
  item_id: string;
  saved_at: string;
  item: {
    id: string;
    headline?: string;
    summary?: string;
    event_date?: string;
    publisher?: string;
    source_count?: number;
    ai_topics?: string[];
    verification_label?: string;
    canonical_name?: string;
    short_description?: string;
    ai_tags?: string[];
    stage?: string;
    hq_city?: string;
    verification_status?: string;
    canonical_domain?: string;
    firm_type?: string;
    ai_focus_areas?: string[];
    name?: string;
    description?: string;
    confidence?: string;
    status?: string;
    distinct_companies?: number;
    distinct_funds?: number;
  };
}

interface SavedResponse {
  saved: SavedItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export default function SavedPage() {
  const [activeTab, setActiveTab] = useState<'stories' | 'companies' | 'funds' | 'patterns'>('stories');
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchSaved = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(activeTab && { type: activeTab }),
      });
      const response = await fetch(`/api/saved?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to fetch saved items');
      const data: SavedResponse = await response.json();
      setItems(data.saved);
      setTotal(data.pagination.total);
      setHasMore(data.pagination.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load saved items');
    } finally {
      setLoading(false);
    }
  }, [page, activeTab]);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  const applyFilters = useCallback(() => {
    setPage(1);
    fetchSaved();
  }, [fetchSaved]);

  const handleSave = async (itemType: string, itemId: string, isSaving: boolean) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      if (isSaving) {
        await fetch('/api/saved', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_type: itemType, item_id: itemId }),
        });
      } else {
        await fetch('/api/saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_type: itemType, item_id: itemId }),
        });
      }
      fetchSaved();
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  const tabs = [
    { id: 'stories', label: 'Stories' },
    { id: 'companies', label: 'Companies' },
    { id: 'funds', label: 'Investors' },
    { id: 'patterns', label: 'Patterns' },
  ];

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="sticky top-0 z-40 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-text-primary">Ventro</Link>
          <Link href="/saved" className="hidden sm:block px-4 py-2 rounded-lg bg-accent-blue/10 text-accent-blue text-sm font-medium">
            Saved
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Saved Items</h1>
          <p className="text-text-secondary">Your bookmarked stories, companies, investors, and patterns</p>
        </div>

        <div className="border-b border-border-default mb-6">
          <nav className="flex gap-1" aria-label="Saved item types">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setPage(1); }}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'text-accent-blue border-accent-blue'
                    : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border-default'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
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
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-accent-red mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-lg font-medium mb-2">Failed to load saved items</h3>
            <p className="text-text-secondary mb-4">{error}</p>
            <Button variant="secondary" onClick={fetchSaved}>Retry</Button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <h3 className="text-lg font-medium mb-2">Nothing saved yet</h3>
            <p className="text-text-secondary mb-4">
              {activeTab === 'stories' && 'Save stories from the feed to read later'}
              {activeTab === 'companies' && 'Follow companies to track them here'}
              {activeTab === 'funds' && 'Follow investors to track them here'}
              {activeTab === 'patterns' && 'Save patterns from the Patterns page'}
            </p>
            <Link href={activeTab === 'stories' ? '/news' : activeTab === 'companies' ? '/companies' : activeTab === 'funds' ? '/investors' : '/patterns'}>
              <Button variant="secondary">Browse {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</Button>
            </Link>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <div className="space-y-4">
              {items.map((item) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.item.headline || item.item.canonical_name || item.item.name || item.item.name}</h3>
                      <p className="text-sm text-text-muted mt-1">Saved {formatRelativeTime(item.saved_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeTab === 'stories' && item.item.id && (
                        <Link href={`/news/${item.item.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      )}
                      {activeTab === 'companies' && item.item.id && (
                        <Link href={`/companies/${item.item.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      )}
                      {activeTab === 'funds' && item.item.id && (
                        <Link href={`/investors/${item.item.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      )}
                      {activeTab === 'patterns' && item.item.id && (
                        <Link href={`/patterns/${item.item.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-accent-red hover:text-red-700"
                        onClick={() => handleSave(activeTab === 'stories' ? 'story' : activeTab === 'companies' ? 'company' : activeTab === 'funds' ? 'fund' : 'pattern', item.item.id, true)}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {hasMore && (
              <div className="mt-6 flex justify-center gap-2">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => setPage(page - 1)} 
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
                  onClick={() => setPage(page + 1)} 
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