import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _ingestionSupabase: SupabaseClient | null = null;

function getIngestionSupabase(): SupabaseClient {
  if (_ingestionSupabase) return _ingestionSupabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase credentials for ingestion worker');
  }

  _ingestionSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _ingestionSupabase;
}

// Export a proxy that lazily initializes the client
export const ingestionSupabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const client = getIngestionSupabase();
    const value = client[prop as keyof SupabaseClient];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});