import { createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { sanitizeRedirectPath } from '@/lib/auth/redirects';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sanitizeRedirectPath(searchParams.get('next'), '/dashboard');

  if (code) {
    const supabase = await createServerClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      // Auto-activate trial for @mastersunion.org emails
      const user = data.session.user;
      if (user.email?.endsWith('@mastersunion.org')) {
        try {
          await supabase.rpc('activate_student_trial');
        } catch {
          // Ignore trial activation errors - user can still access dashboard
          console.warn('Auto trial activation failed for:', user.email);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const errorUrl = new URL('/auth-code-error', origin);
  errorUrl.searchParams.set('error', 'The verification link is invalid or has expired.');
  return NextResponse.redirect(errorUrl);
}
