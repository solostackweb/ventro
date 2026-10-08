/**
 * Pipeline Client — Checkpoint 2
 * Server-only client for creating, enqueueing, and finalizing pipeline runs.
 * Uses service-role Supabase client.
 * Do not import in browser code.
 */

import { ingestionSupabase } from '@/lib/supabase/ingestion';
import type {
  CreatePipelineRunInput,
  PipelineRun,
  PipelineRunSummary,
  EnqueueStageAttemptInput,
  StageAttempt,
  FinalizeRunInput,
  StageWaterfallItem,
  QueueCounts,
  StaleLease,
  SourceHealth,
  ModelRunMetrics,
  PublicationStats,
  PipelineType,
  PipelineStatus,
  StageName,
} from './types';
import { createPipelineError } from './errors';

export class PipelineClient {
  async createOrGetRun(input: CreatePipelineRunInput): Promise<{ run_id: string; is_new: boolean }> {
    const { data, error } = await ingestionSupabase.rpc('create_or_get_pipeline_run', {
      p_pipeline_type: input.pipeline_type,
      p_trigger: input.trigger,
      p_idempotency_key: input.idempotency_key,
      p_parameters: input.parameters ?? {},
    });

    if (error) {
      throw createPipelineError(`Failed to create/get pipeline run: ${error.message}`, {
        code: 'PIPELINE_RUN_CREATE_FAILED',
        metadata: { idempotency_key: input.idempotency_key, error: error.message },
        retryability: 'retryable',
      });
    }

    if (!data || data.length === 0) {
      throw createPipelineError('create_or_get_pipeline_run returned no result', {
        code: 'PIPELINE_RUN_NO_RESULT',
        retryability: 'retryable',
      });
    }

    return {
      run_id: data[0].run_id,
      is_new: data[0].is_new,
    };
  }

  async enqueueStageAttempt(input: EnqueueStageAttemptInput): Promise<{ attempt_id: string; is_new: boolean }> {
    const { data, error } = await ingestionSupabase.rpc('enqueue_stage_attempt', {
      p_pipeline_run_id: input.pipeline_run_id,
      p_stage_name: input.stage_name,
      p_idempotency_key: input.idempotency_key,
      p_input_ref: input.input_ref ?? {},
      p_max_attempts: input.max_attempts ?? 3,
      p_model_run_id: input.model_run_id ?? null,
    });

    if (error) {
      throw createPipelineError(`Failed to enqueue stage attempt: ${error.message}`, {
        code: 'STAGE_ENQUEUE_FAILED',
        metadata: { pipeline_run_id: input.pipeline_run_id, stage_name: input.stage_name, error: error.message },
        retryability: 'retryable',
      });
    }

    if (!data || data.length === 0) {
      throw createPipelineError('enqueue_stage_attempt returned no result', {
        code: 'STAGE_ENQUEUE_NO_RESULT',
        retryability: 'retryable',
      });
    }

    return {
      attempt_id: data[0].attempt_id,
      is_new: data[0].is_new,
    };
  }

  async finalizeRun(input: FinalizeRunInput): Promise<void> {
    const { error } = await ingestionSupabase.rpc('finalize_pipeline_run', {
      p_run_id: input.run_id,
      p_status: input.status ?? 'completed',
      p_failure_summary: input.failure_summary ?? null,
    });

    if (error) {
      throw createPipelineError(`Failed to finalize pipeline run: ${error.message}`, {
        code: 'PIPELINE_RUN_FINALIZE_FAILED',
        metadata: { run_id: input.run_id, error: error.message },
        retryability: 'retryable',
      });
    }
  }

  async getRun(runId: string): Promise<PipelineRun | null> {
    const { data, error } = await ingestionSupabase
      .from('pipeline_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw createPipelineError(`Failed to get pipeline run: ${error.message}`, {
        code: 'GET_PIPELINE_RUN_FAILED',
        metadata: { run_id: runId, error: error.message },
        retryability: 'retryable',
      });
    }

    return data;
  }

  async getRecentRuns(limit = 50, pipelineType?: PipelineType): Promise<PipelineRunSummary[]> {
    const { data, error } = await ingestionSupabase.rpc('get_recent_pipeline_runs', {
      p_limit: limit,
      p_pipeline_type: pipelineType ?? null,
    });

    if (error) {
      throw createPipelineError(`Failed to get recent runs: ${error.message}`, {
        code: 'GET_RECENT_RUNS_FAILED',
        metadata: { error: error.message },
        retryability: 'retryable',
      });
    }

    return data || [];
  }

  async getRunStages(runId: string): Promise<StageWaterfallItem[]> {
    const { data, error } = await ingestionSupabase.rpc('get_pipeline_run_stages', {
      p_run_id: runId,
    });

    if (error) {
      throw createPipelineError(`Failed to get run stages: ${error.message}`, {
        code: 'GET_RUN_STAGES_FAILED',
        metadata: { run_id: runId, error: error.message },
        retryability: 'retryable',
      });
    }

    return data || [];
  }

  async getQueueCounts(): Promise<QueueCounts[]> {
    const { data, error } = await ingestionSupabase.rpc('get_pipeline_queue_counts');

    if (error) {
      throw createPipelineError(`Failed to get queue counts: ${error.message}`, {
        code: 'GET_QUEUE_COUNTS_FAILED',
        metadata: { error: error.message },
        retryability: 'retryable',
      });
    }

    return data || [];
  }

  async getStaleLeases(thresholdMinutes = 10): Promise<StaleLease[]> {
    const { data, error } = await ingestionSupabase.rpc('get_stale_leases', {
      p_threshold_minutes: thresholdMinutes,
    });

    if (error) {
      throw createPipelineError(`Failed to get stale leases: ${error.message}`, {
        code: 'GET_STALE_LEASES_FAILED',
        metadata: { error: error.message },
        retryability: 'retryable',
      });
    }

    return data || [];
  }

  async getSourceHealth(limit = 100): Promise<SourceHealth[]> {
    const { data, error } = await ingestionSupabase.rpc('get_source_health', {
      p_limit: limit,
    });

    if (error) {
      throw createPipelineError(`Failed to get source health: ${error.message}`, {
        code: 'GET_SOURCE_HEALTH_FAILED',
        metadata: { error: error.message },
        retryability: 'retryable',
      });
    }

    return data || [];
  }

  async getModelRunMetrics(since?: Date, runKind?: string): Promise<ModelRunMetrics[]> {
    const { data, error } = await ingestionSupabase.rpc('get_model_run_metrics', {
      p_since: since?.toISOString() ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      p_run_kind: runKind ?? null,
    });

    if (error) {
      throw createPipelineError(`Failed to get model run metrics: ${error.message}`, {
        code: 'GET_MODEL_METRICS_FAILED',
        metadata: { error: error.message },
        retryability: 'retryable',
      });
    }

    return data || [];
  }

  async getPublicationStats(since?: Date): Promise<PublicationStats[]> {
    const { data, error } = await ingestionSupabase.rpc('get_publication_stats', {
      p_since: since?.toISOString() ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });

    if (error) {
      throw createPipelineError(`Failed to get publication stats: ${error.message}`, {
        code: 'GET_PUBLICATION_STATS_FAILED',
        metadata: { error: error.message },
        retryability: 'retryable',
      });
    }

    return data || [];
  }

  async replayDeadLetter(attemptId: string, reason: string): Promise<{ new_attempt_id: string; old_attempt_id: string }> {
    const { data, error } = await ingestionSupabase.rpc('replay_dead_letter', {
      p_attempt_id: attemptId,
      p_reason: reason,
    });

    if (error) {
      throw createPipelineError(`Failed to replay dead letter: ${error.message}`, {
        code: 'REPLAY_DEAD_LETTER_FAILED',
        metadata: { attempt_id: attemptId, error: error.message },
        retryability: 'retryable',
      });
    }

    if (!data || data.length === 0) {
      throw createPipelineError('replay_dead_letter returned no result', {
        code: 'REPLAY_NO_RESULT',
        retryability: 'retryable',
      });
    }

    return {
      new_attempt_id: data[0].new_attempt_id,
      old_attempt_id: data[0].old_attempt_id,
    };
  }

  async getPendingStageAttempts(
    pipelineRunId: string,
    stageNames?: StageName[]
  ): Promise<StageAttempt[]> {
    let query = ingestionSupabase
      .from('stage_attempts')
      .select('*')
      .eq('pipeline_run_id', pipelineRunId)
      .in('status', ['pending', 'retry_wait', 'leased'])
      .order('created_at', { ascending: true });

    if (stageNames?.length) {
      query = query.in('stage_name', stageNames);
    }

    const { data, error } = await query;

    if (error) {
      throw createPipelineError(`Failed to get pending stage attempts: ${error.message}`, {
        code: 'GET_PENDING_ATTEMPTS_FAILED',
        metadata: { pipeline_run_id: pipelineRunId, error: error.message },
        retryability: 'retryable',
      });
    }

    return data || [];
  }

  async getCompletedStages(pipelineRunId: string): Promise<Set<StageName>> {
    const { data, error } = await ingestionSupabase
      .from('stage_attempts')
      .select('stage_name')
      .eq('pipeline_run_id', pipelineRunId)
      .eq('status', 'completed');

    if (error) {
      throw createPipelineError(`Failed to get completed stages: ${error.message}`, {
        code: 'GET_COMPLETED_STAGES_FAILED',
        metadata: { pipeline_run_id: pipelineRunId, error: error.message },
        retryability: 'retryable',
      });
    }

    return new Set((data || []).map(d => d.stage_name as StageName));
  }

  async markStageSkipped(pipelineRunId: string, stageName: StageName, idempotencyKey: string, reason: string): Promise<void> {
    const { error } = await ingestionSupabase
      .from('stage_attempts')
      .update({
        status: 'skipped',
        error_message: reason,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('pipeline_run_id', pipelineRunId)
      .eq('stage_name', stageName)
      .eq('idempotency_key', idempotencyKey);

    if (error) {
      throw createPipelineError(`Failed to mark stage skipped: ${error.message}`, {
        code: 'MARK_STAGE_SKIPPED_FAILED',
        metadata: { pipeline_run_id: pipelineRunId, stage_name: stageName, error: error.message },
        retryability: 'retryable',
      });
    }
  }
}

export function createPipelineClient(): PipelineClient {
  return new PipelineClient();
}