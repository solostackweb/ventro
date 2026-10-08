import { NextRequest } from 'next/server';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { createServerClient, hasFullAccess } from '@/lib/supabase/server';

/* eslint-disable @typescript-eslint/no-explicit-any */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID.test(id)) return createErrorResponse('Invalid citation ID', 400, 'INVALID_UUID');
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const fullAccess = user ? await hasFullAccess() : false;
    const { ingestionSupabase } = await import('@/lib/supabase/ingestion');
    const { data, error } = await ingestionSupabase.from('answer_snapshot_citations').select(`
      id, stance, label, claim_id, claim_binding_id, claim_evidence_id,
      funding_round_id, round_participant_id, thesis_record_id, pattern_id,
      answer_snapshots!inner(id, answer_kind, status, period_start, period_end),
      claim_evidence(
        id, stance, excerpt, span_start, span_end,
        document_versions(id, published_at, fetched_at, rights_snapshot, source_documents(canonical_url, publisher))
      )
    `).eq('id', id).in('answer_snapshots.status', ['published', 'stale', 'superseded']).maybeSingle();
    if (error) throw error;
    if (!data) return createErrorResponse('Citation not found', 404, 'NOT_FOUND');
    const evidence = data.claim_evidence as Record<string, any> | null;
    const rights = evidence?.document_versions?.rights_snapshot ?? {};
    const canShowExcerpt = rights.can_store_full_text !== false;
    const excerptLimit = fullAccess ? 800 : 280;
    return createSuccessResponse({
      citation: {
        id: data.id,
        stance: data.stance,
        label: data.label,
        targets: {
          claimId: data.claim_id,
          claimBindingId: data.claim_binding_id,
          fundingRoundId: data.funding_round_id,
          roundParticipantId: data.round_participant_id,
          thesisRecordId: data.thesis_record_id,
          patternId: data.pattern_id,
        },
        evidence: evidence ? {
          id: evidence.id,
          stance: evidence.stance,
          excerpt: canShowExcerpt ? String(evidence.excerpt ?? '').slice(0, excerptLimit) : null,
          spanStart: evidence.span_start,
          spanEnd: evidence.span_end,
          sourceUrl: evidence.document_versions?.source_documents?.canonical_url ?? null,
          publisher: evidence.document_versions?.source_documents?.publisher ?? null,
          publishedAt: evidence.document_versions?.published_at ?? null,
          fetchedAt: evidence.document_versions?.fetched_at ?? null,
          excerptRestricted: !canShowExcerpt,
        } : null,
      },
      access: fullAccess ? 'full' : 'preview',
    });
  } catch (error) {
    return handleApiError(error, 500, 'CITATION_READ_FAILED');
  }
}
