'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
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

interface DiscussionSectionProps {
  entityType: 'company' | 'fund' | 'pattern';
  entityId: string;
  title?: string;
}

export function DiscussionSection({ entityType, entityId, title = 'Discussion' }: DiscussionSectionProps) {
  const [threads, setThreads] = useState<DiscussionThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showCreateThread, setShowCreateThread] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadContent, setNewThreadContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replying, setReplying] = useState(false);
  const [reportingComment, setReportingComment] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        entity_type: entityType === 'fund' ? 'fund' : entityType,
        entity_id: entityId,
        page: '1',
        limit: '10',
      });
      const response = await fetch(`/api/discussion/threads?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to fetch discussion');
      const data = await response.json();
      setThreads(data.threads || []);
      if (data.threads?.length > 0 && !activeThreadId) {
        setActiveThreadId(data.threads[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load discussion');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, activeThreadId]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThreadContent.trim()) return;

    setCreating(true);
    try {
      const response = await fetch('/api/discussion/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType === 'fund' ? 'fund' : entityType,
          entity_id: entityId,
          title: newThreadTitle || null,
          content: newThreadContent,
        }),
      });
      if (!response.ok) throw new Error('Failed to create thread');
      const data = await response.json();
      setThreads([data.thread, ...threads]);
      setActiveThreadId(data.thread.id);
      setShowCreateThread(false);
      setNewThreadTitle('');
      setNewThreadContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create thread');
    } finally {
      setCreating(false);
    }
  };

  const handleReply = async (threadId: string) => {
    if (!replyContent.trim()) return;

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
      setError(err instanceof Error ? err.message : 'Failed to post reply');
    } finally {
      setReplying(false);
    }
  };

  const handleReportComment = async (commentId: string) => {
    if (!reportReason.trim()) return;

    setReporting(true);
    try {
      const response = await fetch(`/api/discussion/comments/${commentId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason }),
      });
      if (!response.ok) throw new Error('Failed to report comment');
      setReportingComment(null);
      setReportReason('');
      alert('Comment reported for review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to report comment');
    } finally {
      setReporting(false);
    }
  };

  const activeThread = threads.find(t => t.id === activeThreadId);
  const rootComments = activeThread?.discussion_comments?.filter(c => !c.parent_id) || [];
  const replies = activeThread?.discussion_comments?.filter(c => c.parent_id) || [];

  const getReplies = (parentId: string) => {
    return replies.filter(r => r.parent_id === parentId);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="h-4 bg-bg-tertiary animate-pulse rounded w-1/2"></div>
            <div className="h-6 bg-bg-tertiary animate-pulse rounded w-1/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-accent-red text-sm">{error}</p>
          <Button variant="ghost" size="sm" onClick={fetchThreads}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-text-muted mt-1">Community discussion for this {entityType === 'fund' ? 'investor' : entityType}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Thread List */}
        <div className="border-r border-border-default pr-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium">Threads ({threads.length})</h4>
            <Button size="sm" variant="secondary" onClick={() => setShowCreateThread(true)}>
              New Thread
            </Button>
          </div>

          {threads.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <p>No discussions yet. Start the conversation!</p>
              <Button size="sm" variant="secondary" className="mt-2" onClick={() => setShowCreateThread(true)}>
                Create First Thread
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => setActiveThreadId(thread.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg transition-colors',
                    activeThreadId === thread.id
                      ? 'bg-accent-blue/10 border border-accent-blue/30'
                      : 'hover:bg-bg-secondary'
                  )}
                >
                  {thread.title && <p className="font-medium text-sm">{thread.title}</p>}
                  <p className="text-xs text-text-muted truncate">
                    {thread.discussion_comments?.[0]?.content?.slice(0, 100)}...
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    {formatRelativeTime(thread.created_at)} · {thread.discussion_comments?.length || 0} replies
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active Thread */}
        {activeThread && (
          <div className="flex-1 min-w-0">
            {activeThread.title && (
              <h4 className="font-semibold mb-4">{activeThread.title}</h4>
            )}
            <div className="space-y-4">
              {rootComments.map((comment) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  replies={getReplies(comment.id)}
                  onReply={setReplyingTo}
                  replyingTo={replyingTo}
                  replyContent={replyContent}
                  setReplyContent={setReplyContent}
                  onSubmitReply={(content) => handleReply(activeThread.id)}
                  replying={replying}
                  onReport={setReportingComment}
                />
              ))}
              {rootComments.length === 0 && (
                <p className="text-text-muted text-center py-4">No comments yet. Be the first to reply!</p>
              )}
            </div>
          </div>
        )}

        {/* Create Thread Modal */}
        {showCreateThread && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-bg-primary rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Create Discussion Thread</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowCreateThread(false)}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </Button>
                </div>
                <form onSubmit={handleCreateThread} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Title (Optional)</label>
                    <Input
                      placeholder="Brief title for the discussion"
                      value={newThreadTitle}
                      onChange={(e) => setNewThreadTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Content</label>
                    <textarea
                      value={newThreadContent}
                      onChange={(e) => setNewThreadContent(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4 border-t border-border-default">
                    <Button variant="ghost" onClick={() => setShowCreateThread(false)}>Cancel</Button>
                    <Button type="submit" loading={creating}>{creating ? 'Creating...' : 'Create Thread'}</Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommentThread({
  comment,
  replies,
  onReply,
  replyingTo,
  replyContent,
  setReplyContent,
  onSubmitReply,
  replying,
  onReport,
}: {
  comment: DiscussionComment;
  replies: DiscussionComment[];
  onReply: (id: string | null) => void;
  replyingTo: string | null;
  replyContent: string;
  setReplyContent: (content: string) => void;
  onSubmitReply: (content: string) => void;
  replying: boolean;
  onReport: (id: string) => void;
}) {
  const [showReplies, setShowReplies] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');

  return (
    <div className="space-y-3">
      <Card className={replyingTo === comment.id ? 'border-accent-blue/30 bg-accent-blue/5' : ''}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-accent-blue/10 flex items-center justify-center text-accent-blue text-sm font-medium">
              {comment.user_profiles?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">{comment.user_profiles?.email || 'Unknown'}</span>
                <Badge variant="default" className="text-xs">{comment.user_profiles?.role || 'member'}</Badge>
                <span className="text-xs text-text-muted">{formatRelativeTime(comment.created_at)}</span>
                {comment.is_hidden && (
                  <Badge variant="red" className="ml-auto">Hidden</Badge>
                )}
              </div>
              <p className="text-text-secondary whitespace-pre-wrap">{comment.content}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-text-muted">
                <Button variant="ghost" size="sm" className="px-2 py-0" onClick={() => onReply(comment.id)}>
                  {replyingTo === comment.id ? 'Cancel' : 'Reply'}
                </Button>
                <Button variant="ghost" size="sm" className="px-2 py-0" onClick={() => onReport(comment.id)}>
                  Report
                </Button>
              </div>
            </div>
          </div>

          {/* Report Modal */}
          {showReport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-bg-primary rounded-xl max-w-md w-full p-6">
                <h3 className="text-lg font-semibold mb-4">Report Comment</h3>
                <p className="text-text-secondary text-sm mb-4">Help us keep discussions safe and constructive.</p>
                <form className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Reason</label>
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                      required
                    >
                      <option value="">Select reason</option>
                      <option value="spam">Spam / Self-promotion</option>
                      <option value="harassment">Harassment / Abuse</option>
                      <option value="misinformation">Misinformation</option>
                      <option value="off_topic">Off-topic</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Details (optional)</label>
                    <textarea
                      rows={3}
                      className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-accent-blue text-text-primary"
                      placeholder="Additional context..."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={() => { setShowReport(false); setReportReason(''); }}>
                      Cancel
                    </Button>
                    <Button 
                      type="button" 
                      variant="primary" 
                      onClick={() => { /* handleReport would be passed via context or prop */ }}
                    >
                      Submit Report
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Reply Form */}
          {replyingTo === comment.id && (
            <form onSubmit={(e) => { e.preventDefault(); onSubmitReply(replyContent); }} className="mt-3 ml-11 flex gap-2">
              <input
                type="text"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
                autoFocus
              />
              <Button type="submit" size="sm" loading={replying}>{replying ? 'Posting...' : 'Reply'}</Button>
            </form>
          )}

          {/* Replies */}
          {replies.length > 0 && (
            <div className="ml-11 mt-3 space-y-2 border-l-2 border-border-default pl-3">
              {replies.map((reply) => (
                <Card key={reply.id} className="bg-bg-secondary/50">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-accent-blue/10 flex items-center justify-center text-accent-blue text-xs font-medium">
                        {reply.user_profiles?.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-xs">{reply.user_profiles?.email || 'Unknown'}</span>
                          <span className="text-xs text-text-muted">{formatRelativeTime(reply.created_at)}</span>
                        </div>
                        <p className="text-text-secondary text-sm">{reply.content}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}