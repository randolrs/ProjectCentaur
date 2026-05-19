import { z } from 'zod';

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

export const ACTIVE_DAY_OPTIONS = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
] as const satisfies readonly Option[];

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
  // Track names are validated dynamically against the synced `tracks` table,
  // not a static list — the onboarding form is built from that same source.
  tracks: z
    .array(z.string().min(1))
    .min(1, 'Pick at least one track.'),
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
  activeDays: z
    .array(z.enum(enumValues(ACTIVE_DAY_OPTIONS)))
    .min(1, 'Pick at least one day.'),
  timezone: z.enum(enumValues(TIMEZONE_OPTIONS)),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
