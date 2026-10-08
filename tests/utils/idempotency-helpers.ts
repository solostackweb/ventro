/**
 * Test helpers for idempotency key generation
 * Mirrors the logic in the pipeline module
 */

import crypto from 'crypto';

export function generateIdempotencyKey(pipelineType: string, scope: string): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const scopeHash = crypto.createHash('sha256').update(scope || 'all').digest('hex').slice(0, 16);
  return `${pipelineType}:scheduled:${scopeHash}:${timestamp}:1.0`;
}

export function buildStageIdempotencyKey(
  pipelineType: string,
  stageName: string,
  parameters: Record<string, unknown>
): string {
  const sourceInput = (parameters.source_id as string) ?? (parameters.url as string) ?? 'global';
  const contentHash = (parameters.content_hash as string) ?? 'params';
  const schemaVersion = '1.0';
  return `${pipelineType}:${stageName}:${sourceInput}:${contentHash}:${schemaVersion}`;
}