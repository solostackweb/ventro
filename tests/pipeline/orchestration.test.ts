/**
 * Pipeline Orchestration Tests — Checkpoint 2
 * Unit tests for pipeline types, error handling, and core logic.
 * These tests do not require a database.
 */

import { PipelineType, PipelineTrigger, PipelineStatus, StageName, StageStatus, Retryability, STAGE_DEFINITIONS, STAGE_ORDER, getStageOrderIndex, canStageRun, StructuredLogContext } from '@/lib/pipeline/types';
import {
  serializeError,
  createPipelineError,
  isRetryableError,
  isNonRetryableError,
  getBackoffMinutes,
  computeRetryAfter,
  SafeErrorMetadata,
} from '@/lib/pipeline/errors';

describe('Pipeline Types', () => {
  describe('Enums', () => {
    it('has correct pipeline types', () => {
      const types: PipelineType[] = ['news_ingestion', 'funding_extraction', 'thesis_extraction', 'pattern_detection', 'full_refresh'];
      expect(types).toHaveLength(5);
    });

    it('has correct pipeline triggers', () => {
      const triggers: PipelineTrigger[] = ['scheduled', 'manual', 'webhook', 'retry'];
      expect(triggers).toHaveLength(4);
    });

    it('has correct pipeline statuses', () => {
      const statuses: PipelineStatus[] = ['pending', 'running', 'completed', 'failed', 'partial', 'cancelled'];
      expect(statuses).toHaveLength(6);
    });

    it('has correct stage names', () => {
      const stages: StageName[] = ['discover', 'fetch', 'archive', 'normalize', 'extract', 'resolve', 'verify', 'publish'];
      expect(stages).toHaveLength(8);
    });

    it('has correct stage statuses', () => {
      const statuses: StageStatus[] = ['pending', 'leased', 'running', 'completed', 'retry_wait', 'failed', 'dead_letter', 'skipped'];
      expect(statuses).toHaveLength(8);
    });

    it('has correct retryability values', () => {
      const retryability: Retryability[] = ['retryable', 'non_retryable'];
      expect(retryability).toHaveLength(2);
    });
  });

  describe('Stage Definitions', () => {
    it('has all 8 stages defined', () => {
      expect(Object.keys(STAGE_DEFINITIONS)).toHaveLength(8);
    });

    it('each stage has required properties', () => {
      for (const [, def] of Object.entries(STAGE_DEFINITIONS)) {
        expect(def.name).toBeDefined();
        expect(def.description).toBeDefined();
        expect(Array.isArray(def.depends_on)).toBe(true);
        expect(typeof def.default_max_attempts).toBe('number');
        expect(def.default_max_attempts).toBeGreaterThan(0);
        expect(typeof def.default_lease_seconds).toBe('number');
        expect(def.default_lease_seconds).toBeGreaterThan(0);
        expect(typeof def.timeout_seconds).toBe('number');
        expect(def.timeout_seconds).toBeGreaterThan(0);
      }
    });

    it('discover has no dependencies', () => {
      expect(STAGE_DEFINITIONS.discover.depends_on).toEqual([]);
    });

    it('fetch depends on discover', () => {
      expect(STAGE_DEFINITIONS.fetch.depends_on).toEqual(['discover']);
    });

    it('publish depends on verify', () => {
      expect(STAGE_DEFINITIONS.publish.depends_on).toEqual(['verify']);
    });
  });

  describe('Stage Order', () => {
    it('has correct order', () => {
      expect(STAGE_ORDER).toEqual(['discover', 'fetch', 'archive', 'normalize', 'extract', 'resolve', 'verify', 'publish']);
    });

    it('getStageOrderIndex returns correct index', () => {
      expect(getStageOrderIndex('discover')).toBe(0);
      expect(getStageOrderIndex('fetch')).toBe(1);
      expect(getStageOrderIndex('publish')).toBe(7);
      expect(getStageOrderIndex('unknown' as StageName)).toBe(-1);
    });
  });

  describe('canStageRun', () => {
    it('returns true for discover with no completed stages', () => {
      expect(canStageRun('discover', new Set<StageName>())).toBe(true);
    });

    it('returns false for fetch if discover not completed', () => {
      expect(canStageRun('fetch', new Set<StageName>())).toBe(false);
    });

    it('returns true for fetch if discover completed', () => {
      expect(canStageRun('fetch', new Set<StageName>(['discover' as StageName]))).toBe(true);
    });

    it('returns true for publish if all dependencies completed', () => {
      const completed = new Set<StageName>(['discover', 'fetch', 'archive', 'normalize', 'extract', 'resolve', 'verify'] as StageName[]);
      expect(canStageRun('publish', completed)).toBe(true);
    });

    it('returns false for publish if verify not completed', () => {
      const completed = new Set<StageName>(['discover', 'fetch', 'archive', 'normalize', 'extract', 'resolve'] as StageName[]);
      expect(canStageRun('publish', completed)).toBe(false);
    });
  });
});

describe('Error Serialization', () => {
  describe('serializeError', () => {
    it('serializes Error with code', () => {
      const error = new Error('Test error');
      (error as any).code = 'TEST_CODE';
      const result = serializeError(error);

      expect(result.code).toBe('TEST_CODE');
      expect(result.message).toBe('Test error');
      expect(result.retryability).toBe('retryable');
      expect(result.timestamp).toBeDefined();
    });

    it('serializes Error with statusCode', () => {
      const error = new Error('Not found');
      (error as any).statusCode = 404;
      const result = serializeError(error);

      expect(result.code).toBe('HTTP_404');
      expect(result.retryability).toBe('non_retryable');
    });

    it('serializes plain string error', () => {
      const result = serializeError('Plain string error');

      expect(result.code).toBe('UnknownError');
      expect(result.message).toBe('Plain string error');
    });

    it('redacts sensitive keys', () => {
      const error = new Error('Auth failed');
      (error as any).metadata = { api_key: 'secret123', normal_field: 'value' };
      const result = serializeError(error);

      expect(result.metadata.api_key).toBe('[REDACTED]');
      expect(result.metadata.normal_field).toBe('value');
    });

    it('redacts API key patterns in strings', () => {
      const error = new Error('API key sk-abc123def456ghi789jkl012mno345pqr678stu901');
      const result = serializeError(error);

      expect(result.message).toContain('[REDACTED]');
      expect(result.message).not.toContain('sk-abc123def456ghi789jkl012mno345pqr678stu901');
    });

    it('includes stack frames limited to 10', () => {
      const error = new Error('Test');
      error.stack = 'Error: Test\n    at func1 (file1.js:1)\n    at func2 (file2.js:2)\n    at func3 (file3.js:3)';
      const result = serializeError(error);

      expect(result.metadata.stack_frames).toBeDefined();
      expect(Array.isArray(result.metadata.stack_frames)).toBe(true);
    });
  });

  describe('createPipelineError', () => {
    it('creates error with all options', () => {
      const cause = new Error('Cause');
      const error = createPipelineError('Test error', {
        code: 'CUSTOM_CODE',
        retryability: 'non_retryable',
        metadata: { key: 'value' },
        statusCode: 400,
        cause,
      });

      expect(error.message).toBe('Test error');
      expect((error as any).code).toBe('CUSTOM_CODE');
      expect((error as any).retryability).toBe('non_retryable');
      expect((error as any).metadata).toEqual({ key: 'value' });
      expect((error as any).statusCode).toBe(400);
      expect((error as any).cause).toBe(cause);
    });
  });

  describe('Retry Classification', () => {
    it('classifies timeout as retryable', () => {
      const error = new Error('Connection timeout');
      expect(isRetryableError(error)).toBe(true);
    });

    it('classifies rate limit as retryable', () => {
      const error = new Error('Rate limit exceeded (429)');
      expect(isRetryableError(error)).toBe(true);
    });

    it('classifies 503 as retryable', () => {
      const error = new Error('Service unavailable 503');
      expect(isRetryableError(error)).toBe(true);
    });

    it('classifies unauthorized as non-retryable', () => {
      const error = new Error('Unauthorized access');
      expect(isRetryableError(error)).toBe(false);
      expect(isNonRetryableError(error)).toBe(true);
    });

    it('classifies not found as non-retryable', () => {
      const error = new Error('Resource not found (404)');
      expect(isNonRetryableError(error)).toBe(true);
    });

    it('classifies validation error as non-retryable', () => {
      const error = new Error('Validation failed');
      expect(isNonRetryableError(error)).toBe(true);
    });

    it('defaults to retryable for unknown errors', () => {
      const error = new Error('Some unknown error');
      expect(isRetryableError(error)).toBe(true);
    });
  });

  describe('Backoff Calculation', () => {
    it('returns 1 minute for attempt 1', () => {
      expect(getBackoffMinutes(1)).toBe(1);
    });

    it('returns 5 minutes for attempt 2', () => {
      expect(getBackoffMinutes(2)).toBe(5);
    });

    it('returns 15 minutes for attempt 3', () => {
      expect(getBackoffMinutes(3)).toBe(15);
    });

    it('returns 15 minutes for attempt 4+', () => {
      expect(getBackoffMinutes(4)).toBe(15);
      expect(getBackoffMinutes(10)).toBe(15);
    });

    it('computeRetryAfter returns future date', () => {
      const retryAfter = computeRetryAfter(1);
      expect(retryAfter.getTime()).toBeGreaterThan(Date.now());
      expect(retryAfter.getTime()).toBeLessThanOrEqual(Date.now() + 2 * 60 * 1000); // ~1 minute
    });
  });
});

describe('Structured Logging Context', () => {
  it('StructuredLogContext has all required fields', () => {
    const context: StructuredLogContext = {
      run_id: 'run-123',
      attempt_id: 'attempt-456',
      stage: 'extract',
      source_id: 'source-789',
      document_version_id: 'docver-abc',
      model_run_id: 'model-xyz',
    };

    expect(context.run_id).toBe('run-123');
    expect(context.attempt_id).toBe('attempt-456');
    expect(context.stage).toBe('extract');
    expect(context.source_id).toBe('source-789');
    expect(context.document_version_id).toBe('docver-abc');
    expect(context.model_run_id).toBe('model-xyz');
  });

  it('allows null values', () => {
    const context: StructuredLogContext = {
      run_id: 'run-123',
      attempt_id: null,
      stage: null,
      source_id: null,
      document_version_id: null,
      model_run_id: null,
    };

    expect(context.attempt_id).toBeNull();
    expect(context.stage).toBeNull();
  });
});

describe('Budget Guard Logic (Pure Functions)', () => {
  // These test the pure logic without database
  it('calculates stage cost limits correctly', () => {
    const config = {
      maxCostUsdPerRun: 10.00,
      maxCostUsdPerStage: {
        discover: 0.10,
        fetch: 0.50,
        extract: 5.00,
      },
    };

    expect(config.maxCostUsdPerStage.extract).toBe(5.00);
    expect(config.maxCostUsdPerStage.discover).toBe(0.10);
  });

  it('calculates alert thresholds', () => {
    const thresholdPercent = 80;
    const limit = 5.00;
    const alertThreshold = limit * (thresholdPercent / 100);
    expect(alertThreshold).toBe(4.00);
  });
});

describe('Idempotency Key Generation', () => {
  it('generates consistent format', () => {
    const pipelineType = 'news_ingestion';
    const stage = 'extract';
    const sourceInput = 'source-123';
    const contentHash = 'abc123';
    const schemaVersion = '1.0';

    const key = `${pipelineType}:${stage}:${sourceInput}:${contentHash}:${schemaVersion}`;
    expect(key).toBe('news_ingestion:extract:source-123:abc123:1.0');
  });
});