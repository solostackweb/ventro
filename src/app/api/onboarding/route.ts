import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { onboardingSchema } from '@/lib/validators/schemas';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = onboardingSchema.parse(body);

    if (!user.email) {
      return NextResponse.json({ error: 'Your account is missing an email address.' }, { status: 400 });
    }

    // Auto-activate trial for @mastersunion.org emails (safety net for callback)
    if (user.email.endsWith('@mastersunion.org')) {
      try {
        await supabase.rpc('activate_student_trial');
      } catch {
        console.warn('Auto trial activation failed during onboarding for:', user.email);
      }
    }

    // All writes are anchored to the verified session user. The service role is
    // required here so onboarding can repair legacy accounts that predate the
    // auth.users -> user_profiles trigger.
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create a missing profile or update the existing profile. Completion is
    // recorded only after all dependent onboarding writes succeed.
    const { error: profileError } = await admin
      .from('user_profiles')
      .upsert({
        id: user.id,
        email: user.email,
        role: validated.role,
        ai_topics: validated.ai_topics,
        geographies: validated.geographies,
        stages: validated.stages,
      }, { onConflict: 'id' });

    if (profileError) throw profileError;

    // Create follow records
    const follows = [];
    if (validated.follow_funds?.length) {
      follows.push(...validated.follow_funds.map((fund_id: string) => ({
        user_id: user.id,
        entity_type: 'fund',
        entity_id: fund_id,
      })));
    }
    if (validated.follow_companies?.length) {
      follows.push(...validated.follow_companies.map((company_id: string) => ({
        user_id: user.id,
        entity_type: 'company',
        entity_id: company_id,
      })));
    }

    if (follows.length) {
      const { error: followError } = await admin
        .from('follows')
        .upsert(follows, {
          onConflict: 'user_id,entity_type,entity_id',
          ignoreDuplicates: true,
        });
      if (followError) throw followError;
    }

    // Create default workspace settings
    const { error: settingsError } = await admin.from('workspace_settings').upsert({
      user_id: user.id,
      feed_ranking_weights: {
        follow_fund: 1.0,
        follow_company: 0.8,
        topic_match: 0.6,
        geography_match: 0.4,
        stage_match: 0.3,
      },
      alert_frequency: 'daily',
      alert_channels: ['email', 'in_app'],
    });

    if (settingsError) throw settingsError;

    const { data: completedProfile, error: completionError } = await admin
      .from('user_profiles')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('id, onboarding_completed_at')
      .single();

    if (completionError || !completedProfile?.onboarding_completed_at) {
      throw completionError || new Error('Onboarding completion was not persisted');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 });
  }
}

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, ai_topics, geographies, stages, onboarding_completed_at')
    .eq('id', user.id)
    .single();

  return NextResponse.json({ profile });
}
