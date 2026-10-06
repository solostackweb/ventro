import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Razorpay webhooks are disabled until Phase 7 (Commercial Activation).
  // This endpoint intentionally fails closed: no event parsing, no DB mutations.
  return handleApiError(new Error('Payment webhooks are not available yet'), 503, 'PAYMENTS_DISABLED');
}