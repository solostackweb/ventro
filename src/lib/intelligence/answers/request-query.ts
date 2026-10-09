export interface DashboardAnswerFilters {
  period: string;
  domain: string;
  geography: string;
  stage: string;
}

const SUPPORTED_PERIOD_DAYS = new Set([30, 90, 180, 365]);

export function buildDashboardAnswerQuery(filters: DashboardAnswerFilters, now = new Date()): URLSearchParams {
  const requestedPeriod = Number(filters.period);
  const periodDays = SUPPORTED_PERIOD_DAYS.has(requestedPeriod) ? requestedPeriod : 90;
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const periodStart = new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const query = new URLSearchParams({
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    kind: 'both',
  });

  if (filters.domain) query.set('domains', filters.domain);
  if (filters.geography) query.set('geographies', filters.geography);
  if (filters.stage) query.set('stages', filters.stage);
  return query;
}
