import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';

// Razorpay webhook secret (set in env)
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

const checkoutSchema = z.object({
  plan: z.literal('monthly'),
  trial: z.boolean().optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { plan, trial } = checkoutSchema.parse(body);

    // Check if user is eligible for trial
    let trialEligible = false;
    let trialExpiresAt: string | null = null;

    if (trial && user.email?.endsWith('@mastersunion.org')) {
      // Verify exact domain match (case-insensitive)
      const domain = user.email.split('@')[1]?.toLowerCase();
      if (domain === 'mastersunion.org') {
        trialEligible = true;
        trialExpiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    // Get or create user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Create Razorpay order for $10/month
    // In production, use Razorpay Node SDK
    const orderData = {
      amount: 1000, // $10.00 in cents
      currency: 'USD',
      receipt: `order_${user.id}_${Date.now()}`,
      notes: {
        user_id: user.id,
        plan: 'monthly',
        trial_eligible: trialEligible.toString(),
      },
    };

    // Mock Razorpay order creation - replace with actual SDK call
    const orderId = `order_${crypto.randomBytes(8).toString('hex')}`;

    // Create subscription record
    const { error: subError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        plan: 'monthly',
        status: trialEligible ? 'trialing' : 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: trialEligible ? trialExpiresAt : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        trial_ends_at: trialExpiresAt,
        razorpay_order_id: orderId,
        razorpay_subscription_id: null,
        cancel_at_period_end: false,
        metadata: {},
      });

    if (subError) {
      console.error('Subscription upsert error:', subError);
      return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
    }

    // Update user profile entitlement
    const newEntitlement = trialEligible ? 'discount_card' : 'subscribed';
    await supabase
      .from('user_profiles')
      .update({
        entitlement: newEntitlement,
        discount_card_expires_at: trialExpiresAt,
        discount_card_issued_at: trialEligible ? new Date().toISOString() : null,
      })
      .eq('id', user.id);

    // Log entitlement change
    await supabase
      .from('entitlement_audit')
      .insert({
        user_id: user.id,
        previous_entitlement: profile.entitlement,
        new_entitlement: newEntitlement,
        source: trialEligible ? 'discount_card' : 'stripe_webhook',
        metadata: { order_id: orderId, trial_eligible: trialEligible },
      });

    return NextResponse.json({
      order_id: orderId,
      key_id: RAZORPAY_KEY_ID,
      amount: orderData.amount,
      currency: orderData.currency,
      trial_eligible: trialEligible,
      trial_expires_at: trialExpiresAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 });
    }
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
