import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function adminClient() {
  const client = await createServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { status: 401 as const, client };
  // Profile fields are user-editable; only server-managed membership is trusted.
  const { ingestionSupabase } = await import('@/lib/supabase/ingestion');
  const { data: admin, error } = await ingestionSupabase.from('admin_users')
    .select('user_id').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (!admin) return { status: 403 as const, client };
  return { status: 200 as const, client, service: ingestionSupabase };
}

export async function GET() {
  let auth;
  try { auth = await adminClient(); } catch {
    return NextResponse.json({ error: 'Review service unavailable' }, { status: 503 });
  }
  if (auth.status !== 200) return NextResponse.json(
    { error: auth.status === 401 ? 'Unauthorized' : 'Admin access required' },
    { status: auth.status },
  );
  try {
    const ingestionSupabase = auth.service;
    const [stories, rounds, participants, patterns, history] = await Promise.all([
      ingestionSupabase.from('stories').select('id,headline,summary,publisher,canonical_url,source_urls,verification_label,created_at')
        .in('verification_label', ['unverified', 'partial', 'conflicted']).order('created_at', { ascending: false }).limit(100),
      ingestionSupabase.from('funding_rounds').select('id,company_id,round_stage,amount_usd,announced_date,source_urls,verification_status,created_at')
        .in('verification_status', ['unverified', 'partial', 'conflicted']).order('created_at', { ascending: false }).limit(100),
      ingestionSupabase.from('round_participants').select('id,round_id,fund_id,role,source_urls,verification_status,created_at')
        .in('verification_status', ['unverified', 'partial', 'conflicted']).order('created_at', { ascending: false }).limit(100),
      ingestionSupabase.from('patterns').select('id,name,description,source_links,qualifying_events,status,created_at')
        .in('status', ['candidate', 'corrected']).order('created_at', { ascending: false }).limit(100),
      ingestionSupabase.from('admin_review_events').select('id,item_kind,item_id,reviewer_id,previous_status,new_status,reason,reviewed_at')
        .order('reviewed_at', { ascending: false }).limit(20),
    ]);
    const failed = [stories, rounds, participants, patterns, history].find(result => result.error);
    if (failed?.error) {
      console.error('Admin review queue query failed:', failed.error);
      return NextResponse.json({ error: 'Review queue unavailable; check the review migration' }, { status: 503 });
    }
    return NextResponse.json({
      stories: stories.data ?? [], rounds: rounds.data ?? [],
      participants: participants.data ?? [], patterns: patterns.data ?? [],
      history: history.data ?? [],
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Admin review queue failed:', error);
    return NextResponse.json({ error: 'Review queue unavailable' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let auth;
  try { auth = await adminClient(); } catch {
    return NextResponse.json({ error: 'Review service unavailable' }, { status: 503 });
  }
  if (auth.status !== 200) return NextResponse.json(
    { error: auth.status === 401 ? 'Unauthorized' : 'Admin access required' },
    { status: auth.status },
  );
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid review' }, { status: 400 });
  const { kind, id, expectedStatus, newStatus, reason } = body as Record<string, unknown>;
  const kinds = ['story', 'funding_round', 'round_participant', 'pattern'];
  if (typeof kind !== 'string' || !kinds.includes(kind) || typeof id !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    || typeof expectedStatus !== 'string' || typeof newStatus !== 'string'
    || typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 1000) {
    return NextResponse.json({ error: 'Review needs a valid item, states and 10-1000 character reason' }, { status: 400 });
  }
  const { data, error } = await auth.client.rpc('admin_review_candidate', {
    p_kind: kind, p_id: id, p_expected_status: expectedStatus,
    p_new_status: newStatus, p_reason: reason.trim(),
  });
  if (error) {
    const status = error.code === '40001' ? 409 : error.code === 'P0002' ? 404
      : error.code === '42501' ? 403 : error.code === '22023' ? 400 : 503;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ review_event_id: data }, { headers: { 'Cache-Control': 'no-store' } });
}
