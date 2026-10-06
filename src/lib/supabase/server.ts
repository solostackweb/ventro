import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot set cookies. Middleware refreshes them.
          }
        },
      },
    }
  );
}

export async function getUser() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getProfile(userId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) return null;
  return data;
}

/**
 * Centralized expiry-aware access check.
 * Returns true only for active subscribed or non-expired student_trial.
 * Delegates to the database function for authoritative evaluation.
 * Derives identity from auth.uid() - no user_id parameter.
 */
export async function hasFullAccess(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('has_full_access');
  if (error) {
    console.error('has_full_access RPC error:', error);
    return false;
  }
  return data === true;
}

/**
 * Get entitlement with expiry awareness for display purposes.
 * Still uses profile read for UI, but full access decisions should use hasFullAccess().
 */
export async function getEntitlement(userId: string): Promise<'preview' | 'student_trial' | 'subscribed'> {
  const profile = await getProfile(userId);
  if (!profile) return 'preview';
  
  // Check if student trial is expired
  if (profile.entitlement === 'student_trial' && profile.trial_expires_at) {
    const expiresAt = new Date(profile.trial_expires_at);
    if (expiresAt < new Date()) {
      return 'preview';
    }
  }
  
  return profile.entitlement;
}