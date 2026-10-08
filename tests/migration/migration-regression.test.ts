/**
 * Migration Regression Tests — Checkpoint 2
 * Tests that the active migration SQL is free of known defect patterns.
 * These tests parse the SQL file directly and assert against defect patterns.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const migrationPath = resolve(__dirname, '../../supabase/migrations/20261007030000_pipeline_orchestration.sql');
const migrationSQL = readFileSync(migrationPath, 'utf8');

describe('Migration 20261007030000 — Defect Regression', () => {
  it('contains no NOW() in CREATE INDEX predicates', () => {
    const indexLines = migrationSQL.split('\n')
      .filter(line => line.trim().startsWith('CREATE INDEX'));
    
    for (const line of indexLines) {
      // Partial index predicates are in WHERE clauses of CREATE INDEX
      const whereMatch = line.match(/WHERE\s+(.+)$/i);
      if (whereMatch) {
        const predicate = whereMatch[1];
        expect(predicate).not.toMatch(/NOW\s*\(/i);
      }
    }
  });

  it('contains no CURRENT_TIMESTAMP in CREATE INDEX predicates', () => {
    const indexLines = migrationSQL.split('\n')
      .filter(line => line.trim().startsWith('CREATE INDEX'));
    
    for (const line of indexLines) {
      const whereMatch = line.match(/WHERE\s+(.+)$/i);
      if (whereMatch) {
        const predicate = whereMatch[1];
        expect(predicate).not.toMatch(/CURRENT_TIMESTAMP/i);
      }
    }
  });

  it('acquire_stage_lease UPDATE uses v_attempt.started_at not sa.started_at', () => {
    // Find the acquire_stage_lease function
    const fnStart = migrationSQL.indexOf('CREATE OR REPLACE FUNCTION public.acquire_stage_lease');
    expect(fnStart).toBeGreaterThan(-1);
    
    const fnEnd = migrationSQL.indexOf('$$;', fnStart);
    const fnBody = migrationSQL.slice(fnStart, fnEnd);
    
    // The UPDATE should reference v_attempt.started_at
    expect(fnBody).toMatch(/started_at\s*=\s*COALESCE\s*\(\s*v_attempt\.started_at/);
    // And should NOT reference sa.started_at in the UPDATE
    expect(fnBody).not.toMatch(/UPDATE public\.stage_attempts[\s\S]*?started_at\s*=\s*COALESCE\s*\(\s*sa\.started_at/);
  });

  it('get_stale_leases returns minutes_stale as INTEGER', () => {
    const fnStart = migrationSQL.indexOf('CREATE OR REPLACE FUNCTION public.get_stale_leases');
    expect(fnStart).toBeGreaterThan(-1);
    
    const fnEnd = migrationSQL.indexOf('$$;', fnStart);
    const fnBody = migrationSQL.slice(fnStart, fnEnd);
    
    // Should cast to INTEGER
    expect(fnBody).toMatch(/minutes_stale\s+INTEGER/);
    expect(fnBody).toMatch(/FLOOR\(EXTRACT\(EPOCH FROM \(NOW\(\) - sa\.lease_expires_at\)\) \/ 60\)::INTEGER/);
  });

  it('get_source_health returns health_score as NUMERIC', () => {
    const fnStart = migrationSQL.indexOf('CREATE OR REPLACE FUNCTION public.get_source_health');
    expect(fnStart).toBeGreaterThan(-1);
    
    const fnEnd = migrationSQL.indexOf('$$;', fnStart);
    const fnBody = migrationSQL.slice(fnStart, fnEnd);
    
    // Should cast to NUMERIC
    expect(fnBody).toMatch(/health_score\s+NUMERIC/);
    expect(fnBody).toMatch(/::NUMERIC/);
  });

  it('idx_pipeline_runs_stale has no time predicate', () => {
    const idxLine = migrationSQL.split('\n')
      .find(line => line.includes('idx_pipeline_runs_stale'));
    
    expect(idxLine).toBeDefined();
    // Should only index on id, heartbeat_at with status = 'running'
    expect(idxLine).toMatch(/CREATE INDEX idx_pipeline_runs_stale ON public\.pipeline_runs\(id, heartbeat_at\) WHERE status = 'running'/);
    // Should NOT have time comparison
    expect(idxLine).not.toMatch(/NOW\(\)/);
    expect(idxLine).not.toMatch(/INTERVAL/);
  });

  it('no partial index contains volatile function', () => {
    const indexLines = migrationSQL.split('\n')
      .filter(line => line.trim().startsWith('CREATE INDEX') && line.includes('WHERE'));
    
    for (const line of indexLines) {
      const whereMatch = line.match(/WHERE\s+(.+)$/i);
      if (whereMatch) {
        const predicate = whereMatch[1];
        // No volatile functions allowed in partial index predicates
        expect(predicate).not.toMatch(/NOW\s*\(/i);
        expect(predicate).not.toMatch(/CURRENT_TIMESTAMP/i);
        expect(predicate).not.toMatch(/RANDOM\s*\(/i);
        expect(predicate).not.toMatch(/GEN_RANDOM_BYTES\s*\(/i);
      }
    }
  });
});