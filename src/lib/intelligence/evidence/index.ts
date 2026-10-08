/**
 * Evidence Foundation Module — Checkpoint 1 (Pure Core)
 * Immutable document versions, model runs, claims, evidence spans, field bindings.
 * Zero dependencies — safe to import in tests.
 */

export * from './core';

export type {
  PersistDocumentVersionInput,
  CreateClaimWithEvidenceInput,
  GetFieldEvidenceInput,
  FieldEvidenceOutput,
  ClaimType,
  PublicationStatus,
  ModelRunKind,
  EvidenceStance,
  ResolutionMethod,
  ResolutionStatus,
} from './payloads';