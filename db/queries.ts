import { and, asc, count, desc, eq, inArray, type SQL } from 'drizzle-orm';
import { getDb } from './index';
import type {
  HandicapperProfileRow,
  HorseRow,
  JockeyRow,
  RaceEntryRow,
  RaceRow,
  SubscriptionRow,
  TrainerRow,
  UserPreferencesRow,
  UserRow,
} from './schema';
import {
  digests,
  handicapperProfile,
  horses,
  jockeys,
  raceEntries,
  races,
  subscriptions,
  trainers,
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

/** One onboarded user joined to their subscription, or null. */
export async function getDigestEligibleUser(
  userId: string,
): Promise<DigestEligibleUser | null> {
  const db = getDb();
  const rows = await db
    .select({
      user: users,
      prefs: userPreferences,
      profile: handicapperProfile,
      subscription: subscriptions,
    })
    .from(users)
    .innerJoin(userPreferences, eq(userPreferences.userId, users.id))
    .innerJoin(handicapperProfile, eq(handicapperProfile.userId, users.id))
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** How many digests each user has actually been sent, keyed by user id. */
export async function getSentDigestCountByUser(): Promise<Map<string, number>> {
  const db = getDb();
  const rows = await db
    .select({ userId: digests.userId, sent: count() })
    .from(digests)
    .where(eq(digests.status, 'sent'))
    .groupBy(digests.userId);
  return new Map(rows.map((row) => [row.userId, Number(row.sent)]));
}

// ---------------------------------------------------------------------------
// Admin data explorer — read-only drill-down across the normalized racing
// tables: races -> race_entries -> horses / jockeys / trainers, and back.
// ---------------------------------------------------------------------------

export interface RaceEntryDetail {
  entry: RaceEntryRow;
  horse: HorseRow;
  jockey: JockeyRow | null;
  trainer: TrainerRow | null;
}

/** A race with its full field of entries. */
export async function getRaceWithEntries(
  raceId: string,
): Promise<{ race: RaceRow; entries: RaceEntryDetail[] } | null> {
  const db = getDb();
  const raceRows = await db
    .select()
    .from(races)
    .where(eq(races.id, raceId))
    .limit(1);
  const race = raceRows[0];
  if (!race) return null;

  const entries = await db
    .select({
      entry: raceEntries,
      horse: horses,
      jockey: jockeys,
      trainer: trainers,
    })
    .from(raceEntries)
    .innerJoin(horses, eq(horses.id, raceEntries.horseId))
    .leftJoin(jockeys, eq(jockeys.id, raceEntries.jockeyId))
    .leftJoin(trainers, eq(trainers.id, raceEntries.trainerId))
    .where(eq(raceEntries.raceId, raceId))
    .orderBy(asc(raceEntries.programNumber));

  return { race, entries };
}

/** One race a horse / jockey / trainer was involved in. */
export interface RaceEntryAppearance {
  entry: RaceEntryRow;
  race: RaceRow;
  horse: HorseRow;
  jockey: JockeyRow | null;
  trainer: TrainerRow | null;
}

/** Load every race entry matching `condition`, newest racing day first. */
async function loadAppearances(condition: SQL): Promise<RaceEntryAppearance[]> {
  const db = getDb();
  return db
    .select({
      entry: raceEntries,
      race: races,
      horse: horses,
      jockey: jockeys,
      trainer: trainers,
    })
    .from(raceEntries)
    .innerJoin(races, eq(races.id, raceEntries.raceId))
    .innerJoin(horses, eq(horses.id, raceEntries.horseId))
    .leftJoin(jockeys, eq(jockeys.id, raceEntries.jockeyId))
    .leftJoin(trainers, eq(trainers.id, raceEntries.trainerId))
    .where(condition)
    .orderBy(
      desc(races.raceDate),
      asc(races.trackCanonical),
      asc(races.raceNumber),
    );
}

/** A horse and every race it has been entered in. */
export async function getHorseWithEntries(
  horseId: string,
): Promise<{ horse: HorseRow; appearances: RaceEntryAppearance[] } | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(horses)
    .where(eq(horses.id, horseId))
    .limit(1);
  const horse = rows[0];
  if (!horse) return null;
  return { horse, appearances: await loadAppearances(eq(raceEntries.horseId, horseId)) };
}

/** A jockey and every mount they have been booked on. */
export async function getJockeyWithEntries(
  jockeyId: string,
): Promise<{ jockey: JockeyRow; appearances: RaceEntryAppearance[] } | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(jockeys)
    .where(eq(jockeys.id, jockeyId))
    .limit(1);
  const jockey = rows[0];
  if (!jockey) return null;
  return {
    jockey,
    appearances: await loadAppearances(eq(raceEntries.jockeyId, jockeyId)),
  };
}

/** A trainer and every runner they have started. */
export async function getTrainerWithEntries(
  trainerId: string,
): Promise<{ trainer: TrainerRow; appearances: RaceEntryAppearance[] } | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(trainers)
    .where(eq(trainers.id, trainerId))
    .limit(1);
  const trainer = rows[0];
  if (!trainer) return null;
  return {
    trainer,
    appearances: await loadAppearances(eq(raceEntries.trainerId, trainerId)),
  };
}
