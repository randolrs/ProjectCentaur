import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { getDb } from './index';
import type {
  HandicapperProfileRow,
  SubscriptionRow,
  UserPreferencesRow,
  UserRow,
} from './schema';
import {
  handicapperProfile,
  raceEntries,
  races,
  subscriptions,
  userPreferences,
  users,
} from './schema';

/** The user's deterministic onboarding preferences, or null if not onboarded. */
export async function getUserPreferences(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** The extended public.users profile row, or null if missing. */
export async function getUserProfile(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** The M2 conversational handicapper profile, or null if not yet built. */
export async function getHandicapperProfile(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(handicapperProfile)
    .where(eq(handicapperProfile.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** Every ingested race for a racing day (YYYY-MM-DD), in post-time order. */
export async function getRacesForDate(date: string, region = 'us') {
  const db = getDb();
  return db
    .select()
    .from(races)
    .where(and(eq(races.raceDate, date), eq(races.region, region)))
    .orderBy(asc(races.postTimestamp), asc(races.track), asc(races.raceNumber));
}

/**
 * Ingested races for a racing day limited to a set of track names — the
 * digest pipeline's scope for a user (their followed tracks).
 */
export async function getRacesForTracks(
  date: string,
  tracks: string[],
  region = 'us',
) {
  if (tracks.length === 0) return [];
  const db = getDb();
  return db
    .select()
    .from(races)
    .where(
      and(
        eq(races.raceDate, date),
        eq(races.region, region),
        inArray(races.trackCanonical, tracks),
      ),
    )
    .orderBy(asc(races.postTimestamp), asc(races.track), asc(races.raceNumber));
}

export interface IngestDaySummary {
  date: string;
  raceCount: number;
  entryCount: number;
  /** Per-track race counts, ordered by canonical track name. */
  tracks: { track: string; races: number }[];
}

/** Summarize what has been ingested for a racing day, broken down by track. */
export async function getIngestSummaryForDate(
  date: string,
): Promise<IngestDaySummary> {
  const db = getDb();
  const trackRows = await db
    .select({ track: races.trackCanonical, races: count() })
    .from(races)
    .where(eq(races.raceDate, date))
    .groupBy(races.trackCanonical)
    .orderBy(asc(races.trackCanonical));
  const [entryRow] = await db
    .select({ n: count() })
    .from(raceEntries)
    .innerJoin(races, eq(raceEntries.raceId, races.id))
    .where(eq(races.raceDate, date));

  const tracks = trackRows.map((row) => ({
    track: row.track,
    races: Number(row.races),
  }));
  return {
    date,
    raceCount: tracks.reduce((sum, t) => sum + t.races, 0),
    entryCount: Number(entryRow?.n ?? 0),
    tracks,
  };
}

export interface DigestEligibleUser {
  user: UserRow;
  prefs: UserPreferencesRow;
  profile: HandicapperProfileRow;
  /** The user's subscription row, or null if they never started checkout. */
  subscription: SubscriptionRow | null;
}

/**
 * Every user who has finished onboarding — they have both structured
 * preferences and a conversational handicapper profile — joined to their
 * subscription. The digest pipeline considers these users each morning and
 * delivers only to the ones whose subscription is active.
 */
export async function getDigestEligibleUsers(): Promise<DigestEligibleUser[]> {
  const db = getDb();
  return db
    .select({
      user: users,
      prefs: userPreferences,
      profile: handicapperProfile,
      subscription: subscriptions,
    })
    .from(users)
    .innerJoin(userPreferences, eq(userPreferences.userId, users.id))
    .innerJoin(handicapperProfile, eq(handicapperProfile.userId, users.id))
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id));
}

/** The user's subscription row, or null if they never started checkout. */
export async function getSubscription(
  userId: string,
): Promise<SubscriptionRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}
