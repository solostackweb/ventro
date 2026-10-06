const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Regression: ISSUE-001 — candidate rows are hidden by browser RLS, and review writes bypass server audit.
// Found by /qa on 2026-10-05
// Report: QA_ADMIN_REVIEW_2026-10-05.md
// Admin review objects are now part of the active baseline migration (20261006010000_initial_ventro_schema.sql)
describe('admin review boundary', () => {
  const page = fs.readFileSync(path.join(__dirname, '../src/app/(dashboard)/admin/review/page.tsx'), 'utf8');
  const route = fs.readFileSync(path.join(__dirname, '../src/app/api/admin/review/route.ts'), 'utf8');
  const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261006010000_initial_ventro_schema.sql'), 'utf8');

  test('review page does not query or mutate Supabase directly from the browser', () => {
    expect(page).not.toContain("from '@/lib/supabase/client'");
    expect(page).toContain("/api/admin/review");
  });

  test('server gates review access on server-managed membership and calls an atomic review function', () => {
    expect(route).toContain(".from('admin_users')");
    expect(route).not.toContain("profile?.role === 'admin'");
    expect(route).toContain("rpc('admin_review_candidate'");
    expect(migration.toLowerCase()).toContain('for update');
    expect(migration.toLowerCase()).toContain('insert into public.admin_review_events');
    expect(migration.toLowerCase()).toContain('where user_id = v_actor');
    expect(migration.toLowerCase()).toContain('v_old_status is distinct from p_expected_status');
  });

  test('route can load at build time without a service-role key', () => {
    const code = `
      import { createJiti } from 'jiti';
      const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
      await jiti.import('./src/app/api/admin/review/route.ts');
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
      cwd: path.resolve(__dirname, '..'), encoding: 'utf8',
      env: { ...process.env, SUPABASE_SERVICE_ROLE_KEY: '' },
    });
    if (result.status !== 0) throw new Error(result.stderr);
  });
});