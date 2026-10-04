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

    const { data: batch, error } = await supabase
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
          is_ai_company,
          companies!inner (
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
            verification_status
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'YC batch not found' }, { status: 404 });
      }
      console.error('YC Batch API error:', error);
      return NextResponse.json({ error: 'Failed to fetch YC batch' }, { status: 500 });
    }

    return NextResponse.json({ batch });
  } catch (error) {
    console.error('YC Batch API error:', error);
    return NextResponse.json({ error: 'Failed to fetch YC batch' }, { status: 500 });
  }
}