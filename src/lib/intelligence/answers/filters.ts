import { z } from 'zod';
import type { AnswerFilters } from './types';
export { fingerprint, stableJson } from './hash';

const list = z.array(z.string().trim().min(1).max(80)).max(20).default([]);
const optionalUuid = z.string().uuid().nullable().default(null);

export const answerFiltersSchema = z.object({
  periodStart: z.string().datetime({ offset: true }),
  periodEnd: z.string().datetime({ offset: true }),
  domains: list,
  geographies: list,
  stages: list,
  fundId: optionalUuid,
  ycBatchId: z.string().trim().min(1).max(20).nullable().default(null),
}).superRefine((value, ctx) => {
  if (new Date(value.periodEnd) <= new Date(value.periodStart)) {
    ctx.addIssue({ code: 'custom', path: ['periodEnd'], message: 'periodEnd must be after periodStart' });
  }
  const maxWindowMs = 730 * 24 * 60 * 60 * 1000;
  if (new Date(value.periodEnd).getTime() - new Date(value.periodStart).getTime() > maxWindowMs) {
    ctx.addIssue({ code: 'custom', path: ['periodEnd'], message: 'answer window cannot exceed 730 days' });
  }
});

function normalizedList(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim().toLowerCase()).filter(Boolean))].sort();
}

export function normalizeAnswerFilters(input: unknown): AnswerFilters {
  const parsed = answerFiltersSchema.parse(input);
  return {
    ...parsed,
    periodStart: new Date(parsed.periodStart).toISOString(),
    periodEnd: new Date(parsed.periodEnd).toISOString(),
    domains: normalizedList(parsed.domains),
    geographies: normalizedList(parsed.geographies),
    stages: normalizedList(parsed.stages),
  };
}

export function parseAnswerFilters(searchParams: URLSearchParams, now = new Date()): AnswerFilters {
  // Scheduled snapshots use a daily UTC boundary. Keeping the default request on
  // the same boundary prevents a new filter fingerprint from being created on
  // every page load while still allowing callers to request exact custom windows.
  const dailyBoundary = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const periodEnd = searchParams.get('period_end') ?? dailyBoundary;
  const defaultStart = new Date(new Date(periodEnd).getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const split = (key: string) => (searchParams.get(key) ?? '').split(',').filter(Boolean);
  return normalizeAnswerFilters({
    periodStart: searchParams.get('period_start') ?? defaultStart,
    periodEnd,
    domains: split('domains'),
    geographies: split('geographies'),
    stages: split('stages'),
    fundId: searchParams.get('fund_id'),
    ycBatchId: searchParams.get('yc_batch'),
  });
}

export function equalPreviousWindow(filters: AnswerFilters): { start: string; end: string } {
  const start = new Date(filters.periodStart).getTime();
  const end = new Date(filters.periodEnd).getTime();
  const duration = end - start;
  return { start: new Date(start - duration).toISOString(), end: new Date(start).toISOString() };
}
