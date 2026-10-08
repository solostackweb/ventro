import { readFileSync } from 'fs';
import { resolve } from 'path';

const migration = readFileSync(
  resolve(__dirname, '../../supabase/migrations/20261008010000_fix_hosted_function_lint.sql'),
  'utf8',
);
const schema = readFileSync(resolve(__dirname, '../../supabase/schema.sql'), 'utf8');

function functionBody(sql: string, functionName: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf('$$;', start);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe('hosted function lint repair migration', () => {
  it('generates a 64-character lease token without search-path-dependent pgcrypto calls', () => {
    const body = functionBody(migration, 'acquire_stage_lease');

    expect(body).not.toMatch(/gen_random_bytes/i);
    expect(body.match(/replace\(gen_random_uuid\(\)::TEXT, '-', ''\)/g)).toHaveLength(2);
    expect(body).toContain('v_lease_token');
  });

  it('fully qualifies the latest source log correlation', () => {
    const body = functionBody(migration, 'get_source_health');

    expect(body).toContain('FROM public.source_fetch_logs latest_sfl');
    expect(body).toContain('WHERE latest_sfl.source_id = sc.source_id');
    expect(body).not.toMatch(/WHERE\s+source_id\s*=\s*sc\.source_id/i);
  });

  it('removes every variable reported unused by hosted lint', () => {
    expect(functionBody(migration, 'activate_student_trial')).not.toMatch(/\bv_result\b/);
    expect(functionBody(migration, 'admin_review_candidate')).not.toMatch(/\bv_new\b/);
    expect(functionBody(migration, 'replay_dead_letter')).not.toMatch(/\bv_run_status\b/);
    expect(functionBody(migration, 'finalize_pipeline_run')).not.toMatch(/\bv_run\b/);
  });

  it('uses a typed empty array in the admin review function', () => {
    const body = functionBody(migration, 'admin_review_candidate');

    expect(body).toContain('v_urls TEXT[] := ARRAY[]::TEXT[]');
    expect(body).toMatch(/COALESCE\(ARRAY_AGG\(VALUE\), ARRAY\[\]::TEXT\[\]\)/);
  });

  it('keeps the consolidated schema aligned with the repaired definitions', () => {
    const leaseBody = functionBody(schema, 'acquire_stage_lease');
    const sourceHealthBody = functionBody(schema, 'get_source_health');
    const adminReviewBody = functionBody(schema, 'admin_review_candidate');

    expect(leaseBody).not.toMatch(/gen_random_bytes/i);
    expect(sourceHealthBody).toContain('WHERE latest_sfl.source_id = sc.source_id');
    expect(adminReviewBody).toContain('ARRAY[]::TEXT[]');
  });

  it('creates admin review dependencies before the schema function that uses them', () => {
    const adminUsers = schema.indexOf('CREATE TABLE public.admin_users');
    const reviewEvents = schema.indexOf('CREATE TABLE public.admin_review_events');
    const reviewFunction = schema.indexOf('CREATE OR REPLACE FUNCTION public.admin_review_candidate');

    expect(adminUsers).toBeGreaterThan(-1);
    expect(reviewEvents).toBeGreaterThan(adminUsers);
    expect(reviewFunction).toBeGreaterThan(reviewEvents);
  });
});
