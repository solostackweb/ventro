'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { MultiSelect } from '@/components/ui/Select';
import { cn, formatRelativeTime, formatDate } from '@/lib/utils/helpers';

interface AlertRule {
  id: string;
  entity_type: 'fund' | 'company';
  entity_id: string;
  trigger: 'new_funding_round' | 'new_portfolio_company' | 'thesis_update' | 'pattern_published' | 'any_announcement';
  frequency: 'instant' | 'daily' | 'weekly';
  channels: ('email' | 'in_app')[];
  topic_filter: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Notification {
  id: string;
  alert_rule_id: string | null;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  channels: ('email' | 'in_app')[];
  status: 'pending' | 'sent' | 'failed' | 'read' | 'archived';
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

interface AlertsData {
  alertRules: AlertRule[];
  notifications: Notification[];
  unreadCount: number;
}

const TRIGGER_OPTIONS = [
  { value: 'new_funding_round', label: 'New Funding Round' },
  { value: 'new_portfolio_company', label: 'New Portfolio Company' },
  { value: 'thesis_update', label: 'Thesis Update' },
  { value: 'pattern_published', label: 'Pattern Published' },
  { value: 'any_announcement', label: 'Any Announcement' },
];

const FREQUENCY_OPTIONS = [
  { value: 'instant', label: 'Instant' },
  { value: 'daily', label: 'Daily Digest' },
  { value: 'weekly', label: 'Weekly Digest' },
];

const CHANNEL_OPTIONS = [
  { value: 'in_app', label: 'In-App' },
  { value: 'email', label: 'Email' },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return <Badge variant="amber" dot>Pending</Badge>;
    case 'sent':
      return <Badge variant="blue" dot>Sent</Badge>;
    case 'failed':
      return <Badge variant="red" dot>Failed</Badge>;
    case 'read':
      return <Badge variant="green" dot>Read</Badge>;
    case 'archived':
      return <Badge variant="default" dot>Archived</Badge>;
    default:
      return <Badge variant="default" dot>{status}</Badge>;
  }
};

const getTriggerLabel = (trigger: string) => {
  const labels: Record<string, string> = {
    new_funding_round: 'New Funding Round',
    new_portfolio_company: 'New Portfolio Company',
    thesis_update: 'Thesis Update',
    pattern_published: 'Pattern Published',
    any_announcement: 'Any Announcement',
  };
  return labels[trigger] || trigger;
};

export default function AlertsPage() {
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rules' | 'notifications'>('rules');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create modal state
  const [newRule, setNewRule] = useState({
    entity_type: 'fund' as 'fund' | 'company',
    entity_id: '',
    trigger: 'new_funding_round' as AlertRule['trigger'],
    frequency: 'daily' as AlertRule['frequency'],
    channels: ['in_app'] as AlertRule['channels'],
    topic_filter: [] as string[],
  });

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/alerts', {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to fetch alerts');
      const data: AlertsData = await response.json();
      setAlertRules(data.alertRules);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.entity_id) {
      setError('Entity ID is required');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      });
      if (!response.ok) throw new Error('Failed to create alert rule');
      setShowCreateModal(false);
      setNewRule({ entity_type: 'fund', entity_id: '', trigger: 'new_funding_round', frequency: 'daily', channels: ['in_app'], topic_filter: [] });
      fetchAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create alert rule');
    } finally {
      setCreating(false);
    }
  };

  const toggleRule = async (rule: AlertRule) => {
    try {
      const response = await fetch(`/api/alerts/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !rule.is_active }),
      });
      if (!response.ok) throw new Error('Failed to toggle rule');
      setAlertRules(alertRules.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle rule');
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm('Delete this alert rule?')) return;
    try {
      const response = await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete rule');
      setAlertRules(alertRules.filter(r => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  const markNotificationsRead = async (ids: string[]) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: ids, action: 'read' }),
      });
      if (!response.ok) throw new Error('Failed to mark as read');
      setNotifications(notifications.map(n => ids.includes(n.id) ? { ...n, status: 'read', read_at: new Date().toISOString() } : n));
      setUnreadCount(Math.max(0, unreadCount - ids.filter(id => notifications.find(n => n.id === id)?.status === 'pending').length));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as read');
    }
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => n.status === 'pending').map(n => n.id);
    if (unreadIds.length === 0) return;
    await markNotificationsRead(unreadIds);
  };

  return (
    <div className="app-page">
      <header className="app-route-label sticky top-0 z-40 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-text-primary">Ventro</Link>
          <Link href="/alerts" className="hidden sm:block px-4 py-2 rounded-lg bg-accent-blue/10 text-accent-blue text-sm font-medium">
            Alerts
          </Link>
        </div>
      </header>

      <main className="app-page-content">
        <div className="app-page-heading flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Alerts & Notifications</h1>
            <p className="text-text-secondary">Monitor funds, companies, and patterns with custom alerts</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} disabled={creating}>
            {creating ? 'Creating...' : 'Create Alert Rule'}
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="app-tabs mb-6">
          <nav className="flex gap-1" aria-label="Alert sections">
            {['rules', 'notifications'].map((tab) => (
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
                {tab === 'notifications' && unreadCount > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-accent-red text-white rounded-full">{unreadCount}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'rules' && (
          <div className="space-y-6">
            {alertRules.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <h3 className="text-lg font-medium mb-2">No alert rules yet</h3>
                <p className="text-text-secondary mb-4">Create your first alert to get notified about funding rounds, thesis updates, and more</p>
                <Button onClick={() => setShowCreateModal(true)}>Create Alert Rule</Button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {alertRules.map((rule) => (
                  <Card key={rule.id} className={!rule.is_active ? 'opacity-50' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <Badge variant={rule.is_active ? 'green' : 'default'}>{rule.is_active ? 'Active' : 'Paused'}</Badge>
                        <Button variant="ghost" size="sm" onClick={() => deleteRule(rule.id)}>
                          <svg className="w-4 h-4 text-accent-red" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="blue">{rule.entity_type}</Badge>
                        <span className="font-mono text-text-muted">{rule.entity_id.slice(0, 8)}...</span>
                      </div>
                      <p className="font-medium capitalize">{getTriggerLabel(rule.trigger)}</p>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="default">{rule.frequency}</Badge>
                        {rule.channels.map(c => <Badge key={c} variant="default">{c}</Badge>)}
                        {rule.topic_filter.map(t => <Badge key={t} variant="purple">{t}</Badge>)}
                      </div>
                      {rule.last_triggered_at && (
                        <p className="text-xs text-text-muted">Last triggered: {formatRelativeTime(rule.last_triggered_at)}</p>
                      )}
                      <Button
                        variant={rule.is_active ? 'secondary' : 'primary'}
                        size="sm"
                        className="w-full"
                        onClick={() => toggleRule(rule)}
                      >
                        {rule.is_active ? 'Pause Rule' : 'Activate Rule'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-text-secondary">
                {notifications.length} notifications
                {unreadCount > 0 && <span className="ml-2 px-2 py-0.5 bg-accent-red text-white text-xs rounded-full">{unreadCount} unread</span>}
              </p>
              {unreadCount > 0 && (
                <Button variant="secondary" size="sm" onClick={markAllRead}>
                  Mark all as read
                </Button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <h3 className="text-lg font-medium mb-2">No notifications yet</h3>
                <p className="text-text-secondary">Create alert rules to start receiving notifications</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <Card key={notif.id} className={notif.status === 'pending' ? 'border-accent-blue/30 bg-accent-blue/5' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{notif.title}</h4>
                            {getStatusBadge(notif.status)}
                          </div>
                          {notif.body && <p className="text-text-secondary text-sm">{notif.body}</p>}
                          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-text-muted">
                            <span>{formatRelativeTime(notif.created_at)}</span>
                            {notif.channels.map(c => <Badge key={c} variant="default">{c}</Badge>)}
                          </div>
                        </div>
                        {notif.status === 'pending' && (
                          <Button size="sm" variant="ghost" onClick={() => markNotificationsRead([notif.id])}>
                            Mark as read
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create Rule Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-bg-primary rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Create Alert Rule</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </Button>
                </div>
                <form onSubmit={handleCreateRule} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Entity Type</label>
                    <select
                      value={newRule.entity_type}
                      onChange={(e) => setNewRule({ ...newRule, entity_type: e.target.value as 'fund' | 'company' })}
                      className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
                    >
                      <option value="fund">Fund/Investor</option>
                      <option value="company">Company</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Entity ID (UUID)</label>
                    <Input
                      placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
                      value={newRule.entity_id}
                      onChange={(e) => setNewRule({ ...newRule, entity_id: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Trigger</label>
                    <select
                      value={newRule.trigger}
                      onChange={(e) => setNewRule({ ...newRule, trigger: e.target.value as AlertRule['trigger'] })}
                      className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
                    >
                      {TRIGGER_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Frequency</label>
                    <select
                      value={newRule.frequency}
                      onChange={(e) => setNewRule({ ...newRule, frequency: e.target.value as AlertRule['frequency'] })}
                      className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
                    >
                      {FREQUENCY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Channels</label>
                    <div className="flex flex-wrap gap-2">
                      {CHANNEL_OPTIONS.map(opt => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newRule.channels.includes(opt.value as 'email' | 'in_app')}
                            onChange={(e) => setNewRule({
                              ...newRule,
                              channels: e.target.checked
                                ? [...newRule.channels, opt.value] as ('email' | 'in_app')[]
                                : newRule.channels.filter(c => c !== opt.value) as ('email' | 'in_app')[]
                            })}
                            className="rounded border-border-default text-accent-blue focus:ring-accent-blue"
                          />
                          <span className="text-sm">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Topic Filter (Optional)</label>
                    <MultiSelect
                      options={[
                        { value: 'foundation_models', label: 'Foundation Models' },
                        { value: 'infrastructure', label: 'Infrastructure' },
                        { value: 'applications', label: 'Applications' },
                        { value: 'robotics', label: 'Robotics' },
                        { value: 'hardware', label: 'Hardware' },
                        { value: 'research', label: 'Research' },
                      ]}
                      value={newRule.topic_filter}
                      onChange={(v) => setNewRule({ ...newRule, topic_filter: v })}
                      placeholder="All topics"
                      maxSelections={7}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4 border-t border-border-default">
                    <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                    <Button type="submit" loading={creating}>{creating ? 'Creating...' : 'Create Rule'}</Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
