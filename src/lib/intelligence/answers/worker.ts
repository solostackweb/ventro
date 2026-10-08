import { normalizeAnswerFilters } from './filters';
import { recomputeAnswerSnapshots } from './service';

export interface AnswerWorkerArgs {
  help: boolean;
  filters?: Record<string, unknown>;
}

export function parseAnswerArgs(argv: string[]): AnswerWorkerArgs {
  const values: Record<string, string> = {};
  for (let index = 2; index < argv.length; index++) {
    const token = argv[index];
    if (token === '--help') return { help: true };
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const [rawKey, inlineValue] = token.slice(2).split('=', 2);
    const value = inlineValue ?? argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${rawKey}`);
    values[rawKey] = value;
  }
  if (!values['period-start'] || !values['period-end']) throw new Error('--period-start and --period-end are required');
  return {
    help: false,
    filters: {
      periodStart: values['period-start'],
      periodEnd: values['period-end'],
      domains: values.domains?.split(',').filter(Boolean) ?? [],
      geographies: values.geographies?.split(',').filter(Boolean) ?? [],
      stages: values.stages?.split(',').filter(Boolean) ?? [],
      fundId: values['fund-id'] ?? null,
      ycBatchId: values['yc-batch'] ?? null,
    },
  };
}

export async function runAnswerWorker(
  argv: string[],
  dependencies: { recompute?: typeof recomputeAnswerSnapshots; log?: (message: string) => void } = {},
): Promise<number> {
  const parsed = parseAnswerArgs(argv);
  const log = dependencies.log ?? console.log;
  if (parsed.help) {
    log('Usage: node scripts/compute-answer-snapshots.mjs --period-start ISO --period-end ISO [--domains a,b] [--geographies a,b] [--stages a,b] [--fund-id UUID] [--yc-batch ID]');
    return 0;
  }
  const filters = normalizeAnswerFilters(parsed.filters);
  const results = await (dependencies.recompute ?? recomputeAnswerSnapshots)(filters);
  log(JSON.stringify({ status: 'completed', results }));
  return 0;
}
