import { describe, expect, it } from 'vitest';
import { formatPrice, isSubscriptionActive } from '@/lib/stripe/subscription';

describe('isSubscriptionActive', () => {
  it('grants access for active and past_due (grace) statuses', () => {
    expect(isSubscriptionActive('active')).toBe(true);
    expect(isSubscriptionActive('past_due')).toBe(true);
  });

  it('denies access for every other status and for no subscription', () => {
    for (const status of [
      'incomplete',
      'incomplete_expired',
      'canceled',
      'unpaid',
      'paused',
      'trialing',
    ]) {
      expect(isSubscriptionActive(status)).toBe(false);
    }
    expect(isSubscriptionActive(null)).toBe(false);
    expect(isSubscriptionActive(undefined)).toBe(false);
  });
});

describe('formatPrice', () => {
  it('formats a whole-dollar monthly USD price', () => {
    expect(formatPrice(1900, 'usd', 'month')).toBe('$19/month');
  });

  it('keeps cents when the amount is not whole', () => {
    expect(formatPrice(1950, 'usd', 'month')).toBe('$19.50/month');
  });

  it('falls back to a currency code for non-USD', () => {
    expect(formatPrice(2000, 'gbp', 'year')).toBe('20.00 GBP/year');
  });

  it('treats a missing amount as zero', () => {
    expect(formatPrice(null, 'usd', 'month')).toBe('$0/month');
  });
});
