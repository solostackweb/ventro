'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { MultiSelect } from '@/components/ui/Select';
import { cn, formatDate, formatNumber } from '@/lib/utils/helpers';
import { Pattern } from '@/types';

interface PatternsResponse {
  patterns: Pattern[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const CONFIDENCE_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const STATUS_OPTIONS = [
  { value: 'candidate', label: 'Candidate' },
  { value: 'published', label: 'Published' },
  { value: 'corrected', label: 'Corrected' },
  { value: 'retired', label: 'Retired' },
  { value: 'rejected', label: 'Rejected' },
];

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

const getChangeBadge = (change: number | null) => {
  if (change === null) return <Badge variant="default">N/A</Badge>;
  if (change > 0) return <Badge variant="green">+{change.toFixed(1)}%</Badge>;
  if (change < 0) return <Badge variant="red">{change.toFixed(1)}%</Badge>;
  return <Badge variant="default">0%</Badge>;
};

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [totalPatterns, setTotalPatterns] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<string[]>([]);
  const [timeWindowStart, setTimeWindowStart] = useState('');
  const [timeWindowEnd, setTimeWindowEnd] = useState('');

  const fetchPatterns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(status.length > 0 && { status: status.join(',') }),
        ...(confidence.length > 0 && { min_confidence: confidence.join(',') }),
        ...(timeWindowStart && { time_window_start: timeWindowStart }),
        ...(timeWindowEnd && { time_window_end: timeWindowEnd }),
      });
      const response = await fetch(`/api/patterns?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to fetch patterns');
      const data: PatternsResponse = await response.json();
      setPatterns(data.patterns);
      setTotalPatterns(data.pagination.total);
      setHasMore(data.pagination.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patterns');
    } finally {
      setLoading(false);
    }
  }, [page, status, confidence, timeWindowStart, timeWindowEnd]);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  const applyFilters = useCallback(() => {
    setPage(1);
    fetchPatterns();
  }, [fetchPatterns]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const clearFilters = () => {
    setStatus([]);
    setConfidence([]);
    setTimeWindowStart('');
    setTimeWindowEnd('');
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="sticky top-0 z-40 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-text-primary">Ventro</Link>
          <Link href="/patterns" className="hidden sm:block px-4 py-2 rounded-lg bg-accent-blue/10 text-accent-blue text-sm font-medium">
            Patterns
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Market Patterns</h1>
          <p className="text-text-secondary">Discover emerging trends across AI funding, companies, and investor behavior ({totalPatterns} patterns)</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="w-full sm:w-[200px]">
                <MultiSelect
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={status}
                  onChange={setStatus}
                  placeholder="All statuses"
                  maxSelections={5}
                />
              </div>
              <div className="w-full sm:w-[200px]">
                <MultiSelect
                  label="Confidence"
                  options={CONFIDENCE_OPTIONS}
                  value={confidence}
                  onChange={setConfidence}
                  placeholder="All confidence levels"
                  maxSelections={3}
                />
              </div>
              <div className="w-full sm:w-[180px]">
                <Input
                  label="Time Window Start"
                  type="date"
                  value={timeWindowStart}
                  onChange={(e) => setTimeWindowStart(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-[180px]">
                <Input
                  label="Time Window End"
                  type="date"
                  value={timeWindowEnd}
                  onChange={(e) => setTimeWindowEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={clearFilters}>Clear all</Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Row */}
        <div className="grid sm:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-text-muted">Total Patterns</p>
              <p className="text-2xl font-bold">{totalPatterns}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-text-muted">Published</p>
              <p className="text-2xl font-bold text-green-600">
                {patterns.filter(p => p.status === 'published').length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-text-muted">High Confidence</p>
              <p className="text-2xl font-bold text-blue-600">
                {patterns.filter(p => p.confidence === 'high').length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-text-muted">Candidates</p>
              <p className="text-2xl font-bold text-amber-600">
                {patterns.filter(p => p.status === 'candidate').length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-text-secondary">
            Showing {patterns.length} of {totalPatterns} patterns
          </p>
        </div>

        {loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="h-64 animate-pulse">
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
            <h3 className="text-lg font-medium mb-2">Failed to load patterns</h3>
            <p className="text-text-secondary mb-4">{error}</p>
            <Button variant="secondary" onClick={fetchPatterns}>Retry</Button>
          </div>
        )}

        {!loading && !error && patterns.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium mb-2">No patterns found</h3>
            <p className="text-text-secondary mb-4">Try adjusting your filters</p>
            <Button variant="secondary" onClick={clearFilters}>Clear all filters</Button>
          </div>
        )}

        {!loading && !error && patterns.length > 0 && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {patterns.map((pattern) => (
                <Link key={pattern.id} href={`/patterns/${pattern.id}`} className="block">
                  <Card className="h-full hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex flex-wrap gap-1">
                          {getConfidenceBadge(pattern.confidence)}
                          {getStatusBadge(pattern.status)}
                        </div>
                        {getChangeBadge(pattern.change_percentage)}
                      </div>
                      <h3 className="font-semibold text-lg mb-2 group-hover:text-accent-blue transition-colors">
                        {pattern.name}
                      </h3>
                      <p className="text-text-secondary text-sm mb-3 line-clamp-2">
                        {pattern.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted mb-3">
                        <span>📅 {formatDate(pattern.time_window_start)} – {formatDate(pattern.time_window_end)}</span>
                        <span className="px-2 py-0.5 rounded bg-bg-tertiary">
                          🏢 {pattern.distinct_companies} companies
                        </span>
                        <span className="px-2 py-0.5 rounded bg-bg-tertiary">
                          💰 {pattern.distinct_funds} funds
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="blue">{pattern.qualifying_events?.length || 0} events</Badge>
                        <Badge variant="amber">{pattern.counterexamples?.length || 0} counterexamples</Badge>
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