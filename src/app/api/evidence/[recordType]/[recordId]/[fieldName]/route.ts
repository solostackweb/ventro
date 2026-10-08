import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_FIELDS: Record<string, string[]> = {
  funding_round: ['amount_usd', 'round_stage', 'announced_date'],
  round_participant: ['role'],
};

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ recordType: string; recordId: string; fieldName: string }> }
) {
  const supabase = await createServerClient();

  // Authentication check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return errorResponse('Unauthorized', 401, 'UNAUTHENTICATED');
  }

  const { recordType, recordId, fieldName } = await params;

  // Validate record type
  if (!['funding_round', 'round_participant'].includes(recordType)) {
    return errorResponse('Invalid record type. Must be funding_round or round_participant', 400, 'INVALID_RECORD_TYPE');
  }

  // Validate field name against allowlist
  const allowedFields = ALLOWED_FIELDS[recordType];
  if (!allowedFields.includes(fieldName)) {
    return errorResponse(`Invalid field name for ${recordType}`, 400, 'INVALID_FIELD_NAME');
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(recordId)) {
    return errorResponse('Invalid record ID format', 400, 'INVALID_UUID');
  }

  // Entitlement check for protected evidence
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('entitlement, trial_expires_at')
    .eq('id', user.id)
    .single();

  const hasFullAccess = profile?.entitlement === 'subscribed' ||
    (profile?.entitlement === 'student_trial' && profile?.trial_expires_at && new Date(profile.trial_expires_at) > new Date());

  // For now, allow authenticated users to access evidence
  // In future, could restrict based on entitlement for sensitive data
  if (!hasFullAccess) {
    // Allow preview access to evidence for transparency
    // Full access could be gated behind entitlement later
  }

  try {
    const { data, error } = await supabase.rpc('get_field_evidence', {
      p_record_type: recordType,
      p_record_id: recordId,
      p_field_name: fieldName,
    });

    if (error) {
      console.error('get_field_evidence error:', error);
      return errorResponse('Failed to fetch evidence', 500, 'RPC_ERROR');
    }

    return NextResponse.json({ evidence: data || [] });
  } catch (err) {
    console.error('Evidence API error:', err);
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
}