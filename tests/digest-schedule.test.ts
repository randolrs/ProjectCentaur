import { describe, expect, it } from 'vitest';
import type { UserRow } from '@/db/schema';
import { isUserDue, localParts, localWeekday } from '@/lib/digest/schedule';

function user(overrides: Partial<UserRow>): UserRow {
  return {
    id: 'user-id',
    email: 'handicapper@example.com',
    timezone: 'America/New_York',
    digestDeliveryHour: 7,
    regions: ['us'],
    onboardingStatus: 'conversation_complete',
    createdAt: new Date('2026-05-17T00:00:00Z'),
    ...overrides,
  };
}

describe('localParts', () => {
  it('resolves the local date and hour for a timezone', () => {
    // 11:00 UTC on 2026-05-17 is 07:00 EDT.
    const now = new Date('2026-05-17T11:00:00Z');
    expect(localParts('America/New_York', now)).toEqual({
      date: '2026-05-17',
      hour: 7,
    });
  });

  it('crosses the date boundary for western timezones', () => {
    // 02:00 UTC on 2026-05-17 is still 2026-05-16, 19:00 in Los Angeles.
    const now = new Date('2026-05-17T02:00:00Z');
    expect(localParts('America/Los_Angeles', now)).toEqual({
      date: '2026-05-16',
      hour: 19,
    });
  });

  it('falls back to Eastern when the timezone is null', () => {
    const now = new Date('2026-05-17T11:00:00Z');
    expect(localParts(null, now)).toEqual({ date: '2026-05-17', hour: 7 });
  });
});

describe('isUserDue', () => {
  it('is due when the local hour matches the delivery hour', () => {
    const now = new Date('2026-05-17T11:00:00Z'); // 07:00 EDT
    expect(isUserDue(user({ digestDeliveryHour: 7 }), now)).toBe(true);
  });

  it('is not due outside the delivery hour', () => {
    const now = new Date('2026-05-17T11:00:00Z'); // 07:00 EDT
    expect(isUserDue(user({ digestDeliveryHour: 8 }), now)).toBe(false);
  });

  it('respects each user timezone for the same instant', () => {
    const now = new Date('2026-05-17T14:00:00Z'); // 07:00 PDT, 10:00 EDT
    const pacific = user({
      timezone: 'America/Los_Angeles',
      digestDeliveryHour: 7,
    });
    const eastern = user({
      timezone: 'America/New_York',
      digestDeliveryHour: 7,
    });
    expect(isUserDue(pacific, now)).toBe(true);
    expect(isUserDue(eastern, now)).toBe(false);
  });
});

describe('localWeekday', () => {
  it('resolves the local weekday for a timezone', () => {
    // 2026-05-17 is a Sunday; 11:00 UTC is 07:00 EDT, still Sunday.
    const now = new Date('2026-05-17T11:00:00Z');
    expect(localWeekday('America/New_York', now)).toBe('sun');
  });

  it('crosses the date boundary for western timezones', () => {
    // 02:00 UTC on 2026-05-17 is still Saturday the 16th in Los Angeles.
    const now = new Date('2026-05-17T02:00:00Z');
    expect(localWeekday('America/Los_Angeles', now)).toBe('sat');
  });

  it('falls back to Eastern when the timezone is null', () => {
    const now = new Date('2026-05-17T11:00:00Z');
    expect(localWeekday(null, now)).toBe('sun');
  });
});
