'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { buildAuthCallbackUrl, sanitizeRedirectPath } from '@/lib/auth/redirects';

function AuthCallbackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const next = sanitizeRedirectPath(searchParams.get('next'), '/dashboard');
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  useEffect(() => {
    const handleAuth = async () => {
      if (code) {
        const callbackUrl = new URL(buildAuthCallbackUrl(window.location.origin, next));
        callbackUrl.searchParams.set('code', code);
        window.location.replace(callbackUrl.toString());
        return;
      }

      if (error) {
        console.error('Auth error:', error, errorDescription);
        router.push(`/login?error=${encodeURIComponent(errorDescription || error)}`);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push(next);
        router.refresh();
      } else {
        router.push('/login');
      }
    };

    handleAuth();
  }, [code, router, next, error, errorDescription, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg-primary">
      <div className="w-full max-w-md text-center">
        <div className="animate-spin w-12 h-12 border-4 border-accent-blue border-t-transparent rounded-full mx-auto mb-6" />
        <h2 className="text-xl font-semibold text-text-primary">Completing sign in...</h2>
        <p className="text-text-secondary mt-2">Please wait while we verify your account.</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return <Suspense fallback={null}><AuthCallbackPageContent /></Suspense>;
}
