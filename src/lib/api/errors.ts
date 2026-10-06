import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
  timestamp: string;
}

export function createErrorResponse(
  error: string,
  status: number = 500,
  code?: string,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error,
      code,
      details,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export function handleApiError(error: unknown, status?: number, code?: string): NextResponse<ApiErrorResponse> {
  console.error('API error:', error);

  if (error instanceof ZodError) {
    return createErrorResponse(
      'Invalid request',
      400,
      'VALIDATION_ERROR',
      error.issues
    );
  }

  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('Unauthorized') || error.message.includes('unauthorized')) {
      return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }
    if (error.message.includes('Forbidden') || error.message.includes('forbidden')) {
      return createErrorResponse('Forbidden', 403, 'FORBIDDEN');
    }
    if (error.message.includes('Not found') || error.message.includes('not found')) {
      return createErrorResponse('Not found', 404, 'NOT_FOUND');
    }
    if (error.message.includes('Conflict') || error.message.includes('duplicate')) {
      return createErrorResponse('Conflict', 409, 'CONFLICT');
    }
    if (error.message.includes('Rate limit') || error.message.includes('rate limit')) {
      return createErrorResponse('Rate limit exceeded', 429, 'RATE_LIMITED');
    }

    return createErrorResponse(error.message, status || 500, code || 'INTERNAL_ERROR');
  }

  return createErrorResponse('Internal server error', status || 500, code || 'INTERNAL_ERROR');
}

export function createSuccessResponse<T>(data: T, status: number = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}