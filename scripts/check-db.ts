import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkDatabase() {
  console.log('=== Checking Database State ===\n');
  
  // Check tables
  const tables = [
    'source_connectors',
    'source_fetch_logs', 
    'source_archive',
    'companies',
    'company_aliases',
    'funds',
    'fund_vehicles',
    'stated_thesis',
    'observed_thesis',
    'investments',
    'fund_portfolio',
    'stories',
    'story_companies',
    'story_investors',
    'story_sources',
    'patterns',
    'yc_batches',
    'yc_batch_companies',
    'user_profiles',
    'workspace_settings',
    'follows',
    'saved_items',
    'workspace_notes',
    'alert_rules',
    'notifications',
    'discussion_threads',
    'discussion_comments',
    'admin_audit_log',
    'entitlement_audit'
  ];

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`${table}: ERROR - ${error.message}`);
      } else {
        console.log(`${table}: ${count} rows`);
      }
    } catch (e) {
      console.log(`${table}: TABLE NOT FOUND`);
    }
  }
  
  // Check a few sample records
  console.log('\n=== Sample Data ===');
  
  // Source connectors
  const { data: connectors } = await supabase
    .from('source_connectors')
    .select('source_id, name, status, access_method')
    .limit(5);
  console.log('\nSource Connectors (sample):');
  console.table(connectors || []);
  
  // Companies
  const { data: companies } = await supabase
    .from('companies')
    .select('id, canonical_name, stage, verification_status')
    .limit(5);
  console.log('\nCompanies (sample):');
  console.table(companies || []);
  
  // Funds
  const { data: funds } = await supabase
    .from('funds')
    .select('id, canonical_name, firm_type, verification_status')
    .limit(5);
  console.log('\nFunds (sample):');
  console.table(funds || []);
  
  // Stories
  const { data: stories } = await supabase
    .from('stories')
    .select('id, headline, verification_label, event_date')
    .limit(5);
  console.log('\nStories (sample):');
  console.table(stories || []);
  
  // Investments
  const { data: investments } = await supabase
    .from('investments')
    .select('id, company_id, fund_id, round_stage, amount_usd, verification_status')
    .limit(5);
  console.log('\nInvestments (sample):');
  console.table(investments || []);
}

checkDatabase().catch(console.error);