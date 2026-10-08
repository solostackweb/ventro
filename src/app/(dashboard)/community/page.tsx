'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, formatRelativeTime } from '@/lib/utils/helpers';

interface DiscussionComment {
  id: string;
  thread_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  is_hidden: boolean;
  hidden_reason: string | null;
  created_at: string;
  updated_at: string;
  user_profiles: {
    id: string;
    email: string;
    role: string | null;
  };
}

interface CommunityThread {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  discussion_comments: DiscussionComment[];
}

interface CommunityResponse {
  threads: CommunityThread[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export default function CommunityPage() {
  const [threads, setThreads] = useState<CommunityThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'browse' | 'my-threads'>('browse');
  const [selectedThread, setSelectedThread] = useState<CommunityThread | null>(null);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replying, setReplying] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [profile, setProfile] = useState<{ name: string; avatar: string; entitlement: string } | null>(null);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/community?${new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(activeTab === 'my-threads' && session && { my_threads: 'true' })
      }).toString()}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to fetch threads');
      const data: CommunityResponse = await response.json();
      setThreads(data.threads);
      setHasMore(data.pagination.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load discussions');
    } finally {
      setLoading(false);
    }
  }, [page, activeTab]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase
          .from('user_profiles')
          .select('entitlement')
          .eq('id', session.user.id)
          .single();
        if (data) setProfile({ name: 'You', avatar: 'YO', entitlement: data.entitlement });
      }
    };
    fetchProfile();
  }, []);

  const handlePostComment = async () => {
    if (!newComment.trim() || !selectedThread) return;
    if (!profile || (profile.entitlement !== 'subscribed' && profile.entitlement !== 'student_trial')) return;

    setReplying(true);
    try {
      const response = await fetch(`/api/discussion/comments/${selectedThread.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment, parent_id: replyingTo }),
      });
      if (!response.ok) throw new Error('Failed to post reply');
      setNewComment('');
      setReplyingTo(null);
      fetchThreads();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to post reply');
    } finally {
      setReplying(false);
    }
  };

  const handleCreateThread = async () => {
    if (!newComment.trim()) return;
    if (!profile || (profile.entitlement !== 'subscribed' && profile.entitlement !== 'student_trial')) return;

    setReplying(true);
    try {
      const response = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: 'company',
          entity_id: 'general',
          title: newComment.slice(0, 100),
          content: newComment,
        }),
      });
      if (!response.ok) throw new Error('Failed to create thread');
      const data = await response.json();
      setThreads([data.thread, ...threads]);
      setSelectedThread(data.thread);
      setNewComment('');
      setCreatingThread(false);
      setReplying(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create thread');
      setReplying(false);
    }
  };

  const handleReply = async (threadId: string) => {
    if (!replyContent.trim()) return;
    if (!profile || (profile.entitlement !== 'subscribed' && profile.entitlement !== 'student_trial')) return;

    setReplying(true);
    try {
      const response = await fetch(`/api/discussion/comments/${threadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent, parent_id: replyingTo }),
      });
      if (!response.ok) throw new Error('Failed to post reply');
      setReplyContent('');
      setReplyingTo(null);
      fetchThreads();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to post reply');
    } finally {
      setReplying(false);
    }
  };

  function ThreadDetail() {
    if (!selectedThread) return null;

    let replyForm = null;
    if (profile && (profile.entitlement === 'subscribed' || profile.entitlement === 'student_trial') && !replyingTo) {
      replyForm = (
        <div className="border-t border-border-default pt-4">
          <h3 className="font-semibold mb-3">Write a reply</h3>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent-blue/10 flex items-center justify-center text-sm font-medium text-accent-blue flex-shrink-0">
              {profile?.avatar}
            </div>
            <div className="flex-1">
              <textarea
                placeholder="Markdown supported..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[80px] border border-border-default rounded-lg bg-bg-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
              />
              <div className="flex justify-end mt-2">
                <button 
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handlePostComment} disabled={!newComment.trim() || replying}>
                  Post Reply
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    } else if (replyingTo) {
      replyForm = (
        <div className="border-t border-border-default pt-4">
          <h3 className="font-semibold mb-3">Write a reply</h3>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent-blue/10 flex items-center justify-center text-sm font-medium text-accent-blue flex-shrink-0">
              {profile?.avatar}
            </div>
            <div className="flex-1">
              <textarea
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="min-h-[80px] border border-border-default rounded-lg bg-bg-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
              />
              <div className="flex justify-end mt-2">
                <button className="px-4 py-2 text-sm font-medium rounded-lg border border-border-default bg-bg-secondary hover:bg-bg-tertiary transition-colors" onClick={() => { setReplyContent(''); setReplyingTo(null); }}>Cancel</button>
                <button onClick={() => handleReply(selectedThread.id)} disabled={!replyContent.trim() || replying} className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Post Reply
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      replyForm = (
        <div className="border-t border-border-default pt-4 p-4 bg-bg-secondary rounded-lg">
          <p className="text-text-secondary text-center">
            Upgrade to Pro or verify student email to join the discussion.
          </p>
          <div className="flex justify-center gap-3 mt-3">
            <a href="/settings"><button className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors">Upgrade</button></a>
            <a href="/signup"><button className="px-4 py-2 text-sm font-medium rounded-lg border border-border-default bg-bg-primary hover:bg-bg-tertiary">Verify Student Email</button></a>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <button 
          className="px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors gap-1"
          onClick={() => setSelectedThread(null)}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to discussions
        </button>

        <div className="rounded-md border border-rule bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-accent-blue/10 text-accent-blue">{selectedThread?.entity_type}</span>
            <a href="#" className="text-accent-blue hover:underline text-sm">
              {selectedThread.entity_id === 'general' ? 'General Discussion' : selectedThread.entity_id}
            </a>
          </div>
          <h2 className="text-xl font-bold">{selectedThread.title || 'Untitled Discussion'}</h2>
          <div className="flex items-center gap-4 text-sm text-text-muted mt-2">
            <span>{selectedThread.discussion_comments?.length || 0} replies</span>
          </div>
          <div className="p-4 space-y-4 border-t border-border-default mt-4">
            {selectedThread.discussion_comments?.filter(c => !c.parent_id).map((comment, i) => (
              <div key={comment.id} className={'border-l-2 border-border-default pl-4' + (i > 0 ? ' ml-8' : '')}>
                <div style={{display: 'flex', gap: 12, alignItems: 'flex-start'}}>
                  <div className="w-8 h-8 rounded-full bg-accent-blue/10 flex items-center justify-center text-sm font-medium text-accent-blue flex-shrink-0">
                    {comment.user_profiles?.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div style={{flex: 1}}>
                    <div style={{display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center'}}>
                      <span style={{fontWeight: 600}}>{comment.user_profiles?.email || 'Unknown'}</span>
                      <span style={{fontSize: 12, color: 'var(--text-muted)'}}>{formatRelativeTime(comment.created_at)}</span>
                    </div>
                    <p style={{color: 'var(--text-secondary)'}}>{comment.content}</p>
                    <div style={{display: 'flex', gap: 12, marginTop: 8, fontSize: 13, color: 'var(--text-muted)'}}>
                      <button
                        className="gap-1 h-auto p-0 text-text-muted hover:text-text-primary"
                        onClick={() => setReplyingTo(comment.id)}>
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              ))}
          </div>
          {replyForm}
        </div>
      </div>
    );
  }

  function renderThreadList() {
    return (
      <div className="space-y-5">
        <div className="flex flex-col justify-between gap-3 border-b border-rule pb-4 sm:flex-row sm:items-center">
          <div className="flex gap-1" role="tablist" aria-label="Community discussions">
            {['browse', 'my-threads'].map((t) => (
              <button
                key={t}
                onClick={() => { setActiveTab(t as 'browse' | 'my-threads'); setPage(1); }}
                className={cn('min-h-11 rounded-sm px-4 text-sm font-semibold transition-colors', activeTab === t ? 'bg-ink-950 text-white' : 'text-ink-500 hover:bg-ink-950/[0.05] hover:text-ink-950')}
                role="tab"
                aria-selected={activeTab === t}
              >
                {t === 'browse' ? 'All Discussions' : 'My Threads'}
              </button>
            ))}
          </div>
          <Button onClick={() => { setNewComment(''); setCreatingThread(true); }}>New discussion</Button>
        </div>

        {creatingThread && <Card className="border-cyan-700/30 bg-white"><CardHeader><div><p className="eyebrow text-cyan-700">New discussion</p><h2 className="mt-1 text-xl font-semibold text-ink-950">Share a market observation</h2></div></CardHeader><CardContent className="space-y-3"><textarea value={newComment} onChange={event => setNewComment(event.target.value)} placeholder="What are you seeing in the AI market? Add the signal, source, and your interpretation." className="min-h-32 w-full resize-y rounded-md border border-rule bg-white p-3 text-sm leading-6 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20" /><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setCreatingThread(false)}>Cancel</Button><Button onClick={handleCreateThread} loading={replying} disabled={!newComment.trim()}>Publish discussion</Button></div></CardContent></Card>}

        {loading && <div className="space-y-3" aria-label="Loading discussions">{[0, 1, 2].map(item => <div key={item} className="h-32 animate-pulse rounded-md border border-rule bg-white" />)}</div>}
        {error && <div className="state-panel state-panel-error"><div className="flex-1"><h2>Discussions unavailable</h2><p>{error}</p></div><Button variant="secondary" onClick={fetchThreads}>Retry</Button></div>}
        {!loading && !error && threads.length === 0 && <div className="app-empty-state"><h2 className="text-lg font-semibold text-ink-950">No discussions yet</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6">Start with a specific market signal, funding event, or investor thesis others can investigate with you.</p><Button className="mt-5" onClick={() => setCreatingThread(true)}>Start the first discussion</Button></div>}
        {!loading && !error && threads.length > 0 && <div className="divide-y divide-rule border-y border-rule bg-white">{threads.map(thread => <button key={thread.id} type="button" onClick={() => setSelectedThread(thread)} className="block w-full px-5 py-5 text-left transition-colors hover:bg-research-muted"><div className="flex flex-wrap items-center gap-2"><Badge variant="blue">{thread.entity_type}</Badge><span className="text-xs text-ink-500">{formatRelativeTime(thread.updated_at)}</span></div><h2 className="mt-2 text-lg font-semibold tracking-[-0.015em] text-ink-950">{thread.title || 'Untitled discussion'}</h2><div className="mt-3 flex items-center gap-4 text-xs font-medium text-ink-500"><span>{thread.discussion_comments?.length || 0} replies</span><span>Open discussion →</span></div></button>)}</div>}

        {!loading && !error && (page > 1 || hasMore) && <div className="flex items-center justify-between"><Button variant="secondary" disabled={page === 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Previous</Button><span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Page {page}</span><Button variant="secondary" disabled={!hasMore} onClick={() => setPage(current => current + 1)}>Next</Button></div>}
      </div>
    );
  }

  return (
    <div className="app-page">
      <header className="app-route-label sticky top-0 z-40 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-text-primary">Ventro</Link>
          <Link href="/community" className="hidden sm:block px-4 py-2 rounded-lg bg-accent-blue/10 text-accent-blue text-sm font-medium">
            Community
          </Link>
        </div>
      </header>

      <main className="app-page-content app-page-content-narrow">
        <div className="app-page-heading">
          <h1 className="text-3xl font-bold mb-2">Community</h1>
          <p className="text-text-secondary">Discuss companies, investors, and patterns with verified members</p>
        </div>

        {selectedThread ? ThreadDetail() : renderThreadList()}
      </main>
    </div>
  );
}
