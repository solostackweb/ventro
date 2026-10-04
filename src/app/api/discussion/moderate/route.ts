import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { commentId, action, reason } = body; // action: 'report', 'hide', 'unhide'
    const supabase = await createServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!commentId || !action) {
      return NextResponse.json({ error: 'commentId and action are required' }, { status: 400 });
    }

    if (action === 'report') {
      // Create report record (could add a separate reports table, for now just flag)
      const { data: comment, error } = await supabase
        .from('discussion_comments')
        .update({
          is_hidden: true,
          hidden_reason: reason || 'Reported by user',
          hidden_by: user.id,
          hidden_at: new Date().toISOString(),
        })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ comment });
    }

    if (action === 'hide') {
      // Admin/moderator action
      const { data: { user: adminUser } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', adminUser?.id)
        .single();

      // Check if user is admin (you can add admin role check here)
      const { data: comment, error } = await supabase
        .from('discussion_comments')
        .update({
          is_hidden: true,
          hidden_reason: reason || 'Hidden by moderator',
          hidden_by: adminUser?.id,
          hidden_at: new Date().toISOString(),
        })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ comment });
    }

    if (action === 'unhide') {
      // Admin/moderator action
      const { data: { user: adminUser } } = await supabase.auth.getUser();
      const { data: comment, error } = await supabase
        .from('discussion_comments')
        .update({
          is_hidden: false,
          hidden_reason: null,
          hidden_by: null,
          hidden_at: null,
        })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ comment });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Moderate comment error:', error);
    return NextResponse.json({ error: 'Failed to moderate comment' }, { status: 500 });
  }
}