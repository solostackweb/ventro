import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    
    const topics = searchParams.get('topics')?.split(',').filter(Boolean) || [];
    const geographies = searchParams.get('geographies')?.split(',').filter(Boolean) || [];
    const stages = searchParams.get('stages')?.split(',').filter(Boolean) || [];
    const firmTypes = searchParams.get('firm_types')?.split(',').filter(Boolean) || [];
    const verifiedOnly = searchParams.get('verified_only') === 'true';
    const search = searchParams.get('q') || '';
    const sort = searchParams.get('sort') || 'name';

    const supabase = await createServerClient();

    let query = supabase
      .from('funds')
      .select(`
        id,
        canonical_name,
        canonical_domain,
        firm_type,
        hq_city,
        hq_country,
        source_links,
        last_verified_at,
        verification_status,
        created_at,
        updated_at,
        fund_vehicles (
          id,
          name,
          vintage_year,
          size_usd,
          focus
        ),
        stated_thesis (
          id,
          text,
          source_url,
          source_type,
          date_stated,
          extracted_at
        ),
        fund_portfolio (
          company_id,
          companies!inner (canonical_name)
        )
      `, { count: 'exact' });

    if (search) {
      query = query.or(
        `canonical_name.ilike.%${search}%,hq_city.ilike.%${search}%,hq_country.ilike.%${search}%`
      );
    }
    if (topics.length > 0) {
      query = query.contains('ai_focus_areas', topics);
    }
    if (geographies.length > 0) {
      query = query.in('hq_country', geographies.map(g => g.toUpperCase()));
    }
    if (stages.length > 0) {
      query = query.contains('typical_stages', stages);
    }
    if (firmTypes.length > 0) {
      query = query.in('firm_type', firmTypes);
    }
    if (verifiedOnly) {
      query = query.eq('verification_status', 'verified');
    }

    if (sort === 'name') {
      query = query.order('canonical_name', { ascending: true });
    } else if (sort === 'created_at') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('canonical_name', { ascending: true });
    }

    query = query.range(offset, offset + limit - 1);

    const { data: funds, error, count } = await query;

    if (error) {
      console.error('Funds API error:', error);
      return NextResponse.json({ error: 'Failed to fetch funds' }, { status: 500 });
    }

    const total = count || 0;

    return NextResponse.json({
      funds: funds || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Funds API error:', error);
    return NextResponse.json({ error: 'Failed to fetch funds' }, { status: 500 });
  }
}