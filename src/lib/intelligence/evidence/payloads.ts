/**
 * Typed database payloads for evidence operations.
 * Pure TypeScript types — no runtime code.
 */

import type { CanonicalUrlResult } from './canonical-url';
import type { NormalizedTextResult } from './normalization';
import type { EvidenceSpan } from './spans';

export type ClaimType =
  | 'funding_amount'
  | 'funding_stage'
  | 'announced_date'
  | 'investor_participation'
  | 'investor_role'
  | 'thesis_statement'
  | 'company_stage'
  | 'yc_batch'
  | 'other';

export type PublicationStatus = 'candidate' | 'published' | 'corrected' | 'retracted' | 'rejected';

export type EvidenceStance = 'supports' | 'contradicts' | 'context';

export type ModelRunKind =
  | 'deterministic_extraction'
  | 'model_extraction'
  | 'classification'
  | 'resolution'
  | 'narration';

export type ResolutionMethod = 'deterministic' | 'model' | 'manual';
export type ResolutionStatus = 'accepted' | 'rejected' | 'overridden';

export interface SourceDocumentPayload {
  source_id: string;
  canonical_url: string;
  url_hash: string;
  domain: string;
  title: string | null;
  publisher: string | null;
  first_seen_at: string;
  last_fetched_at: string;
  latest_version_id: string | null;
}

export interface DocumentVersionPayload {
  source_document_id: string;
  content_hash: string;
  normalization_version: number;
  normalized_text: string;
  normalized_text_checksum: string;
  fetched_at: string;
  published_at: string | null;
  r2_key: string | null;
  r2_url: string | null;
  rights_snapshot: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  supersedes_version_id: string | null;
}

export interface ModelRunPayload {
  run_kind: ModelRunKind;
  provider: string | null;
  model: string | null;
  prompt_version: string | null;
  schema_version: string | null;
  implementation_version: string;
  input_checksum: string;
  document_version_id: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  latency_ms: number | null;
  cost_usd: number | null;
  status: 'success' | 'partial' | 'failed';
  failure_reason: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface ClaimPayload {
  subject_type: 'funding_round' | 'round_participant' | 'company' | 'fund' | 'thesis' | 'pattern';
  subject_id: string;
  claim_type: ClaimType;
  predicate: string;
  value_json: Record<string, unknown>;
  effective_at: string | null;
  extraction_confidence: number;
  resolution_confidence: number;
  publication_status: PublicationStatus;
  model_run_id: string;
  superseded_by_claim_id: string | null;
  publication_reason: string | null;
  published_at: string | null;
  corrected_at: string | null;
  retracted_at: string | null;
}

export interface ClaimEvidencePayload {
  claim_id: string;
  document_version_id: string;
  stance: EvidenceStance;
  span_start: number;
  span_end: number;
  excerpt: string;
  excerpt_checksum: string;
  extractor_confidence: number;
}

export interface ClaimBindingPayload {
  claim_id: string;
  record_type: 'funding_round' | 'round_participant';
  record_id: string;
  field_name: string;
}

export interface EntityAliasPayload {
  entity_type: 'company' | 'fund';
  entity_id: string;
  original_alias: string;
  normalized_alias: string;
  provenance_source: string | null;
}

export interface ResolutionDecisionPayload {
  input_text: string;
  normalized_input: string;
  target_entity_type: 'company' | 'fund';
  resolved_entity_id: string | null;
  method: ResolutionMethod;
  confidence: number;
  model_run_id: string | null;
  evidence_claim_id: string | null;
  status: ResolutionStatus;
  reason: string | null;
  decided_at: string;
  overridden_at: string | null;
  overridden_by: string | null;
}

export interface PersistDocumentVersionInput {
  source_id: string;
  canonical_url: string;
  domain: string;
  title: string | null;
  publisher: string | null;
  raw_content: string;
  normalized_text: string;
  normalization_version: number;
  fetched_at: string;
  published_at: string | null;
  r2_key: string | null;
  r2_url: string | null;
  rights_snapshot: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  archive_id: string;
}

export interface CreateClaimWithEvidenceInput {
  subject_type: 'funding_round' | 'round_participant' | 'company' | 'fund' | 'thesis' | 'pattern';
  subject_id: string;
  claim_type: ClaimType;
  predicate: string;
  value_json: Record<string, unknown>;
  effective_at: string | null;
  extraction_confidence: number;
  resolution_confidence: number;
  model_run_id: string;
  evidence_items: Array<{
    document_version_id: string;
    stance: EvidenceStance;
    span_start: number;
    span_end: number;
    excerpt: string;
    excerpt_checksum: string;
    extractor_confidence: number;
  }>;
  binding_record_type?: 'funding_round' | 'round_participant';
  binding_record_id?: string;
  binding_field_name?: string;
}

export interface GetFieldEvidenceInput {
  record_type: 'funding_round' | 'round_participant';
  record_id: string;
  field_name: string;
}

export interface FieldEvidenceOutput {
  claim_id: string;
  claim_type: ClaimType;
  value_json: Record<string, unknown>;
  publication_status: PublicationStatus;
  extraction_confidence: number;
  resolution_confidence: number;
  source_title: string | null;
  source_publisher: string | null;
  source_canonical_url: string | null;
  source_fetched_at: string | null;
  source_published_at: string | null;
  evidence_excerpt: string | null;
  evidence_span_start: number;
  evidence_span_end: number;
  evidence_checksum: string;
  extractor_confidence: number;
  source_count: number;
  has_contradiction: boolean;
  model_run_id: string;
  model_run_kind: ModelRunKind;
  model_provider: string | null;
  model_name: string | null;
  implementation_version: string | null;
}