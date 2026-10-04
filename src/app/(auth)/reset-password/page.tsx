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
import { resetPasswordSchema, updatePasswordSchema, type ResetPasswordData, type UpdatePasswordData } from '@/lib/validators/schemas';

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  
  const isUpdate = searchParams.get('type') === 'recovery';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Forgot password form
  const forgotForm = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
  });
  
  // Update password form
  const updateForm = useForm<UpdatePasswordData>({
    resolver: zodResolver(updatePasswordSchema),
  });

  const onForgotSubmit = async (data: ResetPasswordData) => {
    setLoading(true);
    setError(null);
    
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password?type=recovery`,
    });
    
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  const onUpdateSubmit = async (data: UpdatePasswordData) => {
    setLoading(true);
    setError(null);
    
    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });
    
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    
    router.push('/login?reset=success');
    router.refresh();
  };

  if (isUpdate) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-bg-primary">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="text-2xl font-bold text-text-primary">Ventro</Link>
            <h1 className="text-2xl font-semibold mt-4">Set new password</h1>
            <p className="text-text-secondary mt-2">Your new password must be different from previous ones</p>
          </div>

          <div className="bg-bg-secondary border border-border-default rounded-xl p-6 sm:p-8">
            {error && (
              <div className="mb-6 p-4 rounded-lg bg-accent-red/10 text-accent-red text-sm" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="space-y-4">
              <Input
                label="New Password"
                type="password"
                placeholder="••••••••"
                error={updateForm.formState.errors.password?.message}
                {...updateForm.register('password')}
                autoComplete="new-password"
                disabled={loading}
                hint="At least 8 characters"
              />
              
              <Input
                label="Confirm New Password"
                type="password"
                placeholder="••••••••"
                error={updateForm.formState.errors.confirmPassword?.message}
                {...updateForm.register('confirmPassword')}
                autoComplete="new-password"
                disabled={loading}
              />

              <Button type="submit" className="w-full" loading={loading}>
                Update Password
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-text-secondary">
              Remember your password?{' '}
              <Link href="/login" className="text-accent-blue hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-bg-primary">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-text-primary">Ventro</Link>
          <h1 className="text-2xl font-semibold mt-4">Forgot password?</h1>
          <p className="text-text-secondary mt-2">Enter your email and we&apos;ll send you a reset link</p>
        </div>

        <div className="bg-bg-secondary border border-border-default rounded-xl p-6 sm:p-8">
          {success && (
            <div className="mb-6 p-4 rounded-lg bg-accent-green/10 text-accent-green text-sm" role="status">
              If an account exists for that email, you&apos;ll receive a password reset link shortly.
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-accent-red/10 text-accent-red text-sm" role="alert">
              {error}
            </div>
          )}

          {!success && (
            <form onSubmit={forgotForm.handleSubmit(onForgotSubmit)} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                error={forgotForm.formState.errors.email?.message}
                {...forgotForm.register('email')}
                autoComplete="email"
                disabled={loading}
              />

              <Button type="submit" className="w-full" loading={loading}>
                Send reset link
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-text-secondary">
            Back to{' '}
            <Link href="/login" className="text-accent-blue hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={null}><ResetPasswordPageContent /></Suspense>;
}
