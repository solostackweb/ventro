import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const stages = searchParams.get('stages')?.split(',').filter(Boolean) || [];
    const geographies = searchParams.get('geographies')?.split(',').filter(Boolean) || [];
    const aiTopics = searchParams.get('topics')?.split(',').filter(Boolean) || [];
    const ycBatches = searchParams.get('yc_batches')?.split(',').filter(Boolean) || [];
    const investorId = searchParams.get('investor_id');
    const companyId = searchParams.get('company_id');
    const verifiedOnly = searchParams.get('verified_only') === 'true';
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const sort = searchParams.get('sort') || 'date_desc';

    const supabase = await createServerClient();

    let query = supabase
      .from('investments')
      .select(`
        id,
        fund_id,
        fund_vehicle_id,
        company_id,
        company_name,
        announced_date,
        round_stage,
        amount_usd,
        amount_currency,
        investor_role,
        source_urls,
        verification_status,
        conflicts,
        created_at,
        updated_at,
        funds!inner (
          id,
          canonical_name,
          canonical_domain,
          firm_type,
          hq_city,
          hq_country
        ),
        companies!inner (
          id,
          canonical_name,
          canonical_domain,
          ai_tags,
          hq_city,
          hq_country,
          stage,
          yc_batch
        ),
        fund_vehicles (
          id,
          name,
          vintage_year,
          size_usd,
          focus
        )
      `, { count: 'exact' });

    // Filters
    if (stages.length > 0) {
      query = query.in('round_stage', stages);
    }
    if (verifiedOnly) {
      query = query.eq('verification_status', 'verified');
    }
    if (investorId) {
      query = query.eq('fund_id', investorId);
    }
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    if (dateFrom) {
      query = query.gte('announced_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('announced_date', dateTo);
    }
    if (ycBatches.length > 0) {
      query = query.in('companies.yc_batch', ycBatches);
    }
    if (geographies.length > 0) {
      query = query.in('companies.hq_country', geographies.map(g => g.toUpperCase()));
    }
    if (aiTopics.length > 0) {
      query = query.contains('companies.ai_tags', aiTopics);
    }

    // Sorting
    if (sort === 'date_desc') {
      query = query.order('announced_date', { ascending: false });
    } else if (sort === 'date_asc') {
      query = query.order('announced_date', { ascending: true });
    } else if (sort === 'amount_desc') {
      query = query.order('amount_usd', { ascending: false });
    } else if (sort === 'amount_asc') {
      query = query.order('amount_usd', { ascending: true });
    } else {
      query = query.order('announced_date', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data: investments, error, count } = await query;

    if (error) {
      console.error('Investments API error:', error);
      return NextResponse.json({ error: 'Failed to fetch investments' }, { status: 500 });
    }

    return NextResponse.json({
      investments: investments || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: offset + limit < (count || 0),
      },
    });
  } catch (error) {
    console.error('Investments API error:', error);
    return NextResponse.json({ error: 'Failed to fetch investments' }, { status: 500 });
  }
}
