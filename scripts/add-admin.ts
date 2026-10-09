import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Get the current user (you'll need to replace with your actual user ID or email)
  // Option 1: If you know your user ID
  // const userId = 'your-user-id-here';
  
  // Option 2: Find by email
  const email = 'akshat.jain_pgpaias27@mastersunion.org'; // Replace with your email
  
  console.log(`Finding user with email: ${email}`);
  
  // Use admin API to find user
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError.message);
    return;
  }
  
  const user = users.users.find(u => u.email === email);
  if (!user) {
    console.log('User not found. Available users:');
    users.users.forEach(u => console.log(`  ${u.email} (${u.id})`));
    return;
  }
  
  console.log(`Found user: ${user.email} (${user.id})`);
  
  // Check if already admin
  const { data: existing } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .single();
  
  if (existing) {
    console.log('User is already an admin!');
    return;
  }
  
  // Add to admin_users
  const { error } = await supabase
    .from('admin_users')
    .insert({ user_id: user.id });
  
  if (error) {
    console.error('Error adding admin:', error.message);
    return;
  }
  
  console.log(`Successfully added ${email} as admin!`);
  console.log('You can now access:');
  console.log('  - /admin (Admin Dashboard - sources, logs, usage, audit)');
  console.log('  - /admin/review (Review Queue - stories, rounds, participants, patterns)');
}

main().catch(console.error);