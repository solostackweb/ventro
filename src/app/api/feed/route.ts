import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { feedFilterSchema, searchSchema } from '@/lib/validators/schemas';
import { normalizeStory } from '@/lib/utils/normalize-story';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse search separately since it's not in feedFilterSchema
    const search = searchParams.get('q') || '';
    const validated = feedFilterSchema.parse(Object.fromEntries(searchParams));

    const page = validated.page || 1;
    const limit = validated.limit || 20;
    const offset = (page - 1) * limit;

    const supabase = await createServerClient();

    // Build base query
    let query = supabase
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
        )
      `, { count: 'exact' })
      .order('event_date', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply search
    if (search) {
      query = query.or(
        `headline.ilike.%${search}%,summary.ilike.%${search}%,publisher.ilike.%${search}%`
      );
    }

    // Apply filters
    if (validated.topics?.length) {
      query = query.contains('ai_topics', validated.topics);
    }
    if (validated.geographies?.length) {
      query = query.in('geography', validated.geographies);
    }
    if (validated.event_types?.length) {
      query = query.in('event_type', validated.event_types);
    }
    if (validated.verified_only) {
      query = query.eq('verification_label', 'verified');
    }
    if (validated.companies?.length) {
      // Filter via story_companies join - requires subquery
      query = query.in('story_companies.company_id', validated.companies);
    }
    if (validated.investors?.length) {
      query = query.in('story_investors.fund_id', validated.investors);
    }

    const { data: stories, error, count } = await query;

    if (error) {
      console.error('Feed API error:', error);
      return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 });
    }

    const transformedStories = (stories || []).map((s) => normalizeStory(s));

    const total = count || 0;

    return NextResponse.json({
      stories: transformedStories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Feed API error:', error);
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 });
  }
}
