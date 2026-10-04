'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { MultiSelect } from '@/components/ui/Select';
import { cn, formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils/helpers';
import { Investment, VerificationStatus, Stage, Geography, AITheme } from '@/types';

interface InvestmentGraphResponse {
  investments: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const STAGE_OPTIONS: { value: Stage; label: string }[] = [
  { value: 'pre_seed', label: 'Pre-seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series_a', label: 'Series A' },
  { value: 'series_b', label: 'Series B' },
  { value: 'series_c', label: 'Series C' },
  { value: 'growth', label: 'Growth' },
  { value: 'public', label: 'Public' },
];

const GEOGRAPHY_OPTIONS: { value: Geography; label: string }[] = [
  { value: 'us', label: 'United States' },
  { value: 'india', label: 'India' },
  { value: 'eu', label: 'European Union' },
  { value: 'israel', label: 'Israel' },
  { value: 'canada', label: 'Canada' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'sea', label: 'Southeast Asia' },
  { value: 'global', label: 'Global' },
];

const TOPIC_OPTIONS: { value: AITheme; label: string }[] = [
  { value: 'foundation_models', label: 'Foundation Models' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'applications', label: 'Applications' },
  { value: 'robotics', label: 'Robotics' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'research', label: 'Research' },
];

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Date (newest)' },
  { value: 'date_asc', label: 'Date (oldest)' },
  { value: 'amount_desc', label: 'Amount (highest)' },
  { value: 'amount_asc', label: 'Amount (lowest)' },
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

const getRoleBadge = (role: string) => {
  switch (role) {
    case 'lead':
      return <Badge variant="green">Lead</Badge>;
    case 'participant':
      return <Badge variant="blue">Participant</Badge>;
    default:
      return <Badge variant="amber">Undisclosed</Badge>;
  }
};

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [totalInvestments, setTotalInvestments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [geographies, setGeographies] = useState<Geography[]>([]);
  const [topics, setTopics] = useState<AITheme[]>([]);
  const [ycBatches, setYcBatches] = useState<string[]>([]);
  const [investorId, setInvestorId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState('date_desc');

  const fetchInvestments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(stages.length > 0 && { stages: stages.join(',') }),
        ...(geographies.length > 0 && { geographies: geographies.join(',') }),
        ...(topics.length > 0 && { topics: topics.join(',') }),
        ...(ycBatches.length > 0 && { yc_batches: ycBatches.join(',') }),
        ...(investorId && { investor_id: investorId }),
        ...(companyId && { company_id: companyId }),
        ...(verifiedOnly && { verified_only: 'true' }),
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
        ...(sort && { sort }),
      });
      const response = await fetch(`/api/investment-graph?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to fetch investment graph');
      const data: InvestmentGraphResponse = await response.json();
      setInvestments(data.investments);
      setTotalInvestments(data.pagination.total);
      setHasMore(data.pagination.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load investments');
    } finally {
      setLoading(false);
    }
  }, [page, stages, geographies, topics, ycBatches, investorId, companyId, verifiedOnly, dateFrom, dateTo, sort]);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  const applyFilters = useCallback(() => {
    setPage(1);
    fetchInvestments();
  }, [fetchInvestments]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const clearFilters = () => {
    setStages([]);
    setGeographies([]);
    setTopics([]);
    setYcBatches([]);
    setInvestorId('');
    setCompanyId('');
    setVerifiedOnly(false);
    setDateFrom('');
    setDateTo('');
    setSort('date_desc');
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="sticky top-0 z-40 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-text-primary">Ventro</Link>
          <Link href="/investments" className="hidden sm:block px-4 py-2 rounded-lg bg-accent-blue/10 text-accent-blue text-sm font-medium">
            Investment Tracker
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Investment Tracker</h1>
          <p className="text-text-secondary">Track {totalInvestments || 'AI'} funding rounds with verified data</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-1 min-w-[250px]">
                <Input
                  label="Investor (Fund ID)"
                  placeholder="Fund UUID..."
                  value={investorId}
                  onChange={(e) => setInvestorId(e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[250px]">
                <Input
                  label="Company (Company ID)"
                  placeholder="Company UUID..."
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-[180px]">
                <MultiSelect
                  label="Stage"
                  options={STAGE_OPTIONS}
                  value={stages}
                  onChange={setStages}
                  placeholder="All stages"
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
                  label="AI Topics"
                  options={TOPIC_OPTIONS}
                  value={topics}
                  onChange={setTopics}
                  placeholder="All topics"
                  maxSelections={7}
                />
              </div>
              <div className="w-full sm:w-[180px]">
                <select
                  value={sort}
                  onChange={(e) => { setSort(e.target.value); applyFilters(); }}
                  className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-[180px]">
                <Input
                  label="Date From"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-[180px]">
                <Input
                  label="Date To"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-[180px]">
                <Input
                  label="YC Batch"
                  placeholder="e.g., W24, S24..."
                  value={ycBatches.join(', ')}
                  onChange={(e) => setYcBatches(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
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
            <div className="mt-4 flex justify-between">
              <Button variant="ghost" size="sm" onClick={clearFilters}>Clear all</Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Row */}
        <div className="grid sm:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-text-muted">Total Rounds</p>
              <p className="text-2xl font-bold">{totalInvestments}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-text-muted">Verified</p>
              <p className="text-2xl font-bold text-green-600">
                {investments.filter(i => i.verification_status === 'verified').length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-text-muted">Total Disclosed Capital</p>
              <p className="text-2xl font-bold">
                {formatCurrency(investments.reduce((sum, i) => sum + (i.amount_usd || 0), 0))}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-text-muted">Unique Companies</p>
              <p className="text-2xl font-bold">
                {new Set(investments.map(i => i.company_id)).size}
              </p>
            </CardContent>
          </Card>
        </div>
        {/* Disclosure */}
        <p className="text-xs text-text-muted mb-4">
          Only disclosed amounts are summed. Undisclosed rounds are excluded from totals, not counted as zero.
        </p>

        {/* Results */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-text-secondary">
            Showing {investments.length} of {totalInvestments} rounds
          </p>
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-48 animate-pulse">
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
            <h3 className="text-lg font-medium mb-2">Failed to load investments</h3>
            <p className="text-text-secondary mb-4">{error}</p>
            <Button variant="secondary" onClick={fetchInvestments}>Retry</Button>
          </div>
        )}

        {!loading && !error && investments.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-lg font-medium mb-2">No rounds found</h3>
            <p className="text-text-secondary mb-4">Try adjusting your filters</p>
            <Button variant="secondary" onClick={clearFilters}>Clear all filters</Button>
          </div>
        )}

        {!loading && !error && investments.length > 0 && (
          <>
            <div className="space-y-4">
              {investments.map((inv) => (
                <article key={inv.id} className="group">
                  <Card className="overflow-hidden transition-shadow hover:shadow-md">
                    <CardContent className="p-4 sm:p-5">
                      {/* Header row */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {inv.companies?.ai_tags?.slice(0, 2).map((topic) => (
                          <Badge key={topic} variant="blue" className="text-xs">{topic.replace('_', ' ')}</Badge>
                        ))}
                        {getVerificationBadge(inv.verification_status)}
                        <Badge variant="amber">{inv.round_stage?.replace('_', ' ')}</Badge>
                        {inv.amount_usd ? (
                          <Badge variant="green">{formatCurrency(inv.amount_usd)}</Badge>
                        ) : (
                          <Badge variant="default">Undisclosed</Badge>
                        )}
                        <span className="text-xs text-text-muted ml-auto">
                          {formatRelativeTime(inv.announced_date)}
                        </span>
                      </div>

                      {/* Company + Investor */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <Link href={`/companies/${inv.company_id}`} className="font-semibold text-lg group-hover:text-accent-blue transition-colors">
                            {inv.companies?.canonical_name || inv.company_name}
                          </Link>
                          <span className="px-2 py-1 rounded bg-bg-tertiary text-sm text-text-muted">
                            {getRoleBadge(inv.investor_role)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/investors/${inv.fund_id}`} className="px-3 py-1.5 rounded-lg bg-accent-blue/10 text-accent-blue text-sm hover:bg-accent-blue/20 transition-colors">
                            {inv.funds?.canonical_name || 'Unknown Fund'}
                          </Link>
                          {inv.fund_vehicles && (
                            <span className="px-2 py-1 rounded bg-bg-tertiary text-xs text-text-muted">
                              {inv.fund_vehicles.name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Source URLs */}
                      {inv.source_urls && inv.source_urls.length > 0 && (
                        <div className="pt-3 border-t border-border-default">
                          <p className="text-xs text-text-muted mb-2">Sources:</p>
                          <div className="flex flex-wrap gap-2">
                            {inv.source_urls.slice(0, 3).map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-blue hover:underline truncate max-w-[200px] block">
                                {url}
                              </a>
                            ))}
                            {inv.source_urls.length > 3 && (
                              <span className="text-xs text-text-muted">+{inv.source_urls.length - 3} more</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Conflicts */}
                      {inv.conflicts && inv.conflicts.length > 0 && (
                        <div className="pt-3 border-t border-border-default">
                          <p className="text-xs text-accent-red mb-2">⚠ Conflicts detected:</p>
                          <ul className="text-xs text-text-muted space-y-1">
                            {inv.conflicts.map((c, i) => (
                              <li key={i}>{c.field}: {c.values.join(' vs ')}</li>
                            ))}
                          </ul>
                        </div>
                      )}
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