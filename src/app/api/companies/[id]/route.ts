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

    const { data: company, error } = await supabase
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
        updated_at,
        company_aliases (
          id,
          alias,
          alias_type,
          created_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Company not found' }, { status: 404 });
      }
      console.error('Company API error:', error);
      return NextResponse.json({ error: 'Failed to fetch company' }, { status: 500 });
    }

    return NextResponse.json({ company });
  } catch (error) {
    console.error('Company API error:', error);
    return NextResponse.json({ error: 'Failed to fetch company' }, { status: 500 });
  }
}