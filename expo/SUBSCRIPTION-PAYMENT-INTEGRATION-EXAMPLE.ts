/**
 * SUBSCRIPTION PAYMENT INTEGRATION EXAMPLE
 * 
 * This file shows how to integrate payment processing with the subscription system.
 * Replace the "Coming Soon" message in app/dating/premium.tsx with actual payment logic.
 */

import { supabase } from '@/lib/supabase';

/**
 * Example: Create subscription after Stripe payment success
 */
export async function createSubscriptionAfterPayment(
  userId: string,
  planId: string,
  stripeSubscriptionId: string,
  expiresAt: Date
): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
  try {
    // First, cancel any existing active subscription
    await supabase
      .from('user_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .in('status', ['active', 'trial']);

    // Create new subscription
    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        payment_provider: 'stripe',
        payment_provider_subscription_id: stripeSubscriptionId,
        auto_renew: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating subscription:', error);
      return { success: false, error: error.message };
    }

    return { success: true, subscriptionId: subscription.id };
  } catch (error: any) {
    console.error('Exception creating subscription:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Example: Handle Stripe payment (client-side)
 * 
 * Note: For production, you should use Stripe's server-side API
 * This is just an example showing the flow
 */
export async function handleStripeSubscription(planId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // 1. Get plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      throw new Error('Plan not found');
    }

    // 2. Create Stripe checkout session (you'd call your backend API for this)
    // This is typically done server-side for security
    const response = await fetch('https://your-api.com/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
      body: JSON.stringify({
        planId,
        userId: user.id,
        priceId: plan.stripe_price_id, // You'd store Stripe price IDs in your plan
      }),
    });

    const { sessionId, url } = await response.json();

    // 3. Redirect to Stripe checkout
    // In React Native, you'd use a web browser component
    // await WebBrowser.openBrowserAsync(url);

    // 4. After payment success, Stripe webhook will call your backend
    // Backend will then create the subscription record using createSubscriptionAfterPayment()

    return { success: true, sessionId };
  } catch (error: any) {
    console.error('Stripe subscription error:', error);
    throw error;
  }
}

/**
 * Example: Webhook handler (Supabase Edge Function)
 * 
 * This would be in: supabase/functions/stripe-webhook/index.ts
 * 
 * Set up webhook in Stripe Dashboard pointing to:
 * https://your-project.supabase.co/functions/v1/stripe-webhook
 */
/*
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  
  // Verify webhook signature (use Stripe SDK)
  const event = stripe.webhooks.constructEvent(
    await req.text(),
    signature,
    webhookSecret
  )
  
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  )
  
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object
      // Create subscription
      await supabaseAdmin
        .from('user_subscriptions')
        .insert({
          user_id: session.client_reference_id, // Pass userId when creating checkout
          plan_id: session.metadata.planId,
          status: 'active',
          payment_provider: 'stripe',
          payment_provider_subscription_id: session.subscription,
          // Calculate expires_at based on plan
        })
      break
      
    case 'customer.subscription.updated':
      const subscription = event.data.object
      // Update subscription status
      await supabaseAdmin
        .from('user_subscriptions')
        .update({
          status: subscription.status === 'active' ? 'active' : 'cancelled',
          expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
        })
        .eq('payment_provider_subscription_id', subscription.id)
      break
      
    case 'customer.subscription.deleted':
      const deletedSubscription = event.data.object
      // Cancel subscription
      await supabaseAdmin
        .from('user_subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('payment_provider_subscription_id', deletedSubscription.id)
      break
  }
  
  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
*/

/**
 * Example: Update handleSubscribe in app/dating/premium.tsx
 * 
 * Replace the current "Coming Soon" alert with:
 */
/*
const handleSubscribe = async (planId: string) => {
  try {
    setIsSubscribing(true);
    
    // Option 1: If using Stripe (recommended)
    await handleStripeSubscription(planId);
    
    // Option 2: If using manual/manual testing
    // const result = await createSubscriptionAfterPayment(
    //   currentUser.id,
    //   planId,
    //   'manual_' + Date.now(), // Temporary ID for manual
    //   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    // );
    // if (result.success) {
    //   Alert.alert('Success', 'Subscription activated!');
    //   loadData(); // Reload subscription info
    // }
    
  } catch (error: any) {
    Alert.alert('Error', error.message || 'Failed to start subscription');
  } finally {
    setIsSubscribing(false);
  }
};
*/

