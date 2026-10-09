import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check stories
  const { data: stories } = await supabase.from('stories').select('id, headline, verification_label, created_at').in('verification_label', ['unverified', 'partial']).limit(10);
  console.log('Stories needing review:', stories?.length);
  stories?.forEach(s => console.log('  ', s.verification_label, s.headline?.slice(0, 60), s.id.slice(0,8)));

  // Check funding rounds
  const { data: rounds } = await supabase.from('funding_rounds').select('id, company_id, round_stage, amount_usd, verification_status, created_at').in('verification_status', ['unverified', 'partial']).limit(10);
  console.log('\nRounds needing review:', rounds?.length);
  rounds?.forEach(r => console.log('  ', r.verification_status, r.round_stage, '\$' + r.amount_usd, r.id.slice(0,8)));

  // Check participants
  const { data: participants } = await supabase.from('round_participants').select('id, round_id, fund_id, role, verification_status, created_at').in('verification_status', ['unverified', 'partial']).limit(10);
  console.log('\nParticipants needing review:', participants?.length);
  participants?.forEach(p => console.log('  ', p.verification_status, p.role, p.id.slice(0,8)));

  // Check patterns
  const { data: patterns } = await supabase.from('patterns').select('id, name, status, created_at').in('status', ['candidate', 'rejected']).limit(10);
  console.log('\nPatterns needing review:', patterns?.length);
  patterns?.forEach(p => console.log('  ', p.status, p.name.slice(0, 50), p.id.slice(0,8)));
}

check().catch(console.error);