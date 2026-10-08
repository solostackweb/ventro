/**
 * Structured Logging — Checkpoint 2
 * Server-only structured logger carrying run_id, attempt_id, stage, source_id,
 * document_version_id, and model_run_id when available.
 * Do not import in browser code.
 */

import type { StructuredLogContext, StageName } from './types';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  context: StructuredLogContext;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

type LogHandler = (entry: LogEntry) => void;

let handlers: LogHandler[] = [defaultConsoleHandler];
let globalContext: Partial<StructuredLogContext> = {};

function defaultConsoleHandler(entry: LogEntry): void {
  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
  const contextParts = [];
  if (entry.context.run_id) contextParts.push(`run=${entry.context.run_id.slice(0, 8)}`);
  if (entry.context.attempt_id) contextParts.push(`attempt=${entry.context.attempt_id.slice(0, 8)}`);
  if (entry.context.stage) contextParts.push(`stage=${entry.context.stage}`);
  if (entry.context.source_id) contextParts.push(`source=${entry.context.source_id}`);
  if (entry.context.document_version_id) contextParts.push(`docver=${entry.context.document_version_id.slice(0, 8)}`);
  if (entry.context.model_run_id) contextParts.push(`modelrun=${entry.context.model_run_id.slice(0, 8)}`);

  const contextStr = contextParts.length > 0 ? ` [${contextParts.join(' ')}]` : '';
  const metaStr = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';

  const output = `${prefix}${contextStr} ${entry.message}${metaStr}`;

  switch (entry.level) {
    case 'debug':
    case 'info':
      console.log(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'error':
      console.error(output);
      break;
  }
}

export function addLogHandler(handler: LogHandler): () => void {
  handlers.push(handler);
  return () => {
    handlers = handlers.filter(h => h !== handler);
  };
}

export function setGlobalContext(context: Partial<StructuredLogContext>): void {
  globalContext = { ...globalContext, ...context };
}

export function clearGlobalContext(): void {
  globalContext = {};
}

export function withContext<T>(
  context: Partial<StructuredLogContext>,
  fn: () => T
): T {
  const previousContext = { ...globalContext };
  globalContext = { ...globalContext, ...context };
  try {
    return fn();
  } finally {
    globalContext = previousContext;
  }
}

function log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    message,
    context: {
      run_id: globalContext.run_id ?? '',
      attempt_id: globalContext.attempt_id ?? null,
      stage: globalContext.stage ?? null,
      source_id: globalContext.source_id ?? null,
      document_version_id: globalContext.document_version_id ?? null,
      model_run_id: globalContext.model_run_id ?? null,
    },
    timestamp: new Date().toISOString(),
    metadata,
  };

  for (const handler of handlers) {
    try {
      handler(entry);
    } catch {
      // Ignore handler errors
    }
  }
}

export const pipelineLogger = {
  debug: (message: string, metadata?: Record<string, unknown>) => log('debug', message, metadata),
  info: (message: string, metadata?: Record<string, unknown>) => log('info', message, metadata),
  warn: (message: string, metadata?: Record<string, unknown>) => log('warn', message, metadata),
  error: (message: string, metadata?: Record<string, unknown>) => log('error', message, metadata),

  stageStart: (stage: StageName, metadata?: Record<string, unknown>) =>
    log('info', `Stage started: ${stage}`, { ...metadata, event: 'stage_start' }),

  stageComplete: (stage: StageName, itemsProcessed: number, itemsSucceeded: number, itemsFailed: number, latencyMs: number, metadata?: Record<string, unknown>) =>
    log('info', `Stage completed: ${stage}`, {
      ...metadata,
      event: 'stage_complete',
      items_processed: itemsProcessed,
      items_succeeded: itemsSucceeded,
      items_failed: itemsFailed,
      latency_ms: latencyMs,
    }),

  stageFailed: (stage: StageName, error: Error, retryability: 'retryable' | 'non_retryable', metadata?: Record<string, unknown>) =>
    log('error', `Stage failed: ${stage}`, {
      ...metadata,
      event: 'stage_failed',
      error_code: error.name,
      error_message: error.message,
      retryability,
    }),

  leaseAcquired: (attemptId: string, stage: StageName, leaseToken: string) =>
    log('info', `Lease acquired for ${stage}`, {
      event: 'lease_acquired',
      attempt_id: attemptId,
      lease_token_prefix: leaseToken.slice(0, 8),
    }),

  leaseHeartbeat: (attemptId: string, stage: StageName) =>
    log('debug', `Lease heartbeat for ${stage}`, { event: 'lease_heartbeat', attempt_id: attemptId }),

  leaseExpired: (attemptId: string, stage: StageName) =>
    log('warn', `Lease expired for ${stage}`, { event: 'lease_expired', attempt_id: attemptId }),

  retryScheduled: (attemptId: string, stage: StageName, attemptNumber: number, retryAfter: Date) =>
    log('warn', `Retry scheduled for ${stage} (attempt ${attemptNumber})`, {
      event: 'retry_scheduled',
      attempt_id: attemptId,
      attempt_number: attemptNumber,
      retry_after: retryAfter.toISOString(),
    }),

  deadLetter: (attemptId: string, stage: StageName, error: Error) =>
    log('error', `Dead letter for ${stage}`, {
      event: 'dead_letter',
      attempt_id: attemptId,
      error_code: error.name,
      error_message: error.message,
    }),

  pipelineStart: (runId: string, pipelineType: string, trigger: string) =>
    log('info', `Pipeline started: ${pipelineType}`, {
      event: 'pipeline_start',
      run_id: runId,
      pipeline_type: pipelineType,
      trigger,
    }),

  pipelineComplete: (runId: string, pipelineType: string, status: string, totalItems: number, latencyMs: number) =>
    log('info', `Pipeline completed: ${pipelineType} (${status})`, {
      event: 'pipeline_complete',
      run_id: runId,
      pipeline_type: pipelineType,
      status,
      total_items: totalItems,
      latency_ms: latencyMs,
    }),

  itemProcessed: (stage: StageName, sourceId: string, documentVersionId: string, success: boolean, metadata?: Record<string, unknown>) =>
    log('debug', `Item processed in ${stage}`, {
      event: 'item_processed',
      stage,
      source_id: sourceId,
      document_version_id: documentVersionId,
      success,
      ...metadata,
    }),
};

export function createStageLogger(
  runId: string,
  attemptId: string,
  stage: StageName,
  sourceId?: string,
  documentVersionId?: string,
  modelRunId?: string
) {
  return {
    debug: (message: string, metadata?: Record<string, unknown>) =>
      pipelineLogger.debug(message, { ...metadata, run_id: runId, attempt_id: attemptId, stage, source_id: sourceId, document_version_id: documentVersionId, model_run_id: modelRunId }),
    info: (message: string, metadata?: Record<string, unknown>) =>
      pipelineLogger.info(message, { ...metadata, run_id: runId, attempt_id: attemptId, stage, source_id: sourceId, document_version_id: documentVersionId, model_run_id: modelRunId }),
    warn: (message: string, metadata?: Record<string, unknown>) =>
      pipelineLogger.warn(message, { ...metadata, run_id: runId, attempt_id: attemptId, stage, source_id: sourceId, document_version_id: documentVersionId, model_run_id: modelRunId }),
    error: (message: string, metadata?: Record<string, unknown>) =>
      pipelineLogger.error(message, { ...metadata, run_id: runId, attempt_id: attemptId, stage, source_id: sourceId, document_version_id: documentVersionId, model_run_id: modelRunId }),
    start: (metadata?: Record<string, unknown>) =>
      pipelineLogger.stageStart(stage, { ...metadata, run_id: runId, attempt_id: attemptId, source_id: sourceId, document_version_id: documentVersionId, model_run_id: modelRunId }),
    complete: (itemsProcessed: number, itemsSucceeded: number, itemsFailed: number, latencyMs: number, metadata?: Record<string, unknown>) =>
      pipelineLogger.stageComplete(stage, itemsProcessed, itemsSucceeded, itemsFailed, latencyMs, { ...metadata, run_id: runId, attempt_id: attemptId, source_id: sourceId, document_version_id: documentVersionId, model_run_id: modelRunId }),
    failed: (error: Error, retryability: 'retryable' | 'non_retryable', metadata?: Record<string, unknown>) =>
      pipelineLogger.stageFailed(stage, error, retryability, { ...metadata, run_id: runId, attempt_id: attemptId, source_id: sourceId, document_version_id: documentVersionId, model_run_id: modelRunId }),
  };
}