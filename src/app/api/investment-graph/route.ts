import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { mapInvestmentGraphRow } from '@/lib/utils/investment-graph';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
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
      .from('investment_graph')
      .select(`
        round_id,
        company_id,
        company_name,
        company_domain,
        company_ai_tags,
        company_country,
        yc_batch,
        announced_date,
        round_stage,
        amount_usd,
        amount_currency,
        round_verification,
        fund_id,
        fund_name,
        firm_type,
        fund_vehicle_id,
        vehicle_name,
        vintage_year,
        participant_role,
        participant_amount_usd,
        participant_verification,
        participant_sources,
        round_sources
      `, { count: 'exact' });

    if (stages.length > 0) {
      query = query.in('round_stage', stages);
    }
    if (geographies.length > 0) {
      query = query.in('company_country', geographies);
    }
    if (aiTopics.length > 0) {
      query = query.overlaps('company_ai_tags', aiTopics);
    }
    if (ycBatches.length > 0) {
      query = query.in('yc_batch', ycBatches);
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
    if (verifiedOnly) {
      query = query.eq('round_verification', 'verified').eq('participant_verification', 'verified');
    }

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

    const { data: rounds, error, count } = await query;

    if (error) {
      console.error('Investment Graph API error:', error);
      return NextResponse.json({ error: 'Failed to fetch investment graph' }, { status: 500 });
    }

    const investments = (rounds || []).map(mapInvestmentGraphRow);

    return NextResponse.json({
      investments,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: offset + limit < (count || 0),
      },
    });
  } catch (error) {
    console.error('Investment Graph API error:', error);
    return NextResponse.json({ error: 'Failed to fetch investment graph' }, { status: 500 });
  }
}
