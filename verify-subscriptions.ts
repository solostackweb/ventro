import { ingestionSupabase } from './src/lib/supabase/ingestion';

async function main() {
  const tables = ['subscriptions', 'invoices', 'billing_events'];
  
  for (const table of tables) {
    const { data, error } = await ingestionSupabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`${table}: ERROR - ${error.message}`);
    } else {
      console.log(`${table}: OK (columns: ${Object.keys(data?.[0] || {}).join(', ')})`);
    }
  }
}

main().catch(console.error);