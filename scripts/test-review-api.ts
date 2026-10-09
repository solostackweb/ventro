import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Get a story to review
  const { data: stories } = await supabase
    .from('stories')
    .select('id, headline, verification_label')
    .eq('verification_label', 'partial')
    .limit(1)
    .single();
  
  if (!stories) {
    console.log('No stories to review');
    return;
  }
  
  console.log('Testing review for story:', stories.id, stories.headline);
  
  // Test the admin_review_candidate RPC
  const { data, error } = await supabase.rpc('admin_review_candidate', {
    p_kind: 'story',
    p_id: stories.id,
    p_expected_status: stories.verification_label,
    p_new_status: 'verified',
    p_reason: 'Verified against source URL - content matches original article',
  });
  
  if (error) {
    console.error('Review error:', error);
  } else {
    console.log('Review successful! Event ID:', data);
    
    // Verify the update
    const { data: updated } = await supabase
      .from('stories')
      .select('verification_label')
      .eq('id', stories.id)
      .single();
    console.log('New status:', updated?.verification_label);
  }
}

main().catch(console.error);