import { createClient } from '@supabase/supabase-js';
import { recomputeAnswerSnapshots } from '../src/lib/intelligence/answers/service';
import { normalizeAnswerFilters } from '../src/lib/intelligence/answers/filters';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const now = new Date();
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const periodStart = new Date(periodEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
  
  const filters = normalizeAnswerFilters({
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    domains: [],
    geographies: ['india'],
    stages: [],
  });
  
  console.log('Filters:', JSON.stringify(filters, null, 2));
  console.log('Triggering recompute...');
  
  try {
    const results = await recomputeAnswerSnapshots(filters);
    console.log('Recompute results:', JSON.stringify(results, null, 2));
    console.log('\n✅ Dashboard answers updated! Refresh /dashboard to see new data.');
  } catch (e) {
    console.error('Error:', e);
  }
}

main().catch(console.error);