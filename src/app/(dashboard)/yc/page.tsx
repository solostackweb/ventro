'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { cn, formatCurrency, formatDate } from '@/lib/utils/helpers';
import { Company } from '@/types';

interface YCBatch {
  id: string;
  batch_name: string;
  season: 'W' | 'S';
  year: number;
  demo_day_date: string | null;
  total_companies: number;
  ai_companies_count: number;
  source_links: string[];
  created_at: string;
  updated_at: string;
  yc_batch_companies?: {
    company_id: string;
    companies?: Company | null;
  }[];
}

interface YCBatchesResponse {
  batches: YCBatch[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export default function YCBatchesPage() {
  const [batches, setBatches] = useState<YCBatch[]>([]);
  const [totalBatches, setTotalBatches] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      const response = await fetch(`/api/yc/batches?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to fetch YC batches');
      const data: YCBatchesResponse = await response.json();
      setBatches(data.batches);
      setTotalBatches(data.pagination.total);
      setHasMore(data.pagination.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load YC batches');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="sticky top-0 z-40 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-text-primary">Ventro</Link>
          <Link href="/yc" className="hidden sm:block px-4 py-2 rounded-lg bg-accent-blue/10 text-accent-blue text-sm font-medium">
            YC Batches
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Y Combinator Batches</h1>
          <p className="text-text-secondary">Track AI companies across YC batches ({totalBatches} batches)</p>
        </div>

        {/* Results */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-text-secondary">
            Showing {batches.length} of {totalBatches} batches
          </p>
        </div>

        {loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="h-64">
                <CardContent className="p-4">
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
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-accent-red mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-lg font-medium mb-2">Failed to load YC batches</h3>
            <p className="text-text-secondary mb-4">{error}</p>
            <Button variant="secondary" onClick={fetchBatches}>Retry</Button>
          </div>
        )}

        {!loading && !error && batches.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium mb-2">No YC batches found</h3>
            <p className="text-text-secondary mb-4">YC batch data not yet imported</p>
          </div>
        )}

        {!loading && !error && batches.length > 0 && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {batches.map((batch) => (
                <Link key={batch.id} href={`/yc/${batch.id}`} className="block">
                  <Card className="h-full hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-accent-blue/10 text-accent-blue">
                            {batch.season} {batch.year}
                          </span>
                        </div>
                        <Badge variant="amber">{batch.ai_companies_count} AI</Badge>
                      </div>
                      <h3 className="font-semibold text-lg mb-1">{batch.batch_name}</h3>
                      <p className="text-text-secondary text-sm mb-3">
                        {batch.total_companies} total companies
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
                        {batch.demo_day_date && (
                          <span>📅 Demo Day: {formatDate(batch.demo_day_date)}</span>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-border-default flex flex-wrap gap-2 text-xs text-text-muted">
                        <span>🏢 {batch.total_companies} companies</span>
                        <span>🤖 {batch.ai_companies_count} AI</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
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