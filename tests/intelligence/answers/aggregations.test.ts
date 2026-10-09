import { buildInvestingNowDraft, buildMarketDemandDraft, isEligiblePattern, isEligibleThesis } from '@/lib/intelligence/answers/aggregations';
import { bundle, filters, investment, pattern, thesis } from './fixtures';

describe('investing-now aggregation', () => {
  it('counts undisclosed rounds separately and never adds them as zero-valued disclosures', () => {
    const draft = buildInvestingNowDraft(filters, bundle({ investments: [investment(), investment({ roundId: '2', amountUsd: null })] }));
    expect(draft.counts.disclosedAmountUsd).toBe(5_000_000);
    expect(draft.counts.disclosedRoundCount).toBe(1);
    expect(draft.counts.undisclosedRoundCount).toBe(1);
    expect(draft.counts.roundCount).toBe(2);
    expect(draft.caveats.join(' ')).toMatch(/undisclosed/i);
  });

  it('accepts participant evidence while excluding unverified and fully uncited events', () => {
    const draft = buildInvestingNowDraft(filters, bundle({ investments: [
      investment({ roundId: '1' }),
      investment({ roundId: '2', verificationStatus: 'partial' }),
      investment({ roundId: '3', citations: [] }),
      investment({ roundId: '4', participants: [{ ...investment().participants[0], verificationStatus: 'partial' }] }),
      investment({ roundId: '5', citations: [], participants: [{ ...investment().participants[0], citations: [] }] }),
    ] }));
    expect(draft.counts.roundCount).toBe(2);
  });

  it('applies domain, geography, stage, YC, and fund filters together', () => {
    const scoped = { ...filters, domains: ['agents'], geographies: ['us'], stages: ['seed'], ycBatchId: 'S26', fundId: investment().participants[0].fundId };
    expect(buildInvestingNowDraft(scoped, bundle()).counts.roundCount).toBe(1);
    expect(buildInvestingNowDraft({ ...scoped, stages: ['series_a'] }, bundle()).counts.roundCount).toBe(0);
  });

  it('compares the prior equal window and exposes coverage-adjusted change', () => {
    const previous = investment({ roundId: '9', announcedDate: '2026-05-15T00:00:00.000Z', sourceCoverage: 0.5 });
    const draft = buildInvestingNowDraft(filters, bundle({ investments: [investment({ sourceCoverage: 1 }), previous] }));
    const comparison = draft.sections.find(section => section.key === 'period_comparison');
    expect(comparison?.metrics.previousRoundCount).toBe(1);
    expect(comparison?.metrics.rawChangePercent).toBe(0);
    expect(comparison?.metrics.coverageAdjustedChangePercent).toBe(-50);
  });

  it('returns an honest sparse state', () => {
    const draft = buildInvestingNowDraft(filters, bundle({ investments: [] }));
    expect(draft.counts.roundCount).toBe(0);
    expect(draft.confidence.label).toBe('low');
    expect(draft.sections.every(section => section.material === false)).toBe(true);
  });
});

describe('market-demand aggregation', () => {
  it('keeps stated and observed thesis in separate labeled sections', () => {
    const draft = buildMarketDemandDraft(filters, bundle());
    expect(draft.sections[0].key).toBe('stated_demand');
    expect(draft.sections[1].key).toBe('observed_demand');
    expect(draft.sections[1].narrative).toMatch(/inferences, not investor quotes/i);
  });

  it('requires official exact evidence for stated thesis', () => {
    expect(isEligibleThesis(thesis({ officialSource: false }), filters)).toBe(false);
    expect(isEligibleThesis(thesis({ citations: [{ stance: 'supports', claimId: 'claim-only' }] }), filters)).toBe(false);
  });

  it('requires sufficient deterministic observed-thesis coverage', () => {
    expect(isEligibleThesis(thesis({ kind: 'observed', sampleSize: 2, periodStart: filters.periodStart, periodEnd: filters.periodEnd }), filters)).toBe(false);
  });

  it('excludes invalid or candidate patterns', () => {
    expect(isEligiblePattern(pattern({ status: 'candidate' }), filters)).toBe(false);
    expect(isEligiblePattern(pattern({ methodologyVersion: null }), filters)).toBe(false);
    expect(isEligiblePattern(pattern({ independentSourceCount: 0 }), filters)).toBe(false);
  });

  it('surfaces published counter-evidence without turning it into a positive conclusion', () => {
    const contradicted = thesis({ counterEvidence: ['The fund paused deployment in this segment.'], citations: [{ stance: 'contradicts', claimEvidenceId: 'evidence-1' }] });
    const draft = buildMarketDemandDraft(filters, bundle({ theses: [contradicted] }));
    expect(draft.counterEvidence.join(' ')).toMatch(/paused deployment/i);
    expect(draft.sections[0].material).toBe(true);
  });
});
