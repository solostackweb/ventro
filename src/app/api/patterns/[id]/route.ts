import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: pattern, error } = await supabase
      .from('patterns')
      .select(`
        id,
        name,
        description,
        time_window_start,
        time_window_end,
        baseline_value,
        current_value,
        change_percentage,
        distinct_companies,
        distinct_funds,
        qualifying_events,
        counterexamples,
        confidence,
        coverage_notes,
        status,
        source_links,
        created_by,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at,
        user_profiles!created_by (
          id,
          email,
          role
        ),
        user_profiles!reviewed_by (
          id,
          email,
          role
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Pattern not found' }, { status: 404 });
      }
      console.error('Pattern API error:', error);
      return NextResponse.json({ error: 'Failed to fetch pattern' }, { status: 500 });
    }

    return NextResponse.json({ pattern });
  } catch (error) {
    console.error('Pattern API error:', error);
    return NextResponse.json({ error: 'Failed to fetch pattern' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = await createServerClient();

    // Verify admin access
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Check if user is admin (you may want to add an admin role check here)
    // For now, allow any authenticated user to update pattern status

    const { data: pattern, error } = await supabase
      .from('patterns')
      .update({
        ...body,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Pattern update error:', error);
      return NextResponse.json({ error: 'Failed to update pattern' }, { status: 500 });
    }

    return NextResponse.json({ pattern });
  } catch (error) {
    console.error('Pattern update error:', error);
    return NextResponse.json({ error: 'Failed to update pattern' }, { status: 500 });
  }
}