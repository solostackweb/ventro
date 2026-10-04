import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { feedFilterSchema } from '@/lib/validators/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate filters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    
    const topics = searchParams.get('topics')?.split(',').filter(Boolean) || [];
    const geographies = searchParams.get('geographies')?.split(',').filter(Boolean) || [];
    const stages = searchParams.get('stages')?.split(',').filter(Boolean) || [];
    const verifiedOnly = searchParams.get('verified_only') === 'true';
    const search = searchParams.get('q') || '';
    const sort = searchParams.get('sort') || 'name';

    const supabase = await createServerClient();

    // Build base query
    let query = supabase
      .from('companies')
      .select(`
        id,
        canonical_name,
        canonical_domain,
        short_description,
        ai_tags,
        hq_city,
        hq_country,
        stage,
        latest_round_date,
        latest_round_amount_usd,
        latest_round_stage,
        lead_investors,
        yc_batch,
        source_links,
        last_verified_at,
        verification_status,
        created_at,
        updated_at
      `, { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(
        `canonical_name.ilike.%${search}%,short_description.ilike.%${search}%,hq_city.ilike.%${search}%,hq_country.ilike.%${search}%`
      );
    }
    if (topics.length > 0) {
      query = query.contains('ai_tags', topics);
    }
    if (geographies.length > 0) {
      query = query.in('hq_country', geographies.map(g => g.toUpperCase()));
    }
    if (stages.length > 0) {
      query = query.in('stage', stages);
    }
    if (verifiedOnly) {
      query = query.eq('verification_status', 'verified');
    }

    // Apply sorting
    const validSortFields = ['name', 'stage', 'latest_round_date', 'created_at'];
    const sortField = validSortFields.includes(sort) ? sort : 'canonical_name';
    const sortOrder = sortField === 'name' ? { ascending: true } : { ascending: false };
    
    if (sortField === 'name') {
      query = query.order('canonical_name', { ascending: true });
    } else if (sortField === 'latest_round_date') {
      query = query.order('latest_round_date', { ascending: false });
    } else if (sortField === 'stage') {
      query = query.order('stage', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data: companies, error, count } = await query;

    if (error) {
      console.error('Companies API error:', error);
      return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
    }

    const total = count || 0;

    return NextResponse.json({
      companies: companies || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Companies API error:', error);
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
  }
}