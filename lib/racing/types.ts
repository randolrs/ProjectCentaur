import { z } from 'zod';

// ---------------------------------------------------------------------------
// Region
// ---------------------------------------------------------------------------

export type Region = 'us' | 'uk';

// ---------------------------------------------------------------------------
// Raw theracingapi.com North America responses.
//
// These schemas are deliberately tolerant: every field is optional and a
// union of plausible types, because the wire format varies and we only need
// a subset. Unknown keys are stripped from the validated copy, but the
// original JSON is preserved on `Racecard.raw` for the `races.raw_data`
// jsonb column introduced in M3. Field mappings are based on the documented
// NA add-on structure and should be confirmed against a live key.
// ---------------------------------------------------------------------------

const stringOrNumber = z.union([z.string(), z.number()]);

export const naMeetSchema = z.object({
  meet_id: z.string().optional(),
  id: z.string().optional(),
  track_name: z.string().optional(),
  track: z.string().optional(),
  course: z.string().optional(),
  date: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
});

export const naMeetsResponseSchema = z.object({
  meets: z.array(naMeetSchema).default([]),
});

export const naRunnerSchema = z.object({
  program_number: stringOrNumber.optional(),
  post_position: stringOrNumber.optional(),
  horse_name: z.string().optional(),
  horse: z.string().optional(),
  jockey: z.string().optional(),
  trainer: z.string().optional(),
  morning_line_odds: stringOrNumber.optional(),
});

export const naRaceSchema = z.object({
  race_id: z.string().optional(),
  race_key: z.string().optional(),
  race_number: stringOrNumber.optional(),
  post_time: z.string().optional(),
  off_time: z.string().optional(),
  distance: stringOrNumber.optional(),
  surface: z.string().optional(),
  race_type: z.string().optional(),
  race_class: z.string().optional(),
  conditions: z.string().optional(),
  runners: z.array(naRunnerSchema).default([]),
});

export const naEntriesResponseSchema = z.object({
  meet_id: z.string().optional(),
  track_name: z.string().optional(),
  track: z.string().optional(),
  course: z.string().optional(),
  date: z.string().optional(),
  races: z.array(naRaceSchema).default([]),
});

export type NaMeet = z.infer<typeof naMeetSchema>;
export type NaMeetsResponse = z.infer<typeof naMeetsResponseSchema>;
export type NaRace = z.infer<typeof naRaceSchema>;
export type NaEntriesResponse = z.infer<typeof naEntriesResponseSchema>;

// ---------------------------------------------------------------------------
// Normalized, region-agnostic domain types.
//
// All business logic (filtering, scoring, digest generation) operates on
// these. The region-specific wire format never leaks past the client
// boundary — `RegionStrategy.raceNormalization` is the only translation point.
// ---------------------------------------------------------------------------

export interface Runner {
  programNumber: string | null;
  horseName: string | null;
  jockey: string | null;
  trainer: string | null;
  morningLineOdds: string | null;
}

export interface Racecard {
  /** Region this card belongs to. Always 'us' in v1. */
  region: Region;
  /** Track / course display name as returned by the data provider. */
  track: string;
  /** Race number within the day's card, or null if the provider omits it. */
  raceNumber: number | null;
  /** Scheduled post time, as provided by the source (string form). */
  postTime: string | null;
  /** Race conditions / eligibility text. */
  conditions: string | null;
  /** Surface (e.g. "Dirt", "Turf"), as provided by the source. */
  surface: string | null;
  /** Distance, as provided by the source. */
  distance: string | null;
  /** Class / race type, as provided by the source. */
  raceClass: string | null;
  /** Number of runners in the field. */
  fieldSize: number;
  runners: Runner[];
  /** Original raw race object from the provider, retained for M3 ingest. */
  raw: unknown;
}

/**
 * Intermediate payload produced by `RegionStrategy.dataFetch` and consumed by
 * `RegionStrategy.raceNormalization` for the US region.
 */
export interface RawUsRacecardData {
  date: string;
  meets: Array<{ meet: NaMeet; entries: NaEntriesResponse }>;
}
