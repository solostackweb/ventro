import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { createServerClient } from '@/lib/supabase/server';
import { ingestionSupabase } from '@/lib/supabase/ingestion';

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    const body = await request.json().catch(() => ({})) as { confirmation?: string };
    if (body.confirmation !== 'DELETE MY ACCOUNT') {
      return createErrorResponse('Type DELETE MY ACCOUNT to confirm permanent deletion', 400, 'CONFIRMATION_REQUIRED');
    }
    const { error } = await ingestionSupabase.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return createSuccessResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error, 500, 'ACCOUNT_DELETE_FAILED');
  }
}
