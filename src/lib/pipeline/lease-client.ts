/**
 * Lease Client — Checkpoint 2
 * Server-only client for acquiring, heartbeating, and releasing stage leases.
 * Uses service-role Supabase client.
 * Do not import in browser code.
 */

import { ingestionSupabase } from '@/lib/supabase/ingestion';
import type {
  AcquireLeaseInput,
  LeaseResult,
  HeartbeatLeaseInput,
  CompleteAttemptInput,
  FailAttemptInput,
  FailAttemptResult,
  StageName,
} from './types';
import { serializeError, createPipelineError } from './errors';

const DEFAULT_LEASE_SECONDS = 300;

export class LeaseClient {
  private workerId: string;

  constructor(workerId: string) {
    this.workerId = workerId;
  }

  async acquireLease(input: AcquireLeaseInput = {}): Promise<LeaseResult | null> {
    const leaseSeconds = input.lease_seconds ?? DEFAULT_LEASE_SECONDS;

    const { data, error } = await ingestionSupabase.rpc('acquire_stage_lease', {
      p_worker_id: this.workerId,
      p_lease_seconds: leaseSeconds,
      p_allowed_stage_names: input.allowed_stage_names ?? null,
      p_pipeline_run_id: input.pipeline_run_id ?? null,
    });

    if (error) {
      throw createPipelineError(`Failed to acquire lease: ${error.message}`, {
        code: 'LEASE_ACQUIRE_FAILED',
        metadata: { worker_id: this.workerId, error: error.message },
        retryability: 'retryable',
      });
    }

    if (!data || data.length === 0 || !data[0]?.attempt_id) {
      return null;
    }

    const result = data[0];
    return {
      attempt_id: result.attempt_id,
      pipeline_run_id: result.pipeline_run_id,
      stage_name: result.stage_name,
      idempotency_key: result.idempotency_key,
      attempt_number: result.attempt_number,
      input_ref: result.input_ref,
      max_attempts: result.max_attempts,
      model_run_id: result.model_run_id,
      lease_token: result.lease_token,
    };
  }

  async heartbeatLease(input: HeartbeatLeaseInput): Promise<boolean> {
    const leaseSeconds = input.lease_seconds ?? DEFAULT_LEASE_SECONDS;

    const { data, error } = await ingestionSupabase.rpc('heartbeat_stage_lease', {
      p_attempt_id: input.attempt_id,
      p_lease_token: input.lease_token,
      p_lease_seconds: leaseSeconds,
    });

    if (error) {
      throw createPipelineError(`Failed to heartbeat lease: ${error.message}`, {
        code: 'LEASE_HEARTBEAT_FAILED',
        metadata: { attempt_id: input.attempt_id, error: error.message },
        retryability: 'retryable',
      });
    }

    return data === true;
  }

  async completeAttempt(input: CompleteAttemptInput): Promise<boolean> {
    const { data, error } = await ingestionSupabase.rpc('complete_stage_attempt', {
      p_attempt_id: input.attempt_id,
      p_lease_token: input.lease_token,
      p_output_ref: input.output_ref,
      p_items_processed: input.items_processed ?? 0,
      p_items_succeeded: input.items_succeeded ?? 0,
      p_items_failed: input.items_failed ?? 0,
      p_cost_usd: input.cost_usd ?? 0,
    });

    if (error) {
      throw createPipelineError(`Failed to complete attempt: ${error.message}`, {
        code: 'ATTEMPT_COMPLETE_FAILED',
        metadata: { attempt_id: input.attempt_id, error: error.message },
        retryability: 'retryable',
      });
    }

    return data === true;
  }

  async failAttempt(input: FailAttemptInput): Promise<FailAttemptResult> {
    const { data, error } = await ingestionSupabase.rpc('fail_stage_attempt', {
      p_attempt_id: input.attempt_id,
      p_lease_token: input.lease_token,
      p_error_code: input.error_code,
      p_error_message: input.error_message,
      p_retryability: input.retryability ?? 'retryable',
      p_error_metadata: input.error_metadata ?? {},
    });

    if (error) {
      throw createPipelineError(`Failed to fail attempt: ${error.message}`, {
        code: 'ATTEMPT_FAIL_FAILED',
        metadata: { attempt_id: input.attempt_id, error: error.message },
        retryability: 'retryable',
      });
    }

    if (!data || data.length === 0) {
      throw createPipelineError('fail_stage_attempt returned no result', {
        code: 'ATTEMPT_FAIL_NO_RESULT',
        retryability: 'retryable',
      });
    }

    const result = data[0];
    return {
      attempt_id: result.attempt_id,
      next_status: result.next_status,
      retry_after: result.retry_after,
    };
  }

  async releaseLease(attemptId: string, leaseToken: string): Promise<boolean> {
    const { error } = await ingestionSupabase
      .from('stage_attempts')
      .update({
        status: 'pending',
        lease_owner: null,
        lease_token: null,
        leased_at: null,
        lease_expires_at: null,
        heartbeat_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attemptId)
      .eq('lease_token', leaseToken)
      .eq('status', 'leased');

    if (error) {
      throw createPipelineError(`Failed to release lease: ${error.message}`, {
        code: 'LEASE_RELEASE_FAILED',
        metadata: { attempt_id: attemptId, error: error.message },
        retryability: 'retryable',
      });
    }

    return true;
  }

  async getAttempt(attemptId: string) {
    const { data, error } = await ingestionSupabase
      .from('stage_attempts')
      .select('*')
      .eq('id', attemptId)
      .single();

    if (error) {
      throw createPipelineError(`Failed to get attempt: ${error.message}`, {
        code: 'GET_ATTEMPT_FAILED',
        metadata: { attempt_id: attemptId, error: error.message },
        retryability: 'retryable',
      });
    }

    return data;
  }

  getWorkerId(): string {
    return this.workerId;
  }
}

export function createLeaseClient(workerId?: string): LeaseClient {
  const id = workerId ?? `worker-${process.env.HOSTNAME ?? 'unknown'}-${process.pid}-${Date.now()}`;
  return new LeaseClient(id);
}

export interface ExecuteWithLeaseOptions {
  leaseSeconds?: number;
  heartbeatIntervalMs?: number;
  onHeartbeatLost?: (attemptId: string, leaseToken: string) => Promise<void>;
  preAcquiredLease?: LeaseResult;
}

export interface ExecuteWithLeaseResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  leaseLost: boolean;
  noWork?: boolean;
}

export class LeaseAbortedError extends Error {
  constructor() {
    super('Stage execution aborted because its lease was lost');
    this.name = 'LeaseAbortedError';
  }
}

export function throwIfLeaseAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new LeaseAbortedError();
}

function waitForHeartbeatInterval(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

export async function executeWithLease<T>(
  leaseClient: LeaseClient,
  input: AcquireLeaseInput,
  work: (lease: LeaseResult, signal: AbortSignal) => Promise<T>,
  options: ExecuteWithLeaseOptions = {}
): Promise<ExecuteWithLeaseResult<T>> {
  const lease = options.preAcquiredLease ?? await leaseClient.acquireLease(input);
  if (!lease) {
    return { success: false, error: new Error('No work available'), leaseLost: false, noWork: true };
  }

  const leaseSeconds = options.leaseSeconds ?? 300;
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? Math.min(leaseSeconds * 1000 / 3, 60000);
  const workController = new AbortController();
  const heartbeatStop = new AbortController();
  let leaseLost = false;
  let completed = false;

  const heartbeatPromise = (async () => {
    while (!completed && !heartbeatStop.signal.aborted) {
      await waitForHeartbeatInterval(heartbeatIntervalMs, heartbeatStop.signal);
      if (completed || heartbeatStop.signal.aborted) break;

      try {
        const ok = await leaseClient.heartbeatLease({
          attempt_id: lease.attempt_id,
          lease_token: lease.lease_token,
          lease_seconds: leaseSeconds,
        });
        if (!ok) {
          leaseLost = true;
          workController.abort();
          if (options.onHeartbeatLost) {
            await options.onHeartbeatLost(lease.attempt_id, lease.lease_token);
          }
          break;
        }
      } catch {
        leaseLost = true;
        workController.abort();
        if (options.onHeartbeatLost) {
          await options.onHeartbeatLost(lease.attempt_id, lease.lease_token);
        }
        break;
      }
    }
  })();

  try {
    const result = await work(lease, workController.signal);
    completed = true;
    heartbeatStop.abort();
    await heartbeatPromise;

    if (leaseLost || workController.signal.aborted) {
      return { success: false, error: new Error('Lease lost before completion'), leaseLost: true };
    }

    // Extract outputRef and counters from StageResult if present
    const handlerResult = result as unknown as { outputRef?: Record<string, unknown>; itemsProcessed?: number; itemsSucceeded?: number; itemsFailed?: number; costUsd?: number } | undefined;
    const outputRef = handlerResult?.outputRef ?? (result as unknown as Record<string, unknown>);
    const itemsProcessed = handlerResult?.itemsProcessed ?? 1;
    const itemsSucceeded = handlerResult?.itemsSucceeded ?? 1;
    const itemsFailed = handlerResult?.itemsFailed ?? 0;
    const costUsd = handlerResult?.costUsd ?? 0;

    const completeOk = await leaseClient.completeAttempt({
      attempt_id: lease.attempt_id,
      lease_token: lease.lease_token,
      output_ref: outputRef,
      items_processed: itemsProcessed,
      items_succeeded: itemsSucceeded,
      items_failed: itemsFailed,
      cost_usd: costUsd,
    });

    if (!completeOk) {
      return { success: false, error: new Error('Lease lost during completion'), leaseLost: true };
    }

    return { success: true, result, leaseLost: false };
  } catch (error) {
    completed = true;
    heartbeatStop.abort();
    await heartbeatPromise;

    if (leaseLost || workController.signal.aborted || error instanceof LeaseAbortedError) {
      return { success: false, error: error as Error, leaseLost: true };
    }

    const safeError = serializeError(error);
    await leaseClient.failAttempt({
      attempt_id: lease.attempt_id,
      lease_token: lease.lease_token,
      error_code: safeError.code,
      error_message: safeError.message,
      retryability: safeError.retryability,
      error_metadata: safeError.metadata,
    });

    return { success: false, error: error as Error, leaseLost: false };
  }
}
