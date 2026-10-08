/**
 * Pipeline Worker CLI — Checkpoint 2
 * Pure JavaScript (ESM) for direct Node.js execution.
 * Uses shared parser module; does not execute on import.
 */

export async function main(argv = process.argv, dependencies = {}) {
  const { createJiti } = await import('jiti');
  const jiti = dependencies.jiti ?? createJiti(import.meta.url, { tsconfigPaths: true });
  const { runPipelineWorker } = dependencies.workerModule ?? jiti('../src/lib/pipeline/worker-main.ts');
  return runPipelineWorker(argv, dependencies);
}

import { pathToFileURL } from 'url';
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error('Pipeline worker failed:', error);
    process.exit(1);
  });
}
