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

export async function getEntitlement(userId: string): Promise<'preview' | 'discount_card' | 'subscribed'> {
  const profile = await getProfile(userId);
  if (!profile) return 'preview';
  
  // Check if discount card is expired
  if (profile.entitlement === 'discount_card' && profile.discount_card_expires_at) {
    const expiresAt = new Date(profile.discount_card_expires_at);
    if (expiresAt < new Date()) {
      return 'preview';
    }
  }
  
  return profile.entitlement;
}
