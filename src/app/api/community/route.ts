import { createServerClient, hasFullAccess } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entity_type'); // 'company', 'fund', 'pattern'
    const entityId = searchParams.get('entity_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // If specific entity, get its threads
    if (entityType && entityId) {
      const { data: threads, error, count } = await supabase
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
            hidden_by,
            created_at,
            updated_at,
            user_profiles!discussion_comments_user_id_fkey (
              id,
              email,
              role
            )
          )
        `, { count: 'exact' })
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Community threads API error:', error);
        return handleApiError(error);
      }

      return NextResponse.json({
        threads: threads || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
          hasMore: offset + limit < (count || 0),
        },
      });
    }

    // Otherwise, get all threads across entities (for browse view)
    const { data: threads, error, count } = await supabase
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
          hidden_by,
          created_at,
          updated_at,
          user_profiles!discussion_comments_user_id_fkey (
            id,
            email,
            role
          )
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Community threads API error:', error);
      return handleApiError(error);
    }

    return NextResponse.json({
      threads: threads || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: offset + limit < (count || 0),
      },
    });
  } catch (error) {
    console.error('Community API error:', error);
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Centralized expiry-aware access check (derives identity from auth.uid())
    const hasAccess = await hasFullAccess();
    if (!hasAccess) {
      return NextResponse.json({ error: 'Premium access required to create discussions' }, { status: 403 });
    }

    const body = await request.json();
    const { entity_type, entity_id, title, content } = body;

    if (!entity_type || !entity_id || !content) {
      return NextResponse.json({ error: 'entity_type, entity_id, and content are required' }, { status: 400 });
    }

    // Validate entity_type
    if (!['company', 'fund', 'pattern'].includes(entity_type)) {
      return NextResponse.json({ error: 'Invalid entity_type' }, { status: 400 });
    }

    // Create thread
    const { data: thread, error: threadError } = await supabase
      .from('discussion_threads')
      .insert({
        entity_type,
        entity_id,
        title: title || null,
      })
      .select()
      .single();

    if (threadError) {
      console.error('Create thread error:', threadError);
      return handleApiError(threadError);
    }

    // Create initial comment
    const { data: comment, error: commentError } = await supabase
      .from('discussion_comments')
      .insert({
        thread_id: thread.id,
        user_id: user.id,
        content,
      })
      .select()
      .single();

    if (commentError) {
      console.error('Create comment error:', commentError);
      return handleApiError(commentError);
    }

    // Update thread with comment count
    await supabase
      .from('discussion_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', thread.id);

    return NextResponse.json({ 
      thread: { ...thread, discussion_comments: [comment] },
      message: 'Discussion created successfully'
    });
  } catch (error) {
    console.error('Create thread error:', error);
    return handleApiError(error);
  }
}