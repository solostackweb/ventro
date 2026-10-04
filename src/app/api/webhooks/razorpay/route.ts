import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    // Verify webhook signature
    if (RAZORPAY_WEBHOOK_SECRET && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
        .update(body)
        .digest('hex');
      
      if (expectedSignature !== signature) {
        console.error('Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    }

    const event = JSON.parse(body);

    // Handle different event types
    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(supabase, event.payload.payment.entity);
        break;
      case 'payment.failed':
        await handlePaymentFailed(supabase, event.payload.payment.entity);
        break;
      case 'subscription.charged':
        await handleSubscriptionCharged(supabase, event.payload.subscription.entity);
        break;
      case 'subscription.cancelled':
        await handleSubscriptionCancelled(supabase, event.payload.subscription.entity);
        break;
      case 'subscription.pending':
        await handleSubscriptionPending(supabase, event.payload.subscription.entity);
        break;
      case 'subscription.completed':
        await handleSubscriptionCompleted(supabase, event.payload.subscription.entity);
        break;
      default:
        console.log(`Unhandled event type: ${event.event}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handlePaymentCaptured(supabase: any, payment: any) {
  const orderId = payment.order_id;
  
  // Find subscription by order ID
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('razorpay_order_id', orderId)
    .single();

  if (!subscription) return;

  // Update subscription status
  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      razorpay_payment_id: payment.id,
      razorpay_subscription_id: payment.subscription_id,
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscription.id);

  // Update user profile
  await supabase
    .from('user_profiles')
    .update({ entitlement: 'subscribed' })
    .eq('id', subscription.user_id);

  // Log entitlement change
  await supabase
    .from('entitlement_audit')
    .insert({
      user_id: subscription.user_id,
      previous_entitlement: 'discount_card',
      new_entitlement: 'subscribed',
      source: 'stripe_webhook',
      metadata: { payment_id: payment.id, order_id: orderId },
    });

  console.log(`Payment captured for order ${orderId}, subscription activated`);
}

async function handlePaymentFailed(supabase: any, payment: any) {
  const orderId = payment.order_id;
  
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('razorpay_order_id', orderId)
    .single();

  if (!subscription) return;

  // Update subscription status
  await supabase
    .from('subscriptions')
    .update({
      status: 'payment_failed',
      failed_payment_count: (subscription.failed_payment_count || 0) + 1,
      last_failed_payment_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscription.id);

  // If trial, keep discount_card entitlement; if not trial, revert to preview
  if (subscription.status !== 'trialing') {
    await supabase
      .from('user_profiles')
      .update({ entitlement: 'preview' })
      .eq('id', subscription.user_id);

    await supabase
      .from('entitlement_audit')
      .insert({
        user_id: subscription.user_id,
        previous_entitlement: subscription.status,
        new_entitlement: 'preview',
        source: 'stripe_webhook',
        metadata: { payment_id: payment.id, reason: 'payment_failed' },
      });
  }

  console.log(`Payment failed for order ${orderId}`);
}

async function handleSubscriptionCharged(supabase: any, subscription: any) {
  // Recurring payment successful
  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_start: new Date(subscription.current_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_end * 1000).toISOString(),
      razorpay_subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    })
    .eq('razorpay_subscription_id', subscription.id);

  // Ensure user has subscribed entitlement
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('razorpay_subscription_id', subscription.id)
    .single();

  if (sub) {
    await supabase
      .from('user_profiles')
      .update({ entitlement: 'subscribed' })
      .eq('id', sub.user_id);
  }
}

async function handleSubscriptionCancelled(supabase: any, subscription: any) {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('razorpay_subscription_id', subscription.id)
    .single();

  if (!sub) return;

  // Update subscription
  await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancel_at_period_end: true,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id);

  // User keeps access until period ends
  console.log(`Subscription cancelled for user ${sub.user_id}, access until ${sub.current_period_end}`);
}

async function handleSubscriptionPending(supabase: any, subscription: any) {
  // Subscription is pending (e.g., trial ending, waiting for payment)
  await supabase
    .from('subscriptions')
    .update({
      status: 'pending',
      razorpay_subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    })
    .eq('razorpay_subscription_id', subscription.id);
}

async function handleSubscriptionCompleted(supabase: any, subscription: any) {
  // Subscription fully completed (all billing cycles done)
  await supabase
    .from('subscriptions')
    .update({
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('razorpay_subscription_id', subscription.id);

  // Revert user to preview
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('razorpay_subscription_id', subscription.id)
    .single();

  if (sub) {
    await supabase
      .from('user_profiles')
      .update({ entitlement: 'preview' })
      .eq('id', sub.user_id);

    await supabase
      .from('entitlement_audit')
      .insert({
        user_id: sub.user_id,
        previous_entitlement: 'subscribed',
        new_entitlement: 'preview',
        source: 'stripe_webhook',
        metadata: { reason: 'subscription_completed' },
      });
  }
}