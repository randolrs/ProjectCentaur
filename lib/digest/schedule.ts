import type { UserRow } from '@/db/schema';

// ---------------------------------------------------------------------------
// Delivery scheduling.
//
// The digest cron runs hourly; each run delivers to the users for whom it is
// currently their chosen delivery hour in their own timezone. These helpers
// are pure so the hour-matching logic is unit-testable without a clock.
// ---------------------------------------------------------------------------

/** Region default when a user has no timezone set. */
const DEFAULT_TIMEZONE = 'America/New_York';

export interface LocalParts {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Local hour of day, 0-23. */
  hour: number;
}

/** The calendar date and hour at `now` in the given IANA timezone. */
export function localParts(timezone: string | null, now: Date): LocalParts {
  const tz = timezone ?? DEFAULT_TIMEZONE;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
  };
}

/** True when `now` falls in the user's configured delivery hour locally. */
export function isUserDue(user: UserRow, now: Date): boolean {
  return localParts(user.timezone, now).hour === user.digestDeliveryHour;
}

/** The local day-of-week code (`mon`..`sun`) at `now` in the given timezone. */
export function localWeekday(timezone: string | null, now: Date): string {
  const tz = timezone ?? DEFAULT_TIMEZONE;
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
    .format(now)
    .toLowerCase();
}
