import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supabase = await createServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's alert rules
    const { data: alertRules, error: rulesError } = await supabase
      .from('alert_rules')
      .select(`
        id,
        entity_type,
        entity_id,
        trigger,
        frequency,
        channels,
        topic_filter,
        is_active,
        last_triggered_at,
        created_at,
        updated_at
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (rulesError) throw rulesError;

    // Get recent notifications
    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .select(`
        id,
        alert_rule_id,
        type,
        title,
        body,
        data,
        channels,
        status,
        sent_at,
        read_at,
        created_at
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (notifError) throw notifError;

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'pending');

    return NextResponse.json({
      alertRules: alertRules || [],
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
    });
  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create alert rule
    const { data: alertRule, error } = await supabase
      .from('alert_rules')
      .insert({
        user_id: user.id,
        entity_type: body.entity_type,
        entity_id: body.entity_id,
        trigger: body.trigger,
        frequency: body.frequency || 'daily',
        channels: body.channels || ['in_app'],
        topic_filter: body.topic_filter || [],
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ alertRule });
  } catch (error) {
    console.error('Create alert rule error:', error);
    return NextResponse.json({ error: 'Failed to create alert rule' }, { status: 500 });
  }
}