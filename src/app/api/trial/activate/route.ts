import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call the atomic PostgreSQL function for trial activation
    const { data, error } = await supabase.rpc('activate_student_trial');

    if (error) {
      console.error('Trial activation RPC error:', error);
      return handleApiError(error);
    }

    // The function returns a JSONB with success/code/message
    const result = data as {
      success: boolean;
      code: string;
      message: string;
      entitlement?: string;
      trial_expires_at?: string;
      trial_issued_at?: string;
    };

    if (!result.success) {
      // Map error codes to HTTP status codes
      const statusMap: Record<string, number> = {
        'EMAIL_NOT_FOUND': 400,
        'INELIGIBLE_DOMAIN': 403,
        'EMAIL_UNCONFIRMED': 403,
        'TRIAL_CONSUMED': 409,
        'TRIAL_ALREADY_ACTIVE': 409,
      };
      const status = statusMap[result.code] || 400;
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      entitlement: result.entitlement,
      trial_expires_at: result.trial_expires_at,
      trial_issued_at: result.trial_issued_at,
    });
  } catch (error) {
    console.error('Trial activation error:', error);
    return handleApiError(error);
  }
}