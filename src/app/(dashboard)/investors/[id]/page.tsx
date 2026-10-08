'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { cn, formatCurrency, formatDate } from '@/lib/utils/helpers';
import { Fund, VerificationStatus } from '@/types';
import { DiscussionSection } from '@/components/DiscussionSection';

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

export default function InvestorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [fund, setFund] = useState<Fund | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'stated' | 'observed' | 'portfolio' | 'activity' | 'timeline'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionField, setCorrectionField] = useState('');
  const [correctionValue, setCorrectionValue] = useState('');
  const [correctionEvidence, setCorrectionEvidence] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [correctionSuccess, setCorrectionSuccess] = useState(false);

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fund || !correctionField || !correctionValue) return;
    
    setSubmittingCorrection(true);
    try {
      const response = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: 'fund',
          entity_id: fund.id,
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
    const fetchFund = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/funds/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            router.push('/investors');
            return;
          }
          throw new Error('Failed to fetch fund');
        }
        const data = await response.json();
        setFund(data.fund);
        
        // Check if following
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: follow } = await supabase
            .from('follows')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('entity_type', 'fund')
            .eq('entity_id', id)
            .single();
          setFollowing(!!follow);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load fund');
      } finally {
        setLoading(false);
      }
    };
    fetchFund();
    
    // Fetch timeline
    const fetchTimeline = async () => {
      setTimelineLoading(true);
      try {
        const response = await fetch(`/api/investors/${id}/timeline?limit=50`);
        if (response.ok) {
          const data = await response.json();
          setTimeline(data.timeline || []);
        }
      } catch (err) {
        console.error('Failed to fetch timeline:', err);
      } finally {
        setTimelineLoading(false);
      }
    };
    fetchTimeline();
  }, [id, router]);

  const handleFollow = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push(`/login?redirect=/investors/${id}`);
      return;
    }

    setFollowLoading(true);
    try {
      if (following) {
        await supabase
          .from('follows')
          .delete()
          .eq('user_id', session.user.id)
          .eq('entity_type', 'fund')
          .eq('entity_id', id);
        setFollowing(false);
      } else {
        await supabase
          .from('follows')
          .insert({
            user_id: session.user.id,
            entity_type: 'fund',
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

  if (error || !fund) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-text-secondary">Investor not found</p>
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
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Following
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
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
          <Link href="/investors" className="text-sm text-text-muted hover:text-text-primary">
            ← Back to Investors
          </Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">{fund.canonical_name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {getVerificationBadge(fund.verification_status)}
                  {fund.ai_focus_areas?.map((tag) => getTopicBadge(tag))}
                  {fund.hq_city && (
                    <Badge variant="blue">🌍 {fund.hq_city}{fund.hq_country && `, ${fund.hq_country.toUpperCase()}`}</Badge>
                  )}
                  <Badge variant="amber">{fund.firm_type.replace('_', ' ')}</Badge>
                </div>
              </div>
              {fund.canonical_domain && (
                <a href={`https://${fund.canonical_domain}`} target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:underline text-sm flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  {fund.canonical_domain}
                </a>
              )}
            </div>

            {/* Tabs */}
            <div className="app-tabs">
              <nav className="flex gap-1 pb-1" aria-label="Investor sections">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'stated', label: 'Stated Thesis' },
                  { id: 'observed', label: 'Observed Thesis' },
                  { id: 'portfolio', label: 'Portfolio' },
                  { id: 'activity', label: 'Activity' },
                  { id: 'timeline', label: 'Timeline' },
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

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid sm:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-text-muted">Fund Vehicles</p>
                      <p className="text-xl font-semibold">{fund.fund_vehicles?.length || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-text-muted">Portfolio Companies</p>
                      <p className="text-xl font-semibold">{fund.fund_portfolio?.length || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-text-muted">AI Focus Areas</p>
                      <p className="text-xl font-semibold">{fund.ai_focus_areas?.length || 0}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Typical Stages/Geos */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">Typical Stages</h3>
                      <div className="flex flex-wrap gap-2">
                        {fund.typical_stages?.map((s) => (
                          <Badge key={s} variant="blue">{s.replace('_', ' ')}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">Typical Geographies</h3>
                      <div className="flex flex-wrap gap-2">
                        {fund.typical_geographies?.map((g) => (
                          <Badge key={g} variant="amber">{g.toUpperCase()}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'stated' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Stated Thesis</h2>
                  <Badge variant="verified">Official Source</Badge>
                </div>
                <p className="text-text-secondary text-sm">
                  Excerpts from the fund&apos;s own blog posts, interviews, podcasts, and public statements. 
                  Each claim links to the original source.
                </p>
                <div className="space-y-4">
                  {fund.stated_thesis?.map((excerpt, i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <p className="text-text-primary mb-3">&ldquo;{excerpt.text}&rdquo;</p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
                          <span>Source: <a href={excerpt.source_url} target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:underline">{excerpt.source_type}</a></span>
                          <span>Date: {formatDate(excerpt.date_stated)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(!fund.stated_thesis || fund.stated_thesis.length === 0) && (
                    <p className="text-text-secondary">No stated thesis excerpts recorded yet.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'observed' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Observed Thesis (Inferred)</h2>
                  <Badge variant="amber">Inferred</Badge>
                </div>
                {fund.observed_thesis ? (
                  <>
                    <p className="text-text-secondary text-sm">
                      Based on portfolio clustering analysis. Not the fund&apos;s official position. 
                      Methodology: {fund.observed_thesis.methodology}. 
                      Period: {formatDate(fund.observed_thesis.period_start)} – {formatDate(fund.observed_thesis.period_end)}. 
                      Sample: {fund.observed_thesis.sample_size} deals. 
                      Confidence: {fund.observed_thesis.confidence}. 
                      Last computed: {formatDate(fund.observed_thesis.last_computed)}.
                    </p>
                    {fund.observed_thesis.caveats && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                        <strong>Caveats:</strong> {fund.observed_thesis.caveats}
                      </div>
                    )}
                    <div className="space-y-3">
                      {fund.observed_thesis.themes?.map((theme, i) => (
                        <Card key={i}>
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div>
                                <h3 className="font-semibold">{theme.theme}</h3>
                                <p className="text-sm text-text-muted">{theme.company_count} companies · {theme.deal_count} deals</p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-accent-blue">{theme.percentage}%</p>
                                <p className="text-sm text-text-muted">of AI deals</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-text-secondary">No observed thesis computed yet. Requires sufficient portfolio data.</p>
                )}
              </div>
            )}

            {activeTab === 'portfolio' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Portfolio Companies ({fund.fund_portfolio?.length || 0})</h2>
                <div className="flex flex-wrap gap-2">
                  {fund.fund_portfolio?.map((item, i) => (
                    <Link key={i} href={`/companies/${item.company_id}`} className="px-3 py-1.5 rounded-lg bg-bg-secondary border border-border-default text-sm hover:bg-bg-tertiary transition-colors">
                      {item.companies?.canonical_name || item.company_id}
                    </Link>
                  ))}
                </div>
                {(!fund.fund_portfolio || fund.fund_portfolio.length === 0) && (
                  <p className="text-text-secondary">No portfolio companies recorded yet.</p>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Recent Investments</h2>
                <div className="space-y-3">
                  {fund.investments?.map((inv, i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <Link href={`/companies/${inv.company_id}`} className="font-semibold hover:text-accent-blue">{inv.company_name}</Link>
                            <p className="text-sm text-text-muted">{formatDate(inv.announced_date)} · {getRoleBadge(inv.investor_role || 'undisclosed')}</p>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-text-secondary">
                            <Badge variant="blue">{inv.round_stage?.replace('_', ' ')}</Badge>
                            <Badge variant="green">{formatCurrency(inv.amount_usd)}</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
{(!fund.investments || fund.investments.length === 0) && (
                    <p className="text-text-secondary">No recent investments recorded yet.</p>
                  )}
                </div>
              </div>
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
                  <p className="text-text-secondary">No timeline events found. Investments and announcements will appear here once verified.</p>
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
                                <p className="text-text-muted">Company</p>
                                <p>{event.details.company_name}</p>
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
            {/* Fit for You */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Fit for You</h3>
                <div className="space-y-2 text-sm text-text-secondary">
                  <p>🎯 {fund.ai_focus_areas?.filter(t => ['foundation_models', 'infrastructure', 'applications'].includes(t)).length || 0} matching topics</p>
                  <p>📍 {fund.hq_city || 'Location'} focus</p>
                </div>
                <Button variant="ghost" size="sm" className="w-full justify-start mt-2 text-text-muted">
                  Why this fit?
                </Button>
              </CardContent>
            </Card>

            {/* Fund Vehicles */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Fund Vehicles</h3>
                <ul className="space-y-2">
                  {fund.fund_vehicles?.map((v) => (
                    <li key={v.id} className="text-sm">
                      <span className="font-medium">{v.name}</span>
                      {v.vintage_year && <span className="text-text-muted ml-2">({v.vintage_year})</span>}
                      {v.size_usd && <span className="text-text-muted ml-2">{formatCurrency(v.size_usd)}</span>}
                      {v.focus && <span className="text-text-muted ml-2">— {v.focus}</span>}
                    </li>
                  ))}
                </ul>
                {(!fund.fund_vehicles || fund.fund_vehicles.length === 0) && (
                  <p className="text-text-secondary text-sm">No fund vehicles recorded.</p>
                )}
              </CardContent>
            </Card>

            {/* Source Links */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Sources</h3>
                <ul className="space-y-2">
                  {fund.source_links?.map((link, i) => (
                    <li key={i}>
                      <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-blue hover:underline truncate block">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-text-muted mt-3">Last verified: {formatDate(fund.last_verified_at)}</p>
              </CardContent>
            </Card>

            {/* Report Correction */}
            <Card>
              <CardContent className="p-4">
                <Button variant="ghost" className="w-full justify-start text-text-muted hover:text-accent-red">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  Report a correction
                </Button>
                <p className="text-xs text-text-muted mt-2">Corrections are reviewed by our team.</p>
              </CardContent>
            </Card>

            {/* Discussion */}
            <DiscussionSection entityType="fund" entityId={fund.id} />
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
                      <option value="canonical_name">Fund Name</option>
                      <option value="canonical_domain">Website</option>
                      <option value="firm_type">Firm Type</option>
                      <option value="ai_focus_areas">AI Focus Areas</option>
                      <option value="hq_city">HQ City</option>
                      <option value="hq_country">HQ Country</option>
                      <option value="typical_stages">Typical Stages</option>
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
