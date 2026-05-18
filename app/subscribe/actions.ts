'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { getSubscription } from '@/db/queries';
import { subscriptions } from '@/db/schema';
import {
  getStripePriceId,
  getStripePublishableKey,
} from '@/lib/env';
import { getStripe } from '@/lib/stripe/client';
import { formatPrice, isSubscriptionActive } from '@/lib/stripe/subscription';
import { createClient } from '@/lib/supabase/server';
import type { CreateSubscriptionResult } from './types';

// ---------------------------------------------------------------------------
// Subscription billing actions.
//
// `createSubscription` creates an incomplete Stripe subscription and returns
// the client secret the Payment Element confirms against. The webhook — not
// these actions — owns the authoritative `status`; the row written here just
// guarantees the webhook has a row to update.
// ---------------------------------------------------------------------------

/** Create (or resume) a pending subscription and return its payment secret. */
export async function createSubscription(): Promise<CreateSubscriptionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const existing = await getSubscription(user.id);
  if (existing && isSubscriptionActive(existing.status)) {
    return { ok: false, error: 'You already have an active subscription.' };
  }

  try {
    const stripe = getStripe();

    // Reuse the user's Stripe customer across attempts.
    let customerId = existing?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: getStripePriceId() }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.confirmation_secret'],
    });

    const invoice = subscription.latest_invoice;
    const clientSecret =
      invoice && typeof invoice !== 'string'
        ? (invoice.confirmation_secret?.client_secret ?? null)
        : null;
    if (!clientSecret) {
      return { ok: false, error: 'Stripe did not return a payment secret.' };
    }

    const price = subscription.items.data[0]?.price;

    await getDb()
      .insert(subscriptions)
      .values({
        userId: user.id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        priceId: price?.id ?? null,
      })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          priceId: price?.id ?? null,
          updatedAt: new Date(),
        },
      });

    return {
      ok: true,
      data: {
        clientSecret,
        publishableKey: getStripePublishableKey(),
        priceLabel: price
          ? formatPrice(
              price.unit_amount,
              price.currency,
              price.recurring?.interval ?? 'month',
            )
          : 'your subscription',
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Open the Stripe Customer Portal for the signed-in user to manage billing. */
export async function openBillingPortal(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const existing = await getSubscription(user.id);
  if (!existing?.stripeCustomerId) redirect('/subscribe');

  const headerList = await headers();
  const origin =
    headerList.get('origin') ?? `https://${headerList.get('host')}`;
  const session = await getStripe().billingPortal.sessions.create({
    customer: existing.stripeCustomerId,
    return_url: `${origin}/dashboard`,
  });
  redirect(session.url);
}
