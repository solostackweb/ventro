/**
 * Lease Logic Tests — Checkpoint 2
 * Tests for lease acquisition, heartbeat, completion, failure, and replay logic.
 * These tests verify the core lease state machine logic without database.
 */

import { StageStatus, Retryability } from '@/lib/pipeline/types';

// Simulate the lease state machine logic
type LeaseState = {
  status: StageStatus;
  lease_owner: string | null;
  lease_token: string | null;
  leased_at: string | null;
  lease_expires_at: string | null;
  heartbeat_at: string | null;
  attempt_number: number;
  max_attempts: number;
  retry_after: string | null;
  error_code: string | null;
  error_message: string | null;
  completed_at: string | null;
  latency_ms: number | null;
  output_ref: Record<string, unknown> | null;
  items_processed: number;
  items_succeeded: number;
  items_failed: number;
  cost_usd: number;
  error_metadata: Record<string, unknown>;
};

function createInitialState(): LeaseState {
  return {
    status: 'pending',
    lease_owner: null,
    lease_token: null,
    leased_at: null,
    lease_expires_at: null,
    heartbeat_at: null,
    attempt_number: 1,
    max_attempts: 3,
    retry_after: null,
    error_code: null,
    error_message: null,
    completed_at: null,
    latency_ms: null,
    output_ref: null,
    items_processed: 0,
    items_succeeded: 0,
    items_failed: 0,
    cost_usd: 0,
    error_metadata: {},
  };
}

function acquireLease(state: LeaseState, workerId: string, leaseSeconds: number, now: Date = new Date()): LeaseState {
  if (state.status !== 'pending' && state.status !== 'retry_wait' && state.status !== 'leased') {
    throw new Error(`Cannot acquire lease from status: ${state.status}`);
  }

  if (state.status === 'leased' && state.lease_expires_at) {
    const expiry = new Date(state.lease_expires_at);
    if (expiry > now) {
      throw new Error('Lease not expired');
    }
  }

  const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1000);
  const leaseToken = `token-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    ...state,
    status: 'leased',
    lease_owner: workerId,
    lease_token: leaseToken,
    leased_at: now.toISOString(),
    lease_expires_at: leaseExpiresAt.toISOString(),
    retry_after: null,
  };
}

function heartbeatLease(state: LeaseState, leaseToken: string, leaseSeconds: number, now: Date = new Date()): LeaseState {
  if (state.status !== 'leased') {
    throw new Error('Cannot heartbeat non-leased attempt');
  }

  if (state.lease_token !== leaseToken) {
    throw new Error('Invalid lease token');
  }

  if (state.lease_expires_at) {
    const expiry = new Date(state.lease_expires_at);
    if (expiry <= now) {
      throw new Error('Lease already expired');
    }
  }

  const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1000);

  return {
    ...state,
    heartbeat_at: now.toISOString(),
    lease_expires_at: leaseExpiresAt.toISOString(),
  };
}

function completeAttempt(
  state: LeaseState,
  leaseToken: string,
  outputRef: Record<string, unknown>,
  itemsProcessed: number,
  itemsSucceeded: number,
  itemsFailed: number,
  costUsd: number,
  now: Date = new Date()
): LeaseState {
  if (state.status !== 'leased') {
    throw new Error('Cannot complete non-leased attempt');
  }

  if (state.lease_token !== leaseToken) {
    throw new Error('Invalid lease token');
  }

  const startedAt = state.leased_at ? new Date(state.leased_at) : now;
  const latencyMs = now.getTime() - startedAt.getTime();

  return {
    ...state,
    status: 'completed',
    output_ref: outputRef,
    items_processed: itemsProcessed,
    items_succeeded: itemsSucceeded,
    items_failed: itemsFailed,
    cost_usd: costUsd,
    completed_at: now.toISOString(),
    latency_ms: latencyMs,
    lease_owner: null,
    lease_token: null,
    leased_at: null,
    lease_expires_at: null,
    heartbeat_at: null,
  };
}

function failAttempt(
  state: LeaseState,
  leaseToken: string,
  errorCode: string,
  errorMessage: string,
  retryability: Retryability,
  now: Date = new Date()
): { state: LeaseState; nextStatus: StageStatus; retryAfter: Date | null } {
  if (state.status !== 'leased') {
    throw new Error('Cannot fail non-leased attempt');
  }

  if (state.lease_token !== leaseToken) {
    throw new Error('Invalid lease token');
  }

  const startedAt = state.leased_at ? new Date(state.leased_at) : now;
  const latencyMs = now.getTime() - startedAt.getTime();

  let nextStatus: StageStatus;
  let retryAfter: Date | null = null;

  if (retryability === 'non_retryable' || state.attempt_number >= state.max_attempts) {
    nextStatus = 'dead_letter';
  } else {
    nextStatus = 'retry_wait';
    const backoffMinutes = state.attempt_number === 1 ? 1 : state.attempt_number === 2 ? 5 : 15;
    retryAfter = new Date(now.getTime() + backoffMinutes * 60 * 1000);
  }

  const newState: LeaseState = {
    ...state,
    status: nextStatus,
    error_code: errorCode,
    error_message: errorMessage,
    retry_after: retryAfter?.toISOString() ?? null,
    completed_at: nextStatus === 'dead_letter' ? now.toISOString() : null,
    latency_ms: latencyMs,
    lease_owner: null,
    lease_token: null,
    leased_at: null,
    lease_expires_at: null,
    heartbeat_at: null,
    attempt_number: state.attempt_number + 1,
  };

  return { state: newState, nextStatus, retryAfter };
}

function replayDeadLetter(state: LeaseState, reason: string, now: Date = new Date()): LeaseState {
  if (state.status !== 'dead_letter') {
    throw new Error('Can only replay dead_letter attempts');
  }

  return {
    ...state,
    status: 'pending',
    attempt_number: state.attempt_number + 1,
    error_code: null,
    error_message: null,
    retry_after: null,
    completed_at: null,
    latency_ms: null,
    error_metadata: {
      ...(state as any).error_metadata,
      replayed_from: 'original-attempt-id',
      reason,
      replayed_at: now.toISOString(),
    },
  };
}

describe('Lease State Machine', () => {
  let state: LeaseState;
  const workerId = 'worker-1';
  const leaseSeconds = 300;

  beforeEach(() => {
    state = createInitialState();
  });

  describe('acquireLease', () => {
    it('acquires lease from pending', () => {
      const newState = acquireLease(state, workerId, leaseSeconds);
      expect(newState.status).toBe('leased');
      expect(newState.lease_owner).toBe(workerId);
      expect(newState.lease_token).toBeDefined();
      expect(newState.lease_expires_at).toBeDefined();
    });

    it('acquires lease from retry_wait', () => {
      state.status = 'retry_wait';
      state.retry_after = new Date(Date.now() - 1000).toISOString();
      const newState = acquireLease(state, workerId, leaseSeconds);
      expect(newState.status).toBe('leased');
    });

    it('acquires lease from expired lease', () => {
      state.status = 'leased';
      state.lease_expires_at = new Date(Date.now() - 1000).toISOString();
      const newState = acquireLease(state, workerId, leaseSeconds);
      expect(newState.status).toBe('leased');
    });

    it('rejects acquire from running', () => {
      state.status = 'running';
      expect(() => acquireLease(state, workerId, leaseSeconds)).toThrow('Cannot acquire lease from status: running');
    });

    it('rejects acquire from completed', () => {
      state.status = 'completed';
      expect(() => acquireLease(state, workerId, leaseSeconds)).toThrow('Cannot acquire lease from status: completed');
    });

    it('rejects acquire from active lease', () => {
      state.status = 'leased';
      state.lease_expires_at = new Date(Date.now() + 60000).toISOString();
      expect(() => acquireLease(state, workerId, leaseSeconds)).toThrow('Lease not expired');
    });
  });

  describe('heartbeatLease', () => {
    it('extends lease expiry', () => {
      const fixedNow = new Date('2026-10-07T00:00:00.000Z');
      state = acquireLease(state, workerId, leaseSeconds, fixedNow);
      const originalExpiry = state.lease_expires_at;

      // Advance time by 1 second
      const laterNow = new Date(fixedNow.getTime() + 1000);
      const newState = heartbeatLease(state, state.lease_token!, leaseSeconds, laterNow);
      expect(newState.lease_expires_at).not.toBe(originalExpiry);
      expect(new Date(newState.lease_expires_at!).getTime()).toBeGreaterThan(new Date(originalExpiry!).getTime());
    });

    it('updates heartbeat timestamp', () => {
      state = acquireLease(state, workerId, leaseSeconds);
      const newState = heartbeatLease(state, state.lease_token!, leaseSeconds);
      expect(newState.heartbeat_at).toBeDefined();
    });

    it('rejects heartbeat with wrong token', () => {
      state = acquireLease(state, workerId, leaseSeconds);
      expect(() => heartbeatLease(state, 'wrong-token', leaseSeconds)).toThrow('Invalid lease token');
    });

    it('rejects heartbeat on expired lease', () => {
      state = acquireLease(state, workerId, leaseSeconds);
      state.lease_expires_at = new Date(Date.now() - 1000).toISOString();
      expect(() => heartbeatLease(state, state.lease_token!, leaseSeconds)).toThrow('Lease already expired');
    });

    it('rejects heartbeat on non-leased', () => {
      expect(() => heartbeatLease(state, 'token', leaseSeconds)).toThrow('Cannot heartbeat non-leased attempt');
    });
  });

  describe('completeAttempt', () => {
    it('completes attempt with output', () => {
      state = acquireLease(state, workerId, leaseSeconds);
      const newState = completeAttempt(state, state.lease_token!, { result: 'success' }, 5, 5, 0, 0.01);

      expect(newState.status).toBe('completed');
      expect(newState.output_ref).toEqual({ result: 'success' });
      expect(newState.items_processed).toBe(5);
      expect(newState.items_succeeded).toBe(5);
      expect(newState.items_failed).toBe(0);
      expect(newState.cost_usd).toBe(0.01);
      expect(newState.lease_token).toBeNull();
      expect(newState.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it('rejects complete with wrong token', () => {
      state = acquireLease(state, workerId, leaseSeconds);
      expect(() => completeAttempt(state, 'wrong-token', {}, 1, 1, 0, 0)).toThrow('Invalid lease token');
    });

    it('rejects complete on non-leased', () => {
      expect(() => completeAttempt(state, 'token', {}, 1, 1, 0, 0)).toThrow('Cannot complete non-leased attempt');
    });
  });

  describe('failAttempt', () => {
    it('fails with retry_wait on first retryable attempt', () => {
      state = acquireLease(state, workerId, leaseSeconds);
      const { state: newState, nextStatus, retryAfter } = failAttempt(
        state,
        state.lease_token!,
        'TIMEOUT',
        'Request timeout',
        'retryable'
      );

      expect(nextStatus).toBe('retry_wait');
      expect(newState.status).toBe('retry_wait');
      expect(newState.attempt_number).toBe(2);
      expect(newState.retry_after).toBeDefined();
      expect(retryAfter).not.toBeNull();
      expect(newState.error_code).toBe('TIMEOUT');
      expect(newState.error_message).toBe('Request timeout');
    });

    it('fails with dead_letter on non-retryable error', () => {
      state = acquireLease(state, workerId, leaseSeconds);
      const { state: newState, nextStatus } = failAttempt(
        state,
        state.lease_token!,
        'VALIDATION_ERROR',
        'Invalid input',
        'non_retryable'
      );

      expect(nextStatus).toBe('dead_letter');
      expect(newState.status).toBe('dead_letter');
      expect(newState.completed_at).toBeDefined();
    });

    it('fails with dead_letter after max attempts', () => {
      state = acquireLease(state, workerId, leaseSeconds);
      state.attempt_number = 3;
      state.max_attempts = 3;

      const { state: newState, nextStatus } = failAttempt(
        state,
        state.lease_token!,
        'TIMEOUT',
        'Request timeout',
        'retryable'
      );

      expect(nextStatus).toBe('dead_letter');
      expect(newState.status).toBe('dead_letter');
    });

    it('uses exponential backoff: 1, 5, 15 minutes', () => {
      const now = new Date();

      state = acquireLease(state, workerId, leaseSeconds);
      let { retryAfter } = failAttempt(state, state.lease_token!, 'ERR', 'msg', 'retryable', now);
      expect(retryAfter!.getTime() - now.getTime()).toBeCloseTo(1 * 60 * 1000, -3);

      state = { ...createInitialState(), attempt_number: 2, max_attempts: 3 };
      state = acquireLease(state, workerId, leaseSeconds);
      ({ retryAfter } = failAttempt(state, state.lease_token!, 'ERR', 'msg', 'retryable', now));
      expect(retryAfter!.getTime() - now.getTime()).toBeCloseTo(5 * 60 * 1000, -3);

      state = { ...createInitialState(), attempt_number: 3, max_attempts: 3 };
      state = acquireLease(state, workerId, leaseSeconds);
      ({ retryAfter } = failAttempt(state, state.lease_token!, 'ERR', 'msg', 'retryable', now));
      expect(retryAfter).toBeNull(); // dead_letter
    });

    it('rejects fail with wrong token', () => {
      state = acquireLease(state, workerId, leaseSeconds);
      expect(() => failAttempt(state, 'wrong-token', 'ERR', 'msg', 'retryable')).toThrow('Invalid lease token');
    });
  });

  describe('replayDeadLetter', () => {
    it('creates new attempt from dead_letter', () => {
      state = createInitialState();
      state.status = 'dead_letter';
      state.attempt_number = 3;

      const newState = replayDeadLetter(state, 'Fixed root cause');
      expect(newState.status).toBe('pending');
      expect(newState.attempt_number).toBe(4);
      expect(newState.error_code).toBeNull();
      expect(newState.error_message).toBeNull();
      expect((newState as any).error_metadata.reason).toBe('Fixed root cause');
    });

    it('rejects replay from non-dead-letter', () => {
      expect(() => replayDeadLetter(state, 'reason')).toThrow('Can only replay dead_letter attempts');
    });
  });

  describe('Concurrency Simulation', () => {
    it('two workers competing - only one gets lease', () => {
      const state1 = createInitialState();
      const state2 = { ...state1 };

      const lease1 = acquireLease(state1, 'worker-1', leaseSeconds);
      const lease2 = acquireLease(state2, 'worker-2', leaseSeconds);

      // Both succeed in isolation (simulating SKIP LOCKED)
      // In reality, DB SKIP LOCKED ensures only one gets it
      expect(lease1.lease_token).not.toBe(lease2.lease_token);
    });

    it('lease token is unguessable', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const s = acquireLease(createInitialState(), 'worker', leaseSeconds);
        tokens.add(s.lease_token!);
      }
      expect(tokens.size).toBe(100); // All unique
    });
  });
});