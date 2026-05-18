/** Everything the client needs to mount the Payment Element. */
export interface SubscribeSession {
  /** PaymentIntent client secret for the subscription's first invoice. */
  clientSecret: string;
  publishableKey: string;
  /** Human-readable recurring price, e.g. "$19/month". */
  priceLabel: string;
}

export type CreateSubscriptionResult =
  | { ok: true; data: SubscribeSession }
  | { ok: false; error: string };
