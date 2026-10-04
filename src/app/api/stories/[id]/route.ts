import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeStory } from '@/lib/utils/normalize-story';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: story, error } = await supabase
      .from('stories')
      .select(`
        id,
        canonical_url,
        content_hash,
        headline,
        summary,
        event_date,
        publisher,
        source_count,
        ai_topics,
        geography,
        event_type,
        verification_label,
        last_checked_at,
        created_at,
        story_companies (
          company_id,
          companies!inner (canonical_name),
          role
        ),
        story_investors (
          fund_id,
          funds!inner (canonical_name),
          role
        ),
        story_sources (
          id,
          source_url,
          publisher,
          published_at,
          fetched_at,
          content_hash,
          supports_claims
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Story not found' }, { status: 404 });
      }
      console.error('Story API error:', error);
      return NextResponse.json({ error: 'Failed to fetch story' }, { status: 500 });
    }

    return NextResponse.json({ story: normalizeStory(story) });
  } catch (error) {
    console.error('Story API error:', error);
    return NextResponse.json({ error: 'Failed to fetch story' }, { status: 500 });
  }
}
