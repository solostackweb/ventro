import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function executeSQL(sql: string): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      } as HeadersInit,
      body: JSON.stringify({ sql }),
    });
    
    if (!response.ok) {
      const err = await response.text();
      if (!err.includes('already exists') && !err.includes('duplicate key')) {
        console.log('  SQL Error:', err.slice(0, 200));
      }
      return false;
    }
    return true;
  } catch (e) {
    console.log('  Exception:', e);
    return false;
  }
}

async function runSQLFile(filePath: string, description: string) {
  console.log(`\n=== ${description} ===`);
  const sql = fs.readFileSync(filePath, 'utf-8');
  
  // Split statements by semicolon, handling dollar-quoted strings
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1] || '';
    
    if (!inDollarQuote && char === '$' && nextChar && /[a-zA-Z0-9_]/.test(nextChar)) {
      // Potential start of dollar quote
      let j = i + 1;
      let tag = '$';
      while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) {
        tag += sql[j];
        j++;
      }
      if (j < sql.length && sql[j] === '$') {
        inDollarQuote = true;
        dollarTag = tag + '$';
        i = j;
      }
    } else if (inDollarQuote && sql.slice(i).startsWith(dollarTag)) {
      inDollarQuote = false;
      dollarTag = '';
    }
    
    current += char;
    
    if (!inDollarQuote && char === ';') {
      const stmt = current.trim();
      if (stmt && !stmt.startsWith('--')) {
        statements.push(stmt);
      }
      current = '';
    }
  }
  
  // Handle remaining
  if (current.trim() && !current.trim().startsWith('--')) {
    statements.push(current.trim());
  }
  
  console.log(`  Found ${statements.length} statements`);
  
  let success = 0;
  let skipped = 0;
  for (const stmt of statements) {
    if (stmt.trim()) {
      const result = await executeSQL(stmt);
      if (result) success++;
      else skipped++;
    }
  }
  
  console.log(`  Completed: ${success} succeeded, ${skipped} skipped/failed`);
}

async function main() {
  console.log('=== Running Missing Seeds and Migrations ===\n');
  
  // Run YC migration first (creates tables needed by seed)
  await runSQLFile(
    path.join(__dirname, '../supabase/migrations/20261001_add_yc_tables.sql'),
    'YC Migration'
  );
  
  // Run companies seed
  await runSQLFile(
    path.join(__dirname, '../supabase/seed_companies.sql'),
    'Companies Seed'
  );
  
  // Run source connectors seed (in case not all ran)
  await runSQLFile(
    path.join(__dirname, '../supabase/seed_source_connectors.sql'),
    'Source Connectors Seed'
  );
  
  // Verify
  console.log('\n=== Verification ===');
  const { count: companiesCount } = await supabase.from('companies').select('*', { count: 'exact', head: true });
  const { count: ycBatchesCount } = await supabase.from('yc_batches').select('*', { count: 'exact', head: true });
  const { count: ycBatchCompaniesCount } = await supabase.from('yc_batch_companies').select('*', { count: 'exact', head: true });
  const { count: connectorsCount } = await supabase.from('source_connectors').select('*', { count: 'exact', head: true });
  
  console.log(`\nCompanies: ${companiesCount}`);
  console.log(`YC Batches: ${ycBatchesCount}`);
  console.log(`YC Batch Companies: ${ycBatchCompaniesCount}`);
  console.log(`Source Connectors: ${connectorsCount}`);
}

main().catch(console.error);