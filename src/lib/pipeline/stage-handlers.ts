/**
 * Stage Handlers — Checkpoint 2
 * Implements the pipeline stages by wiring existing ingestion modules.
 * Registered per (pipeline_type, stage_name) to avoid collisions.
 * Server-only module. Do not import in browser code.
 */

import { registerStage } from './registry';
import type { StageHandlerContext, StageResult } from './orchestrator';
import { STAGE_DEFINITIONS } from './types';
import { ingestionSupabase } from '@/lib/supabase/ingestion';
import { loadApprovedConnectors, runIngestionForSource } from '@/lib/ingestion/rss-fetcher';
import { runStoryClustering } from '@/lib/ingestion/story-clustering';
import { extractFundingEvidence } from '@/lib/ingestion/funding-extractor';
import { detectPatterns } from '@/lib/ingestion/pattern-detector';
import { extractStatedThesisForAllFunds, computeObservedThesisForAllFunds } from '@/lib/ingestion/thesis-extractor';
import { materializeStatedThesisRecords, materializeObservedThesisRecords } from '@/lib/intelligence/answers/thesis-materializer';
import { evidenceCore } from '@/lib/intelligence/evidence/with-repository';
import crypto from 'crypto';
import { throwIfLeaseAborted } from './lease-client';

function assertLeaseActive(ctx: StageHandlerContext): void {
  throwIfLeaseAborted(ctx.signal);
}

function filterSourcesByScope(sources: Array<{ source_id: string }>, scope?: string): Array<{ source_id: string }> {
  if (!scope || scope === 'all') return sources;
  return sources.filter(s => s.source_id === scope);
}

// ============================================
// NEWS INGESTION PIPELINE HANDLERS
// ============================================

// Discover (news_ingestion): find sources due for ingestion
const discoverNewsHandler = async (ctx: StageHandlerContext): Promise<StageResult> => {
  assertLeaseActive(ctx);
  const connectors = await loadApprovedConnectors();
  assertLeaseActive(ctx);
  const scope = ctx.inputRef.source_scope as string | undefined;
  const dueConnectors = connectors.filter(c =>
    (c.cadence === 'realtime' || c.cadence === 'hourly' || c.cadence === 'daily' || c.cadence === 'weekly') &&
    (scope === undefined || scope === 'all' || c.source_id === scope)
  );

  const sources = dueConnectors.map(c => ({
    source_id: c.source_id,
    name: c.name,
    cadence: c.cadence,
    access_method: c.access_method,
  }));

  ctx.logger.info(`Discovered ${sources.length} sources due for ingestion`, { sources_count: sources.length, scope });

  return { outputRef: { sources, scope }, itemsProcessed: sources.length, itemsSucceeded: sources.length, itemsFailed: 0, costUsd: 0 };
};

registerStage({ pipelineType: 'news_ingestion', stageName: 'discover', definition: STAGE_DEFINITIONS.discover, handler: discoverNewsHandler });

// Discover (full_refresh): all connectors regardless of cadence
const discoverFullRefreshHandler = async (ctx: StageHandlerContext): Promise<StageResult> => {
  assertLeaseActive(ctx);
  const connectors = await loadApprovedConnectors();
  assertLeaseActive(ctx);
  const scope = ctx.inputRef.source_scope as string | undefined;
  const sources = connectors
    .filter(c => scope === undefined || scope === 'all' || c.source_id === scope)
    .map(c => ({ source_id: c.source_id, name: c.name, cadence: c.cadence, access_method: c.access_method }));

  ctx.logger.info(`Full refresh: discovered ${sources.length} sources`, { sources_count: sources.length, scope });
  return { outputRef: { sources, scope }, itemsProcessed: sources.length, itemsSucceeded: sources.length, itemsFailed: 0, costUsd: 0 };
};

registerStage({ pipelineType: 'full_refresh', stageName: 'discover', definition: STAGE_DEFINITIONS.discover, handler: discoverFullRefreshHandler });

// Fetch: retrieve content from sources (shared)
const fetchHandler = async (ctx: StageHandlerContext): Promise<StageResult> => {
  assertLeaseActive(ctx);
  const sources = ctx.inputRef.sources as Array<{ source_id: string; name: string; cadence: string; access_method: string }> ?? [];
  const scope = ctx.inputRef.scope as string | undefined;
  let totalItems = 0, totalNew = 0, totalUpdated = 0, totalErrors = 0;

  for (const source of sources) {
    assertLeaseActive(ctx);
    ctx.logger.info(`Fetching from source: ${source.source_id}`, { source_id: source.source_id });
    try {
      const result = await runIngestionForSource(source.source_id);
      assertLeaseActive(ctx);
      totalItems += result.items_fetched;
      totalNew += result.items_new;
      totalUpdated += result.items_updated;
      if (!result.success) totalErrors++;
      ctx.logger.info(`Source ${source.source_id}: ${result.items_fetched} fetched, ${result.items_new} new, ${result.items_updated} updated`, {
        source_id: source.source_id, items_fetched: result.items_fetched, items_new: result.items_new, items_updated: result.items_updated, success: result.success,
      });
    } catch (error) {
      assertLeaseActive(ctx);
      totalErrors++;
      ctx.logger.error(`Source ${source.source_id} fetch failed`, { source_id: source.source_id, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  // Preserve bounded context: pass sources and scope to next stage
  return { outputRef: { sources, scope, items_fetched: totalItems, items_new: totalNew, items_updated: totalUpdated, errors: totalErrors }, itemsProcessed: totalItems, itemsSucceeded: totalItems - totalErrors, itemsFailed: totalErrors, costUsd: 0 };
};

registerStage({ pipelineType: 'news_ingestion', stageName: 'fetch', definition: STAGE_DEFINITIONS.fetch, handler: fetchHandler });
registerStage({ pipelineType: 'full_refresh', stageName: 'fetch', definition: STAGE_DEFINITIONS.fetch, handler: fetchHandler });

// Archive: validate archive integrity (shared)
const archiveHandler = async (ctx: StageHandlerContext): Promise<StageResult> => {
  assertLeaseActive(ctx);
  const sources = ctx.inputRef.sources as Array<{ source_id: string }> ?? [];
  const scope = ctx.inputRef.scope as string | undefined;
  let validated = 0, errors = 0;

  for (const source of sources) {
    assertLeaseActive(ctx);
    const { data, error } = await ingestionSupabase.from('source_archive').select('id, content_hash, document_version_id').eq('source_id', source.source_id).is('document_version_id', null).limit(100);
    assertLeaseActive(ctx);
    if (error) { errors++; continue; }
    if (data && data.length > 0) {
      ctx.logger.warn(`Found ${data.length} archive items without document_version_id for ${source.source_id}`, { source_id: source.source_id, count: data.length });
    }
    validated++;
  }
  // Preserve bounded context: pass sources and scope to next stage
  return { outputRef: { sources, scope, validated, errors }, itemsProcessed: validated + errors, itemsSucceeded: validated, itemsFailed: errors, costUsd: 0 };
};

registerStage({ pipelineType: 'news_ingestion', stageName: 'archive', definition: STAGE_DEFINITIONS.archive, handler: archiveHandler });
registerStage({ pipelineType: 'full_refresh', stageName: 'archive', definition: STAGE_DEFINITIONS.archive, handler: archiveHandler });

// Normalize: cluster stories, extract entities (shared)
const normalizeHandler = async (ctx: StageHandlerContext): Promise<StageResult> => {
  assertLeaseActive(ctx);
  ctx.logger.info('Running story clustering');
  let totalClustered = 0, batchCount = 0;
  // Drain a cold-start backlog of up to 3,000 archived items in one hosted
  // run. The workflow has a 60-minute cap and the loop still exits as soon as
  // the current backlog is exhausted.
  const maxBatches = 30;
  for (let batch = 0; batch < maxBatches; batch++) {
    assertLeaseActive(ctx);
    try {
      const count = await runStoryClustering();
      assertLeaseActive(ctx);
      totalClustered += count; batchCount++;
      if (count < 100) break;
    } catch (error) { ctx.logger.error(`Story clustering batch ${batch} failed`, { error: error instanceof Error ? error.message : 'Unknown' }); throw error; }
  }
  return { outputRef: { items_clustered: totalClustered, batches: batchCount }, itemsProcessed: totalClustered, itemsSucceeded: totalClustered, itemsFailed: 0, costUsd: 0 };
};

registerStage({ pipelineType: 'news_ingestion', stageName: 'normalize', definition: STAGE_DEFINITIONS.normalize, handler: normalizeHandler });
registerStage({ pipelineType: 'full_refresh', stageName: 'normalize', definition: STAGE_DEFINITIONS.normalize, handler: normalizeHandler });

// Extract: funding evidence from document versions (shared)
const extractNewsHandler = async (ctx: StageHandlerContext): Promise<StageResult> => {
  assertLeaseActive(ctx);
  ctx.logger.info('Running funding evidence extraction');
  try { await extractFundingEvidence(); assertLeaseActive(ctx); return { outputRef: { extraction_completed: true }, itemsProcessed: 1, itemsSucceeded: 1, itemsFailed: 0, costUsd: 0 }; }
  catch (error) { ctx.logger.error('Funding extraction failed', { error: error instanceof Error ? error.message : 'Unknown' }); throw error; }
};

registerStage({ pipelineType: 'news_ingestion', stageName: 'extract', definition: STAGE_DEFINITIONS.extract, handler: extractNewsHandler });
registerStage({ pipelineType: 'full_refresh', stageName: 'extract', definition: STAGE_DEFINITIONS.extract, handler: extractNewsHandler });

// Resolve: create resolution decisions for unresolved entity mentions (shared)
const resolveHandler = async (ctx: StageHandlerContext): Promise<StageResult> => {
  assertLeaseActive(ctx);
  ctx.logger.info('Running entity resolution');
  const { data: unresolvedClaims, error } = await ingestionSupabase.from('claims').select('id, subject_id, value_json, predicate').eq('claim_type', 'investor_participation').is('resolution_confidence', null).limit(100);
  assertLeaseActive(ctx);
  if (error) throw new Error(`Failed to find unresolved claims: ${error.message}`);

  let resolved = 0;
  for (const claim of unresolvedClaims ?? []) {
    assertLeaseActive(ctx);
    const fundId = (claim.value_json as { fund_id?: string })?.fund_id;
    if (!fundId) continue;
    const { error: upsertError } = await ingestionSupabase.from('resolution_decisions').upsert({ input_text: claim.predicate, normalized_input: claim.predicate.toLowerCase().trim(), target_entity_type: 'fund', resolved_entity_id: fundId, method: 'deterministic', confidence: 0.95, evidence_claim_id: claim.id, status: 'accepted', reason: 'Deterministic match from funding extraction claim' }, { onConflict: 'input_text, target_entity_type, resolved_entity_id', ignoreDuplicates: true });
    assertLeaseActive(ctx);
    if (upsertError) throw new Error(`Failed to upsert resolution decision: ${upsertError.message}`);
    const { error: updateError } = await ingestionSupabase.from('claims').update({ resolution_confidence: 0.95 }).eq('id', claim.id);
    assertLeaseActive(ctx);
    if (updateError) throw new Error(`Failed to update claim resolution_confidence: ${updateError.message}`);
    resolved++;
  }
  return { outputRef: { claims_resolved: resolved }, itemsProcessed: resolved, itemsSucceeded: resolved, itemsFailed: 0, costUsd: 0 };
};

registerStage({ pipelineType: 'news_ingestion', stageName: 'resolve', definition: STAGE_DEFINITIONS.resolve, handler: resolveHandler });
registerStage({ pipelineType: 'full_refresh', stageName: 'resolve', definition: STAGE_DEFINITIONS.resolve, handler: resolveHandler });
registerStage({ pipelineType: 'funding_extraction', stageName: 'resolve', definition: STAGE_DEFINITIONS.resolve, handler: resolveHandler });

// Verify is intentionally non-publishing. The evidence write path applies the
// central publication policy when claims are created; this stage must not imply
// that candidate claims were re-evaluated when no candidate evaluator exists.
const verifyNewsHandler = async (ctx: StageHandlerContext): Promise<StageResult> => {
  assertLeaseActive(ctx);
  ctx.logger.info('Candidate recheck skipped; publication policy runs during claim creation');
  return {
    outputRef: {
      verification_mode: 'creation_time_policy',
      candidate_recheck_skipped: true,
    },
    itemsProcessed: 0,
    itemsSucceeded: 0,
    itemsFailed: 0,
    costUsd: 0,
  };
};

registerStage({ pipelineType: 'news_ingestion', stageName: 'verify', definition: STAGE_DEFINITIONS.verify, handler: verifyNewsHandler });
registerStage({ pipelineType: 'full_refresh', stageName: 'verify', definition: STAGE_DEFINITIONS.verify, handler: verifyNewsHandler });
registerStage({ pipelineType: 'funding_extraction', stageName: 'verify', definition: STAGE_DEFINITIONS.verify, handler: verifyNewsHandler });

// Publish: bind published claims to canonical records (shared)
const publishHandler = async (ctx: StageHandlerContext): Promise<StageResult> => {
  assertLeaseActive(ctx);
  ctx.logger.info('Running publication binding');
  const { data: publishedClaims, error } = await ingestionSupabase.from('claims').select('id, subject_type, subject_id, claim_type, predicate, publication_status').eq('publication_status', 'published').is('superseded_by_claim_id', null).limit(1000);
  assertLeaseActive(ctx);
  if (error) throw new Error(`Failed to get published claims: ${error.message}`);

  let bound = 0;
  for (const claim of publishedClaims ?? []) {
    assertLeaseActive(ctx);
    const { data: bindings } = await ingestionSupabase.from('claim_bindings').select('id').eq('claim_id', claim.id).limit(1);
    assertLeaseActive(ctx);
    if (!bindings || bindings.length === 0) {
      const recordType = claim.subject_type === 'funding_round' ? 'funding_round' : 'round_participant';
      const { error: upsertError } = await ingestionSupabase.from('claim_bindings').upsert({ claim_id: claim.id, record_type: recordType, record_id: claim.subject_id, field_name: claim.predicate }, { onConflict: 'claim_id, record_type, record_id, field_name', ignoreDuplicates: true });
      assertLeaseActive(ctx);
      if (upsertError) throw new Error(`Failed to upsert claim binding: ${upsertError.message}`);
      bound++;
    }
  }
  return { outputRef: { claims_bound: bound }, itemsProcessed: publishedClaims?.length ?? 0, itemsSucceeded: bound, itemsFailed: 0, costUsd: 0 };
};

registerStage({ pipelineType: 'news_ingestion', stageName: 'publish', definition: STAGE_DEFINITIONS.publish, handler: publishHandler });
registerStage({ pipelineType: 'full_refresh', stageName: 'publish', definition: STAGE_DEFINITIONS.publish, handler: publishHandler });
registerStage({ pipelineType: 'funding_extraction', stageName: 'publish', definition: STAGE_DEFINITIONS.publish, handler: publishHandler });

// ============================================
// FUNDING EXTRACTION PIPELINE (standalone)
// ============================================

registerStage({ pipelineType: 'funding_extraction', stageName: 'extract', definition: STAGE_DEFINITIONS.extract, handler: extractNewsHandler });

// ============================================
// THESIS EXTRACTION PIPELINE
// ============================================

const thesisExtractHandler = async (ctx: StageHandlerContext): Promise<StageResult> => {
  assertLeaseActive(ctx);
  ctx.logger.info('Running stated thesis extraction');
  try {
    await extractStatedThesisForAllFunds();
    const statedRecords = await materializeStatedThesisRecords();
    assertLeaseActive(ctx);
    return { outputRef: { stated_thesis_extraction_completed: true, stated_records: statedRecords }, itemsProcessed: statedRecords, itemsSucceeded: statedRecords, itemsFailed: 0, costUsd: 0 };
  }
  catch (error) { ctx.logger.error('Stated thesis extraction failed', { error: error instanceof Error ? error.message : 'Unknown' }); throw error; }
};

registerStage({ pipelineType: 'thesis_extraction', stageName: 'extract', definition: STAGE_DEFINITIONS.extract, handler: thesisExtractHandler });

const thesisVerifyHandler = async (ctx: StageHandlerContext): Promise<StageResult> => {
  assertLeaseActive(ctx);
  ctx.logger.info('Running observed thesis computation');
  try {
    await computeObservedThesisForAllFunds();
    const observedRecords = await materializeObservedThesisRecords();
    assertLeaseActive(ctx);
    return { outputRef: { observed_thesis_computation_completed: true, observed_records: observedRecords }, itemsProcessed: observedRecords, itemsSucceeded: observedRecords, itemsFailed: 0, costUsd: 0 };
  }
  catch (error) { ctx.logger.error('Observed thesis computation failed', { error: error instanceof Error ? error.message : 'Unknown' }); throw error; }
};

registerStage({ pipelineType: 'thesis_extraction', stageName: 'verify', definition: STAGE_DEFINITIONS.verify, handler: thesisVerifyHandler });

// ============================================
// PATTERN DETECTION PIPELINE
// ============================================

const patternExtractHandler = async (ctx: StageHandlerContext): Promise<StageResult> => {
  assertLeaseActive(ctx);
  ctx.logger.info('Running pattern detection');
  try { await detectPatterns(); assertLeaseActive(ctx); return { outputRef: { pattern_detection_completed: true }, itemsProcessed: 1, itemsSucceeded: 1, itemsFailed: 0, costUsd: 0 }; }
  catch (error) { ctx.logger.error('Pattern detection failed', { error: error instanceof Error ? error.message : 'Unknown' }); throw error; }
};

registerStage({ pipelineType: 'pattern_detection', stageName: 'extract', definition: STAGE_DEFINITIONS.extract, handler: patternExtractHandler });
