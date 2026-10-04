import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const supabase = await createServerClient();

    // Get funding rounds from investment_graph
    const { data: rounds, error: roundsError } = await supabase
      .from('investment_graph')
      .select(`
        round_id,
        announced_date,
        round_stage,
        amount_usd,
        amount_currency,
        round_verification,
        fund_name,
        firm_type,
        vehicle_name,
        vintage_year,
        participant_role,
        participant_amount_usd,
        participant_verification,
        round_sources
      `)
      .eq('company_id', id)
      .order('announced_date', { ascending: false })
      .limit(limit);

    if (roundsError) {
      console.error('Company timeline funding error:', roundsError);
    }

    // Get story mentions
    const { data: stories, error: storiesError } = await supabase
      .from('stories')
      .select(`
        id,
        headline,
        summary,
        event_date,
        publisher,
        event_type,
        verification_label,
        source_count,
        source_urls,
        story_investors (fund_id, funds!inner (canonical_name), role)
      `)
      .contains('story_companies.company_id', [id])
      .order('event_date', { ascending: false })
      .limit(limit);

    if (storiesError) {
      console.error('Company timeline stories error:', storiesError);
    }

    // Combine and sort timeline events
    const timeline: any[] = [];

    // Add funding rounds
    for (const round of rounds || []) {
      timeline.push({
        type: 'funding_round',
        date: round.announced_date,
        title: `${round.round_stage?.replace('_', ' ')} — ${round.amount_usd ? `$${(round.amount_usd / 1e6).toFixed(1)}M` : 'Undisclosed'}`,
        details: {
          stage: round.round_stage,
          amount_usd: round.amount_usd,
          amount_currency: round.amount_currency,
          round_verification: round.round_verification,
          fund_name: round.fund_name,
          firm_type: round.firm_type,
          vehicle_name: round.vehicle_name,
          vintage_year: round.vintage_year,
          participant_role: round.participant_role,
          participant_amount_usd: round.participant_amount_usd,
          participant_verification: round.participant_verification,
          sources: round.round_sources || [],
        },
      });
    }

    // Add story mentions
    for (const story of stories || []) {
      timeline.push({
        type: 'news_mention',
        date: story.event_date,
        title: story.headline,
        details: {
          summary: story.summary,
          publisher: story.publisher,
          event_type: story.event_type,
          verification_label: story.verification_label,
          source_count: story.source_count,
          source_urls: story.source_urls,
          investors: story.story_investors || [],
        },
      });
    }

    // Sort by date descending
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ timeline: timeline.slice(0, limit) });
  } catch (error) {
    console.error('Company timeline API error:', error);
    return NextResponse.json({ error: 'Failed to fetch company timeline' }, { status: 500 });
  }
}