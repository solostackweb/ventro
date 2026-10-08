/**
 * Pure Evidence Core — zero dependencies, zero side effects.
 * Importable in tests without environment variables.
 */

import { canonicalizeUrl } from './canonical-url';
import { normalizeText, computeContentHash, NORMALIZATION_VERSION } from './normalization';
import { validateSpan, findExactSpan, findSpans, createEvidenceItem, type EvidenceSpan, type SpanValidationResult } from './spans';
import { evaluatePublication, type PublicationEvaluationInput, type PublicationEvaluationResult, PUBLICATION_THRESHOLDS } from './publication';
import { calculateIndependentSourceCount, areSourcesIndependent, getUniqueIndependenceGroups, type SourceIdentity } from './independence';

export {
  canonicalizeUrl,
  normalizeText,
  computeContentHash,
  NORMALIZATION_VERSION,
  validateSpan,
  findExactSpan,
  findSpans,
  createEvidenceItem,
  evaluatePublication,
  calculateIndependentSourceCount,
  areSourcesIndependent,
  getUniqueIndependenceGroups,
  PUBLICATION_THRESHOLDS,
};

export const evidenceCore = {
  canonicalizeUrl,
  normalizeText,
  computeContentHash,
  NORMALIZATION_VERSION,
  validateSpan,
  findExactSpan,
  findSpans,
  createEvidenceItem,
  evaluatePublication,
  calculateIndependentSourceCount,
  areSourcesIndependent,
  getUniqueIndependenceGroups,
};

export type {
  CanonicalUrlResult,
} from './canonical-url';

export type {
  NormalizedTextResult,
} from './normalization';

export type {
  EvidenceSpan,
  SpanValidationResult,
} from './spans';

export type {
  PublicationEvaluationInput,
  PublicationEvaluationResult,
} from './publication';

export type {
  SourceIdentity,
} from './independence';