import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { races, type NewRaceRow } from '@/db/schema';
import { RacingApiClient } from './client';
import {
  canonicalRaceClass,
  canonicalSurface,
  parseDistanceFurlongs,
} from './canonical';
import { usRegionStrategy } from './regions';
import type { Racecard } from './types';

// ---------------------------------------------------------------------------
// Race ingestion
//
// Translates normalized `Racecard`s into `races` rows and upserts them. The
// upsert is keyed on a deterministic natural key so re-running ingestion for
// the same racing day refreshes existing rows (scratches, odds changes)
// rather than duplicating them.
// ---------------------------------------------------------------------------

/** Deterministic idempotency key for a racecard on a given racing day. */
export function racecardKey(date: string, card: Racecard): string {
  const racePart = card.raceNumber ?? card.postTime ?? 'unknown';
  return [card.region, date, card.track, racePart].join('|');
}

/** Map a normalized racecard onto a `races` insert row. */
export function racecardToRow(card: Racecard, date: string): NewRaceRow {
  return {
    key: racecardKey(date, card),
    source: 'theracingapi',
    region: card.region,
    raceDate: date,
    track: card.track,
    raceNumber: card.raceNumber,
    postTime: card.postTime,
    postTimestamp: card.postTimestamp,
    surface: card.surface,
    surfaceCanonical: canonicalSurface(card.surface),
    distance: card.distance,
    distanceFurlongs: parseDistanceFurlongs(card.distance),
    raceClass: card.raceClass,
    raceClassCanonical: canonicalRaceClass(card.raceClass),
    conditions: card.conditions,
    purse: card.purse,
    fieldSize: card.fieldSize,
    runners: card.runners,
    rawData: card.raw,
  };
}

/**
 * Build insert rows for a batch of racecards, de-duplicated by natural key
 * (last write wins). De-duplication keeps a single `INSERT ... ON CONFLICT`
 * statement valid — Postgres rejects a batch that touches one row twice.
 */
export function racecardsToRows(cards: Racecard[], date: string): NewRaceRow[] {
  const byKey = new Map<string, NewRaceRow>();
  for (const card of cards) {
    const row = racecardToRow(card, date);
    byKey.set(row.key, row);
  }
  return [...byKey.values()];
}

// Columns refreshed when an existing race row is re-ingested. Identity and
// `created_at` are preserved; everything else tracks the latest provider data.
const CONFLICT_UPDATE = {
  source: sql`excluded.source`,
  region: sql`excluded.region`,
  raceDate: sql`excluded.race_date`,
  track: sql`excluded.track`,
  raceNumber: sql`excluded.race_number`,
  postTime: sql`excluded.post_time`,
  postTimestamp: sql`excluded.post_timestamp`,
  surface: sql`excluded.surface`,
  surfaceCanonical: sql`excluded.surface_canonical`,
  distance: sql`excluded.distance`,
  distanceFurlongs: sql`excluded.distance_furlongs`,
  raceClass: sql`excluded.race_class`,
  raceClassCanonical: sql`excluded.race_class_canonical`,
  conditions: sql`excluded.conditions`,
  purse: sql`excluded.purse`,
  fieldSize: sql`excluded.field_size`,
  runners: sql`excluded.runners`,
  rawData: sql`excluded.raw_data`,
  ingestedAt: sql`now()`,
  updatedAt: sql`now()`,
};

export interface IngestResult {
  date: string;
  ingested: number;
}

/** Upsert a batch of racecards for a racing day into the `races` table. */
export async function ingestRacecards(
  cards: Racecard[],
  date: string,
): Promise<IngestResult> {
  const rows = racecardsToRows(cards, date);
  if (rows.length === 0) return { date, ingested: 0 };

  const db = getDb();
  await db
    .insert(races)
    .values(rows)
    .onConflictDoUpdate({ target: races.key, set: CONFLICT_UPDATE });

  return { date, ingested: rows.length };
}

/** Fetch, normalize, and persist today's US racecards. */
export async function ingestTodaysUsRaces(
  client?: RacingApiClient,
): Promise<IngestResult> {
  const api = client ?? RacingApiClient.fromEnv();
  const raw = await usRegionStrategy.dataFetch(api);
  const cards = usRegionStrategy.raceNormalization(raw);
  return ingestRacecards(cards, raw.date);
}
