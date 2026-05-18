import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import {
  horses,
  jockeys,
  meets,
  type NewHorseRow,
  type NewJockeyRow,
  type NewMeetRow,
  type NewRaceEntryRow,
  type NewRaceRow,
  type NewTrackRow,
  type NewTrainerRow,
  raceEntries,
  races,
  tracks,
  trainers,
} from '@/db/schema';
import { RacingApiClient } from './client';
import {
  canonicalRaceClass,
  canonicalSurface,
  canonicalTrack,
  normalizeNameKey,
  parseDistanceFurlongs,
} from './canonical';
import { usRegionStrategy } from './regions';
import type { Person, Racecard, Runner } from './types';

// ---------------------------------------------------------------------------
// Race ingestion
//
// Persists a day's racecards into the normalized hierarchy:
//
//   tracks -> meets -> races -> race_entries
//
// with horses / jockeys / trainers as dimensions the entries reference. Each
// entity is upserted on its natural key, so re-running ingestion refreshes
// existing records (scratches, odds) and links new entries to the records
// already created for the horses and people they involve. The whole batch
// runs in one transaction — a partial hierarchy is never persisted.
// ---------------------------------------------------------------------------

/** Deterministic idempotency key for a race. */
export function racecardKey(card: Racecard): string {
  const racePart = card.raceNumber ?? card.postTime ?? 'unknown';
  const dayPart = card.dayEvening ?? 'D';
  return [card.region, card.raceDate, card.track, racePart, dayPart].join('|');
}

/** Natural key for a horse — the feed gives no id, so name + pedigree. */
export function horseNaturalKey(runner: Runner): string {
  return [runner.horseName, runner.sireName, runner.damName]
    .map(normalizeNameKey)
    .join('|');
}

/** Natural key for a jockey / trainer — provider id, or normalized name. */
export function personNaturalKey(person: Person): string {
  return person.providerId ?? `name:${normalizeNameKey(person.name)}`;
}

/** Idempotency key for one horse's entry in a race. */
function raceEntryKey(raceKey: string, runner: Runner, index: number): string {
  return `${raceKey}|${runner.programNumber ?? `idx${index}`}`;
}

/** Map a normalized racecard onto a `races` insert row for an upserted meet. */
export function racecardToRaceRow(
  card: Racecard,
  key: string,
  meetId: string,
): NewRaceRow {
  return {
    key,
    meetId,
    source: 'theracingapi',
    region: card.region,
    raceDate: card.raceDate,
    track: card.track,
    trackCanonical: canonicalTrack(card.track),
    raceNumber: card.raceNumber,
    dayEvening: card.dayEvening,
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

// Columns refreshed when an existing race row is re-ingested. Identity and
// `created_at` are preserved; everything else tracks the latest provider data.
const RACE_CONFLICT_UPDATE = {
  meetId: sql`excluded.meet_id`,
  source: sql`excluded.source`,
  region: sql`excluded.region`,
  raceDate: sql`excluded.race_date`,
  track: sql`excluded.track`,
  trackCanonical: sql`excluded.track_canonical`,
  raceNumber: sql`excluded.race_number`,
  dayEvening: sql`excluded.day_evening`,
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

const ENTRY_CONFLICT_UPDATE = {
  raceId: sql`excluded.race_id`,
  horseId: sql`excluded.horse_id`,
  jockeyId: sql`excluded.jockey_id`,
  trainerId: sql`excluded.trainer_id`,
  programNumber: sql`excluded.program_number`,
  postPosition: sql`excluded.post_position`,
  morningLineOdds: sql`excluded.morning_line_odds`,
  weight: sql`excluded.weight`,
  medication: sql`excluded.medication`,
  equipment: sql`excluded.equipment`,
  scratched: sql`excluded.scratched`,
  updatedAt: sql`now()`,
};

export interface IngestResult {
  date: string;
  tracks: number;
  meets: number;
  races: number;
  entries: number;
  horses: number;
  jockeys: number;
  trainers: number;
}

/**
 * Upsert a day's racecards into the normalized racing tables in one
 * transaction. Entities are deduped within the batch before each bulk
 * upsert — Postgres rejects an `ON CONFLICT` statement that touches one row
 * twice — and persisted in dependency order so foreign keys always resolve.
 */
export async function ingestRacecards(
  cards: Racecard[],
  date: string,
): Promise<IngestResult> {
  const empty: IngestResult = {
    date,
    tracks: 0,
    meets: 0,
    races: 0,
    entries: 0,
    horses: 0,
    jockeys: 0,
    trainers: 0,
  };
  if (cards.length === 0) return empty;

  return getDb().transaction(async (tx) => {
    // 1. Tracks — deduped on canonical name.
    const trackRows = new Map<string, NewTrackRow>();
    for (const card of cards) {
      const nameCanonical = canonicalTrack(card.track);
      if (!trackRows.has(nameCanonical)) {
        trackRows.set(nameCanonical, {
          providerTrackId: card.providerTrackId,
          name: card.track,
          nameCanonical,
          region: card.region,
        });
      }
    }
    const trackResult = await tx
      .insert(tracks)
      .values([...trackRows.values()])
      .onConflictDoUpdate({
        target: tracks.nameCanonical,
        set: {
          providerTrackId: sql`excluded.provider_track_id`,
          name: sql`excluded.name`,
          region: sql`excluded.region`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: tracks.id, nameCanonical: tracks.nameCanonical });
    const trackId = new Map(trackResult.map((r) => [r.nameCanonical, r.id]));

    // 2. Meets — deduped on provider meet id.
    const meetRows = new Map<string, NewMeetRow>();
    for (const card of cards) {
      if (meetRows.has(card.providerMeetId)) continue;
      const tId = trackId.get(canonicalTrack(card.track));
      if (!tId) continue;
      meetRows.set(card.providerMeetId, {
        providerMeetId: card.providerMeetId,
        trackId: tId,
        raceDate: card.raceDate,
        region: card.region,
        country: card.country,
      });
    }
    const meetResult = await tx
      .insert(meets)
      .values([...meetRows.values()])
      .onConflictDoUpdate({
        target: meets.providerMeetId,
        set: {
          trackId: sql`excluded.track_id`,
          raceDate: sql`excluded.race_date`,
          region: sql`excluded.region`,
          country: sql`excluded.country`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: meets.id, providerMeetId: meets.providerMeetId });
    const meetId = new Map(meetResult.map((r) => [r.providerMeetId, r.id]));

    // 3. Dimensions — horses, jockeys, trainers, each deduped on its key.
    const horseRows = new Map<string, NewHorseRow>();
    const jockeyRows = new Map<string, NewJockeyRow>();
    const trainerRows = new Map<string, NewTrainerRow>();
    for (const card of cards) {
      for (const runner of card.runners) {
        if (runner.horseName) {
          const naturalKey = horseNaturalKey(runner);
          if (!horseRows.has(naturalKey)) {
            horseRows.set(naturalKey, {
              name: runner.horseName,
              sireName: runner.sireName,
              damName: runner.damName,
              naturalKey,
            });
          }
        }
        if (runner.jockey) {
          const naturalKey = personNaturalKey(runner.jockey);
          if (!jockeyRows.has(naturalKey)) {
            jockeyRows.set(naturalKey, {
              providerId: runner.jockey.providerId,
              name: runner.jockey.name,
              naturalKey,
            });
          }
        }
        if (runner.trainer) {
          const naturalKey = personNaturalKey(runner.trainer);
          if (!trainerRows.has(naturalKey)) {
            trainerRows.set(naturalKey, {
              providerId: runner.trainer.providerId,
              name: runner.trainer.name,
              naturalKey,
            });
          }
        }
      }
    }

    const horseId = new Map<string, string>();
    if (horseRows.size > 0) {
      const result = await tx
        .insert(horses)
        .values([...horseRows.values()])
        .onConflictDoUpdate({
          target: horses.naturalKey,
          set: {
            name: sql`excluded.name`,
            sireName: sql`excluded.sire_name`,
            damName: sql`excluded.dam_name`,
            updatedAt: sql`now()`,
          },
        })
        .returning({ id: horses.id, naturalKey: horses.naturalKey });
      for (const r of result) horseId.set(r.naturalKey, r.id);
    }

    const jockeyId = new Map<string, string>();
    if (jockeyRows.size > 0) {
      const result = await tx
        .insert(jockeys)
        .values([...jockeyRows.values()])
        .onConflictDoUpdate({
          target: jockeys.naturalKey,
          set: {
            providerId: sql`excluded.provider_id`,
            name: sql`excluded.name`,
            updatedAt: sql`now()`,
          },
        })
        .returning({ id: jockeys.id, naturalKey: jockeys.naturalKey });
      for (const r of result) jockeyId.set(r.naturalKey, r.id);
    }

    const trainerId = new Map<string, string>();
    if (trainerRows.size > 0) {
      const result = await tx
        .insert(trainers)
        .values([...trainerRows.values()])
        .onConflictDoUpdate({
          target: trainers.naturalKey,
          set: {
            providerId: sql`excluded.provider_id`,
            name: sql`excluded.name`,
            updatedAt: sql`now()`,
          },
        })
        .returning({ id: trainers.id, naturalKey: trainers.naturalKey });
      for (const r of result) trainerId.set(r.naturalKey, r.id);
    }

    // 4. Races — deduped on the idempotency key.
    const raceRows = new Map<string, NewRaceRow>();
    for (const card of cards) {
      const mId = meetId.get(card.providerMeetId);
      if (!mId) continue;
      const key = racecardKey(card);
      raceRows.set(key, racecardToRaceRow(card, key, mId));
    }
    const raceResult = await tx
      .insert(races)
      .values([...raceRows.values()])
      .onConflictDoUpdate({ target: races.key, set: RACE_CONFLICT_UPDATE })
      .returning({ id: races.id, key: races.key });
    const raceId = new Map(raceResult.map((r) => [r.key, r.id]));

    // 5. Race entries — one per horse entered in a race.
    const entryRows = new Map<string, NewRaceEntryRow>();
    for (const card of cards) {
      const key = racecardKey(card);
      const rId = raceId.get(key);
      if (!rId) continue;
      card.runners.forEach((runner, index) => {
        if (!runner.horseName) return;
        const hId = horseId.get(horseNaturalKey(runner));
        if (!hId) return;
        const entryKey = raceEntryKey(key, runner, index);
        entryRows.set(entryKey, {
          key: entryKey,
          raceId: rId,
          horseId: hId,
          jockeyId: runner.jockey
            ? (jockeyId.get(personNaturalKey(runner.jockey)) ?? null)
            : null,
          trainerId: runner.trainer
            ? (trainerId.get(personNaturalKey(runner.trainer)) ?? null)
            : null,
          programNumber: runner.programNumber,
          postPosition: runner.postPosition,
          morningLineOdds: runner.morningLineOdds,
          weight: runner.weight,
          medication: runner.medication,
          equipment: runner.equipment,
          scratched: runner.scratched,
        });
      });
    }
    if (entryRows.size > 0) {
      await tx
        .insert(raceEntries)
        .values([...entryRows.values()])
        .onConflictDoUpdate({
          target: raceEntries.key,
          set: ENTRY_CONFLICT_UPDATE,
        });
    }

    return {
      date,
      tracks: trackRows.size,
      meets: meetRows.size,
      races: raceRows.size,
      entries: entryRows.size,
      horses: horseRows.size,
      jockeys: jockeyRows.size,
      trainers: trainerRows.size,
    };
  });
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
