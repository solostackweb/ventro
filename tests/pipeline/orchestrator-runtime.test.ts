/** Production-path runtime tests. External I/O is mocked; orchestration is real. */
jest.mock('@/lib/ingestion/rss-fetcher', () => ({ loadApprovedConnectors: jest.fn(), runIngestionForSource: jest.fn() }));
jest.mock('@/lib/ingestion/story-clustering', () => ({ runStoryClustering: jest.fn() }));
jest.mock('@/lib/ingestion/funding-extractor', () => ({ extractFundingEvidence: jest.fn() }));
jest.mock('@/lib/ingestion/pattern-detector', () => ({ detectPatterns: jest.fn() }));
jest.mock('@/lib/ingestion/thesis-extractor', () => ({ extractStatedThesisForAllFunds: jest.fn(), computeObservedThesisForAllFunds: jest.fn() }));
jest.mock('@/lib/intelligence/evidence/with-repository', () => ({ evidenceCore: {} }));
jest.mock('@/lib/supabase/ingestion', () => ({ ingestionSupabase: { from: jest.fn(), rpc: jest.fn() } }));

import { PipelineOrchestrator } from '@/lib/pipeline/orchestrator';
import { executeWithLease, LeaseAbortedError } from '@/lib/pipeline/lease-client';
import type { LeaseResult, StageAttempt, StageName } from '@/lib/pipeline/types';
import { loadApprovedConnectors, runIngestionForSource } from '@/lib/ingestion/rss-fetcher';
import { ingestionSupabase } from '@/lib/supabase/ingestion';
import '@/lib/pipeline/stage-handlers';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const selectedSource = { source_id: 'sequoia-capital-blog', name: 'Sequoia', cadence: 'daily', access_method: 'rss' };
const unrelatedSource = { source_id: 'other-source', name: 'Other', cadence: 'daily', access_method: 'rss' };

function attempt(stage: StageName, status: StageAttempt['status'], inputRef: Record<string, unknown>, outputRef: Record<string, unknown> | null = null): StageAttempt {
  return {
    id: `${stage}-${Math.random()}`, pipeline_run_id: 'run-1', stage_name: stage, status,
    attempt_number: 1, max_attempts: 3, idempotency_key: `key-${stage}`,
    lease_owner: null, lease_token: null, leased_at: null, lease_expires_at: null,
    heartbeat_at: null, retry_after: null, input_ref: inputRef, output_ref: outputRef,
    model_run_id: null, error_code: null, error_message: null, error_metadata: {},
    started_at: null, completed_at: status === 'completed' ? new Date().toISOString() : null,
    latency_ms: null, items_processed: 0, items_succeeded: 0, items_failed: 0, cost_usd: 0,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
}

function createRuntimeHarness(initialAttempts: StageAttempt[] = []) {
  const attempts = [...initialAttempts];
  const run = {
    id: 'run-1', pipeline_type: 'news_ingestion', trigger: 'scheduled', status: 'running',
    parameters: { source_scope: selectedSource.source_id }, idempotency_key: 'run-key',
    requested_at: new Date().toISOString(), started_at: new Date().toISOString(), heartbeat_at: new Date().toISOString(),
    completed_at: null, total_items: 0, completed_items: 0, failed_items: 0, total_latency_ms: 0,
    failure_summary: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  } as any;

  const pipelineClient = {
    createOrGetRun: jest.fn().mockResolvedValue({ run_id: run.id, is_new: attempts.length === 0 }),
    enqueueStageAttempt: jest.fn(async (input: any) => {
      const existing = attempts.find((item) => item.stage_name === input.stage_name && item.idempotency_key === input.idempotency_key);
      if (existing) return { attempt_id: existing.id, is_new: false };
      const created = attempt(input.stage_name, 'pending', input.input_ref);
      created.idempotency_key = input.idempotency_key;
      attempts.push(created);
      return { attempt_id: created.id, is_new: true };
    }),
    getRunStages: jest.fn(async () => attempts.map((item) => ({ ...item }))),
    getPendingStageAttempts: jest.fn(async () => attempts.filter((item) => ['pending', 'retry_wait', 'leased'].includes(item.status))),
    getRun: jest.fn(async () => ({ ...run })),
    finalizeRun: jest.fn(async ({ status = 'completed' }: any) => { run.status = status; }),
  } as any;

  const leaseClient = {
    getWorkerId: jest.fn(() => 'worker-1'),
    acquireLease: jest.fn(async (input: any): Promise<LeaseResult | null> => {
      const now = Date.now();
      const item = attempts.find((candidate) => {
        const allowed = !input.allowed_stage_names || input.allowed_stage_names.includes(candidate.stage_name);
        const isDueRetry = candidate.status === 'retry_wait' && (!candidate.retry_after || Date.parse(candidate.retry_after) <= now);
        const isExpiredLease = candidate.status === 'leased' && Boolean(candidate.lease_expires_at) && Date.parse(candidate.lease_expires_at!) <= now;
        return allowed && (candidate.status === 'pending' || isDueRetry || isExpiredLease);
      });
      if (!item) return null;
      item.status = 'leased';
      item.lease_token = `token-${item.stage_name}`;
      return {
        attempt_id: item.id, pipeline_run_id: item.pipeline_run_id, stage_name: item.stage_name,
        idempotency_key: item.idempotency_key, attempt_number: item.attempt_number, input_ref: item.input_ref,
        max_attempts: item.max_attempts, model_run_id: item.model_run_id, lease_token: item.lease_token,
      };
    }),
    heartbeatLease: jest.fn().mockResolvedValue(true),
    completeAttempt: jest.fn(async (input: any) => {
      const item = attempts.find((candidate) => candidate.id === input.attempt_id && candidate.lease_token === input.lease_token);
      if (!item) return false;
      item.status = 'completed'; item.output_ref = input.output_ref; item.lease_token = null;
      item.items_processed = input.items_processed; item.items_succeeded = input.items_succeeded; item.items_failed = input.items_failed;
      return true;
    }),
    failAttempt: jest.fn(async (input: any) => {
      const item = attempts.find((candidate) => candidate.id === input.attempt_id);
      if (item) item.status = 'retry_wait';
      return { attempt_id: input.attempt_id, next_status: 'retry_wait', retry_after: new Date().toISOString() };
    }),
  } as any;

  const orchestrator = new PipelineOrchestrator(
    { workerId: 'worker-1', maxConcurrentStages: 1, leaseSeconds: 300 },
    { pipelineClient, leaseClient },
  );
  return { attempts, run, pipelineClient, leaseClient, orchestrator };
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadApprovedConnectors as jest.Mock).mockResolvedValue([selectedSource, unrelatedSource]);
  (runIngestionForSource as jest.Mock).mockResolvedValue({ success: true, items_fetched: 1, items_new: 1, items_updated: 0 });
  const archiveQuery = { select: jest.fn(), eq: jest.fn(), is: jest.fn(), limit: jest.fn() } as any;
  archiveQuery.select.mockReturnValue(archiveQuery); archiveQuery.eq.mockReturnValue(archiveQuery); archiveQuery.is.mockReturnValue(archiveQuery);
  archiveQuery.limit.mockResolvedValue({ data: [], error: null });
  (ingestionSupabase.from as jest.Mock).mockReturnValue(archiveQuery);
});

describe('executeWithLease', () => {
  const lease: LeaseResult = {
    attempt_id: 'attempt-1', pipeline_run_id: 'run-1', stage_name: 'discover', idempotency_key: 'key',
    attempt_number: 1, input_ref: {}, max_attempts: 3, model_run_id: null, lease_token: 'token-1',
  };

  it('completes successful work exactly once with output and counters', async () => {
    const client = { acquireLease: jest.fn().mockResolvedValue(lease), heartbeatLease: jest.fn().mockResolvedValue(true), completeAttempt: jest.fn().mockResolvedValue(true), failAttempt: jest.fn() } as any;
    const result = await executeWithLease(client, {}, async () => ({ outputRef: { document_version_id: 'doc-1' }, itemsProcessed: 3, itemsSucceeded: 2, itemsFailed: 1, costUsd: 0.25 }), { heartbeatIntervalMs: 5 });
    expect(result).toMatchObject({ success: true, leaseLost: false });
    expect(client.completeAttempt).toHaveBeenCalledTimes(1);
    expect(client.completeAttempt).toHaveBeenCalledWith(expect.objectContaining({ attempt_id: 'attempt-1', output_ref: { document_version_id: 'doc-1' }, items_processed: 3, items_succeeded: 2, items_failed: 1, cost_usd: 0.25 }));
  });

  it('aborts cooperative work on heartbeat loss without complete or fail', async () => {
    const client = { acquireLease: jest.fn().mockResolvedValue(lease), heartbeatLease: jest.fn().mockResolvedValue(false), completeAttempt: jest.fn(), failAttempt: jest.fn() } as any;
    const result = await executeWithLease(client, {}, async (_lease, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new LeaseAbortedError()), { once: true });
    }), { heartbeatIntervalMs: 1 });
    expect(result).toMatchObject({ success: false, leaseLost: true });
    expect(client.completeAttempt).not.toHaveBeenCalled();
    expect(client.failAttempt).not.toHaveBeenCalled();
  });

  it('treats completeAttempt=false as lease loss', async () => {
    const client = { acquireLease: jest.fn().mockResolvedValue(lease), heartbeatLease: jest.fn().mockResolvedValue(true), completeAttempt: jest.fn().mockResolvedValue(false), failAttempt: jest.fn() } as any;
    const result = await executeWithLease(client, {}, async () => ({ outputRef: {}, itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0, costUsd: 0 }), { heartbeatIntervalMs: 5 });
    expect(result).toMatchObject({ success: false, leaseLost: true });
    expect(client.failAttempt).not.toHaveBeenCalled();
  });
});

describe('PipelineOrchestrator production flow', () => {
  it('executes discover -> fetch -> archive with bounded scoped context', async () => {
    const runtime = createRuntimeHarness();
    const result = await runtime.orchestrator.runPipelineBounded('news_ingestion', 'scheduled', { source_scope: selectedSource.source_id }, 3, 'run-key');
    expect(result.processed).toBe(3);
    expect(runtime.attempts.map((item) => item.stage_name)).toEqual(['discover', 'fetch', 'archive']);
    const archiveAttempt = runtime.attempts.find((item) => item.stage_name === 'archive')!;
    expect(archiveAttempt.input_ref).toEqual(expect.objectContaining({ source_scope: selectedSource.source_id, scope: selectedSource.source_id, sources: [expect.objectContaining({ source_id: selectedSource.source_id })] }));
    expect(JSON.stringify(archiveAttempt.input_ref)).not.toContain(unrelatedSource.source_id);
  });

  it('maxStages=1 executes one handler and leaves the run nonterminal', async () => {
    const runtime = createRuntimeHarness();
    const result = await runtime.orchestrator.runPipelineBounded('news_ingestion', 'scheduled', { source_scope: selectedSource.source_id }, 1, 'run-key');
    expect(result.processed).toBe(1);
    expect(runtime.leaseClient.completeAttempt).toHaveBeenCalledTimes(1);
    expect(runtime.pipelineClient.finalizeRun).not.toHaveBeenCalled();
  });

  it('resume continues after persisted completed work without creating a run', async () => {
    const discover = attempt('discover', 'completed', { source_scope: selectedSource.source_id }, { sources: [selectedSource], scope: selectedSource.source_id });
    const runtime = createRuntimeHarness([discover]);
    const result = await runtime.orchestrator.runPipelineBounded('news_ingestion', 'scheduled', { source_scope: selectedSource.source_id }, 1, 'ignored', 'run-1');
    expect(result.processed).toBe(1);
    expect(runtime.pipelineClient.createOrGetRun).not.toHaveBeenCalled();
    expect(runtime.attempts.find((item) => item.stage_name === 'fetch')?.status).toBe('completed');
  });

  it('retry-wait work remains nonterminal instead of failing the run', async () => {
    const discover = attempt('discover', 'completed', {}, { sources: [selectedSource], scope: selectedSource.source_id });
    const fetch = attempt('fetch', 'retry_wait', { sources: [selectedSource], scope: selectedSource.source_id });
    fetch.retry_after = new Date(Date.now() + 60_000).toISOString();
    const runtime = createRuntimeHarness([discover, fetch]);
    const result = await runtime.orchestrator.runPipelineBounded('news_ingestion', 'scheduled', {}, 3, 'ignored', 'run-1');
    expect(result.processed).toBe(0);
    expect(runtime.pipelineClient.finalizeRun).not.toHaveBeenCalled();
    expect(runtime.run.status).toBe('running');
  });

  it('reclaims an expired lease after a cancelled worker', async () => {
    const discover = attempt('discover', 'completed', {}, { sources: [selectedSource], scope: selectedSource.source_id });
    const fetch = attempt('fetch', 'leased', { sources: [selectedSource], scope: selectedSource.source_id });
    fetch.lease_expires_at = new Date(Date.now() - 60_000).toISOString();
    fetch.lease_token = 'abandoned-token';
    const runtime = createRuntimeHarness([discover, fetch]);

    const result = await runtime.orchestrator.runPipelineBounded('news_ingestion', 'scheduled', {}, 1, 'ignored', 'run-1');

    expect(result.processed).toBe(1);
    expect(fetch.status).toBe('completed');
    expect(runtime.leaseClient.acquireLease).toHaveBeenCalledWith(expect.objectContaining({ pipeline_run_id: 'run-1', allowed_stage_names: ['fetch'] }));
  });

  it('retries due retry-wait work instead of stranding the run', async () => {
    const discover = attempt('discover', 'completed', {}, { sources: [selectedSource], scope: selectedSource.source_id });
    const fetch = attempt('fetch', 'retry_wait', { sources: [selectedSource], scope: selectedSource.source_id });
    fetch.retry_after = new Date(Date.now() - 60_000).toISOString();
    const runtime = createRuntimeHarness([discover, fetch]);

    const result = await runtime.orchestrator.runPipelineBounded('news_ingestion', 'scheduled', {}, 1, 'ignored', 'run-1');

    expect(result.processed).toBe(1);
    expect(fetch.status).toBe('completed');
  });

  it('processLeasedWork acquires exactly once and completes that attempt', async () => {
    const runtime = createRuntimeHarness([attempt('discover', 'pending', { source_scope: selectedSource.source_id })]);
    const processed = await runtime.orchestrator.processLeasedWork('news_ingestion', ['discover'], 'run-1');
    expect(processed).toBe(1);
    expect(runtime.leaseClient.acquireLease).toHaveBeenCalledTimes(1);
    expect(runtime.leaseClient.completeAttempt).toHaveBeenCalledWith(expect.objectContaining({ attempt_id: runtime.attempts[0].id }));
  });
});

describe('hosted research publication contracts', () => {
  const migration = readFileSync(resolve(__dirname, '../../supabase/migrations/20261008050000_repair_research_publication_contracts.sql'), 'utf8');
  const thesisMaterializer = readFileSync(resolve(__dirname, '../../src/lib/intelligence/answers/thesis-materializer.ts'), 'utf8');
  const stageHandlers = readFileSync(resolve(__dirname, '../../src/lib/pipeline/stage-handlers.ts'), 'utf8');
  const workflow = readFileSync(resolve(__dirname, '../../.github/workflows/scheduled-ingestion.yml'), 'utf8');

  it('adds every archive/story column required by clustering and the feed API', () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS processed BOOLEAN NOT NULL DEFAULT FALSE/);
    for (const column of ['summary_kind', 'image_url', 'source_urls', 'supporting_sources', 'updated_at']) {
      expect(migration).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\b`));
    }
  });

  it('disambiguates the direct claim-to-evidence relationship', () => {
    expect(thesisMaterializer.match(/claim_evidence!claim_evidence_claim_id_fkey/g)).toHaveLength(3);
  });

  it('gives a cold hosted refresh enough workflow headroom', () => {
    expect(workflow).toMatch(/timeout-minutes:\s*60/);
    expect(stageHandlers).toMatch(/const maxBatches = 30/);
  });
});
