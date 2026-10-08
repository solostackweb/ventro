import { NextRequest } from 'next/server';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { toPreview } from '@/lib/intelligence/answers/composer';
import { getAnswerSnapshotById } from '@/lib/intelligence/answers/repository';
import { createServerClient, hasFullAccess } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID.test(id)) return createErrorResponse('Invalid snapshot ID', 400, 'INVALID_UUID');
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const snapshot = await getAnswerSnapshotById(id);
    if (!snapshot || !['published', 'superseded', 'stale'].includes(snapshot.status)) {
      return createErrorResponse('Answer snapshot not found', 404, 'NOT_FOUND');
    }
    const fullAccess = user ? await hasFullAccess() : false;
    return createSuccessResponse({ snapshot: fullAccess ? snapshot : toPreview(snapshot), access: fullAccess ? 'full' : 'preview' });
  } catch (error) {
    return handleApiError(error, 500, 'ANSWER_DETAIL_FAILED');
  }
}
