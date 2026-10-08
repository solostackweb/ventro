import { createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { getAnswerFacets } from '@/lib/intelligence/answers/repository';

export async function GET() {
  try {
    const facets = await getAnswerFacets();
    const response = createSuccessResponse({ facets });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
    return response;
  } catch (error) {
    return handleApiError(error, 500, 'ANSWER_FACETS_FAILED');
  }
}
