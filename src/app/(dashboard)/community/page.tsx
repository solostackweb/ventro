'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { cn, formatRelativeTime } from '@/lib/utils/helpers';

interface DiscussionThread {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  discussion_comments: DiscussionComment[];
}

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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [profile, setProfile] = useState<{ name: string; avatar: string; entitlement: string } | null>(null);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      let query = supabase
        .from('discussion_threads')
        .select(`
          id,
          entity_type,
          entity_id,
          title,
          created_at,
          updated_at,
          discussion_comments (
            id,
            thread_id,
            user_id,
            parent_id,
            content,
            is_hidden,
            created_at,
            updated_at,
            user_profiles!inner (
              id,
              email,
              role
            )
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      if (activeTab === 'my-threads' && session) {
        query = query.contains('discussion_comments.user_id', [session.user.id]);
      }

      const offset = (page - 1) * 10;
      query = query.range(offset, offset + 9);

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
    if (!profile || (profile.entitlement !== 'subscribed' && profile.entitlement !== 'discount_card')) return;

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

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    if (!profile || (profile.entitlement !== 'subscribed' && profile.entitlement !== 'discount_card')) return;

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
      setReplying(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create thread');
      setReplying(false);
    }
  };

  const handleReply = async (threadId: string) => {
    if (!replyContent.trim()) return;
    if (!profile || (profile.entitlement !== 'subscribed' && profile.entitlement !== 'discount_card')) return;

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

    const canReply = profile?.entitlement === 'subscribed' || profile?.entitlement === 'discount_card';

    let replyForm = null;
    if (profile && (profile.entitlement === 'subscribed' || profile.entitlement === 'discount_card') && !replyingTo) {
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
                  onClick={() => { setReplyingTo('new'); setNewComment(''); }} disabled={!newComment.trim()}>
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
                <button onClick={() => handleReply('new')} disabled={!replyContent.trim()} className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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

        <div className="p-4 border border-border-default rounded-lg bg-bg-primary">
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
                        onClick={() => {}}>
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              ))}
          </div>
        </div>
      </div>
    );
  }

  function renderThreadList() {
    return (
      <div>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24}}>
          <div style={{display: 'flex', gap: 8}}>
            {['browse', 'my-threads'].map((t) => (
              <button
                key={t}
                onClick={() => { setActiveTab(t as 'browse' | 'my-threads'); setPage(1); }}
                style={{
                  padding: '8px 16px',
                  fontSize: 14,
                  fontWeight: 500,
                  borderRadius: 8,
                  transition: 'all 0.2s',
                  border: 'none',
                  background: activeTab === t ? 'var(--accent-blue)' : 'transparent',
                  color: activeTab === t ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                {t === 'browse' ? 'All Discussions' : 'My Threads'}
              </button>
            ))}
          </div>
          <button 
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              borderRadius: 8,
              transition: 'all 0.2s',
              border: 'none',
              background: 'var(--accent-blue)',
              color: 'white',
              cursor: 'pointer'
            }}
            onClick={() => { setNewComment(''); setReplyingTo('new'); }}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Discussion
          </button>
        </div>

        <div style={{marginBottom: 24}}>
          <div style={{fontSize: 18, fontWeight: 600, marginBottom: 8}}>No discussions yet</div>
          <p style={{color: 'var(--text-secondary)', marginBottom: 16}}>Start the conversation!</p>
          <button style={{
            padding: '10px 20px',
            fontSize: 14,
            fontWeight: 500,
            borderRadius: 8,
            transition: 'all 0.2s',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }} onClick={() => {}}>
            Start a Discussion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="sticky top-0 z-40 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-text-primary">Ventro</Link>
          <Link href="/community" className="hidden sm:block px-4 py-2 rounded-lg bg-accent-blue/10 text-accent-blue text-sm font-medium">
            Community
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Community</h1>
          <p className="text-text-secondary">Discuss companies, investors, and patterns with verified members</p>
        </div>

        <div>Community page content here</div>
      </main>
    </div>
  );
}
