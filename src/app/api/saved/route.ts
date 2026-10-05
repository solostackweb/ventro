import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function fetchItemDetails(supabase: any, items: any[]) {
  const stories = items.filter(i => i.item_type === 'story');
  const companies = items.filter(i => i.item_type === 'company');
  const funds = items.filter(i => i.item_type === 'fund');
  const patterns = items.filter(i => i.item_type === 'pattern');

  const [storyData, companyData, fundData, patternData] = await Promise.all([
    stories.length ? supabase.from('stories').select('id, headline, summary, event_date, publisher, source_count, ai_topics, verification_label').in('id', stories.map((s: any) => s.item_id)) : { data: [] },
    companies.length ? supabase.from('companies').select('id, canonical_name, short_description, ai_tags, stage, hq_city, verification_status').in('id', companies.map((c: any) => c.item_id)) : { data: [] },
    funds.length ? supabase.from('funds').select('id, canonical_name, canonical_domain, firm_type, hq_city, ai_focus_areas, verification_status').in('id', funds.map((f: any) => f.item_id)) : { data: [] },
    patterns.length ? supabase.from('patterns').select('id, name, description, confidence, status, distinct_companies, distinct_funds').in('id', patterns.map((p: any) => p.item_id)) : { data: [] },
  ]);

  const storyMap = new Map((storyData.data || []).map((s: any) => [s.id, s]));
  const companyMap = new Map((companyData.data || []).map((c: any) => [c.id, c]));
  const fundMap = new Map((fundData.data || []).map((f: any) => [f.id, f]));
  const patternMap = new Map((patternData.data || []).map((p: any) => [p.id, p]));

  return items.map(s => ({
    ...s,
    item: s.item_type === 'story' ? storyMap.get(s.item_id) :
          s.item_type === 'company' ? companyMap.get(s.item_id) :
          s.item_type === 'fund' ? fundMap.get(s.item_id) :
          s.item_type === 'pattern' ? patternMap.get(s.item_id) : null,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('saved_items')
      .select('id, item_type, item_id, created_at', { count: 'exact' })
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

    // Fetch item details separately (no FK relationships in DB)
    const transformed = await fetchItemDetails(supabase, savedItems || []);

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