import { ingestionSupabase } from '@/lib/supabase/ingestion';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const sourceId = searchParams.get('source_id');

    let query = ingestionSupabase
      .from('source_fetch_logs')
      .select('id, source_id, url, fetched_at, status, error_message, items_found, items_new, items_updated, latency_ms')
      .order('fetched_at', { ascending: false })
      .limit(limit);

    if (sourceId) {
      query = query.eq('source_id', sourceId);
    }

    const { data: logs, error } = await query;

    if (error) throw error;

    return NextResponse.json({ logs: logs || [] });
  } catch (error) {
    console.error('Admin logs API error:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}