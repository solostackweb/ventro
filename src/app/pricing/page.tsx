'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils/helpers';

export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [entitlement, setEntitlement] = useState<'preview' | 'student_trial' | 'subscribed'>('preview');
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setLoading(false);
        return;
      }
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('entitlement, trial_expires_at')
        .eq('id', session.user.id)
        .single();
      
      if (profile) {
        setUser(session.user);
        setEntitlement(profile.entitlement);
        setTrialExpiresAt(profile.trial_expires_at);
      }
      setLoading(false);
    };
    
    fetchUser();
  }, []);

  const handleTrialActivate = async () => {
    if (!user) {
      router.push(`/login?redirect=/pricing`);
      return;
    }

    if (entitlement === 'student_trial' || entitlement === 'subscribed') {
      router.push('/settings');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/trial/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Trial activation failed');
      }

      // Refresh user profile to get updated entitlement
      const supabase = createClient();
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('entitlement, trial_expires_at')
        .eq('id', user.id)
        .single();

      if (profile) {
        setEntitlement(profile.entitlement);
        setTrialExpiresAt(profile.trial_expires_at);
      }
      
      router.refresh();
    } catch (error) {
      console.error('Trial activation error:', error);
      alert(error instanceof Error ? error.message : 'Trial activation failed');
    } finally {
      setProcessing(false);
    }
  };

  const isTrialActive = entitlement === 'student_trial' && trialExpiresAt && new Date(trialExpiresAt) > new Date();
  const trialDaysLeft = isTrialActive ? Math.ceil((new Date(trialExpiresAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="sticky top-0 z-40 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-text-primary">Ventro</Link>
          <Link href="/pricing" className="hidden sm:block px-4 py-2 rounded-lg bg-accent-blue/10 text-accent-blue text-sm font-medium">
            Pricing
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Simple, transparent pricing</h1>
          <p className="text-text-secondary text-lg">One plan. All features. No surprises.</p>
        </div>

        {/* Current Status */}
        {user && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-lg">Your current plan</h3>
                  <p className="text-text-secondary text-sm mt-1">
                    {entitlement === 'subscribed' && 'Active subscription • $10/month'}
                    {entitlement === 'student_trial' && isTrialActive && `20-day trial • ${trialDaysLeft} days left`}
                    {entitlement === 'student_trial' && !isTrialActive && 'Trial expired • Upgrade to continue'}
                    {entitlement === 'preview' && 'Free preview • Limited access'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {entitlement !== 'subscribed' && (
                    <Button 
                      variant={entitlement === 'student_trial' && isTrialActive ? 'secondary' : 'primary'} 
                      onClick={() => handleTrialActivate()}
                      loading={processing}
                      disabled={entitlement === 'student_trial'}
                    >
                      {entitlement === 'student_trial' && isTrialActive ? 'Trial active' : entitlement === 'preview' ? 'Start 20-day trial' : 'Upgrade'}
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => router.push('/settings')}>
                    Manage
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pricing Card */}
        <Card className="mb-8">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-accent-blue/10 text-accent-blue">
                Most popular
              </span>
              <h2 className="text-3xl font-bold mt-2">Ventro Pro</h2>
              <p className="text-text-secondary mt-2">Full access to all intelligence features</p>
            </div>

            <div className="flex items-baseline justify-center gap-1 mb-8">
              <span className="text-5xl font-bold">$10</span>
              <span className="text-text-muted">/month</span>
            </div>

            <ul className="space-y-4 mb-8">
              {[
                'Unlimited news feed with filters & search',
                'Company & investor profiles with source timelines',
                'Investment tracker with verified rounds',
                'YC batch tracking & AI company directory',
                'Pattern detection & thesis analysis',
                'Custom alerts & saved workspaces',
                'Community discussion & private notes',
                'Correction reporting & source audit trail',
                'Priority support',
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-text-secondary">{feature}</span>
                </li>
              ))}
            </ul>

            {!user ? (
              <Button variant="primary" className="w-full" size="lg" onClick={() => router.push('/signup?redirect=/pricing')}>
                Get started
              </Button>
            ) : (
              <>
                {entitlement === 'preview' && (
                  <Button 
                    variant="secondary" 
                    className="w-full" 
                    size="lg"
                    onClick={() => handleTrialActivate()}
                    loading={processing}
                  >
                    Start 20-day trial
                  </Button>
                )}
                {entitlement !== 'subscribed' && entitlement !== 'preview' && (
                  <Button 
                    variant="secondary" 
                    className="w-full" 
                    size="lg"
                    disabled
                  >
                    Subscribe $10/month — Coming soon
                  </Button>
                )}
                {entitlement === 'subscribed' && (
                  <Button variant="secondary" className="w-full" disabled>
                    Already subscribed
                  </Button>
                )}
              </>
            )}

            {user && entitlement === 'preview' && (
              <p className="text-center text-sm text-text-muted mt-4">
                <span className="font-medium">mastersunion.org</span> emails qualify for a 20-day free trial (no card required)
              </p>
            )}
          </CardContent>
        </Card>

        {/* Trial Info */}
        {user && entitlement === 'preview' && (
          <Card className="mb-8 border-accent-blue/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-accent-blue flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-semibold">20-day free trial for Masters&apos; Union students</h3>
                  <p className="text-text-secondary text-sm mt-1">
                    Verify your <span className="font-mono">@mastersunion.org</span> email to unlock full access for 20 days — no credit card required.
                  </p>
                </div>
              </div>
              <Button 
                variant="secondary" 
                className="mt-4 w-full sm:w-auto"
                onClick={() => handleTrialActivate()}
                loading={processing}
              >
                Start free trial
              </Button>
            </CardContent>
          </Card>
        )}

        {/* FAQ */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-center mb-6">Questions?</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                q: 'What\'s included in the free preview?',
                a: 'Access to news feed, company/investor directories, and basic search. Premium features like alerts, saved workspaces, pattern detection, and full investment tracker require subscription.'
              },
              {
                q: 'How does the 20-day trial work?',
                a: 'If you sign up with a verified @mastersunion.org email, you get 20 days of full Pro access free. No credit card required. After 20 days, you can subscribe to continue.'
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Yes. Cancel anytime from Settings. You\'ll keep access until the end of your billing period. No refunds for partial months.'
              },
              {
                q: 'What payment methods are accepted?',
                a: 'Credit/debit cards (USD). Secure, PCI-compliant processing. Coming soon.'
              },
            ].map((faq, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <h4 className="font-semibold mb-2">{faq.q}</h4>
                  <p className="text-text-secondary text-sm">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}