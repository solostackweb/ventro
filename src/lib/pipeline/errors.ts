/**
 * Safe Error Serialization — Checkpoint 2
 * Converts errors to structured metadata without leaking secrets,
 * raw provider responses, or prohibited source text.
 * Server-only module.
 */

import type { Retryability } from './types';

export interface SafeErrorMetadata {
  code: string;
  message: string;
  retryability: Retryability;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface PipelineError extends Error {
  code?: string;
  retryability?: Retryability;
  metadata?: Record<string, unknown>;
  statusCode?: number;
  cause?: Error;
}

const SENSITIVE_KEYS = [
  'api_key',
  'apikey',
  'api-key',
  'secret',
  'password',
  'token',
  'authorization',
  'bearer',
  'access_token',
  'refresh_token',
  'client_secret',
  'private_key',
  'service_role',
  'service_role_key',
  'supabase_key',
  'r2_secret',
  'r2_access_key',
  'openai_key',
  'openai_api_key',
  'tavily_key',
  'firecrawl_key',
  'request_body',
  'response_body',
  'body',
  'prompt',
];

const PROHIBITED_CONTENT_PATTERNS = [
  /sk-[a-zA-Z0-9]{8,}/g,  // OpenAI API keys (sk- followed by 8+ chars)
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi,  // JWTs (case-insensitive)
  /AKIA[0-9A-Z]{16}/g,  // AWS access keys
];

function sanitizeValue(value: unknown): Record<string, unknown> | string | unknown[] | null | number | boolean {
  if (typeof value === 'string') {
    let sanitized = value;
    for (const pattern of PROHIBITED_CONTENT_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    return sanitized;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeValue(val);
      }
    }
    return sanitized;
  }
  return null;
}

function extractErrorCode(error: unknown): string {
  if (error instanceof Error) {
    const pipelineError = error as PipelineError;
    if (pipelineError.code) return pipelineError.code;
    if ('statusCode' in pipelineError && typeof pipelineError.statusCode === 'number') {
      return `HTTP_${pipelineError.statusCode}`;
    }
    return error.name || 'Error';
  }
  return 'UnknownError';
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

function extractRetryability(error: unknown): Retryability {
  if (error instanceof Error) {
    const pipelineError = error as PipelineError;
    if (pipelineError.retryability) return pipelineError.retryability;

    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Non-retryable patterns
    if (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('not found') ||
      message.includes('404') ||
      message.includes('invalid') ||
      message.includes('validation') ||
      message.includes('schema') ||
      message.includes('constraint') ||
      message.includes('permission denied') ||
      name.includes('validation') ||
      name.includes('constraint') ||
      name.includes('permission')
    ) {
      return 'non_retryable';
    }

    // Retryable patterns
    if (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('503') ||
      message.includes('502') ||
      message.includes('504') ||
      message.includes('temporary') ||
      message.includes('unavailable') ||
      name.includes('timeout') ||
      name.includes('network')
    ) {
      return 'retryable';
    }
  }
  // Default to retryable for unknown errors
  return 'retryable';
}

function extractMetadata(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const pipelineError = error as PipelineError;
    const metadata: Record<string, unknown> = {};

    if (pipelineError.metadata) {
      Object.assign(metadata, sanitizeValue(pipelineError.metadata));
    }

    if (pipelineError.statusCode) {
      metadata.http_status = pipelineError.statusCode;
    }

    if (pipelineError.cause) {
      metadata.cause = serializeError(pipelineError.cause);
    }

    if (error.stack) {
      // Only include stack trace frames, not the error message
      const stackFrames = error.stack
        .split('\n')
        .slice(1)
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .slice(0, 10); // Limit to 10 frames
      metadata.stack_frames = stackFrames;
    }

    return metadata;
  }
  return { raw_error: sanitizeValue(error) };
}

export function serializeError(error: unknown): SafeErrorMetadata {
  const message = extractErrorMessage(error);
  return {
    code: extractErrorCode(error),
    message: sanitizeValue(message) as string,
    retryability: extractRetryability(error),
    metadata: sanitizeValue(extractMetadata(error)) as Record<string, unknown>,
    timestamp: new Date().toISOString(),
  };
}

export function createPipelineError(
  message: string,
  options: {
    code?: string;
    retryability?: Retryability;
    metadata?: Record<string, unknown>;
    statusCode?: number;
    cause?: Error;
  } = {}
): PipelineError {
  const error = new Error(message) as PipelineError;
  error.name = 'PipelineError';
  if (options.code) error.code = options.code;
  if (options.retryability) error.retryability = options.retryability;
  if (options.metadata) error.metadata = options.metadata;
  if (options.statusCode) error.statusCode = options.statusCode;
  if (options.cause) error.cause = options.cause;
  return error;
}

export function isRetryableError(error: unknown): boolean {
  return extractRetryability(error) === 'retryable';
}

export function isNonRetryableError(error: unknown): boolean {
  return extractRetryability(error) === 'non_retryable';
}

export function getBackoffMinutes(attemptNumber: number): number {
  if (attemptNumber <= 1) return 1;
  if (attemptNumber === 2) return 5;
  return 15;
}

export function computeRetryAfter(attemptNumber: number): Date {
  const minutes = getBackoffMinutes(attemptNumber);
  return new Date(Date.now() + minutes * 60 * 1000);
}