import { z } from 'zod';

// ---------------------------------------------------------------------------
// Region
// ---------------------------------------------------------------------------

export type Region = 'us' | 'uk';

// ---------------------------------------------------------------------------
// Raw theracingapi.com North America responses.
//
// These mirror the published OpenAPI 3.1 schema for the NA add-on
// (`GET /v1/north-america/meets` and `.../meets/{meet_id}/entries`). Per that
// spec almost every Race/Runner field is nullable; only `race_key` and
// `runners` are required on a Race. The schemas keep just the subset we
// consume — unknown keys are stripped from the validated copy, but the
// original race object is preserved verbatim on `Racecard.raw` for the
// `races.raw_data` jsonb column.
// ---------------------------------------------------------------------------

/** `string | null | undefined` — the spec's pervasive nullable-string shape. */
const nullableString = z.string().nullish();
/** Numeric fields the provider sometimes serialises as strings. */
const numberOrString = z.union([z.number(), z.string()]).nullish();

export const naMeetSchema = z.object({
  meet_id: z.string(),
  track_id: nullableString,
  track_name: z.string(),
  country: nullableString,
  date: nullableString,
});

export const naMeetsResponseSchema = z.object({
  meets: z.array(naMeetSchema).nullish(),
  limit: z.number().optional(),
  skip: z.number().optional(),
});

export const naPersonSchema = z.object({
  id: nullableString,
  alias: nullableString,
  first_name: nullableString,
  first_name_initial: nullableString,
  middle_name: nullableString,
  last_name: nullableString,
  type: nullableString,
});

export const naRunnerSchema = z.object({
  horse_name: nullableString,
  program_number: nullableString,
  program_number_stripped: z.number().nullish(),
  post_pos: nullableString,
  morning_line_odds: nullableString,
  live_odds: nullableString,
  scratch_indicator: nullableString,
  jockey: naPersonSchema.nullish(),
  trainer: naPersonSchema.nullish(),
  weight: nullableString,
  medication: nullableString,
  equipment: nullableString,
  sire_name: nullableString,
  dam_name: nullableString,
});

export const naRaceKeySchema = z.object({
  race_number: nullableString,
  day_evening: nullableString,
});

export const naRaceSchema = z.object({
  race_key: naRaceKeySchema.optional(),
  runners: z.array(naRunnerSchema).default([]),
  post_time: nullableString,
  post_time_long: nullableString,
  distance_description: nullableString,
  distance_value: numberOrString,
  distance_unit: nullableString,
  surface_description: nullableString,
  course_type: nullableString,
  track_condition: nullableString,
  race_class: nullableString,
  race_type: nullableString,
  race_type_description: nullableString,
  race_name: nullableString,
  grade: nullableString,
  purse: numberOrString,
  min_claim_price: numberOrString,
  max_claim_price: numberOrString,
  age_restriction_description: nullableString,
  sex_restriction_description: nullableString,
  race_restriction_description: nullableString,
  is_cancelled: z.boolean().nullish(),
  has_results: z.boolean().nullish(),
});

export const naEntriesResponseSchema = z.object({
  meet_id: nullableString,
  track_id: nullableString,
  track_name: nullableString,
  country: nullableString,
  date: nullableString,
  races: z.array(naRaceSchema).default([]),
});

export type NaMeet = z.infer<typeof naMeetSchema>;
export type NaMeetsResponse = z.infer<typeof naMeetsResponseSchema>;
export type NaPerson = z.infer<typeof naPersonSchema>;
export type NaRunner = z.infer<typeof naRunnerSchema>;
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
  /** True when the entry has been scratched from the race. */
  scratched: boolean;
}

export interface Racecard {
  /** Region this card belongs to. Always 'us' in v1. */
  region: Region;
  /** Track / course display name as returned by the data provider. */
  track: string;
  /** Race number within the day's card, or null if the provider omits it. */
  raceNumber: number | null;
  /** Scheduled post time in the provider's display form (e.g. "12:40 PM"). */
  postTime: string | null;
  /** Epoch-ms post time from `post_time_long`, when the provider supplies it. */
  postTimestamp: number | null;
  /** Race conditions / eligibility text, synthesized from restriction fields. */
  conditions: string | null;
  /** Surface (e.g. "Dirt", "Turf"), as provided by the source. */
  surface: string | null;
  /** Distance description (e.g. "6 1/2 Furlongs"), as provided by the source. */
  distance: string | null;
  /** Class / race type, as provided by the source. */
  raceClass: string | null;
  /** Total purse in whole currency units, when provided. */
  purse: number | null;
  /** Number of live (non-scratched) runners. */
  fieldSize: number;
  runners: Runner[];
  /** Original raw race object from the provider, retained for `races.raw_data`. */
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
