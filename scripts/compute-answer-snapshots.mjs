export async function main(argv = process.argv, dependencies = {}) {
  const { createJiti } = await import('jiti');
  const jiti = dependencies.jiti ?? createJiti(import.meta.url, { tsconfigPaths: true });
  const workerModule = dependencies.workerModule ?? jiti('../src/lib/intelligence/answers/worker.ts');
  return workerModule.runAnswerWorker(argv, dependencies);
}

import { pathToFileURL } from 'url';
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(error => {
    console.error('Answer snapshot computation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
