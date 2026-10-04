'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/helpers';
import { buildAuthCallbackUrl, sanitizeRedirectPath } from '@/lib/auth/redirects';

function VerifyEmailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const next = sanitizeRedirectPath(searchParams.get('next'), '/onboarding');
  const supabase = createClient();
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('Check your email for a verification link. Click the link to continue.');
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setCanResend(true), 60000);
    return () => clearTimeout(timer);
  }, []);

  const resendEmail = async () => {
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: buildAuthCallbackUrl(window.location.origin, next) },
    });
    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('Verification email sent! Check your inbox.');
      setCanResend(false);
      setTimeout(() => setCanResend(true), 60000);
    }
    setLoading(false);
  };

  const checkSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      router.push(next);
      router.refresh();
    }
  }, [next, router, supabase]);

  // Check for session every 3 seconds
  useEffect(() => {
    const interval = setInterval(checkSession, 3000);
    return () => clearInterval(interval);
  }, [checkSession]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-bg-primary">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="text-2xl font-bold text-text-primary mb-8 block">Ventro</Link>
        
        <div className="bg-bg-secondary border border-border-default rounded-xl p-8">
          <div className="w-16 h-16 rounded-full bg-accent-blue/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-semibold mb-2">Verify your email</h1>
          <p className="text-text-secondary mb-6">
            We&apos;ve sent a verification link to <strong>{email}</strong>
          </p>
          
          <p className="text-text-secondary mb-6">{message}</p>
          
          <div className="space-y-4">
            <Button 
              variant="secondary" 
              onClick={resendEmail} 
              disabled={loading || !canResend}
              className="w-full"
            >
              {loading ? 'Sending...' : canResend ? 'Resend verification email' : 'Resend in 60s'}
            </Button>
            
            <Button 
              onClick={checkSession} 
              className="w-full"
            >
              I&apos;ve verified — continue
            </Button>
          </div>
          
          <p className="mt-6 text-sm text-text-muted">
            Didn&apos;t receive the email? Check your spam folder or{' '}
            <Link href="/signup" className="text-accent-blue hover:underline">sign up again</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={null}><VerifyEmailPageContent /></Suspense>;
}
