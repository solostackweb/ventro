import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const supabase = await createServerClient();

    const { data: batches, error, count } = await supabase
      .from('yc_batches')
      .select(`
        id,
        batch_name,
        season,
        year,
        demo_day_date,
        total_companies,
        ai_companies_count,
        source_links,
        created_at,
        updated_at,
        yc_batch_companies (
          company_id,
          companies!inner (
            id,
            canonical_name,
            canonical_domain,
            short_description,
            ai_tags,
            hq_city,
            hq_country,
            stage,
            latest_round_amount_usd,
            verification_status
          )
        )
      `, { count: 'exact' })
      .order('year', { ascending: false })
      .order('season', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('YC Batches API error:', error);
      return NextResponse.json({ error: 'Failed to fetch YC batches' }, { status: 500 });
    }

    return NextResponse.json({
      batches: batches || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: offset + limit < (count || 0),
      },
    });
  } catch (error) {
    console.error('YC Batches API error:', error);
    return NextResponse.json({ error: 'Failed to fetch YC batches' }, { status: 500 });
  }
}