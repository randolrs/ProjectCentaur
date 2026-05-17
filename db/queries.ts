import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb } from './index';
import type {
  HandicapperProfileRow,
  UserPreferencesRow,
  UserRow,
} from './schema';
import { handicapperProfile, races, userPreferences, users } from './schema';

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
        inArray(races.track, tracks),
      ),
    )
    .orderBy(asc(races.postTimestamp), asc(races.track), asc(races.raceNumber));
}

export interface DigestEligibleUser {
  user: UserRow;
  prefs: UserPreferencesRow;
  profile: HandicapperProfileRow;
}

/**
 * Every user who has finished onboarding — they have both structured
 * preferences and a conversational handicapper profile. These are the users
 * the digest pipeline considers each morning.
 */
export async function getDigestEligibleUsers(): Promise<DigestEligibleUser[]> {
  const db = getDb();
  return db
    .select({
      user: users,
      prefs: userPreferences,
      profile: handicapperProfile,
    })
    .from(users)
    .innerJoin(userPreferences, eq(userPreferences.userId, users.id))
    .innerJoin(handicapperProfile, eq(handicapperProfile.userId, users.id));
}
