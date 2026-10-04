import { createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { sanitizeRedirectPath } from '@/lib/auth/redirects';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sanitizeRedirectPath(searchParams.get('next'), '/dashboard');

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const errorUrl = new URL('/auth-code-error', origin);
  errorUrl.searchParams.set('error', 'The verification link is invalid or has expired.');
  return NextResponse.redirect(errorUrl);
}
