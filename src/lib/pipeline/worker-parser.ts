/**
 * Pipeline Worker CLI Parser — Checkpoint 2
 * Shared parser module for both worker and tests.
 * Pure JavaScript (ESM) with no side effects on import.
 */

export interface WorkerArgs {
  type: string;
  scope: string;
  maxStages: number;
  runOnce: boolean;
  resumeRunId: string | null;
  help: boolean;
}

export async function generateIdempotencyKey(pipelineType: string, scope: string, now = new Date()): Promise<string> {
  const crypto = await import('crypto');
  const isoTimestamp = now.toISOString();
  // News is scheduled hourly, so its identity must permit one run per hour.
  // Expensive derived-intelligence pipelines remain bounded to one run per day.
  const timestamp = pipelineType === 'news_ingestion' ? isoTimestamp.slice(0, 13) : isoTimestamp.slice(0, 10);
  const scopeHash = crypto.createHash('sha256').update(scope || 'all').digest('hex').slice(0, 16);
  return `${pipelineType}:scheduled:${scopeHash}:${timestamp}:1.0`;
}

export function parseArgs(argv: string[]): WorkerArgs {
  const args = argv.slice(2);
  const result: WorkerArgs = {
    type: 'news_ingestion',
    scope: '',
    maxStages: 10,
    runOnce: false,
    resumeRunId: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--type' || arg === '-t') {
      if (i + 1 >= args.length) throw new Error('--type requires a value');
      result.type = args[++i];
    } else if (arg.startsWith('--type=')) {
      result.type = arg.slice('--type='.length);
    } else if (arg === '--scope' || arg === '-s') {
      if (i + 1 >= args.length) throw new Error('--scope requires a value');
      result.scope = args[++i];
    } else if (arg.startsWith('--scope=')) {
      result.scope = arg.slice('--scope='.length);
    } else if (arg === '--max-stages' || arg === '-m') {
      if (i + 1 >= args.length) throw new Error('--max-stages requires a value');
      const val = parseInt(args[++i], 10);
      if (!Number.isFinite(val) || val <= 0) throw new Error('--max-stages must be a positive integer');
      result.maxStages = val;
    } else if (arg.startsWith('--max-stages=')) {
      const val = parseInt(arg.slice('--max-stages='.length), 10);
      if (!Number.isFinite(val) || val <= 0) throw new Error('--max-stages must be a positive integer');
      result.maxStages = val;
    } else if (arg === '--once') {
      result.runOnce = true;
    } else if (arg === '--resume' || arg === '-r') {
      if (i + 1 >= args.length) throw new Error('--resume requires a UUID');
      result.resumeRunId = args[++i];
    } else if (arg.startsWith('--resume=')) {
      result.resumeRunId = arg.slice('--resume='.length);
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return result;
}

export function validateArgs(args: WorkerArgs): void {
  const validTypes = ['news_ingestion', 'funding_extraction', 'thesis_extraction', 'pattern_detection', 'entity_sync', 'full_refresh'];
  if (!validTypes.includes(args.type)) {
    throw new Error(`Invalid pipeline type: ${args.type}. Valid: ${validTypes.join(', ')}`);
  }
  if (args.resumeRunId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.resumeRunId)) {
    throw new Error('--resume requires a valid UUID');
  }
}

export function printHelp(): void {
  console.log(`
Pipeline Worker — Checkpoint 2
Runs pipeline stages using lease-based polling.

Usage:
  node scripts/pipeline-worker.mjs [options]

Options:
  --type, -t <type>         Pipeline type (news_ingestion, funding_extraction, thesis_extraction, pattern_detection, entity_sync, full_refresh)
  --scope, -s <scope>       Source scope filter (optional)
  --max-stages, -m <n>      Max stages to process (default: 10)
  --once                    Process up to max-stages and exit (bounded mode)
  --resume, -r <uuid>       Resume a specific run by ID
  --help, -h                Show this help and exit (no credentials required)

Examples:
  node scripts/pipeline-worker.mjs --help
  node scripts/pipeline-worker.mjs --type=news_ingestion --scope=sequoia-capital-blog --max-stages=5
  node scripts/pipeline-worker.mjs --once --type=funding_extraction
  node scripts/pipeline-worker.mjs --resume=123e4567-e89b-12d3-a456-426614174000
`);
}
