import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { getDb } from '@/db';
import { subscriptions } from '@/db/schema';
import { trackEvent } from '@/lib/analytics';
import { getStripeWebhookSecret } from '@/lib/env';
import { getStripe } from '@/lib/stripe/client';
import { syncStripeSubscription } from '@/lib/stripe/subscription';

// ---------------------------------------------------------------------------
// Stripe webhook.
//
// The single source of truth for subscription state. Stripe signs every
// request; an unverified body is rejected. Subscription lifecycle events are
// mirrored onto the user's `subscriptions` row.
// ---------------------------------------------------------------------------

const SUBSCRIPTION_EVENTS: ReadonlySet<string> = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature header.', { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      body,
      signature,
      getStripeWebhookSecret(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'bad signature';
    console.error('[stripe/webhook] signature verification failed:', message);
    return new Response('Invalid signature.', { status: 400 });
  }

  try {
    if (SUBSCRIPTION_EVENTS.has(event.type)) {
      const subscription = event.data.object as Stripe.Subscription;
      await syncStripeSubscription(subscription);
      if (event.type === 'customer.subscription.created') {
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;
        const rows = await getDb()
          .select({ userId: subscriptions.userId })
          .from(subscriptions)
          .where(eq(subscriptions.stripeCustomerId, customerId))
          .limit(1);
        const userId = rows[0]?.userId;
        if (userId) {
          await trackEvent(userId, 'subscription_activated', {
            stripe_subscription_id: subscription.id,
            status: subscription.status,
          });
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[stripe/webhook] handling ${event.type} failed:`, message);
    return new Response('Handler error.', { status: 500 });
  }

  return new Response('ok', { status: 200 });
}
