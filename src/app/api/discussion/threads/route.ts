import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entity_type and entity_id are required' }, { status: 400 });
    }

    const supabase = await createServerClient();

    // Get threads for this entity
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
          user_id,
          parent_id,
          content,
          is_hidden,
          hidden_reason,
          created_at,
          updated_at,
          user_profiles!discussion_comments_user_id_fkey!inner (id, email, role)
        )
      `, { count: 'exact' })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

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
    console.error('Discussion threads API error:', error);
    return NextResponse.json({ error: 'Failed to fetch discussion threads' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entity_type, entity_id, title, content } = body;
    const supabase = await createServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    if (threadError) throw threadError;

    // Create first comment if content provided
    if (content) {
      const { error: commentError } = await supabase
        .from('discussion_comments')
        .insert({
          thread_id: thread.id,
          user_id: user.id,
          content,
        });

      if (commentError) throw commentError;
    }

    return NextResponse.json({ thread });
  } catch (error) {
    console.error('Create discussion thread error:', error);
    return NextResponse.json({ error: 'Failed to create discussion thread' }, { status: 500 });
  }
}
