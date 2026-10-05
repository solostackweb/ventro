import { ingestionSupabase } from '@/lib/supabase/ingestion';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get all source connectors
    const { data: sources, error: sourcesError } = await ingestionSupabase
      .from('source_connectors')
      .select('source_id, name, category, access_method, status, cadence, rate_limit, reuse_permission, updated_at')
      .order('source_id');

    if (sourcesError) throw sourcesError;

    // Get fetch logs for health calculation
    const { data: logs, error: logsError } = await ingestionSupabase
      .from('source_fetch_logs')
      .select('source_id, fetched_at, status, items_found, items_new, items_updated, latency_ms')
      .order('fetched_at', { ascending: false })
      .limit(1000);

    if (logsError) throw logsError;

    // Calculate health metrics per source
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const sourceMetrics = new Map<string, {
      lastFetch: string | null;
      status: 'success' | 'error' | 'partial' | 'unchanged' | null;
      health: number;
      items24h: number;
      yield24h: number;
      totalLatency: number;
      logCount: number;
    }>();

    // Initialize metrics for all sources
    for (const source of sources || []) {
      sourceMetrics.set(source.source_id, {
        lastFetch: null,
        status: null,
        health: 100,
        items24h: 0,
        yield24h: 0,
        totalLatency: 0,
        logCount: 0,
      });
    }

    // Process logs
    for (const log of logs || []) {
      const metrics = sourceMetrics.get(log.source_id);
      if (!metrics) continue;

      if (!metrics.lastFetch) {
        metrics.lastFetch = log.fetched_at;
        metrics.status = log.status as any;
      }

      if (metrics.logCount < 20) { // Last 20 logs for health
        if (log.status === 'success') {
          metrics.health = Math.min(100, metrics.health + 2);
        } else if (log.status === 'error') {
          metrics.health = Math.max(0, metrics.health - 15);
        } else if (log.status === 'partial') {
          metrics.health = Math.max(0, metrics.health - 5);
        }
        metrics.totalLatency += log.latency_ms || 0;
        metrics.logCount++;
      }

      // 24h stats
      if (new Date(log.fetched_at) > twentyFourHoursAgo) {
        metrics.items24h += log.items_found || 0;
        metrics.yield24h += (log.items_new || 0) + (log.items_updated || 0);
      }
    }

    // Build response
    const enrichedSources = (sources || []).map((source) => {
      const metrics = sourceMetrics.get(source.source_id) || {
        lastFetch: null,
        status: null,
        health: 100,
        items24h: 0,
        yield24h: 0,
        totalLatency: 0,
        logCount: 0,
      };

      return {
        source_id: source.source_id,
        name: source.name,
        method: source.access_method?.toUpperCase() || 'RSS',
        status: source.status === 'approved' ? 'active' : source.status,
        last_fetch: metrics.lastFetch ? formatRelativeTime(metrics.lastFetch) : 'Never',
        health: metrics.health,
        items_24h: metrics.items24h,
        yield_24h: metrics.yield24h,
        avg_latency_ms: metrics.logCount > 0 ? Math.round(metrics.totalLatency / metrics.logCount) : 0,
      };
    });

    return NextResponse.json({ sources: enrichedSources });
  } catch (error) {
    console.error('Admin sources API error:', error);
    return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 });
  }
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}