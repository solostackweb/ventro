import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Payments are disabled until Phase 7 (Commercial Activation).
  // This endpoint intentionally fails closed: no provider calls, no DB mutations.
  return handleApiError(new Error('Payments are not available yet'), 503, 'PAYMENTS_DISABLED');
}