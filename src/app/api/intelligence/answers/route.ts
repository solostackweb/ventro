import { NextRequest } from 'next/server';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { parseAnswerFilters } from '@/lib/intelligence/answers/filters';
import { toPreview } from '@/lib/intelligence/answers/composer';
import { getBothLatestAnswers } from '@/lib/intelligence/answers/service';
import { createServerClient, hasFullAccess } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const kind = request.nextUrl.searchParams.get('kind');
    if (kind && !['investing_now', 'market_demand', 'both'].includes(kind)) {
      return createErrorResponse('Invalid answer kind', 400, 'INVALID_ANSWER_KIND');
    }
    const filters = parseAnswerFilters(request.nextUrl.searchParams);
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    let preferences;
    if (user) {
      const { data } = await supabase.from('user_profiles').select('ai_topics,geographies,stages').eq('id', user.id).maybeSingle();
      preferences = data ? { domains: data.ai_topics ?? [], geographies: data.geographies ?? [], stages: data.stages ?? [] } : undefined;
    }
    const answers = await getBothLatestAnswers(filters, preferences);
    const fullAccess = user ? await hasFullAccess() : false;
    const present = <T extends ReturnType<typeof toPreview> | null>(snapshot: T) => {
      if (!snapshot) return null;
      return fullAccess ? snapshot : toPreview(snapshot);
    };
    const payload = {
      filters,
      access: fullAccess ? 'full' : 'preview',
      investingNow: kind === 'market_demand' ? undefined : present(answers.investingNow),
      marketDemand: kind === 'investing_now' ? undefined : present(answers.marketDemand),
      state: !answers.investingNow && !answers.marketDemand ? 'empty' : 'ready',
    };
    const response = createSuccessResponse(payload);
    response.headers.set('Cache-Control', user ? 'private, max-age=60' : 'public, s-maxage=60, stale-while-revalidate=300');
    response.headers.set('Vary', 'Cookie');
    return response;
  } catch (error) {
    return handleApiError(error, 500, 'ANSWERS_READ_FAILED');
  }
}
