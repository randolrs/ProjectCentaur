import { describe, expect, it } from 'vitest';
import { canReceiveDigest } from '@/lib/digest/pipeline';

describe('canReceiveDigest', () => {
  it('always delivers to an active subscriber', () => {
    expect(canReceiveDigest('active', 50)).toBe(true);
    expect(canReceiveDigest('past_due', 3)).toBe(true);
  });

  it('gives an unsubscribed user their first two digests free', () => {
    expect(canReceiveDigest(null, 0)).toBe(true);
    expect(canReceiveDigest(null, 1)).toBe(true);
  });

  it('paywalls an unsubscribed user once the free allotment is used', () => {
    expect(canReceiveDigest(null, 2)).toBe(false);
    expect(canReceiveDigest(undefined, 2)).toBe(false);
    expect(canReceiveDigest('canceled', 5)).toBe(false);
  });
});
