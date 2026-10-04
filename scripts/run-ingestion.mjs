import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { loadApprovedConnectors, runIngestionForSource } = await jiti.import('../src/lib/ingestion/rss-fetcher.ts');
const { runStoryClustering } = await jiti.import('../src/lib/ingestion/story-clustering.ts');
const { ingestionSupabase } = await jiti.import('../src/lib/supabase/ingestion.ts');

const scheduledAt = new Date();
const runAll = process.argv.includes('--all');
const clusterOnly = process.argv.includes('--cluster-only');
const isDailyRun = scheduledAt.getUTCHours() === 2;
const isWeeklyRun = isDailyRun && scheduledAt.getUTCDay() === 1;

const connectors = clusterOnly ? [] : await loadApprovedConnectors();
if (!clusterOnly && connectors.length === 0) {
  throw new Error('No approved source connectors could be loaded');
}
const due = connectors.filter((source) => runAll ||
  source.cadence === 'realtime' ||
  source.cadence === 'hourly' ||
  (isDailyRun && source.cadence === 'daily') ||
  (isWeeklyRun && source.cadence === 'weekly'));

const results = [];
let logFailed = false;

for (const source of due) {
  const result = await runIngestionForSource(source.source_id);
  results.push(result);

  const { error } = await ingestionSupabase.from('source_fetch_logs').insert({
    source_id: source.source_id,
    url: source.base_url,
    fetched_at: new Date().toISOString(),
    status: result.success ? 'success' : 'error',
    error_message: result.errors.join('; ') || null,
    items_found: result.items_fetched,
    items_new: result.items_new,
    items_updated: result.items_updated,
    latency_ms: result.latency_ms,
  });

  if (error) {
    logFailed = true;
    console.error(`Failed to record fetch log for ${source.source_id}:`, error);
  }
}

let itemsClustered = 0;
try {
  // A recovery run drains archived items without refetching every feed.
  // Each batch is acknowledged only after its stories and links are saved.
  const maxBatches = clusterOnly ? 20 : 1;
  for (let batch = 0; batch < maxBatches; batch++) {
    const count = await runStoryClustering();
    itemsClustered += count;
    if (count < 100) break;
  }
} catch (error) {
  console.error('Story clustering failed:', error);
  process.exitCode = 1;
}

if (results.some((result) => !result.success) || logFailed) {
  process.exitCode = 1;
}

console.log(JSON.stringify({
  sources_due: due.length,
  sources_succeeded: results.filter((result) => result.success).length,
  sources_failed: results.filter((result) => !result.success).length,
  items_fetched: results.reduce((sum, result) => sum + result.items_fetched, 0),
  items_new: results.reduce((sum, result) => sum + result.items_new, 0),
  items_clustered: itemsClustered,
}));
