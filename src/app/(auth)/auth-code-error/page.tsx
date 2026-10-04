'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

function AuthErrorPageContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'An unknown error occurred';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg-primary">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-accent-red/10 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-accent-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">Authentication Error</h2>
        <p className="text-text-secondary mb-6">{error}</p>
        <Link href="/login">
          <Button className="w-full">Try Again</Button>
        </Link>
        <p className="mt-4 text-sm text-text-muted">
          If the problem persists,{' '}
          <Link href="/contact" className="text-accent-blue hover:underline">contact support</Link>
        </p>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return <Suspense fallback={null}><AuthErrorPageContent /></Suspense>;
}
