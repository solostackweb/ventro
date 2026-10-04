import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationIds, action } = body; // action: 'read', 'unread', 'archive'
    const supabase = await createServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json({ error: 'No notification IDs provided' }, { status: 400 });
    }

    let updateData: any = {};
    if (action === 'read') {
      updateData = { status: 'read', read_at: new Date().toISOString() };
    } else if (action === 'unread') {
      updateData = { status: 'pending', read_at: null };
    } else if (action === 'archive') {
      updateData = { status: 'archived' };
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('notifications')
      .update(updateData)
      .in('id', notificationIds)
      .eq('user_id', user.id)
      .select();

    if (error) throw error;

    return NextResponse.json({ notifications: data });
  } catch (error) {
    console.error('Update notifications error:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}