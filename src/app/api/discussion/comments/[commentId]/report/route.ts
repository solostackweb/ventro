import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const reportSchema = z.object({
  reason: z.enum(['spam', 'harassment', 'misinformation', 'off_topic', 'other']),
  details: z.string().max(1000).optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params;
    const body = await request.json();
    const validated = reportSchema.parse(body);

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the comment
    const { data: comment, error: commentError } = await supabase
      .from('discussion_comments')
      .select('*')
      .eq('id', commentId)
      .single();

    if (commentError || !comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Check if user already reported this comment
    const { data: existingReport } = await supabase
      .from('admin_audit_log')
      .select('id')
      .eq('action', 'comment_reported')
      .eq('entity_id', commentId)
      .eq('actor_id', user.id)
      .single();

    if (existingReport) {
      return NextResponse.json({ error: 'Already reported this comment' }, { status: 400 });
    }

    // Log the report
    const { error: reportError } = await supabase
      .from('admin_audit_log')
      .insert({
        actor_id: user.id,
        action: 'comment_reported',
        entity_type: 'discussion_comment',
        entity_id: commentId,
        changes: {
          reason: validated.reason,
          details: validated.details || null,
          reported_content: comment.content,
          reported_user_id: comment.user_id,
        },
        performed_by: user.email,
      });

    if (reportError) {
      console.error('Report error:', reportError);
      return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
    }

    // If multiple reports, auto-hide (configurable threshold)
    const { count } = await supabase
      .from('admin_audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'comment_reported')
      .eq('entity_id', commentId);

    const AUTO_HIDE_THRESHOLD = 3;
    if (count && count >= AUTO_HIDE_THRESHOLD) {
      await supabase
        .from('discussion_comments')
        .update({ is_hidden: true, hidden_reason: 'Auto-hidden due to multiple reports', hidden_at: new Date().toISOString() })
        .eq('id', commentId);
    }

    return NextResponse.json({ success: true, message: 'Comment reported for review' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid report data', details: error.issues }, { status: 400 });
    }
    console.error('Report comment error:', error);
    return NextResponse.json({ error: 'Failed to report comment' }, { status: 500 });
  }
}
