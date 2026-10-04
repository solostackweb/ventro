import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const status = searchParams.get('status');
    const minConfidence = searchParams.get('min_confidence');
    const timeWindowStart = searchParams.get('time_window_start');
    const timeWindowEnd = searchParams.get('time_window_end');

    const supabase = await createServerClient();

    let query = supabase
      .from('patterns')
      .select(`
        id,
        name,
        description,
        time_window_start,
        time_window_end,
        baseline_value,
        current_value,
        change_percentage,
        distinct_companies,
        distinct_funds,
        qualifying_events,
        counterexamples,
        confidence,
        coverage_notes,
        status,
        source_links,
        created_by,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at
      `, { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }
    if (minConfidence) {
      query = query.in('confidence', minConfidence.split(',').filter(Boolean));
    }
    if (timeWindowStart) {
      query = query.gte('time_window_start', timeWindowStart);
    }
    if (timeWindowEnd) {
      query = query.lte('time_window_end', timeWindowEnd);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: patterns, error, count } = await query;

    if (error) {
      console.error('Patterns API error:', error);
      return NextResponse.json({ error: 'Failed to fetch patterns' }, { status: 500 });
    }

    return NextResponse.json({
      patterns: patterns || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: offset + limit < (count || 0),
      },
    });
  } catch (error) {
    console.error('Patterns API error:', error);
    return NextResponse.json({ error: 'Failed to fetch patterns' }, { status: 500 });
  }
}