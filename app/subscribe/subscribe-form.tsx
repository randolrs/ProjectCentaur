'use client';

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import { createSubscription } from './actions';
import type { SubscribeSession } from './types';

function CheckoutForm({ priceLabel }: { priceLabel: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/dashboard` },
    });

    // A successful confirm redirects to return_url; only errors return here.
    if (result.error) {
      setError(result.error.message ?? 'Payment could not be completed.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Processing…' : `Subscribe — ${priceLabel}`}
      </button>
      <p className="text-xs text-neutral-500">
        You can cancel anytime from your dashboard.
      </p>
    </form>
  );
}

export function SubscribeForm() {
  const [session, setSession] = useState<SubscribeSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripePromise, setStripePromise] =
    useState<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    let active = true;
    createSubscription().then((result) => {
      if (!active) return;
      if (result.ok) {
        setSession(result.data);
        setStripePromise(loadStripe(result.data.publishableKey));
      } else {
        setError(result.error);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center bg-neutral-950 px-6 text-neutral-100">
      <div className="w-full max-w-md space-y-6 py-16">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Start your subscription
          </h1>
          <p className="text-sm text-neutral-400">
            Your handicapping profile is ready. Subscribe to start receiving
            your personalized morning digest.
          </p>
        </header>

        {error && (
          <div className="space-y-3">
            <p className="text-sm text-red-400">{error}</p>
            <Link
              href="/dashboard"
              className="inline-block rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:border-neutral-400"
            >
              Back to dashboard
            </Link>
          </div>
        )}

        {!error && (!session || !stripePromise) && (
          <p className="text-sm text-neutral-500">Loading checkout…</p>
        )}

        {session && stripePromise && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: session.clientSecret,
              appearance: { theme: 'night' },
            }}
          >
            <CheckoutForm priceLabel={session.priceLabel} />
          </Elements>
        )}
      </div>
    </main>
  );
}
