import type { ConfidenceLabel } from './types';

export function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= 0.8) return 'high';
  if (score >= 0.55) return 'medium';
  return 'low';
}

export function deterministicConfidence(input: {
  sampleSize: number;
  evidenceCoverage: number;
  sourceCoverage: number;
  independentSources: number;
  conflictRatio: number;
}): { score: number; label: ConfidenceLabel } {
  const sample = Math.min(1, input.sampleSize / 20);
  const independence = Math.min(1, input.independentSources / 5);
  const conflictPenalty = Math.min(0.5, Math.max(0, input.conflictRatio) * 0.5);
  const score = Math.max(0, Math.min(1,
    sample * 0.25 +
    Math.max(0, Math.min(1, input.evidenceCoverage)) * 0.35 +
    Math.max(0, Math.min(1, input.sourceCoverage)) * 0.2 +
    independence * 0.2 -
    conflictPenalty,
  ));
  const rounded = Number(score.toFixed(4));
  return { score: rounded, label: confidenceLabel(rounded) };
}
