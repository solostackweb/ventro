'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { cn, formatCurrency, formatDate } from '@/lib/utils/helpers';
import { Company } from '@/types';

interface YCBatchCompany {
  company_id: string;
  is_ai_company: boolean;
  companies?: Company | null;
}

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
  yc_batch_companies?: YCBatchCompany[];
}

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
    default:
      return <Badge variant="default" dot>{status}</Badge>;
  }
};

export default function YCBatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [batch, setBatch] = useState<YCBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'ai'>('ai');

  useEffect(() => {
    const fetchBatch = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/yc/batches/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            router.push('/yc');
            return;
          }
          throw new Error('Failed to fetch YC batch');
        }
        const data = await response.json();
        setBatch(data.batch);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load YC batch');
      } finally {
        setLoading(false);
      }
    };
    fetchBatch();
  }, [id, router]);

  const aiCompanies = batch?.yc_batch_companies?.filter(c => c.is_ai_company && c.companies) || [];
  const allCompanies = batch?.yc_batch_companies?.filter(c => c.companies) || [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary mb-4">YC batch not found</p>
          <Button variant="secondary" onClick={() => router.push('/yc')}>Back to YC Batches</Button>
        </div>
      </div>
    );
  }

  const companies = activeTab === 'ai' ? aiCompanies : allCompanies;

  return (
    <div className="app-page">
      <header className="sticky top-0 z-40 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-text-primary">Ventro</Link>
          <div className="flex items-center gap-3">
            <Link href="/yc" className="px-4 py-2 rounded-lg bg-bg-secondary text-text-secondary hover:bg-bg-tertiary transition-colors text-sm">
              ← Back to YC Batches
            </Link>
          </div>
        </div>
      </header>

      <main className="app-page-content">
        {/* Header */}
        <div className="app-page-heading">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-accent-blue/10 text-accent-blue">
              {batch.season} {batch.year}
            </span>
            <h1 className="text-3xl font-bold">{batch.batch_name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-text-secondary">
            <Badge variant="amber">{batch.ai_companies_count} AI companies</Badge>
            <Badge variant="blue">{batch.total_companies} total</Badge>
            {batch.demo_day_date && (
              <span className="px-2 py-1 rounded bg-bg-tertiary text-sm">
                📅 Demo Day: {formatDate(batch.demo_day_date)}
              </span>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="app-tabs mb-6">
          <nav className="flex gap-1" aria-label="YC batch sections">
            {[
              { id: 'ai', label: `AI Companies (${aiCompanies.length})` },
              { id: 'all', label: `All Companies (${allCompanies.length})` },
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

        {/* Companies Grid */}
        {companies.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium mb-2">No companies found</h3>
            <p className="text-text-secondary">No {activeTab === 'ai' ? 'AI ' : ''}companies in this batch yet</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map((item, i) => {
              const company = item.companies;
              if (!company) return null;
              return (
                <Link key={i} href={`/companies/${company.id}`} className="block">
                  <Card className="h-full hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex flex-wrap gap-1">
                          {company.ai_tags.slice(0, 2).map((tag, idx) => <span key={idx}>{getTopicBadge(tag)}</span>)}
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
              );
            })}
          </div>
        )}

        {/* Sources */}
        {batch.source_links && batch.source_links.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-semibold mb-4">Sources</h2>
            <ul className="space-y-2">
              {batch.source_links.map((link, i) => (
                <li key={i}>
                  <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-blue hover:underline truncate block">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
