/**
 * Conservative automatic publication policy evaluation (D5).
 * Pure function — deterministic, no side effects.
 */

export interface SourceInfo {
  isOfficial: boolean;
  independenceGroup: string | null;
  domain: string;
}

export interface PublicationEvaluationInput {
  evidenceSources: SourceInfo[];
  extractionConfidence: number;
  resolutionConfidence: number;
  hasContradiction: boolean;
}

export interface PublicationEvaluationResult {
  status: 'published' | 'candidate';
  reason: string;
  officialCount: number;
  independentCount: number;
}

const EXTRACTION_CONFIDENCE_THRESHOLD = 0.85;
const RESOLUTION_CONFIDENCE_THRESHOLD = 0.90;

export function evaluatePublication(input: PublicationEvaluationInput): PublicationEvaluationResult {
  const { evidenceSources, extractionConfidence, resolutionConfidence, hasContradiction } = input;

  if (hasContradiction) {
    return {
      status: 'candidate',
      reason: 'Blocked: active contradictory evidence exists',
      officialCount: 0,
      independentCount: 0,
    };
  }

  if (extractionConfidence < EXTRACTION_CONFIDENCE_THRESHOLD) {
    return {
      status: 'candidate',
      reason: `Blocked: extraction confidence ${extractionConfidence} < ${EXTRACTION_CONFIDENCE_THRESHOLD}`,
      officialCount: 0,
      independentCount: 0,
    };
  }

  if (resolutionConfidence < RESOLUTION_CONFIDENCE_THRESHOLD) {
    return {
      status: 'candidate',
      reason: `Blocked: resolution confidence ${resolutionConfidence} < ${RESOLUTION_CONFIDENCE_THRESHOLD.toFixed(2)}`,
      officialCount: 0,
      independentCount: 0,
    };
  }

  let officialCount = 0;
  const independenceGroups = new Set<string>();

  for (const source of evidenceSources) {
    if (source.isOfficial) {
      officialCount++;
    }
    const groupKey = source.independenceGroup ?? source.domain;
    if (groupKey) {
      independenceGroups.add(groupKey);
    }
  }

  const independentCount = independenceGroups.size;

  if (officialCount >= 1 || independentCount >= 2) {
    return {
      status: 'published',
      reason: 'Automatic: meets conservative evidence threshold',
      officialCount,
      independentCount,
    };
  }

  return {
    status: 'candidate',
    reason: `Blocked: insufficient source support (official=${officialCount}, independent=${independentCount})`,
    officialCount,
    independentCount,
  };
}

export const PUBLICATION_THRESHOLDS = {
  EXTRACTION_CONFIDENCE: EXTRACTION_CONFIDENCE_THRESHOLD,
  RESOLUTION_CONFIDENCE: RESOLUTION_CONFIDENCE_THRESHOLD,
} as const;