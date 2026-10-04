const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

describe('admin extraction route build safety', () => {
  it('can load route configuration without worker-only credentials', () => {
    const code = `
      import { createJiti } from 'jiti';
      const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
      await jiti.import('./src/app/api/admin/extract/route.ts');
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, SUPABASE_SERVICE_ROLE_KEY: '' },
    });

    if (result.status !== 0) throw new Error(result.stderr);
    expect(result.stderr).not.toContain('Missing Supabase credentials for ingestion worker');
  });
});
