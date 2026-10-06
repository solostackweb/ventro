'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils/helpers';
import { signupSchema, type SignupData } from '@/lib/validators/schemas';
import { isMastersUnionEmail } from '@/lib/utils/helpers';
import { buildAuthCallbackUrl, sanitizeRedirectPath } from '@/lib/auth/redirects';

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirectPath(searchParams.get('redirect'), '/onboarding');
  const supabase = createClient();
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showMastersUnionNote, setShowMastersUnionNote] = useState(false);
  
  const { register, handleSubmit, watch, formState: { errors } } = useForm<SignupData>({
    resolver: zodResolver(signupSchema),
  });

  const email = watch('email');

  const onSubmit = async (data: SignupData) => {
    setLoading(true);
    setError(null);
    
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: buildAuthCallbackUrl(window.location.origin, redirectTo),
      },
    });
    
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    
    if (signUpData.session) {
      router.replace(redirectTo);
      router.refresh();
      return;
    }

    router.push(`/verify-email?email=${encodeURIComponent(data.email)}&next=${encodeURIComponent(redirectTo)}`);
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: buildAuthCallbackUrl(window.location.origin, redirectTo) },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-bg-primary">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-text-primary">Ventro</Link>
          <h1 className="text-2xl font-semibold mt-4">Create your account</h1>
          <p className="text-text-secondary mt-2">Join founders, investors, and researchers tracking AI intelligence</p>
        </div>

        <div className="bg-bg-secondary border border-border-default rounded-xl p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-accent-red/10 text-accent-red text-sm" role="alert">
              {error}
            </div>
          )}

          {showMastersUnionNote && (
            <div className="mb-6 p-4 rounded-lg bg-accent-purple/10 text-accent-purple text-sm" role="note">
              <strong>Masters&apos; Union student detected!</strong> Verify your @mastersunion.org email to get 20-day full access — no card required.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
              autoComplete="email"
              disabled={loading}
              onBlur={() => setShowMastersUnionNote(isMastersUnionEmail(email))}
            />
            
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
              autoComplete="new-password"
              disabled={loading}
              hint="At least 8 characters"
            />
            
            <Input
              label="Confirm Password"
              type="password"
              placeholder="••••••••"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
              autoComplete="new-password"
              disabled={loading}
            />

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="terms"
                required
                className="mt-1 rounded border-border-default text-accent-blue focus:ring-accent-blue"
              />
              <label htmlFor="terms" className="text-sm text-text-secondary">
                I agree to the{' '}
                <Link href="/terms" className="text-accent-blue hover:underline">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-accent-blue hover:underline">Privacy Policy</Link>
              </label>
            </div>

            <Button type="submit" className="w-full" loading={loading}>
              Create account
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border-default" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-bg-secondary text-text-muted">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              onClick={() => handleOAuth('google')}
              disabled={loading}
              className="w-full"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleOAuth('github')}
              disabled={loading}
              className="w-full"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.536-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </Button>
          </div>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link href="/login" className="text-accent-blue hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return <Suspense fallback={null}><SignupPageContent /></Suspense>;
}
