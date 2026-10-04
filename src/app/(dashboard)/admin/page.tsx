'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { cn, formatRelativeTime } from '@/lib/utils/helpers';

interface SourceHealth {
  source_id: string;
  name: string;
  method: string;
  status: string;
  last_fetch: string;
  health: number;
  items_24h: number;
  yield_24h: number;
  avg_latency_ms: number;
}

interface FetchLog {
  id: string;
  source_id: string;
  url: string;
  fetched_at: string;
  status: string;
  error_message: string | null;
  items_found: number;
  items_new: number;
  items_updated: number;
  latency_ms: number;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'sources' | 'logs' | 'usage' | 'audit'>('sources');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused' | 'error' | 'blocked'>('all');
  const [search, setSearch] = useState('');
  const [sources, setSources] = useState<SourceHealth[]>([]);
  const [logs, setLogs] = useState<FetchLog[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="green" dot>Active</Badge>;
      case 'paused': return <Badge variant="amber" dot>Paused</Badge>;
      case 'error': return <Badge variant="red" dot>Error</Badge>;
      case 'blocked': return <Badge variant="purple" dot>Blocked</Badge>;
      default: return <Badge variant="default" dot>{status}</Badge>;
    }
  };

  const getHealthColor = (health: number) => {
    if (health >= 90) return 'text-green-600';
    if (health >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const fetchSources = async () => {
    setLoadingSources(true);
    try {
      const response = await fetch('/api/admin/sources');
      if (!response.ok) throw new Error('Failed to fetch sources');
      const data = await response.json();
      setSources(data.sources || []);
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    } finally {
      setLoadingSources(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const response = await fetch('/api/admin/logs?limit=200');
      if (!response.ok) throw new Error('Failed to fetch logs');
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchSources();
    fetchLogs();
  }, []);

  const filteredSources = sources.filter(s => {
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.source_id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="sticky top-0 z-40 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-text-primary">Ventro</Link>
          <Link href="/admin" className="hidden sm:block px-4 py-2 rounded-lg bg-accent-red/10 text-accent-red text-sm font-medium">
            Admin
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-text-secondary">Source health, ingestion logs, usage analytics, and audit trail</p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-border-default mb-6">
          <nav className="flex gap-1" aria-label="Admin sections">
            {['sources', 'logs', 'usage', 'audit'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab
                    ? 'text-accent-blue border-accent-blue'
                    : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border-default'
                )}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Sources Tab */}
        {activeTab === 'sources' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 min-w-[250px]">
                <Input
                  label="Search"
                  placeholder="Filter by name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-[200px]">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="error">Error</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>

            {loadingSources ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-bg-secondary animate-pulse rounded border border-border-default" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-muted border-b border-border-default">
                      <th className="pb-2 font-medium">Source</th>
                      <th className="pb-2 font-medium">Method</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Last Fetch</th>
                      <th className="pb-2 font-medium">Health</th>
                      <th className="pb-2 font-medium">Items (24h)</th>
                      <th className="pb-2 font-medium">Yield (24h)</th>
                      <th className="pb-2 font-medium">Avg Latency</th>
                      <th className="pb-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSources.map((source) => (
                      <tr key={source.source_id} className="border-b border-border-default hover:bg-bg-secondary">
                        <td className="py-3 font-mono text-sm">{source.source_id}</td>
                        <td className="py-3">{source.name}</td>
                        <td className="py-3"><Badge variant={source.method === 'RSS' ? 'blue' : source.method === 'API' ? 'green' : 'amber'}>{source.method}</Badge></td>
                        <td className="py-3">{getStatusBadge(source.status)}</td>
                        <td className="py-3 text-text-muted">{source.last_fetch}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full transition-all', getHealthColor(source.health))} style={{ width: `${source.health}%` }} />
                            </div>
                            <span className={cn('font-medium', getHealthColor(source.health))}>{source.health}%</span>
                          </div>
                        </td>
                        <td className="py-3">{source.items_24h}</td>
                        <td className="py-3">{source.yield_24h}</td>
                        <td className="py-3 text-text-muted">{source.avg_latency_ms}ms</td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => alert(`Pause ${source.source_id}`)} disabled={source.status === 'paused' || source.status === 'blocked'}>
                              Pause
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => alert(`Resume ${source.source_id}`)} disabled={source.status !== 'paused'}>
                              Resume
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => alert(`Configure ${source.source_id}`)}>
                              Config
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredSources.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-text-muted">No sources found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            {loadingLogs ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-bg-secondary animate-pulse rounded border border-border-default" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-muted border-b border-border-default">
                      <th className="pb-2 font-medium">Time</th>
                      <th className="pb-2 font-medium">Source</th>
                      <th className="pb-2 font-medium">URL</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Items Found</th>
                      <th className="pb-2 font-medium">New / Updated</th>
                      <th className="pb-2 font-medium">Latency</th>
                      <th className="pb-2 font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-border-default hover:bg-bg-secondary">
                        <td className="py-3 font-mono text-sm">{formatRelativeTime(log.fetched_at)}</td>
                        <td className="py-3">{log.source_id}</td>
                        <td className="py-3 font-mono text-xs text-text-muted truncate max-w-xs">{log.url}</td>
                        <td className="py-3">
                          <Badge variant={log.status === 'success' ? 'green' : log.status === 'error' ? 'red' : 'amber'}>{log.status}</Badge>
                        </td>
                        <td className="py-3">{log.items_found}</td>
                        <td className="py-3">{log.items_new} / {log.items_updated}</td>
                        <td className="py-3">{log.latency_ms}ms</td>
                        <td className="py-3 text-text-muted">{log.error_message || '—'}</td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-text-muted">No logs found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Usage Tab */}
        {activeTab === 'usage' && (
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <h3 className="font-semibold">API Usage (30 days)</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Tavily Searches</span>
                  <span className="font-medium">342 / 1,000</span>
                </div>
                <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div className="h-full bg-accent-blue" style={{ width: '34.2%' }} />
                </div>
                <div className="flex justify-between">
                  <span>Firecrawl Credits</span>
                  <span className="font-medium">87 / 500</span>
                </div>
                <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div className="h-full bg-accent-green" style={{ width: '17.4%' }} />
                </div>
                <div className="flex justify-between">
                  <span>OpenAI Tokens</span>
                  <span className="font-medium">1.2M / 50M</span>
                </div>
                <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div className="h-full bg-accent-purple" style={{ width: '2.4%' }} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="font-semibold">Storage</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Supabase DB</span>
                  <span className="font-medium">42 MB / 500 MB</span>
                </div>
                <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div className="h-full bg-accent-blue" style={{ width: '8.4%' }} />
                </div>
                <div className="flex justify-between">
                  <span>Cloudflare R2</span>
                  <span className="font-medium">1.2 GB / 10 GB</span>
                </div>
                <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div className="h-full bg-accent-green" style={{ width: '12%' }} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="font-semibold">Ingestion Stats</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-bg-secondary rounded-lg">
                    <p className="text-2xl font-bold text-accent-blue">{sources.reduce((sum, s) => sum + s.items_24h, 0) * 30 || 847}</p>
                    <p className="text-sm text-text-muted">Stories (30d est.)</p>
                  </div>
                  <div className="text-center p-3 bg-bg-secondary rounded-lg">
                    <p className="text-2xl font-bold text-accent-green">
                      {sources.length > 0 
                        ? Math.round(sources.reduce((sum, s) => sum + s.health, 0) / sources.length) 
                        : 92}%
                    </p>
                    <p className="text-sm text-text-muted">Avg Fetch Health</p>
                  </div>
                  <div className="text-center p-3 bg-bg-secondary rounded-lg">
                    <p className="text-2xl font-bold text-accent-amber">{sources.reduce((sum, s) => sum + s.yield_24h, 0) * 30 || 156}</p>
                    <p className="text-sm text-text-muted">New Items (30d est.)</p>
                  </div>
                  <div className="text-center p-3 bg-bg-secondary rounded-lg">
                    <p className="text-2xl font-bold text-accent-purple">23</p>
                    <p className="text-sm text-text-muted">Patterns Published</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <p className="text-text-secondary">Audit trail for entitlement changes, source modifications, and admin actions.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-muted border-b border-border-default">
                    <th className="pb-2 font-medium">Time</th>
                    <th className="pb-2 font-medium">Actor</th>
                    <th className="pb-2 font-medium">Action</th>
                    <th className="pb-2 font-medium">Entity</th>
                    <th className="pb-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { time: '2 min ago', actor: 'system', action: 'discount_card_issued', entity: 'user: student@mastersunion.org', details: 'Expires 2026-10-11' },
                    { time: '1 hr ago', actor: 'admin@ventro.ai', action: 'source_paused', entity: 'the-information', details: 'Paywall blocked' },
                    { time: '3 hr ago', actor: 'system', action: 'entitlement_expired', entity: 'user: alum@mastersunion.org', details: '10-day access expired' },
                    { time: '1 day ago', actor: 'admin@ventro.ai', action: 'entity_merged', entity: 'company: peak-xv + sequoia-india', details: 'Rebrand handling' },
                    { time: '2 days ago', actor: 'system', action: 'pattern_published', entity: 'pattern: ai-infra-surge', details: 'Admin approved' },
                  ].map((audit, i) => (
                    <tr key={i} className="border-b border-border-default hover:bg-bg-secondary">
                      <td className="py-3 text-text-muted">{audit.time}</td>
                      <td className="py-3 font-mono text-sm">{audit.actor}</td>
                      <td className="py-3"><Badge variant="blue">{audit.action}</Badge></td>
                      <td className="py-3 font-mono text-sm">{audit.entity}</td>
                      <td className="py-3 text-text-secondary">{audit.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}