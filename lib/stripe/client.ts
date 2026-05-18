import Stripe from 'stripe';
import { getStripeSecretKey } from '@/lib/env';

// Lazily-initialised Stripe client. Lazy so importing this module never
// throws when STRIPE_SECRET_KEY is absent (unit tests, unrelated builds).

let stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(getStripeSecretKey());
  }
  return stripe;
}
