'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { cn, formatCurrency, formatDate, truncate } from '@/lib/utils/helpers';
import { Company, VerificationStatus } from '@/types';
import { DiscussionSection } from '@/components/DiscussionSection';

type CompanyTab = 'overview' | 'funding' | 'investors' | 'announcements' | 'signals' | 'timeline';

interface CompanyWithAliases extends Company {
  company_aliases?: {
    id: string;
    alias: string;
    alias_type: string;
    created_at: string;
  }[];
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

const getTopicBadge = (topic: string, key: string) => {
  const colors: Record<string, 'blue' | 'green' | 'amber' | 'red' | 'purple'> = {
    foundation_models: 'purple',
    infrastructure: 'blue',
    applications: 'green',
    robotics: 'amber',
    hardware: 'red',
    research: 'blue',
    other: 'purple',
  };
  return <Badge key={key} variant={colors[topic] || 'purple'}>{topic.replace('_', ' ')}</Badge>;
};

export default function CompanyProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [company, setCompany] = useState<CompanyWithAliases | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<CompanyTab>('overview');
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionField, setCorrectionField] = useState('');
  const [correctionValue, setCorrectionValue] = useState('');
  const [correctionEvidence, setCorrectionEvidence] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [correctionSuccess, setCorrectionSuccess] = useState(false);

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !correctionField || !correctionValue) return;
    
    setSubmittingCorrection(true);
    try {
      const response = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: 'company',
          entity_id: company.id,
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

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    
    const fetchCompany = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/companies/${id}`, { signal: controller.signal });
        if (!response.ok) {
          if (response.status === 404) {
            router.push('/companies');
            return;
          }
          throw new Error('Failed to fetch company');
        }
        const data = await response.json();
        if (!mounted) return;
        setCompany(data.company);
        
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: follow } = await supabase
            .from('follows')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('entity_type', 'company')
            .eq('entity_id', id)
            .single();
          if (mounted) setFollowing(!!follow);
        }
      } catch (err) {
        if (mounted && err instanceof Error && err.name !== 'AbortError') setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    const fetchTimeline = async () => {
      setTimelineLoading(true);
      try {
        const response = await fetch(`/api/companies/${id}/timeline?limit=50`, { signal: controller.signal });
        if (response.ok) {
          const data = await response.json();
          if (mounted) setTimeline(data.timeline || []);
        }
      } catch (err) {
        if (mounted && err instanceof Error && err.name !== 'AbortError') console.error('Failed to fetch timeline:', err.message);
      } finally {
        if (mounted) setTimelineLoading(false);
      }
    };
    
    fetchCompany();
    fetchTimeline();
    
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [id, router]);

  const handleFollow = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push(`/login?redirect=/companies/${id}`);
      return;
    }

    setFollowLoading(true);
    try {
      if (following) {
        await supabase
          .from('follows')
          .delete()
          .eq('user_id', session.user.id)
          .eq('entity_type', 'company')
          .eq('entity_id', id);
        setFollowing(false);
      } else {
        await supabase
          .from('follows')
          .insert({
            user_id: session.user.id,
            entity_type: 'company',
            entity_id: id,
          });
        setFollowing(true);
      }
    } catch (err) {
      console.error('Follow error:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-text-secondary">Company not found</p>
      </div>
    );
  }

  return (
    <div className="app-page">
      <header className="sticky top-0 z-40 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-text-primary">Ventro</Link>
          <div className="flex items-center gap-3">
            <Button 
              variant={following ? 'secondary' : 'primary'} 
              onClick={handleFollow} 
              className="gap-1"
              loading={followLoading}
            >
              {following ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                  Following
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                  Follow
                </>
              )}
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

      <main className="app-page-content">
        <div className="app-page-heading mb-6">
          <Link href="/companies" className="text-sm text-text-muted hover:text-text-primary">
            ← Back to Companies
          </Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">{company.canonical_name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {getVerificationBadge(company.verification_status)}
                  {company.ai_tags.map((tag, index) => getTopicBadge(tag, `${tag}-${index}`))}
                  {company.hq_city && (
                    <Badge variant="blue">🌍 {company.hq_city}{company.hq_country && `, ${company.hq_country.toUpperCase()}`}</Badge>
                  )}
                </div>
              </div>
              {company.canonical_domain && (
                <a href={`https://${company.canonical_domain}`} target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:underline text-sm flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  {company.canonical_domain}
                </a>
              )}
            </div>

            {/* Description */}
            {company.short_description && (
              <p className="text-text-secondary">{company.short_description}</p>
            )}

            {/* Key Metrics */}
            <div className="grid sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-text-muted">Stage</p>
                  <p className="text-xl font-semibold capitalize">{company.stage?.replace('_', ' ') || 'Not disclosed'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-text-muted">Latest Round</p>
                  <p className="text-xl font-semibold">{formatCurrency(company.latest_round_amount_usd)}</p>
                  <p className="text-sm text-text-muted capitalize">{company.latest_round_stage?.replace('_', ' ') || 'Undisclosed'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-text-muted">Lead Investors</p>
                  <p className="text-xl font-semibold">{company.lead_investors?.join(', ') || 'Not disclosed'}</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <div className="border-t border-border-default">
              <nav className="flex gap-1 pb-1" aria-label="Company sections">
                {['Overview', 'Funding', 'Investors', 'Announcements', 'Signals', 'Timeline'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab.toLowerCase() as any)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.toLowerCase()
                        ? 'text-accent-blue border-accent-blue'
                        : 'text-text-secondary hover:text-text-primary border-transparent hover:border-accent-blue'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                {/* Funding Timeline */}
                <section>
                  <h2 className="text-lg font-semibold mb-4">Funding Timeline</h2>
                  <p className="text-sm text-text-muted mb-3">
                    Funding data will appear here once investment records are linked.
                    {" "}
                    <a href={`/investors`} className="text-accent-blue hover:underline">Browse investors</a>
                    to see portfolio companies.
                  </p>
                </section>

                {/* Key Investors */}
                <section>
                  <h2 className="text-lg font-semibold mb-4">Key Investors</h2>
                  <p className="text-sm text-text-muted mb-3">
                    Investor relationships will appear once funding rounds are verified.
                  </p>
                </section>

                {/* Recent Announcements */}
                <section>
                  <h2 className="text-lg font-semibold mb-4">Recent Announcements</h2>
                  <p className="text-sm text-text-muted mb-3">
                    Announcements will appear once story-company associations are verified.
                  </p>
                </section>
              </>
            )}

            {/* Timeline Tab */}
            {activeTab === 'timeline' && (
              <section>
                <h2 className="text-lg font-semibold mb-4">Activity Timeline</h2>
                {timelineLoading && (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
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
                {!timelineLoading && timeline.length === 0 && (
                  <p className="text-text-secondary">No timeline events found. Funding rounds and announcements will appear here once verified.</p>
                )}
                {!timelineLoading && timeline.length > 0 && (
                  <div className="space-y-4">
                    {timeline.map((event, i) => (
                      <Card key={i} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <span className="text-sm text-text-muted font-mono shrink-0">{new Date(event.date).toLocaleDateString()}</span>
                              <div>
                                <h4 className="font-medium">{event.title}</h4>
                                <p className="text-sm text-text-muted">{event.type === 'funding_round' ? 'Funding Round' : 'News Mention'}</p>
                              </div>
                            </div>
                            {event.type === 'funding_round' && event.details.amount_usd && (
                              <span className="px-2 py-1 rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-sm font-mono">
                                {formatCurrency(event.details.amount_usd)}
                              </span>
                            )}
                          </div>
                          {event.type === 'funding_round' && (
                            <div className="mt-3 grid sm:grid-cols-3 gap-4 text-sm text-text-secondary">
                              <div>
                                <p className="text-text-muted">Stage</p>
                                <p className="capitalize">{event.details.stage?.replace('_', ' ')}</p>
                              </div>
                              <div>
                                <p className="text-text-muted">Lead</p>
                                <p>{event.details.fund_name}</p>
                              </div>
                              <div>
                                <p className="text-text-muted">Role</p>
                                <p className="capitalize">{event.details.participant_role}</p>
                              </div>
                            </div>
                          )}
                          {event.type === 'news_mention' && event.details.summary && (
                            <p className="mt-3 text-sm text-text-secondary line-clamp-2">{event.details.summary}</p>
                          )}
                          {event.details.sources && event.details.sources.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border-default">
                              <p className="text-xs text-text-muted mb-2">Sources:</p>
                              <div className="flex flex-wrap gap-2">
                                {event.details.sources.slice(0, 3).map((url: string, j: number) => (
                                  <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-blue hover:underline truncate max-w-[200px] block">
                                    {url}
                                  </a>
                                ))}
                                {event.details.sources.length > 3 && (
                                  <span className="text-xs text-text-muted">+{event.details.sources.length - 3} more</span>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Aliases */}
            {company.company_aliases && company.company_aliases.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Known Aliases</h3>
                  <ul className="space-y-2">
                    {company.company_aliases.map((alias) => (
                      <li key={alias.id} className="flex items-center gap-2 text-sm">
                        <span className="font-mono">{alias.alias}</span>
                        <Badge variant="default" className="text-xs capitalize">{alias.alias_type.replace('_', ' ')}</Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Source Links */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Sources</h3>
                <ul className="space-y-2">
                  {company.source_links.map((link, i) => (
                    <li key={i}>
                      <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-blue hover:underline truncate block">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-text-muted mt-3">Last verified: {formatDate(company.last_verified_at)}</p>
              </CardContent>
            </Card>

            {/* Related Companies */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Related Companies</h3>
                <p className="text-sm text-text-muted mb-3">
                  Related companies will appear once topic/geography overlap is computed.
                </p>
              </CardContent>
            </Card>

            {/* Report Correction */}
            <Card>
              <CardContent className="p-4">
                <Button variant="ghost" className="w-full justify-start text-text-muted hover:text-accent-red">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  Report a correction
                </Button>
                <p className="text-xs text-text-muted mt-2">Help us keep data accurate. Corrections are reviewed by our team.</p>
              </CardContent>
            </Card>

            {/* Discussion */}
            <DiscussionSection entityType="company" entityId={company.id} />
          </div>
        </div>
      </main>

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
                      <option value="canonical_name">Company Name</option>
                      <option value="canonical_domain">Website</option>
                      <option value="short_description">Description</option>
                      <option value="ai_tags">AI Topics</option>
                      <option value="hq_city">HQ City</option>
                      <option value="hq_country">HQ Country</option>
                      <option value="stage">Stage</option>
                      <option value="verification_status">Verification Status</option>
                      <option value="source_links">Source Links</option>
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
    </div>
  );
}
