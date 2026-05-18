import { redirect } from 'next/navigation';
import { getSubscription } from '@/db/queries';
import { getStripe } from '@/lib/stripe/client';
import { syncStripeSubscription } from '@/lib/stripe/subscription';
import { createClient } from '@/lib/supabase/server';

// Payment Element `return_url` target. The subscription's `active` status
// normally arrives via the webhook a moment after checkout — too late for the
// redirect that follows it. Syncing straight from Stripe here makes the
// dashboard show the right state immediately; the webhook still reconciles
// every later change.
export default async function SubscribeCompletePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const subscription = await getSubscription(user.id);
  if (subscription?.stripeSubscriptionId) {
    try {
      const stripeSubscription = await getStripe().subscriptions.retrieve(
        subscription.stripeSubscriptionId,
      );
      await syncStripeSubscription(stripeSubscription);
    } catch (error) {
      // Best effort — the webhook will reconcile if this fails.
      console.error('[subscribe/complete] sync failed:', error);
    }
  }

  redirect('/dashboard');
}
