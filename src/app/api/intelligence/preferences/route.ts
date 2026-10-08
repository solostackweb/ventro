import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { createServerClient } from '@/lib/supabase/server';

export async function DELETE() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    const { error } = await supabase.from('user_profiles').update({ ai_topics: [], geographies: [], stages: [] }).eq('id', user.id);
    if (error) throw error;
    return createSuccessResponse({ reset: true });
  } catch (error) {
    return handleApiError(error, 500, 'PREFERENCES_RESET_FAILED');
  }
}
