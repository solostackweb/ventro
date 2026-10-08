/**
 * Stage Registry — Checkpoint 2
 * Defines pipeline stages and their handlers keyed by (pipeline_type, stage_name).
 * Server-only module. Do not import in browser code.
 */

import type { StageName, StageDefinition, PipelineType, StructuredLogContext } from './types';
import { LeaseClient, createLeaseClient, executeWithLease, throwIfLeaseAborted } from './lease-client';
import { PipelineClient, createPipelineClient } from './pipeline-client';
import { BudgetGuard, createBudgetGuard } from './budget';
import { pipelineLogger, createStageLogger } from './logging';
import { serializeError, isRetryableError } from './errors';
import { ingestionSupabase } from '@/lib/supabase/ingestion';
import {
  getAllRegisteredStages,
  getPipelineGraph,
  getStageRegistration,
  getStagesForPipeline,
  getStagesForPipelineOrdered,
  registerStage,
} from './registry';

export { getAllRegisteredStages, getPipelineGraph, getStageRegistration, getStagesForPipeline, registerStage } from './registry';

export interface StageHandlerContext {
  runId: string;
  attemptId: string;
  leaseToken: string;
  stage: StageName;
  inputRef: Record<string, unknown>;
  pipelineClient: PipelineClient;
  leaseClient: LeaseClient;
  budgetGuard: BudgetGuard;
  logger: ReturnType<typeof createStageLogger>;
  signal: AbortSignal;
}

export interface StageResult {
  outputRef: Record<string, unknown>;
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  costUsd: number;
  modelRunId?: string;
}

export type StageHandler = (ctx: StageHandlerContext) => Promise<StageResult>;

export interface StageRegistration {
  pipelineType: PipelineType;
  stageName: StageName;
  handler: StageHandler;
  definition: StageDefinition;
}

export interface PipelineOrchestratorOptions {
  workerId?: string;
  budgetConfig?: Partial<{
    maxCostUsdPerRun: number;
    maxCostUsdPerStage: Record<string, number>;
    maxTokensPerRun: number;
    maxLatencyMsPerStage: Record<string, number>;
  }>;
  maxConcurrentStages?: number;
  leaseSeconds?: number;
}

export interface PipelineOrchestratorDependencies {
  pipelineClient?: PipelineClient;
  leaseClient?: LeaseClient;
}

export class PipelineOrchestrator {
  private pipelineClient: PipelineClient;
  private leaseClient: LeaseClient;
  private budgetGuard: BudgetGuard | null = null;
  private options: PipelineOrchestratorOptions;

  constructor(options: PipelineOrchestratorOptions = {}, dependencies: PipelineOrchestratorDependencies = {}) {
    this.pipelineClient = dependencies.pipelineClient ?? createPipelineClient();
    this.leaseClient = dependencies.leaseClient ?? createLeaseClient(options.workerId);
    this.options = {
      ...options,
      maxConcurrentStages: options.maxConcurrentStages ?? 1,
      leaseSeconds: options.leaseSeconds ?? 300,
    };
  }

  async runPipeline(
    pipelineType: PipelineType,
    trigger: 'scheduled' | 'manual' | 'webhook' | 'retry',
    parameters: Record<string, unknown>,
    idempotencyKey: string
  ): Promise<string> {
    const result = await this.runPipelineBounded(
      pipelineType,
      trigger,
      parameters,
      Number.MAX_SAFE_INTEGER,
      idempotencyKey,
    );
    return result.runId;
  }

  private async processStage(runId: string, stage: StageRegistration) {
    return executeWithLease(
      this.leaseClient,
      {
        worker_id: this.leaseClient.getWorkerId(),
        lease_seconds: stage.definition.default_lease_seconds,
        allowed_stage_names: [stage.stageName],
        pipeline_run_id: runId,
      },
      async (lease, signal) => {
        const logger = createStageLogger(
          runId,
          lease.attempt_id,
          stage.stageName,
          lease.input_ref.source_id as string | undefined,
          lease.input_ref.document_version_id as string | undefined,
          lease.model_run_id ?? undefined
        );

        logger.start();

        const ctx: StageHandlerContext = {
          runId,
          attemptId: lease.attempt_id,
          leaseToken: lease.lease_token,
          stage: stage.stageName,
          inputRef: lease.input_ref,
          pipelineClient: this.pipelineClient,
          leaseClient: this.leaseClient,
          budgetGuard: this.budgetGuard!,
          logger,
          signal,
        };

        const stageStartTime = Date.now();

        signal.addEventListener('abort', () => {
          logger.warn('Lease lost during stage execution, aborting');
        });

        throwIfLeaseAborted(signal);
        const handlerResult = await stage.handler(ctx);
        throwIfLeaseAborted(signal);

        const latencyMs = Date.now() - stageStartTime;
        logger.complete(handlerResult.itemsProcessed, handlerResult.itemsSucceeded, handlerResult.itemsFailed, latencyMs);

        if (handlerResult.modelRunId) {
          throwIfLeaseAborted(signal);
          const { data: modelRun } = await ingestionSupabase
            .from('model_runs')
            .select('provider, model, tokens_input, tokens_output, cost_usd, latency_ms')
            .eq('id', handlerResult.modelRunId)
            .single();
          throwIfLeaseAborted(signal);

          if (modelRun) {
            this.budgetGuard!.recordModelRun(
              stage.stageName,
              modelRun.provider ?? 'unknown',
              modelRun.model ?? 'unknown',
              modelRun.tokens_input ?? 0,
              modelRun.tokens_output ?? 0,
              modelRun.cost_usd ?? 0,
              modelRun.latency_ms ?? latencyMs
            );
          }
        }

        return handlerResult;
      },
      {
        leaseSeconds: stage.definition.default_lease_seconds,
      }
    );
  }

  private canStageRun(pipelineType: PipelineType, stageName: StageName, completedStages: Set<StageName>): boolean {
    const graph = getPipelineGraph(pipelineType);
    const stageDef = graph.find(s => s.stageName === stageName);
    if (!stageDef) return false;
    return stageDef.dependsOn.every(dep => completedStages.has(dep));
  }

  private buildStageIdempotencyKey(pipelineType: PipelineType, stageName: StageName, parameters: Record<string, unknown>): string {
    const sourceInput = parameters.source_id ?? parameters.url ?? 'global';
    const contentHash = parameters.content_hash ?? 'params';
    const schemaVersion = '1.0';
    return `${pipelineType}:${stageName}:${sourceInput}:${contentHash}:${schemaVersion}`;
  }

  private async getLatestAttempt(runId: string, stageName: StageName) {
    const attempts = await this.pipelineClient.getRunStages(runId);
    return attempts
      .filter((attempt) => attempt.stage_name === stageName)
      .sort((a, b) => b.attempt_number - a.attempt_number)[0] ?? null;
  }

  async finalizeRun(runId: string, status?: 'completed' | 'failed' | 'partial' | 'cancelled', failureSummary?: Record<string, unknown> | null): Promise<void> {
    await this.pipelineClient.finalizeRun({ run_id: runId, status, failure_summary: failureSummary ?? null });
  }

  static getStagesForPipeline(pipelineType: PipelineType): StageRegistration[] {
    return getStagesForPipeline(pipelineType);
  }

  async processLeasedWork(
    pipelineType: PipelineType,
    allowedStages?: StageName[],
    pipelineRunId?: string
  ): Promise<number> {
    let processed = 0;
    const maxConcurrentStages = this.options.maxConcurrentStages ?? 1;

    if (!this.budgetGuard) {
      this.budgetGuard = createBudgetGuard('leased-work', this.options.budgetConfig);
    }

    // If runId is provided, fetch the actual pipeline type from the run
    let actualPipelineType = pipelineType;
    if (pipelineRunId) {
      const run = await this.pipelineClient.getRun(pipelineRunId);
      if (run) {
        actualPipelineType = run.pipeline_type;
      }
    }

    for (let i = 0; i < maxConcurrentStages; i++) {
      const lease = await this.leaseClient.acquireLease({
        worker_id: this.leaseClient.getWorkerId(),
        lease_seconds: this.options.leaseSeconds,
        allowed_stage_names: allowedStages,
        pipeline_run_id: pipelineRunId,
      });

      if (!lease) break;

      const registration = getStageRegistration(actualPipelineType, lease.stage_name);
      if (!registration) {
        await this.leaseClient.failAttempt({
          attempt_id: lease.attempt_id,
          lease_token: lease.lease_token,
          error_code: 'STAGE_NOT_REGISTERED',
          error_message: `No handler registered for stage: ${lease.stage_name}`,
          retryability: 'non_retryable',
        });
        continue;
      }

      const result = await executeWithLease(
        this.leaseClient,
        {
          worker_id: this.leaseClient.getWorkerId(),
          lease_seconds: this.options.leaseSeconds,
          allowed_stage_names: allowedStages,
          pipeline_run_id: pipelineRunId,
        },
        async (acquiredLease, signal) => {
          const logger = createStageLogger(
            acquiredLease.pipeline_run_id,
            acquiredLease.attempt_id,
            acquiredLease.stage_name,
            acquiredLease.input_ref.source_id as string | undefined,
            acquiredLease.input_ref.document_version_id as string | undefined,
            acquiredLease.model_run_id ?? undefined
          );

          logger.start();

          const ctx: StageHandlerContext = {
            runId: acquiredLease.pipeline_run_id,
            attemptId: acquiredLease.attempt_id,
            leaseToken: acquiredLease.lease_token,
            stage: acquiredLease.stage_name,
            inputRef: acquiredLease.input_ref,
            pipelineClient: this.pipelineClient,
            leaseClient: this.leaseClient,
            budgetGuard: this.budgetGuard!,
            logger,
            signal,
          };

          signal.addEventListener('abort', () => {
            logger.warn('Lease lost during stage execution, aborting');
          });

          return await registration.handler(ctx);
        },
        {
          leaseSeconds: this.options.leaseSeconds,
          preAcquiredLease: lease,
        }
      );

      if (result.success) {
        processed++;
      }
    }

    return processed;
  }

  /**
   * Bounded pipeline execution: creates/resumes run, enqueues first stage,
   * processes up to maxStages, propagates context, finalizes when no runnable work remains.
   */
  async runPipelineBounded(
    pipelineType: PipelineType,
    trigger: 'scheduled' | 'manual' | 'webhook' | 'retry',
    parameters: Record<string, unknown>,
    maxStages: number,
    idempotencyKey: string,
    resumeRunId?: string
  ): Promise<{ runId: string; processed: number; status: string }> {
    let run_id: string;

    if (resumeRunId) {
      const run = await this.pipelineClient.getRun(resumeRunId);
      if (!run) {
        throw new Error(`Run not found: ${resumeRunId}`);
      }
      if (run.pipeline_type !== pipelineType) {
        throw new Error(`Run ${resumeRunId} is for pipeline type ${run.pipeline_type}, not ${pipelineType}`);
      }
      run_id = resumeRunId;
      pipelineLogger.info(`Resuming pipeline run`, {
        event: 'pipeline_resume',
        run_id,
        pipeline_type: pipelineType,
      });
    } else {
      const result = await this.pipelineClient.createOrGetRun({
        pipeline_type: pipelineType,
        trigger,
        idempotency_key: idempotencyKey,
        parameters,
      });
      run_id = result.run_id;

      if (!result.is_new) {
        pipelineLogger.info(`Resuming existing pipeline run`, {
          event: 'pipeline_resume',
          run_id,
          pipeline_type: pipelineType,
        });
      }
    }

    this.budgetGuard = createBudgetGuard(run_id, this.options.budgetConfig);

    const stages = getStagesForPipelineOrdered(pipelineType);
    if (stages.length === 0) {
      throw new Error(`No stages registered for pipeline type: ${pipelineType}`);
    }

    pipelineLogger.pipelineStart(run_id, pipelineType, trigger);
    const startTime = Date.now();

    try {
      let attempts = await this.pipelineClient.getRunStages(run_id);
      const completedStages = new Set<StageName>();
      let runContext: Record<string, unknown> = { ...parameters };

      for (const stage of stages) {
        const completed = attempts
          .filter((attempt) => attempt.stage_name === stage.stageName && attempt.status === 'completed')
          .sort((a, b) => b.attempt_number - a.attempt_number)[0];
        if (!completed) continue;
        completedStages.add(stage.stageName);
        runContext = { ...runContext, ...(completed.output_ref ?? {}) };
      }

      if (attempts.length === 0) {
        const firstStage = stages[0];
        await this.pipelineClient.enqueueStageAttempt({
          pipeline_run_id: run_id,
          stage_name: firstStage.stageName,
          idempotency_key: this.buildStageIdempotencyKey(pipelineType, firstStage.stageName, runContext),
          input_ref: runContext,
          max_attempts: firstStage.definition.default_max_attempts,
        });
        attempts = await this.pipelineClient.getRunStages(run_id);
      }

      let processed = 0;

      for (const stage of stages) {
        if (processed >= maxStages) break;

        let attempt = attempts
          .filter((candidate) => candidate.stage_name === stage.stageName)
          .sort((a, b) => b.attempt_number - a.attempt_number)[0];

        if (attempt?.status === 'completed') continue;
        if (attempt?.status === 'dead_letter') break;

        if (!this.canStageRun(pipelineType, stage.stageName, completedStages)) {
          continue;
        }

        if (!attempt) {
          await this.pipelineClient.enqueueStageAttempt({
            pipeline_run_id: run_id,
            stage_name: stage.stageName,
            idempotency_key: this.buildStageIdempotencyKey(pipelineType, stage.stageName, runContext),
            input_ref: runContext,
            max_attempts: stage.definition.default_max_attempts,
          });
          attempts = await this.pipelineClient.getRunStages(run_id);
          attempt = attempts
            .filter((candidate) => candidate.stage_name === stage.stageName)
            .sort((a, b) => b.attempt_number - a.attempt_number)[0];
        }

        if (!attempt || attempt.status === 'leased' || attempt.status === 'retry_wait') break;

        const result = await this.processStage(run_id, stage);
        if (!result.success) {
          if (!result.noWork && !result.leaseLost) {
            pipelineLogger.warn(`Stage ${stage.stageName} failed and was left for retry/dead-letter handling`, {
              event: 'stage_failed',
              run_id,
              stage: stage.stageName,
              error_message: result.error?.message,
            });
          }
          break;
        }

        processed++;
        attempts = await this.pipelineClient.getRunStages(run_id);
        attempt = attempts
          .filter((candidate) => candidate.stage_name === stage.stageName)
          .sort((a, b) => b.attempt_number - a.attempt_number)[0];
        if (attempt?.status !== 'completed') break;

        completedStages.add(stage.stageName);
        runContext = { ...runContext, ...(attempt.output_ref ?? {}) };
      }

      const totalLatencyMs = Date.now() - startTime;
      attempts = await this.pipelineClient.getRunStages(run_id);
      const pending = await this.pipelineClient.getPendingStageAttempts(run_id);
      const allCompleted = stages.every((stage) => attempts.some(
        (attempt) => attempt.stage_name === stage.stageName && attempt.status === 'completed',
      ));
      const hasDeadLetter = attempts.some((attempt) => attempt.status === 'dead_letter');

      if (pending.length === 0 && (allCompleted || hasDeadLetter)) {
        await this.pipelineClient.finalizeRun({ run_id, status: allCompleted ? 'completed' : 'partial' });
        await this.budgetGuard?.persistMetrics();
      }

      const run = await this.pipelineClient.getRun(run_id);
      pipelineLogger.pipelineComplete(run_id, pipelineType, run?.status ?? 'running', run?.total_items ?? 0, totalLatencyMs);
      return { runId: run_id, processed, status: run?.status ?? 'running' };
    } catch (error) {
      const safeError = serializeError(error);
      await this.pipelineClient.finalizeRun({
        run_id,
        status: 'failed',
        failure_summary: safeError as unknown as Record<string, unknown>,
      });
      await this.budgetGuard?.persistMetrics();

      pipelineLogger.error(`Pipeline failed: ${pipelineType}`, {
        event: 'pipeline_failed',
        run_id: run_id,
        error_code: safeError.code,
        error_message: safeError.message,
      });
      throw error;
    }
  }
}

export function createPipelineOrchestrator(
  options?: PipelineOrchestratorOptions,
  dependencies?: PipelineOrchestratorDependencies,
): PipelineOrchestrator {
  return new PipelineOrchestrator(options, dependencies);
}
