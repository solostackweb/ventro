import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

async function adminClient() {
  const client = await createServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { status: 401 as const, client };
  const { ingestionSupabase } = await import('@/lib/supabase/ingestion');
  const { data: admin, error } = await ingestionSupabase.from('admin_users')
    .select('user_id').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (!admin) return { status: 403 as const, client };
  return { status: 200 as const, client, service: ingestionSupabase };
}

function validateAction(action: string): string {
  const validActions = ['runs', 'stages', 'queue', 'stale-leases', 'source-health', 'model-metrics', 'publication-stats'];
  if (!validActions.includes(action)) throw new Error('Invalid action');
  return action;
}

function validatePipelineType(type?: string): string | undefined {
  if (!type) return undefined;
  const validTypes = ['news_ingestion', 'funding_extraction', 'thesis_extraction', 'pattern_detection', 'entity_sync', 'full_refresh'];
  if (!validTypes.includes(type)) throw new Error('Invalid pipeline type');
  return type;
}

function validateUUID(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('Invalid UUID format');
  }
  return id;
}

function validateReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length < 10 || trimmed.length > 1000) {
    throw new Error('Reason must be 10-1000 characters');
  }
  return trimmed;
}

export async function GET(request: NextRequest) {
  let auth;
  try { auth = await adminClient(); } catch {
    return NextResponse.json({ error: 'Pipeline diagnostics unavailable' }, { status: 503 });
  }
  if (auth.status !== 200) return NextResponse.json(
    { error: auth.status === 401 ? 'Unauthorized' : 'Admin access required' },
    { status: auth.status },
  );

  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action') || 'runs';

  try {
    switch (validateAction(action)) {
      case 'runs': {
        const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
        const pipelineType = validatePipelineType(searchParams.get('pipeline_type') || undefined);
        const { data, error } = await auth.service.rpc('get_recent_pipeline_runs', {
          p_limit: limit,
          p_pipeline_type: pipelineType as any,
        });
        if (error) throw error;
        return NextResponse.json({ runs: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
      }

      case 'stages': {
        const runId = validateUUID(searchParams.get('run_id') || '');
        const { data, error } = await auth.service.rpc('get_pipeline_run_stages', { p_run_id: runId });
        if (error) throw error;
        return NextResponse.json({ stages: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
      }

      case 'queue': {
        const { data, error } = await auth.service.rpc('get_pipeline_queue_counts');
        if (error) throw error;
        return NextResponse.json({ queues: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
      }

      case 'stale-leases': {
        const thresholdMinutes = Math.min(Math.max(parseInt(searchParams.get('threshold_minutes') || '10', 10), 1), 1440);
        const { data, error } = await auth.service.rpc('get_stale_leases', { p_threshold_minutes: thresholdMinutes });
        if (error) throw error;
        return NextResponse.json({ stale_leases: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
      }

      case 'source-health': {
        const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
        const { data, error } = await auth.service.rpc('get_source_health', { p_limit: limit });
        if (error) throw error;
        return NextResponse.json({ sources: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
      }

      case 'model-metrics': {
        const sinceParam = searchParams.get('since');
        const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (isNaN(since.getTime())) throw new Error('Invalid since date');
        const runKind = searchParams.get('run_kind') || undefined;
        const { data, error } = await auth.service.rpc('get_model_run_metrics', {
          p_since: since.toISOString(),
          p_run_kind: runKind as any,
        });
        if (error) throw error;
        return NextResponse.json({ metrics: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
      }

      case 'publication-stats': {
        const sinceParam = searchParams.get('since');
        const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (isNaN(since.getTime())) throw new Error('Invalid since date');
        const { data, error } = await auth.service.rpc('get_publication_stats', { p_since: since.toISOString() });
        if (error) throw error;
        return NextResponse.json({ stats: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Pipeline diagnostics error:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message.includes('Invalid') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  let auth;
  try { auth = await adminClient(); } catch {
    return NextResponse.json({ error: 'Pipeline admin unavailable' }, { status: 503 });
  }
  if (auth.status !== 200) return NextResponse.json(
    { error: auth.status === 401 ? 'Unauthorized' : 'Admin access required' },
    { status: auth.status },
  );

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { action } = body as Record<string, unknown>;
  if (!action || typeof action !== 'string') return NextResponse.json({ error: 'Missing action' }, { status: 400 });

  try {
    switch (action) {
      case 'replay-dead-letter': {
        const { attempt_id, reason } = body as Record<string, unknown>;
        if (!attempt_id || typeof attempt_id !== 'string' || !reason || typeof reason !== 'string') {
          return NextResponse.json({ error: 'attempt_id and reason required' }, { status: 400 });
        }
        validateUUID(attempt_id);
        validateReason(reason);
        const { data, error } = await auth.service.rpc('replay_dead_letter', {
          p_attempt_id: attempt_id,
          p_reason: reason,
        });
        if (error) throw error;
        return NextResponse.json({ replayed: data });
      }

      case 'finalize-run': {
        const { run_id, status, failure_summary } = body as Record<string, unknown>;
        if (!run_id || typeof run_id !== 'string') {
          return NextResponse.json({ error: 'run_id required' }, { status: 400 });
        }
        validateUUID(run_id);
        const validStatuses = ['completed', 'failed', 'partial', 'cancelled'];
        if (status && typeof status === 'string' && !validStatuses.includes(status)) {
          return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }
        const { error } = await auth.service.rpc('finalize_pipeline_run', {
          p_run_id: run_id,
          p_status: (status as any) ?? 'completed',
          p_failure_summary: failure_summary ?? null,
        });
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Pipeline admin action error:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message.includes('Invalid') || message.includes('format') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
