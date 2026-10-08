import { NextRequest } from 'next/server';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { normalizeAnswerFilters } from '@/lib/intelligence/answers/filters';
import { recomputeAnswerSnapshots } from '@/lib/intelligence/answers/service';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    const { ingestionSupabase } = await import('@/lib/supabase/ingestion');
    const { data: admin, error: adminError } = await ingestionSupabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    if (adminError) throw adminError;
    if (!admin) return createErrorResponse('Admin access required', 403, 'FORBIDDEN');
    const body = await request.json();
    const filters = normalizeAnswerFilters(body?.filters);
    const results = await recomputeAnswerSnapshots(filters);
    return createSuccessResponse({ results }, 201);
  } catch (error) {
    return handleApiError(error, 500, 'ANSWER_RECOMPUTE_FAILED');
  }
}
