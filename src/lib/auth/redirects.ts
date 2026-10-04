export function sanitizeRedirectPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  return value;
}

export function buildAuthCallbackUrl(origin: string, next: string): string {
  const callbackUrl = new URL('/api/auth/callback', origin);
  callbackUrl.searchParams.set('next', sanitizeRedirectPath(next, '/dashboard'));
  return callbackUrl.toString();
}
