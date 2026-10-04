import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Record<string, string>> }
) {
  try {
    const { threadId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const supabase = await createServerClient();

    const { data: comments, error, count } = await supabase
      .from('discussion_comments')
      .select(`
        id,
        thread_id,
        user_id,
        parent_id,
        content,
        is_hidden,
        hidden_reason,
        hidden_at,
        created_at,
        updated_at,
        user_profiles!discussion_comments_user_id_fkey!inner (id, email, role)
      `, { count: 'exact' })
      .eq('thread_id', threadId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      comments: comments || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: offset + limit < (count || 0),
      },
    });
  } catch (error) {
    console.error('Discussion comments API error:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Record<string, string>> }
) {
  try {
    const { threadId } = await params;
    const body = await request.json();
    const { content, parent_id } = body;
    const supabase = await createServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Verify thread exists
    const { data: thread } = await supabase
      .from('discussion_threads')
      .select('id')
      .eq('id', threadId)
      .single();

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Create comment
    const { data: comment, error } = await supabase
      .from('discussion_comments')
      .insert({
        thread_id: threadId,
        user_id: user.id,
        parent_id: parent_id || null,
        content: content.trim(),
      })
      .select(`
        id,
        thread_id,
        user_id,
        parent_id,
        content,
        is_hidden,
        created_at,
        updated_at,
        user_profiles!discussion_comments_user_id_fkey!inner (id, email, role)
      `)
      .single();

    if (error) throw error;

    // Update thread updated_at
    await supabase
      .from('discussion_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);

    return NextResponse.json({ comment });
  } catch (error) {
    console.error('Create comment error:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}
