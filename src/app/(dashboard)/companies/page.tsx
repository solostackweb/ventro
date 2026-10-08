'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { MultiSelect } from '@/components/ui/Select';
import { cn, formatCurrency } from '@/lib/utils/helpers';
import { Company, AITheme, Geography, Stage } from '@/types';

interface CompaniesResponse {
  companies: Company[];
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

const STAGE_OPTIONS = [
  { value: 'pre_seed', label: 'Pre-seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series_a', label: 'Series A' },
  { value: 'series_b', label: 'Series B' },
  { value: 'series_c', label: 'Series C' },
  { value: 'growth', label: 'Growth' },
  { value: 'public', label: 'Public' },
];

const getVerificationBadge = (status: string) => {
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

const getTopicBadge = (topic: string, key: string) => {
  const colors: Record<string, 'blue' | 'green' | 'amber' | 'red' | 'purple'> = {
    foundation_models: 'purple',
    infrastructure: 'blue',
    applications: 'green',
    robotics: 'amber',
    hardware: 'red',
    research: 'blue',
  };
  return <Badge key={key} variant={colors[topic] || 'purple'}>{topic.replace('_', ' ')}</Badge>;
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [search, setSearch] = useState('');
  const [topics, setTopics] = useState<AITheme[]>([]);
  const [geographies, setGeographies] = useState<Geography[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { q: search }),
        ...(topics.length > 0 && { topics: topics.join(',') }),
        ...(geographies.length > 0 && { geographies: geographies.join(',') }),
        ...(stages.length > 0 && { stages: stages.join(',') }),
        ...(verifiedOnly && { verified_only: 'true' }),
      });
      const response = await fetch(`/api/companies?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to fetch companies');
      const data: CompaniesResponse = await response.json();
      setCompanies(data.companies);
      setTotalCompanies(data.pagination.total);
      setHasMore(data.pagination.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, [page, search, topics, geographies, stages, verifiedOnly]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const applyFilters = useCallback(() => {
    setPage(1);
    fetchCompanies();
  }, [fetchCompanies]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const clearFilters = () => {
    setSearch('');
    setTopics([]);
    setGeographies([]);
    setStages([]);
    setVerifiedOnly(false);
    setPage(1);
  };

  return (
    <div className="app-page">
      <header className="app-route-label sticky top-0 z-40 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-text-primary">Ventro</Link>
          <Link href="/companies" className="hidden sm:block px-4 py-2 rounded-lg bg-accent-blue/10 text-accent-blue text-sm font-medium">
            Companies
          </Link>
        </div>
      </header>

      <main className="app-page-content">
        <div className="app-page-heading">
          <h1 className="text-3xl font-bold mb-2">Companies</h1>
          <p className="text-text-secondary">Browse {totalCompanies || 'AI'} companies in our catalog</p>
        </div>

        {/* Filters */}
        <Card className="app-filter-panel mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 min-w-[250px]">
                <Input
                  label="Search"
                  placeholder="Company name, topic, location..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                />
              </div>
              <div className="w-full sm:w-[200px]">
                <MultiSelect
                  label="AI Topics"
                  options={TOPIC_OPTIONS}
                  value={topics}
                  onChange={setTopics}
                  placeholder="All topics"
                  maxSelections={7}
                />
              </div>
              <div className="w-full sm:w-[200px]">
                <MultiSelect
                  label="Geography"
                  options={GEOGRAPHY_OPTIONS}
                  value={geographies}
                  onChange={setGeographies}
                  placeholder="All regions"
                  maxSelections={8}
                />
              </div>
              <div className="w-full sm:w-[200px]">
                <MultiSelect
                  label="Stage"
                  options={STAGE_OPTIONS}
                  value={stages}
                  onChange={setStages}
                  placeholder="All stages"
                  maxSelections={7}
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
            Showing {companies.length} of {totalCompanies} companies
          </p>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
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
            <h3 className="text-lg font-medium mb-2">Failed to load companies</h3>
            <p className="text-text-secondary mb-4">{error}</p>
            <Button variant="secondary" onClick={fetchCompanies}>Retry</Button>
          </div>
        )}

        {!loading && !error && companies.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium mb-2">No companies found</h3>
            <p className="text-text-secondary mb-4">Try adjusting your filters or search terms</p>
            <Button variant="secondary" onClick={clearFilters}>
              Clear all filters
            </Button>
          </div>
        )}

        {!loading && !error && companies.length > 0 && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {companies.map((company) => (
                <Link key={company.id} href={`/companies/${company.id}`} className="block">
                  <Card className="h-full hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex flex-wrap gap-1">
                          {company.ai_tags.slice(0, 2).map((tag, index) => getTopicBadge(tag, `${company.id}-${tag}-${index}`))}
                        </div>
                        {getVerificationBadge(company.verification_status)}
                      </div>
                      <h3 className="font-semibold text-lg mb-2 group-hover:text-accent-blue transition-colors">
                        {company.canonical_name}
                      </h3>
                      <p className="text-text-secondary text-sm mb-3 line-clamp-2">
                        {company.short_description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
                        {company.hq_city && <span>🌍 {company.hq_city}</span>}
                        {company.stage && <span className="px-2 py-0.5 rounded bg-bg-tertiary capitalize">{company.stage.replace('_', ' ')}</span>}
                        {company.latest_round_amount_usd && (
                          <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                            {formatCurrency(company.latest_round_amount_usd)}
                          </span>
                        )}
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
