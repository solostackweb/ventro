import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Check if user exists and has admin access
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === 'akshat.jain_pgpaias27@mastersunion.org');
  
  if (!user) {
    console.log('User not found');
    return;
  }
  
  console.log('User:', user.email, user.id);
  console.log('Email confirmed:', user.email_confirmed_at);
  console.log('Created:', user.created_at);
  
  // Check admin_users
  const { data: admin } = await supabase.from('admin_users').select('*').eq('user_id', user.id).single();
  console.log('Admin record:', admin);
  
  // Check user profile
  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  console.log('Profile:', profile);
  
  // Check entitlement
  console.log('Entitlement:', profile?.entitlement);
  console.log('Trial expires:', profile?.trial_expires_at);
  console.log('Has full access:', profile?.entitlement === 'subscribed' || (profile?.entitlement === 'student_trial' && profile?.trial_expires_at && new Date(profile.trial_expires_at) > new Date()));
}

main().catch(console.error);