import { z } from 'zod';
import { usRegionStrategy } from '@/lib/racing/regions';

// ---------------------------------------------------------------------------
// Deterministic onboarding options (SPEC core flow, step 2).
//
// Every selectable value lives here so the form, the server action, and the
// validation schema all stay in sync.
// ---------------------------------------------------------------------------

export interface Option {
  readonly value: string;
  readonly label: string;
}

/** Tracks covered in v1, sourced from the US region strategy. */
export const TRACK_OPTIONS: readonly string[] = usRegionStrategy.vocabulary.v1Tracks;

export const RACE_CLASS_OPTIONS = [
  { value: 'maiden', label: 'Maiden' },
  { value: 'claiming', label: 'Claiming' },
  { value: 'allowance', label: 'Allowance' },
  { value: 'stakes', label: 'Stakes' },
] as const satisfies readonly Option[];

export const DISTANCE_RANGE_OPTIONS = [
  { value: 'sprint', label: 'Sprint — under 1 mile' },
  { value: 'route', label: 'Route — 1 mile to 1¼ miles' },
  { value: 'marathon', label: 'Marathon — over 1¼ miles' },
] as const satisfies readonly Option[];

export const SURFACE_OPTIONS = [
  { value: 'dirt', label: 'Dirt' },
  { value: 'turf', label: 'Turf' },
  { value: 'synthetic', label: 'Synthetic' },
  { value: 'all', label: 'All surfaces' },
] as const satisfies readonly Option[];

export const FIELD_SIZE_BAND_OPTIONS = [
  { value: 'small', label: 'Small fields — 7 or fewer' },
  { value: 'medium', label: 'Medium fields — 8 to 10' },
  { value: 'large', label: 'Large fields — 11 or more' },
  { value: 'any', label: 'No preference' },
] as const satisfies readonly Option[];

export const BET_TYPE_OPTIONS = [
  { value: 'win', label: 'Win' },
  { value: 'place', label: 'Place' },
  { value: 'show', label: 'Show' },
  { value: 'exacta', label: 'Exacta' },
  { value: 'trifecta', label: 'Trifecta' },
  { value: 'pick_3', label: 'Pick 3' },
  { value: 'pick_4', label: 'Pick 4' },
  { value: 'pick_5', label: 'Pick 5' },
  { value: 'pick_6', label: 'Pick 6' },
] as const satisfies readonly Option[];

export const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HT)' },
] as const satisfies readonly Option[];

export const DAYS_PER_WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

// Extract a Zod-enum-ready tuple of `value`s from an options array.
function enumValues<const T extends readonly Option[]>(
  options: T,
): [T[number]['value'], ...T[number]['value'][]] {
  return options.map((o) => o.value) as [
    T[number]['value'],
    ...T[number]['value'][],
  ];
}

// ---------------------------------------------------------------------------
// Validation schema — used by the onboarding server action.
// ---------------------------------------------------------------------------

export const onboardingSchema = z.object({
  tracks: z
    .array(z.string())
    .min(1, 'Pick at least one track.')
    .refine(
      (tracks) => tracks.every((t) => TRACK_OPTIONS.includes(t)),
      'Unrecognized track.',
    ),
  raceClasses: z
    .array(z.enum(enumValues(RACE_CLASS_OPTIONS)))
    .min(1, 'Pick at least one race class.'),
  distanceRanges: z
    .array(z.enum(enumValues(DISTANCE_RANGE_OPTIONS)))
    .min(1, 'Pick at least one distance range.'),
  surfaces: z
    .array(z.enum(enumValues(SURFACE_OPTIONS)))
    .min(1, 'Pick at least one surface.'),
  fieldSizeBand: z.enum(enumValues(FIELD_SIZE_BAND_OPTIONS)),
  betTypes: z
    .array(z.enum(enumValues(BET_TYPE_OPTIONS)))
    .min(1, 'Pick at least one bet type.'),
  daysPerWeek: z.coerce.number().int().min(1).max(7),
  timezone: z.enum(enumValues(TIMEZONE_OPTIONS)),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
