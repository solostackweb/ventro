import type { AnswerFilters, AnswerInputBundle, InvestmentEvent, PatternRecordInput, ThesisRecordInput } from '@/lib/intelligence/answers/types';

export const filters: AnswerFilters = {
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-10-01T00:00:00.000Z',
  domains: [],
  geographies: [],
  stages: [],
  fundId: null,
  ycBatchId: null,
};

const citation = (id: string, stance: 'supports' | 'contradicts' = 'supports') => ({
  stance,
  claimId: `00000000-0000-4000-8000-${id.padStart(12, '0')}`,
  claimEvidenceId: `10000000-0000-4000-8000-${id.padStart(12, '0')}`,
});

export function investment(overrides: Partial<InvestmentEvent> = {}): InvestmentEvent {
  const suffix = String(overrides.roundId ?? '1').replace(/\D/g, '').slice(-12).padStart(12, '0');
  return {
    roundId: `20000000-0000-4000-8000-${suffix}`,
    companyId: `30000000-0000-4000-8000-${suffix}`,
    companyName: `Company ${suffix}`,
    announcedDate: '2026-08-15T00:00:00.000Z',
    stage: 'seed',
    amountUsd: 5_000_000,
    geography: 'us',
    domains: ['agents'],
    ycBatchId: 'S26',
    verificationStatus: 'verified',
    sourceCoverage: 1,
    citations: [citation(suffix)],
    participants: [{
      participantId: `40000000-0000-4000-8000-${suffix}`,
      fundId: `50000000-0000-4000-8000-${suffix}`,
      fundName: `Fund ${suffix}`,
      role: 'lead',
      verificationStatus: 'verified',
      citations: [citation(`${Number(suffix) + 100}`)],
    }],
    ...overrides,
  };
}

export function thesis(overrides: Partial<ThesisRecordInput> = {}): ThesisRecordInput {
  return {
    id: '60000000-0000-4000-8000-000000000001',
    fundId: '50000000-0000-4000-8000-000000000001',
    fundName: 'Evidence Ventures',
    kind: 'stated',
    status: 'published',
    periodStart: null,
    periodEnd: null,
    methodologyVersion: 'thesis-v1',
    sampleSize: 0,
    coverageRatio: 1,
    confidenceScore: 0.9,
    themes: [{ theme: 'agent infrastructure' }],
    summary: {},
    caveats: [],
    counterEvidence: [],
    officialSource: true,
    citations: [{ ...citation('201'), thesisRecordId: '60000000-0000-4000-8000-000000000001' }],
    ...overrides,
  };
}

export function pattern(overrides: Partial<PatternRecordInput> = {}): PatternRecordInput {
  return {
    id: '70000000-0000-4000-8000-000000000001',
    name: 'Agent infrastructure acceleration',
    description: 'Verified acceleration in agent infrastructure rounds.',
    status: 'published',
    windowStart: '2026-07-01T00:00:00.000Z',
    windowEnd: '2026-09-30T00:00:00.000Z',
    baselineStart: '2026-04-01T00:00:00.000Z',
    baselineEnd: '2026-07-01T00:00:00.000Z',
    sampleSize: 8,
    distinctCompanies: 7,
    distinctFunds: 5,
    independentSourceCount: 3,
    methodologyVersion: 'pattern-v1',
    inputFingerprint: 'a'.repeat(64),
    coverageMetrics: { ratio: 0.8 },
    counterexamples: [],
    sensitivity: { threshold: 0.5 },
    filters: {},
    citations: [{ ...citation('301'), patternId: '70000000-0000-4000-8000-000000000001' }],
    ...overrides,
  };
}

export function bundle(overrides: Partial<AnswerInputBundle> = {}): AnswerInputBundle {
  return {
    investments: [investment()],
    theses: [
      thesis(),
      thesis({
        id: '60000000-0000-4000-8000-000000000002',
        kind: 'observed',
        periodStart: filters.periodStart,
        periodEnd: filters.periodEnd,
        sampleSize: 8,
        coverageRatio: 0.8,
        themes: [{ theme: 'vertical agents', dealCount: 5, companyCount: 5, percentage: 62.5 }],
        officialSource: false,
      }),
    ],
    patterns: [pattern()],
    dataCutoffAt: '2026-10-01T00:05:00.000Z',
    expectedSourceCount: 10,
    observedSourceCount: 8,
    ...overrides,
  };
}
