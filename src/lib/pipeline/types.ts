/**
 * Pipeline Orchestration Types — Checkpoint 2
 * Server-only types for durable pipeline execution.
 * Do not import in browser code.
 */

export type PipelineType =
  | 'news_ingestion'
  | 'funding_extraction'
  | 'thesis_extraction'
  | 'pattern_detection'
  | 'full_refresh';

export type PipelineTrigger = 'scheduled' | 'manual' | 'webhook' | 'retry';

export type PipelineStatus = 'pending' | 'running' | 'completed' | 'failed' | 'partial' | 'cancelled';

export type StageName =
  | 'discover'
  | 'fetch'
  | 'archive'
  | 'normalize'
  | 'extract'
  | 'resolve'
  | 'verify'
  | 'publish';

export type StageStatus =
  | 'pending'
  | 'leased'
  | 'running'
  | 'completed'
  | 'retry_wait'
  | 'failed'
  | 'dead_letter'
  | 'skipped';

export type Retryability = 'retryable' | 'non_retryable';

export interface PipelineRun {
  id: string;
  pipeline_type: PipelineType;
  trigger: PipelineTrigger;
  status: PipelineStatus;
  parameters: Record<string, unknown>;
  idempotency_key: string;
  requested_at: string;
  started_at: string | null;
  heartbeat_at: string | null;
  completed_at: string | null;
  total_items: number;
  completed_items: number;
  failed_items: number;
  total_latency_ms: number;
  failure_summary: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface StageAttempt {
  id: string;
  pipeline_run_id: string;
  stage_name: StageName;
  status: StageStatus;
  attempt_number: number;
  max_attempts: number;
  idempotency_key: string;
  lease_owner: string | null;
  lease_token: string | null;
  leased_at: string | null;
  lease_expires_at: string | null;
  heartbeat_at: string | null;
  retry_after: string | null;
  input_ref: Record<string, unknown>;
  output_ref: Record<string, unknown> | null;
  model_run_id: string | null;
  error_code: string | null;
  error_message: string | null;
  error_metadata: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  latency_ms: number | null;
  items_processed: number;
  items_succeeded: number;
  items_failed: number;
  cost_usd: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePipelineRunInput {
  pipeline_type: PipelineType;
  trigger: PipelineTrigger;
  idempotency_key: string;
  parameters?: Record<string, unknown>;
}

export interface EnqueueStageAttemptInput {
  pipeline_run_id: string;
  stage_name: StageName;
  idempotency_key: string;
  input_ref?: Record<string, unknown>;
  max_attempts?: number;
  model_run_id?: string | null;
}

export interface AcquireLeaseInput {
  worker_id?: string;
  lease_seconds?: number;
  allowed_stage_names?: StageName[];
  pipeline_run_id?: string;
}

export interface LeaseResult {
  attempt_id: string;
  pipeline_run_id: string;
  stage_name: StageName;
  idempotency_key: string;
  attempt_number: number;
  input_ref: Record<string, unknown>;
  max_attempts: number;
  model_run_id: string | null;
  lease_token: string;
}

export interface CompleteAttemptInput {
  attempt_id: string;
  lease_token: string;
  output_ref: Record<string, unknown>;
  items_processed?: number;
  items_succeeded?: number;
  items_failed?: number;
  cost_usd?: number;
}

export interface FailAttemptInput {
  attempt_id: string;
  lease_token: string;
  error_code: string;
  error_message: string;
  retryability?: Retryability;
  error_metadata?: Record<string, unknown>;
}

export interface FailAttemptResult {
  attempt_id: string;
  next_status: StageStatus;
  retry_after: string | null;
}

export interface HeartbeatLeaseInput {
  attempt_id: string;
  lease_token: string;
  lease_seconds?: number;
}

export interface ReplayDeadLetterInput {
  attempt_id: string;
  reason: string;
}

export interface FinalizeRunInput {
  run_id: string;
  status?: PipelineStatus;
  failure_summary?: Record<string, unknown> | null;
}

export interface PipelineRunSummary {
  id: string;
  pipeline_type: PipelineType;
  trigger: PipelineTrigger;
  status: PipelineStatus;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  total_items: number;
  completed_items: number;
  failed_items: number;
  total_latency_ms: number;
  failure_summary: Record<string, unknown> | null;
}

export interface StageWaterfallItem {
  id: string;
  stage_name: StageName;
  status: StageStatus;
  attempt_number: number;
  max_attempts: number;
  idempotency_key: string;
  lease_owner: string | null;
  leased_at: string | null;
  lease_expires_at: string | null;
  retry_after: string | null;
  input_ref: Record<string, unknown>;
  output_ref: Record<string, unknown> | null;
  model_run_id: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  latency_ms: number | null;
  items_processed: number;
  items_succeeded: number;
  items_failed: number;
  cost_usd: number;
}

export interface QueueCounts {
  pipeline_type: PipelineType;
  pending_count: number;
  running_count: number;
  retry_wait_count: number;
  dead_letter_count: number;
  stale_lease_count: number;
}

export interface StaleLease {
  attempt_id: string;
  pipeline_run_id: string;
  stage_name: StageName;
  lease_owner: string;
  leased_at: string;
  lease_expires_at: string;
  minutes_stale: number;
}

export interface SourceHealth {
  source_id: string;
  name: string;
  status: string;
  last_fetch_at: string | null;
  last_fetch_status: string | null;
  consecutive_failures: number;
  items_fetched_24h: number;
  items_new_24h: number;
  unique_yield_24h: number;
  health_score: number;
}

export interface ModelRunMetrics {
  run_kind: string;
  provider: string;
  model: string;
  runs_count: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_latency_ms: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  success_rate: number;
}

export interface PublicationStats {
  publication_status: string;
  claim_type: string;
  count: number;
  avg_extraction_confidence: number;
  avg_resolution_confidence: number;
  top_rejection_reasons: string[];
}

export interface StructuredLogContext {
  run_id: string;
  attempt_id: string | null;
  stage: StageName | null;
  source_id: string | null;
  document_version_id: string | null;
  model_run_id: string | null;
}

export interface StageDefinition {
  name: StageName;
  description: string;
  depends_on: StageName[];
  default_max_attempts: number;
  default_lease_seconds: number;
  timeout_seconds: number;
}

export const STAGE_DEFINITIONS: Record<StageName, StageDefinition> = {
  discover: {
    name: 'discover',
    description: 'Discover new source URLs from connectors',
    depends_on: [],
    default_max_attempts: 3,
    default_lease_seconds: 120,
    timeout_seconds: 300,
  },
  fetch: {
    name: 'fetch',
    description: 'Fetch raw content from source URLs',
    depends_on: ['discover'],
    default_max_attempts: 3,
    default_lease_seconds: 180,
    timeout_seconds: 600,
  },
  archive: {
    name: 'archive',
    description: 'Persist raw content to R2 and create source_document/document_version',
    depends_on: ['fetch'],
    default_max_attempts: 3,
    default_lease_seconds: 120,
    timeout_seconds: 300,
  },
  normalize: {
    name: 'normalize',
    description: 'Normalize text, cluster stories, extract entities',
    depends_on: ['archive'],
    default_max_attempts: 3,
    default_lease_seconds: 180,
    timeout_seconds: 600,
  },
  extract: {
    name: 'extract',
    description: 'Extract claims with evidence spans from document versions',
    depends_on: ['normalize'],
    default_max_attempts: 3,
    default_lease_seconds: 300,
    timeout_seconds: 900,
  },
  resolve: {
    name: 'resolve',
    description: 'Resolve entity aliases and create resolution decisions',
    depends_on: ['extract'],
    default_max_attempts: 3,
    default_lease_seconds: 120,
    timeout_seconds: 300,
  },
  verify: {
    name: 'verify',
    description: 'Run publication policy evaluation on claims',
    depends_on: ['resolve'],
    default_max_attempts: 3,
    default_lease_seconds: 120,
    timeout_seconds: 300,
  },
  publish: {
    name: 'publish',
    description: 'Bind published claims to canonical records (funding_rounds, etc.)',
    depends_on: ['verify'],
    default_max_attempts: 3,
    default_lease_seconds: 120,
    timeout_seconds: 300,
  },
};

export const STAGE_ORDER: StageName[] = [
  'discover',
  'fetch',
  'archive',
  'normalize',
  'extract',
  'resolve',
  'verify',
  'publish',
];

export function getStageOrderIndex(stage: StageName): number {
  return STAGE_ORDER.indexOf(stage);
}

export function canStageRun(stage: StageName, completedStages: Set<StageName>): boolean {
  const deps = STAGE_DEFINITIONS[stage].depends_on;
  return deps.every(dep => completedStages.has(dep));
}