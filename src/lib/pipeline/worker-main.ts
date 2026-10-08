import {
  generateIdempotencyKey,
  parseArgs,
  printHelp,
  validateArgs,
} from './worker-parser';
import type { PipelineType } from './types';

interface BoundedOrchestrator {
  runPipelineBounded: (
    pipelineType: ReturnType<typeof parseArgs>['type'],
    trigger: 'scheduled',
    parameters: Record<string, unknown>,
    maxStages: number,
    idempotencyKey: string,
    resumeRunId?: string,
  ) => Promise<{ runId: string; processed: number; status: string }>;
}

export interface PipelineWorkerDependencies {
  orchestrator?: BoundedOrchestrator;
  loadOrchestrator?: () => Promise<BoundedOrchestrator>;
  log?: (message: string) => void;
}

export async function runPipelineWorker(
  argv: string[] = process.argv,
  dependencies: PipelineWorkerDependencies = {},
) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return { help: true as const };
  }
  validateArgs(args);

  const log = dependencies.log ?? console.log;
  const orchestrator = dependencies.orchestrator ?? await (
    dependencies.loadOrchestrator ?? (async () => {
      const { createPipelineOrchestrator } = await import('./index');
      return createPipelineOrchestrator({ maxConcurrentStages: 1, leaseSeconds: 300 });
    })
  )();

  log(`Starting pipeline worker: type=${args.type}, scope=${args.scope || 'all'}, maxStages=${args.maxStages}`);
  if (args.resumeRunId) log(`Resuming pipeline run: ${args.resumeRunId}`);

  const idempotencyKey = await generateIdempotencyKey(args.type, args.scope);
  const result = await orchestrator.runPipelineBounded(
    args.type as PipelineType,
    'scheduled',
    { source_scope: args.scope || 'all' },
    args.maxStages,
    idempotencyKey,
    args.resumeRunId ?? undefined,
  );

  if (args.runOnce) {
    log(`Worker completed. Processed ${result.processed} stage attempts. Run: ${result.runId} (${result.status})`);
  } else {
    log(`Pipeline completed: ${result.runId} (processed ${result.processed} stages, status: ${result.status})`);
  }
  return result;
}
