import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'story', 'company', 'fund', 'pattern'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('saved_items')
      .select(`
        id,
        item_type,
        item_id,
        created_at,
        stories!item_id (
          id,
          headline,
          summary,
          event_date,
          publisher,
          source_count,
          ai_topics,
          verification_label
        ),
        companies!item_id (
          id,
          canonical_name,
          short_description,
          ai_tags,
          stage,
          hq_city,
          verification_status
        ),
        funds!item_id (
          id,
          canonical_name,
          canonical_domain,
          firm_type,
          hq_city,
          ai_focus_areas,
          verification_status
        ),
        patterns!item_id (
          id,
          name,
          description,
          confidence,
          status,
          distinct_companies,
          distinct_funds
        )
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('item_type', type);
    }

    const { data: savedItems, error, count } = await query;

    if (error) {
      console.error('Saved items API error:', error);
      return NextResponse.json({ error: 'Failed to fetch saved items' }, { status: 500 });
    }

    // Transform to include item details
    const transformed = (savedItems || []).map((s: any) => ({
      id: s.id,
      item_type: s.item_type,
      item_id: s.item_id,
      saved_at: s.created_at,
      item: s.item_type === 'story' ? s.stories : s.item_type === 'company' ? s.companies : s.item_type === 'fund' ? s.funds : s.patterns,
    }));

    return NextResponse.json({
      saved: transformed,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: offset + limit < (count || 0),
      },
    });
  } catch (error) {
    console.error('Saved API error:', error);
    return NextResponse.json({ error: 'Failed to fetch saved items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { item_type, item_id } = body;

    if (!item_type || !item_id) {
      return NextResponse.json({ error: 'item_type and item_id are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('saved_items')
      .upsert({
        user_id: user.id,
        item_type,
        item_id,
      }, { onConflict: 'user_id,item_type,item_id' })
      .select()
      .single();

    if (error) {
      console.error('Save item error:', error);
      return NextResponse.json({ error: 'Failed to save item' }, { status: 500 });
    }

    return NextResponse.json({ saved: data });
  } catch (error) {
    console.error('Save item error:', error);
    return NextResponse.json({ error: 'Failed to save item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const itemType = searchParams.get('item_type');
    const itemId = searchParams.get('item_id');

    if (!itemType || !itemId) {
      return NextResponse.json({ error: 'item_type and item_id are required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('saved_items')
      .delete()
      .eq('user_id', user.id)
      .eq('item_type', itemType)
      .eq('item_id', itemId);

    if (error) {
      console.error('Unsave item error:', error);
      return NextResponse.json({ error: 'Failed to unsave item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unsave item error:', error);
    return NextResponse.json({ error: 'Failed to unsave item' }, { status: 500 });
  }
}