/**
 * Evidence Repository — service-role only database operations.
 * All write operations go through this module.
 */

import { ingestionSupabase } from '@/lib/supabase/ingestion';
import type {
  PersistDocumentVersionInput,
  CreateClaimWithEvidenceInput,
  GetFieldEvidenceInput,
  FieldEvidenceOutput,
  ClaimType,
  PublicationStatus,
  ModelRunKind,
  EvidenceStance,
} from './payloads';

export const evidenceRepository = {
  async persistDocumentVersion(input: PersistDocumentVersionInput) {
    const { data, error } = await ingestionSupabase
      .rpc('persist_document_version', {
        p_source_id: input.source_id,
        p_canonical_url: input.canonical_url,
        p_domain: input.domain,
        p_title: input.title,
        p_publisher: input.publisher,
        p_raw_content: input.raw_content,
        p_normalized_text: input.normalized_text,
        p_normalization_version: input.normalization_version,
        p_fetched_at: input.fetched_at,
        p_published_at: input.published_at,
        p_r2_key: input.r2_key,
        p_r2_url: input.r2_url,
        p_rights_snapshot: input.rights_snapshot,
        p_metadata: input.metadata,
        p_archive_id: input.archive_id,
      });

    if (error) {
      throw new Error(`persist_document_version failed: ${error.message}`);
    }

    const result = data?.[0];
    if (!result) {
      throw new Error('persist_document_version returned no result');
    }

    return {
      sourceDocumentId: result.source_document_id,
      documentVersionId: result.document_version_id,
      archiveId: result.archive_id,
      isNewVersion: result.is_new_version,
    };
  },

  async createClaimWithEvidence(input: CreateClaimWithEvidenceInput) {
    const { data, error } = await ingestionSupabase
      .rpc('create_claim_with_evidence', {
        p_subject_type: input.subject_type,
        p_subject_id: input.subject_id,
        p_claim_type: input.claim_type,
        p_predicate: input.predicate,
        p_value_json: input.value_json,
        p_effective_at: input.effective_at,
        p_extraction_confidence: input.extraction_confidence,
        p_resolution_confidence: input.resolution_confidence,
        p_model_run_id: input.model_run_id,
        p_evidence_items: input.evidence_items,
        p_binding_record_type: input.binding_record_type,
        p_binding_record_id: input.binding_record_id,
        p_binding_field_name: input.binding_field_name,
      });

    if (error) {
      throw new Error(`create_claim_with_evidence failed: ${error.message}`);
    }

    const result = data?.[0];
    if (!result) {
      throw new Error('create_claim_with_evidence returned no result');
    }

    return {
      claimId: result.claim_id,
      publicationStatus: result.publication_status as PublicationStatus,
      publicationReason: result.publication_reason,
    };
  },

  async getFieldEvidence(input: GetFieldEvidenceInput): Promise<FieldEvidenceOutput[]> {
    const { data, error } = await ingestionSupabase
      .rpc('get_field_evidence', {
        p_record_type: input.record_type,
        p_record_id: input.record_id,
        p_field_name: input.field_name,
      });

    if (error) {
      throw new Error(`get_field_evidence failed: ${error.message}`);
    }

    return (data || []) as FieldEvidenceOutput[];
  },

  async createModelRun(input: {
    run_kind: ModelRunKind;
    provider?: string | null;
    model?: string | null;
    prompt_version?: string | null;
    schema_version?: string | null;
    implementation_version: string;
    input_checksum: string;
    document_version_id?: string | null;
    tokens_input?: number | null;
    tokens_output?: number | null;
    latency_ms?: number | null;
    cost_usd?: number | null;
    status?: 'success' | 'partial' | 'failed';
    failure_reason?: string | null;
  }) {
    const { data, error } = await ingestionSupabase
      .from('model_runs')
      .insert({
        run_kind: input.run_kind,
        provider: input.provider,
        model: input.model,
        prompt_version: input.prompt_version,
        schema_version: input.schema_version,
        implementation_version: input.implementation_version,
        input_checksum: input.input_checksum,
        document_version_id: input.document_version_id,
        tokens_input: input.tokens_input,
        tokens_output: input.tokens_output,
        latency_ms: input.latency_ms,
        cost_usd: input.cost_usd,
        status: input.status ?? 'success',
        failure_reason: input.failure_reason,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`model_runs insert failed: ${error.message}`);
    }

    return data;
  },

  async getDocumentVersion(documentVersionId: string) {
    const { data, error } = await ingestionSupabase
      .from('document_versions')
      .select('*')
      .eq('id', documentVersionId)
      .single();

    if (error) {
      throw new Error(`getDocumentVersion failed: ${error.message}`);
    }

    return data;
  },

  async getSourceDocument(sourceDocumentId: string) {
    const { data, error } = await ingestionSupabase
      .from('source_documents')
      .select('*')
      .eq('id', sourceDocumentId)
      .single();

    if (error) {
      throw new Error(`getSourceDocument failed: ${error.message}`);
    }

    return data;
  },

  async getConnectorInfo(sourceId: string) {
    const { data, error } = await ingestionSupabase
      .from('source_connectors')
      .select('source_id, trust_tier, is_official, independence_group, domain')
      .eq('source_id', sourceId)
      .single();

    if (error) {
      throw new Error(`getConnectorInfo failed: ${error.message}`);
    }

    return data;
  },
};

export type EvidenceRepository = typeof evidenceRepository;