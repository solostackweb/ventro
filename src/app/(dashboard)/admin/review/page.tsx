'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { cn, formatDate, formatNumber, formatCurrency } from '@/lib/utils/helpers';
import { Pattern } from '@/types';

interface ReviewItem {
  id: string;
  type: 'pattern' | 'thesis' | 'funding_round';
  title: string;
  description: string;
  status: string;
  confidence: string;
  created_at: string;
  created_by: string;
  reviewed_at: string | null;
  data: any;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'candidate':
      return <Badge variant="blue" dot>Candidate</Badge>;
    case 'published':
      return <Badge variant="verified" dot>Published</Badge>;
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

const getConfidenceBadge = (confidence: string) => {
  switch (confidence) {
    case 'high':
      return <Badge variant="green" dot>High</Badge>;
    case 'medium':
      return <Badge variant="amber" dot>Medium</Badge>;
    case 'low':
      return <Badge variant="red" dot>Low</Badge>;
    default:
      return <Badge variant="default" dot>{confidence}</Badge>;
  }
};

const getTypeBadge = (type: string) => {
  switch (type) {
    case 'pattern':
      return <Badge variant="blue">Pattern</Badge>;
    case 'thesis':
      return <Badge variant="purple">Thesis</Badge>;
    case 'funding_round':
      return <Badge variant="green">Round</Badge>;
    default:
      return <Badge variant="default">{type}</Badge>;
  }
};

export default function ReviewQueuePage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'patterns' | 'thesis' | 'rounds'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const isAdmin = profile?.role === 'admin';
      if (!isAdmin) return;

      // Fetch patterns
      const { data: patterns } = await supabase
        .from('patterns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Fetch stated thesis
      const { data: thesis } = await supabase
        .from('stated_thesis')
        .select('*')
        .order('extracted_at', { ascending: false })
        .limit(100);

      // Fetch observed thesis
      const { data: observed } = await supabase
        .from('observed_thesis')
        .select('*')
        .order('last_computed', { ascending: false })
        .limit(100);

      // Fetch funding rounds
      const { data: rounds } = await supabase
        .from('funding_rounds')
        .select('*')
        .order('announced_date', { ascending: false })
        .limit(100);

      const allItems: ReviewItem[] = [];

      // Add patterns
      if (patterns) {
        for (const p of patterns) {
          allItems.push({
            id: p.id,
            type: 'pattern',
            title: p.name,
            description: p.description,
            status: p.status,
            confidence: p.confidence,
            created_at: p.created_at,
            created_by: p.created_by,
            reviewed_at: p.reviewed_at,
            data: p,
          });
        }
      }

      // Add thesis
      if (thesis) {
        for (const t of thesis) {
          allItems.push({
            id: t.id,
            type: 'thesis',
            title: `Stated Thesis: ${t.fund_id}`,
            description: t.text.substring(0, 200),
            status: 'extracted',
            confidence: 'high',
            created_at: t.extracted_at,
            created_by: 'system',
            reviewed_at: null,
            data: t,
          });
        }
      }

      // Add observed thesis
      if (observed) {
        for (const o of observed) {
          allItems.push({
            id: o.id,
            type: 'thesis',
            title: `Observed Thesis: ${o.fund_id}`,
            description: `${o.themes?.length || 0} themes, ${o.sample_size} deals`,
            status: 'computed',
            confidence: o.confidence || 'medium',
            created_at: o.last_computed,
            created_by: 'system',
            reviewed_at: null,
            data: o,
          });
        }
      }

      // Add rounds
      if (rounds) {
        for (const r of rounds) {
          allItems.push({
            id: r.id,
            type: 'funding_round',
            title: `${r.company_id} - ${r.round_stage}`,
            description: `$${r.amount_usd ? (r.amount_usd / 1e6).toFixed(1) + 'M' : 'Undisclosed'} ${r.round_stage}`,
            status: r.verification_status,
            confidence: r.verification_status === 'verified' ? 'high' : 'medium',
            created_at: r.created_at,
            created_by: 'extraction',
            reviewed_at: null,
            data: r,
          });
        }
      }

      // Sort by created_at desc
      allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(allItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleAction = async (itemId: string, action: 'publish' | 'reject' | 'correct') => {
    setProcessing(itemId);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const isAdmin = profile?.role === 'admin';
      if (!isAdmin) return;

      let table: string;
      const updates: Record<string, any> = { status: action === 'publish' ? 'published' : action === 'reject' ? 'rejected' : 'corrected' };

      // Find the item
      const item = items.find(i => i.id === itemId);
      if (!item) return;

      if (item.type === 'pattern') {
        table = 'patterns';
        updates.reviewed_by = user.id;
        updates.reviewed_at = new Date().toISOString();
      } else if (item.type === 'thesis') {
        table = 'observed_thesis'; // or stated_thesis
        updates.last_computed = new Date().toISOString();
      } else if (item.type === 'funding_round') {
        table = 'funding_rounds';
        updates.verification_status = action === 'publish' ? 'verified' : 'unverified';
      } else {
        return;
      }

      const { error } = await supabase
        .from(table)
        .update(updates)
        .eq('id', itemId);

      if (error) throw error;

      // Refresh
      fetchItems();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setProcessing(null);
    }
  };

  const filteredItems = items.filter(item => {
    if (activeTab === 'all') return true;
    if (activeTab === 'patterns') return item.type === 'pattern';
    if (activeTab === 'thesis') return item.type === 'thesis';
    if (activeTab === 'rounds') return item.type === 'funding_round';
    return true;
  });

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="sticky top-0 z-40 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-text-primary">Ventro</Link>
          <Link href="/admin" className="hidden sm:block px-4 py-2 rounded-lg bg-bg-secondary text-text-secondary hover:bg-bg-tertiary transition-colors text-sm">
            ← Admin Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Review Queue</h1>
          <p className="text-text-secondary">Review and moderate AI-generated patterns, theses, and extracted data</p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-border-default mb-6">
          <nav className="flex gap-1" aria-label="Review sections">
            {[
              { id: 'all', label: `All (${items.length})` },
              { id: 'patterns', label: `Patterns (${items.filter(i => i.type === 'pattern').length})` },
              { id: 'thesis', label: `Theses (${items.filter(i => i.type === 'thesis').length})` },
              { id: 'rounds', label: `Rounds (${items.filter(i => i.type === 'funding_round').length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-12">
            <p className="text-accent-red">{error}</p>
            <Button variant="secondary" onClick={fetchItems}>Retry</Button>
          </div>
        )}

        {!loading && !error && filteredItems.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium mb-2">No items to review</h3>
            <p className="text-text-secondary mb-4">All caught up!</p>
          </div>
        )}

        {!loading && !error && filteredItems.length > 0 && (
          <>
            <div className="space-y-4">
              {filteredItems.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {getTypeBadge(item.type)}
                          {getStatusBadge(item.status)}
                          {getConfidenceBadge(item.confidence)}
                          <span className="text-xs text-text-muted ml-auto">
                            {formatDate(item.created_at)}
                          </span>
                        </div>
                        <h3 className="font-semibold text-lg mb-1 truncate">{item.title}</h3>
                        <p className="text-text-secondary text-sm line-clamp-2">{item.description}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                        {item.type === 'pattern' && (
                          <>
                            {item.status === 'candidate' && (
                              <Button 
                                variant="primary" 
                                size="sm" 
                                onClick={() => handleAction(item.id, 'publish')}
                                loading={processing === item.id}
                              >
                                Publish
                              </Button>
                            )}
                            {item.status === 'candidate' && (
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                onClick={() => handleAction(item.id, 'reject')}
                                loading={processing === item.id}
                              >
                                Reject
                              </Button>
                            )}
                            {item.status !== 'candidate' && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleAction(item.id, 'correct')}
                                loading={processing === item.id}
                              >
                                Mark Corrected
                              </Button>
                            )}
                          </>
                        )}
                        {item.type === 'funding_round' && (
                          <>
                            {item.status !== 'verified' && (
                              <Button 
                                variant="primary" 
                                size="sm" 
                                onClick={() => handleAction(item.id, 'publish')}
                                loading={processing === item.id}
                              >
                                Verify
                              </Button>
                            )}
                            {item.status === 'verified' && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleAction(item.id, 'reject')}
                                loading={processing === item.id}
                              >
                                Unverify
                              </Button>
                            )}
                          </>
                        )}
                        <Link 
                          href={item.type === 'pattern' ? `/patterns/${item.id}` : item.type === 'thesis' ? `/investors/${item.data?.fund_id}` : `/companies/${item.data?.company_id}`}
                          className="px-3 py-1.5 rounded-lg bg-bg-secondary border border-border-default text-sm hover:bg-bg-tertiary transition-colors"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>

                    {/* Details expander */}
                    <details className="mt-4">
                      <summary className="text-sm text-text-muted cursor-pointer">Show raw data</summary>
                      <pre className="mt-2 p-3 bg-bg-tertiary rounded text-xs overflow-x-auto text-text-secondary">
                        {JSON.stringify(item.data, null, 2)}
                      </pre>
                    </details>
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
