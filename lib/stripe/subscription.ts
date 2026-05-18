import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { getDb } from '@/db';
import { subscriptions } from '@/db/schema';

// ---------------------------------------------------------------------------
// Subscription state.
//
// Stripe is the source of truth; the webhook handler mirrors a subscription's
// state onto the user's `subscriptions` row, and the digest pipeline reads
// `status` to decide who gets a digest. `past_due` is treated as active so a
// transient card failure does not instantly cut off delivery while Stripe
// retries.
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES: ReadonlySet<string> = new Set(['active', 'past_due']);

/** True when a subscription status currently grants digest access. */
export function isSubscriptionActive(
  status: string | null | undefined,
): boolean {
  return status != null && ACTIVE_STATUSES.has(status);
}

/** Human-readable recurring price, e.g. "$19/month". */
export function formatPrice(
  unitAmount: number | null,
  currency: string,
  interval: string,
): string {
  const amount = (unitAmount ?? 0) / 100;
  const whole = Number.isInteger(amount);
  const money =
    currency.toLowerCase() === 'usd'
      ? `$${amount.toFixed(whole ? 0 : 2)}`
      : `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  return `${money}/${interval}`;
}

/** Mirror a Stripe subscription's state onto the user's `subscriptions` row. */
export async function syncStripeSubscription(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;
  const item = subscription.items.data[0];
  const periodEnd = item?.current_period_end ?? null;

  await getDb()
    .update(subscriptions)
    .set({
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      priceId: item?.price.id ?? null,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeCustomerId, customerId));
}
