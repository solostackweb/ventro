import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: fund, error } = await supabase
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
          focus,
          created_at
        ),
        stated_thesis (
          id,
          text,
          source_url,
          source_type,
          date_stated,
          extracted_at
        ),
        observed_thesis (
          id,
          methodology,
          period_start,
          period_end,
          sample_size,
          themes,
          confidence,
          caveats,
          last_computed
        ),
        fund_portfolio (
          company_id,
          first_investment_date,
          latest_investment_date,
          total_invested_usd,
          companies!inner (
            id,
            canonical_name,
            canonical_domain,
            ai_tags,
            hq_city,
            hq_country,
            stage,
            latest_round_date,
            latest_round_amount_usd
          )
        ),
        investments (
          id,
          company_id,
          company_name,
          announced_date,
          round_stage,
          amount_usd,
          investor_role,
          source_urls,
          verification_status
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Fund not found' }, { status: 404 });
      }
      console.error('Fund API error:', error);
      return NextResponse.json({ error: 'Failed to fetch fund' }, { status: 500 });
    }

    return NextResponse.json({ fund });
  } catch (error) {
    console.error('Fund API error:', error);
    return NextResponse.json({ error: 'Failed to fetch fund' }, { status: 500 });
  }
}