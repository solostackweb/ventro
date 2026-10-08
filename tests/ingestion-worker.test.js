const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

describe('scheduled ingestion entry point', () => {
  it('uses a Node runtime with native WebSocket support', () => {
    const workflow = fs.readFileSync(path.join(root, '.github/workflows/scheduled-ingestion.yml'), 'utf8');
    const version = Number(workflow.match(/node-version:\s*['"]?(\d+)/)?.[1]);
    expect(version).toBeGreaterThanOrEqual(22);
  });

  it('runs a real TypeScript worker rather than a non-existent compiled module', () => {
    const workflow = fs.readFileSync(path.join(root, '.github/workflows/scheduled-ingestion.yml'), 'utf8');
    expect(workflow).toMatch(/npm run pipeline:worker/);
    expect(workflow).not.toMatch(/require\('\.\/lib\/ingestion\/rss-fetcher'\)/);
    expect(fs.existsSync(path.join(root, 'scripts/pipeline-worker.mjs'))).toBe(true);
  });

  it('wires collection, persistent fetch logs, and story clustering together', () => {
    const worker = fs.readFileSync(path.join(root, 'scripts/run-ingestion.mjs'), 'utf8');
    expect(worker).toMatch(/loadApprovedConnectors/);
    expect(worker).toMatch(/runIngestionForSource/);
    expect(worker).toMatch(/source_fetch_logs/);
    expect(worker).toMatch(/runStoryClustering/);
    expect(worker).toMatch(/process\.exitCode = 1/);
  });

  it('loads the TypeScript imports before checking worker credentials', () => {
    const result = spawnSync(process.execPath, ['scripts/run-ingestion.mjs'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, SUPABASE_SERVICE_ROLE_KEY: '' },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Missing Supabase credentials for ingestion worker');
    expect(result.stderr).not.toContain('Cannot find module');
  });
});
