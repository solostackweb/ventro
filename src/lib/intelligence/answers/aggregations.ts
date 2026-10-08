import { deterministicConfidence } from './confidence';
import { equalPreviousWindow, fingerprint } from './filters';
import type {
  AnswerCitation,
  AnswerFilters,
  AnswerInputBundle,
  AnswerSection,
  AnswerSnapshotDraft,
  InvestmentEvent,
  PatternRecordInput,
  ThesisRecordInput,
} from './types';

export const ANSWER_SCHEMA_VERSION = 'answer-snapshot-v1';
export const ANSWER_METHODOLOGY_VERSION = 'two-answer-method-v1';

function inRange(date: string, start: string, end: string): boolean {
  const value = new Date(date).getTime();
  return value >= new Date(start).getTime() && value < new Date(end).getTime();
}

function intersects(values: string[], filters: string[]): boolean {
  return filters.length === 0 || values.some(value => filters.includes(value.toLowerCase()));
}

function eligibleEvent(event: InvestmentEvent, filters: AnswerFilters): boolean {
  const participants = event.participants.filter(participant => participant.verificationStatus === 'verified' && participant.citations.length > 0);
  return event.verificationStatus === 'verified' &&
    event.citations.length > 0 &&
    participants.length > 0 &&
    (filters.domains.length === 0 || intersects(event.domains.map(value => value.toLowerCase()), filters.domains)) &&
    (filters.geographies.length === 0 || (event.geography ? filters.geographies.includes(event.geography.toLowerCase()) : false)) &&
    (filters.stages.length === 0 || (event.stage ? filters.stages.includes(event.stage.toLowerCase()) : false)) &&
    (!filters.ycBatchId || event.ycBatchId === filters.ycBatchId) &&
    (!filters.fundId || participants.some(participant => participant.fundId === filters.fundId));
}

function uniqueCitations(citations: AnswerCitation[]): AnswerCitation[] {
  const seen = new Set<string>();
  return citations.filter(citation => {
    const key = JSON.stringify(citation);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function eventCitations(event: InvestmentEvent): AnswerCitation[] {
  return uniqueCitations([
    ...event.citations,
    ...event.participants.flatMap(participant => participant.citations),
    { stance: 'supports', fundingRoundId: event.roundId, label: event.companyName },
  ]);
}

function rankedCounts(values: Array<string | null>, limit = 5): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

function percentageChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function averageCoverage(events: InvestmentEvent[]): number {
  if (events.length === 0) return 0;
  return events.reduce((sum, event) => sum + Math.max(0, Math.min(1, event.sourceCoverage)), 0) / events.length;
}

function adjustedChange(current: InvestmentEvent[], previous: InvestmentEvent[]): number | null {
  const currentCoverage = averageCoverage(current);
  const previousCoverage = averageCoverage(previous);
  if (!currentCoverage || !previousCoverage || previous.length === 0) return null;
  return percentageChange(current.length / currentCoverage, previous.length / previousCoverage);
}

function freshness(computedAt: string): string {
  return new Date(new Date(computedAt).getTime() + 24 * 60 * 60 * 1000).toISOString();
}

function baseFingerprint(kind: string, filters: AnswerFilters, bundle: AnswerInputBundle, recordIds: string[]): string {
  return fingerprint({
    kind,
    filters,
    dataCutoffAt: bundle.dataCutoffAt,
    recordIds: [...recordIds].sort(),
    schemaVersion: ANSWER_SCHEMA_VERSION,
    methodologyVersion: ANSWER_METHODOLOGY_VERSION,
  });
}

export function buildInvestingNowDraft(filters: AnswerFilters, bundle: AnswerInputBundle, now = new Date()): AnswerSnapshotDraft {
  const previousWindow = equalPreviousWindow(filters);
  const eligible = bundle.investments.filter(event => eligibleEvent(event, filters));
  const current = eligible.filter(event => inRange(event.announcedDate, filters.periodStart, filters.periodEnd));
  const previous = eligible.filter(event => inRange(event.announcedDate, previousWindow.start, previousWindow.end));
  const disclosed = current.filter(event => event.amountUsd !== null);
  const undisclosed = current.filter(event => event.amountUsd === null);
  const companyIds = new Set(current.map(event => event.companyId));
  const participants = current.flatMap(event => event.participants.filter(participant =>
    participant.verificationStatus === 'verified' && participant.citations.length > 0 && (!filters.fundId || participant.fundId === filters.fundId),
  ));
  const fundIds = new Set(participants.map(participant => participant.fundId));
  const topRounds = [...current]
    .sort((a, b) => (b.amountUsd ?? -1) - (a.amountUsd ?? -1) || b.announcedDate.localeCompare(a.announcedDate))
    .slice(0, 8);
  const evidenceCoverage = current.length ? current.filter(event => event.citations.length > 0).length / current.length : 0;
  const sourceCoverage = bundle.expectedSourceCount
    ? Math.min(1, (bundle.observedSourceCount ?? 0) / bundle.expectedSourceCount)
    : averageCoverage(current);
  const independentSources = new Set(current.flatMap(event => event.citations.map(citation => citation.claimEvidenceId).filter(Boolean))).size;
  const counterCitations = uniqueCitations(current.flatMap(event => event.citations.filter(citation => citation.stance === 'contradicts')));
  const confidence = deterministicConfidence({
    sampleSize: current.length,
    evidenceCoverage,
    sourceCoverage,
    independentSources,
    conflictRatio: current.length ? counterCitations.length / current.length : 0,
  });
  const rawChange = percentageChange(current.length, previous.length);
  const coverageAdjustedChange = adjustedChange(current, previous);
  const caveats: string[] = [];
  if (undisclosed.length > 0) caveats.push(`${undisclosed.length} verified rounds have undisclosed amounts and are excluded from the dollar total.`);
  if (current.length < 5) caveats.push('The selected window is sparse; directional conclusions should be treated as preliminary.');
  if (rawChange !== null && coverageAdjustedChange !== null && Math.abs(rawChange - coverageAdjustedChange) >= 20) {
    caveats.push('The raw period change is materially affected by source-coverage changes; use the coverage-adjusted comparison.');
  }
  if (current.length === 0) caveats.push('No qualifying published, verified investment records match these filters.');

  const sections: AnswerSection[] = [
    {
      key: 'market_flow',
      title: 'Where capital is flowing',
      position: 0,
      material: current.length > 0,
      narrative: current.length > 0
        ? `${current.length} verified rounds were identified across ${companyIds.size} companies. ${disclosed.length} disclosed rounds total $${disclosed.reduce((sum, event) => sum + (event.amountUsd ?? 0), 0).toLocaleString('en-US')}; ${undisclosed.length} rounds are undisclosed.`
        : 'There is not enough qualifying evidence to describe capital flow for this slice yet.',
      metrics: {
        roundCount: current.length,
        disclosedAmountUsd: disclosed.reduce((sum, event) => sum + (event.amountUsd ?? 0), 0),
        disclosedRoundCount: disclosed.length,
        undisclosedRoundCount: undisclosed.length,
        companyCount: companyIds.size,
        fundCount: fundIds.size,
      },
      citations: uniqueCitations(topRounds.flatMap(eventCitations)),
      whyThis: {},
    },
    {
      key: 'leading_segments',
      title: 'Leading segments',
      position: 1,
      material: current.length > 0,
      narrative: 'The rankings below count verified rounds, not mentions or article volume.',
      metrics: {
        domains: rankedCounts(current.flatMap(event => event.domains)),
        stages: rankedCounts(current.map(event => event.stage)),
        geographies: rankedCounts(current.map(event => event.geography)),
        ycBatches: rankedCounts(current.map(event => event.ycBatchId)),
        activeFunds: rankedCounts(participants.map(participant => participant.fundName)),
      },
      citations: uniqueCitations(current.slice(0, 20).flatMap(eventCitations)),
      whyThis: {},
    },
    {
      key: 'period_comparison',
      title: 'Change versus the prior equal window',
      position: 2,
      material: current.length > 0 || previous.length > 0,
      narrative: rawChange === null
        ? 'The prior equal-length window has no qualifying rounds, so a percentage change would be misleading.'
        : `Verified round count changed ${rawChange}% versus the prior equal-length window.`,
      metrics: {
        currentRoundCount: current.length,
        previousRoundCount: previous.length,
        rawChangePercent: rawChange,
        coverageAdjustedChangePercent: coverageAdjustedChange,
        currentCoverage: Number(averageCoverage(current).toFixed(4)),
        previousCoverage: Number(averageCoverage(previous).toFixed(4)),
        previousPeriodStart: previousWindow.start,
        previousPeriodEnd: previousWindow.end,
      },
      citations: uniqueCitations([...current.slice(0, 10), ...previous.slice(0, 10)].flatMap(eventCitations)),
      whyThis: {},
    },
  ];
  const computedAt = now.toISOString();
  const recordIds = eligible.map(event => event.roundId);

  return {
    kind: 'investing_now',
    filters,
    dataCutoffAt: bundle.dataCutoffAt,
    computedAt,
    staleAfter: freshness(computedAt),
    schemaVersion: ANSWER_SCHEMA_VERSION,
    methodologyVersion: ANSWER_METHODOLOGY_VERSION,
    filterFingerprint: fingerprint(filters),
    inputFingerprint: baseFingerprint('investing_now', filters, bundle, recordIds),
    summary: { headline: sections[0].narrative, rawChangePercent: rawChange, coverageAdjustedChangePercent: coverageAdjustedChange },
    counts: {
      disclosedAmountUsd: disclosed.reduce((sum, event) => sum + (event.amountUsd ?? 0), 0),
      disclosedRoundCount: disclosed.length,
      undisclosedRoundCount: undisclosed.length,
      companyCount: companyIds.size,
      fundCount: fundIds.size,
      roundCount: current.length,
      thesisCount: 0,
      patternCount: 0,
    },
    coverage: { evidenceCoverage, sourceCoverage, eligibleRoundCount: current.length, previousEligibleRoundCount: previous.length },
    confidence,
    caveats,
    counterEvidence: counterCitations.map(citation => citation.label ?? 'A cited source contradicts part of the current record.'),
    sections,
  };
}

export function isEligibleThesis(record: ThesisRecordInput, filters: AnswerFilters): boolean {
  if (record.status !== 'published' || record.citations.length === 0) return false;
  if (filters.fundId && record.fundId !== filters.fundId) return false;
  if (record.kind === 'stated') return record.officialSource && record.citations.some(citation => Boolean(citation.claimEvidenceId));
  return record.sampleSize >= 3 && record.coverageRatio > 0 && Boolean(record.methodologyVersion);
}

export function isEligiblePattern(record: PatternRecordInput, filters: AnswerFilters): boolean {
  const active = record.status === 'published' || record.status === 'corrected';
  const sameWindow = inRange(record.windowEnd, filters.periodStart, new Date(new Date(filters.periodEnd).getTime() + 1).toISOString());
  return active && sameWindow && record.sampleSize >= 3 && record.distinctCompanies >= 3 &&
    record.independentSourceCount >= 1 && Boolean(record.methodologyVersion) && Boolean(record.inputFingerprint) &&
    record.citations.some(citation => citation.stance === 'supports');
}

export function buildMarketDemandDraft(filters: AnswerFilters, bundle: AnswerInputBundle, now = new Date()): AnswerSnapshotDraft {
  const theses = bundle.theses.filter(record => isEligibleThesis(record, filters));
  const stated = theses.filter(record => record.kind === 'stated');
  const observed = theses.filter(record => record.kind === 'observed');
  const patterns = bundle.patterns.filter(record => isEligiblePattern(record, filters));
  const themeCounts = (records: ThesisRecordInput[]) => rankedCounts(records.flatMap(record => record.themes.map(theme => theme.theme)), 10);
  const statedThemes = themeCounts(stated);
  const observedThemes = themeCounts(observed);
  const recurringThemes = rankedCounts([
    ...stated.flatMap(record => record.themes.map(theme => theme.theme)),
    ...observed.flatMap(record => record.themes.map(theme => theme.theme)),
    ...patterns.map(pattern => pattern.name),
  ], 10);
  const thesisChanges = theses.flatMap(record => {
    const addedThemes = Array.isArray(record.summary.addedThemes) ? record.summary.addedThemes : [];
    const removedThemes = Array.isArray(record.summary.removedThemes) ? record.summary.removedThemes : [];
    return (addedThemes.length || removedThemes.length) ? [{ thesisRecordId: record.id, fundName: record.fundName, kind: record.kind, addedThemes, removedThemes }] : [];
  });
  const counterCitations = uniqueCitations([
    ...theses.flatMap(record => record.citations.filter(citation => citation.stance === 'contradicts')),
    ...patterns.flatMap(record => record.citations.filter(citation => citation.stance === 'contradicts')),
  ]);
  const evidenceCoverage = theses.length + patterns.length > 0
    ? (theses.filter(record => record.citations.length > 0).length + patterns.filter(record => record.citations.length > 0).length) / (theses.length + patterns.length)
    : 0;
  const sourceCoverage = bundle.expectedSourceCount
    ? Math.min(1, (bundle.observedSourceCount ?? 0) / bundle.expectedSourceCount)
    : (theses.length ? theses.reduce((sum, record) => sum + record.coverageRatio, 0) / theses.length : 0);
  const independentSources = new Set([...theses, ...patterns].flatMap(record => record.citations.map(citation => citation.claimEvidenceId).filter(Boolean))).size;
  const confidence = deterministicConfidence({
    sampleSize: theses.length + patterns.length,
    evidenceCoverage,
    sourceCoverage,
    independentSources,
    conflictRatio: theses.length + patterns.length ? counterCitations.length / (theses.length + patterns.length) : 0,
  });
  const caveatText = [
    ...new Set([...theses.flatMap(record => record.caveats), ...(patterns.length < 2 ? ['Pattern coverage is sparse for the selected slice.'] : [])]),
  ];
  if (stated.length === 0) caveatText.push('No qualifying official stated-thesis records match these filters.');
  if (observed.length === 0) caveatText.push('No qualifying observed-thesis records have sufficient verified investment coverage.');

  const statedCitations = uniqueCitations(stated.flatMap(record => [
    ...record.citations,
    { stance: 'supports' as const, thesisRecordId: record.id, label: `${record.fundName} stated thesis` },
  ]));
  const observedCitations = uniqueCitations(observed.flatMap(record => [
    ...record.citations,
    { stance: 'supports' as const, thesisRecordId: record.id, label: `${record.fundName} observed thesis` },
  ]));
  const patternCitations = uniqueCitations(patterns.flatMap(record => [
    ...record.citations,
    { stance: 'supports' as const, patternId: record.id, label: record.name },
  ]));
  const sections: AnswerSection[] = [
    {
      key: 'stated_demand',
      title: 'What investors explicitly say they want',
      position: 0,
      material: stated.length > 0,
      narrative: stated.length ? `${stated.length} published stated-thesis records from official sources qualify for this slice.` : 'No qualifying official stated-thesis evidence is available for this slice.',
      metrics: { recordCount: stated.length, themes: statedThemes },
      citations: statedCitations,
      whyThis: {},
    },
    {
      key: 'observed_demand',
      title: 'What verified investment behavior suggests',
      position: 1,
      material: observed.length > 0,
      narrative: observed.length ? `${observed.length} observed-thesis records infer demand from verified investment behavior. These are inferences, not investor quotes.` : 'There is not enough verified investment history to infer observed demand for this slice.',
      metrics: { recordCount: observed.length, themes: observedThemes, sampleSize: observed.reduce((sum, record) => sum + record.sampleSize, 0) },
      citations: observedCitations,
      whyThis: {},
    },
    {
      key: 'recurring_patterns',
      title: 'Recurring market signals',
      position: 2,
      material: patterns.length > 0,
      narrative: patterns.length ? `${patterns.length} eligible deterministic patterns add context to the thesis evidence.` : 'No pattern currently meets the publication and evidence threshold for this slice.',
      metrics: { patternCount: patterns.length, recurringThemes, patterns: patterns.map(pattern => ({ id: pattern.id, name: pattern.name, sampleSize: pattern.sampleSize })) },
      citations: patternCitations,
      whyThis: {},
    },
    {
      key: 'thesis_changes',
      title: 'Recent thesis changes',
      position: 3,
      material: thesisChanges.length > 0,
      narrative: thesisChanges.length ? `${thesisChanges.length} versioned thesis records changed their tracked themes.` : 'No evidence-backed thesis change is visible in the current records.',
      metrics: { changes: thesisChanges },
      citations: uniqueCitations(theses.filter(record => thesisChanges.some(change => change.thesisRecordId === record.id)).flatMap(record => record.citations)),
      whyThis: {},
    },
  ];
  const computedAt = now.toISOString();
  const ids = [...theses.map(record => record.id), ...patterns.map(record => record.id)];
  return {
    kind: 'market_demand',
    filters,
    dataCutoffAt: bundle.dataCutoffAt,
    computedAt,
    staleAfter: freshness(computedAt),
    schemaVersion: ANSWER_SCHEMA_VERSION,
    methodologyVersion: ANSWER_METHODOLOGY_VERSION,
    filterFingerprint: fingerprint(filters),
    inputFingerprint: baseFingerprint('market_demand', filters, bundle, ids),
    summary: {
      headline: 'Official statements and observed behavior are reported separately.',
      statedThemes,
      observedThemes,
      recurringThemes,
    },
    counts: {
      disclosedAmountUsd: 0,
      disclosedRoundCount: 0,
      undisclosedRoundCount: 0,
      companyCount: 0,
      fundCount: new Set(theses.map(record => record.fundId)).size,
      roundCount: observed.reduce((sum, record) => sum + record.sampleSize, 0),
      thesisCount: theses.length,
      patternCount: patterns.length,
    },
    coverage: { evidenceCoverage, sourceCoverage, statedCount: stated.length, observedCount: observed.length, eligiblePatternCount: patterns.length },
    confidence,
    caveats: caveatText,
    counterEvidence: [
      ...theses.flatMap(record => record.counterEvidence),
      ...counterCitations.map(citation => citation.label ?? 'Published counter-evidence is attached to this answer.'),
    ],
    sections,
  };
}

export function buildBothAnswerDrafts(filters: AnswerFilters, bundle: AnswerInputBundle, now = new Date()): AnswerSnapshotDraft[] {
  return [buildInvestingNowDraft(filters, bundle, now), buildMarketDemandDraft(filters, bundle, now)];
}
