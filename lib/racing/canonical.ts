// ---------------------------------------------------------------------------
// Canonicalization
//
// The provider's surface / class / distance values are free-form display
// strings. The digest pipeline (M4) filters and scores races against a
// user's onboarding preferences, which use a small fixed vocabulary
// (see lib/onboarding/options.ts). These helpers collapse the raw provider
// strings onto that vocabulary so the persisted `races` row carries
// queryable structured columns alongside the raw text.
// ---------------------------------------------------------------------------

export type CanonicalSurface = 'dirt' | 'turf' | 'synthetic' | 'other';
export type CanonicalRaceClass =
  | 'maiden'
  | 'claiming'
  | 'allowance'
  | 'stakes'
  | 'other';

/** Map a provider `surface_description` onto the onboarding surface set. */
export function canonicalSurface(raw: string | null | undefined): CanonicalSurface {
  if (!raw) return 'other';
  const s = raw.toLowerCase();
  if (s.includes('turf') || s.includes('grass')) return 'turf';
  if (s.includes('dirt')) return 'dirt';
  if (/synth|tapeta|poly|cushion|all.?weather|\baw\b/.test(s)) return 'synthetic';
  return 'other';
}

/**
 * Map a provider race class / type string onto the onboarding class set.
 * Order matters: a "Maiden Claiming" is a maiden; an "Allowance Optional
 * Claiming" is an allowance.
 */
export function canonicalRaceClass(
  raw: string | null | undefined,
): CanonicalRaceClass {
  if (!raw) return 'other';
  const s = raw.toLowerCase();
  if (s.includes('maiden') || /\bmsw\b|\bmcl\b|\bmoc\b/.test(s)) return 'maiden';
  if (
    s.includes('stake') ||
    s.includes('handicap') ||
    s.includes('futurity') ||
    /\bstk\b|\bhcp\b/.test(s)
  ) {
    return 'stakes';
  }
  if (s.includes('allowance') || s.includes('optional') || /\balw\b|\baoc\b/.test(s)) {
    return 'allowance';
  }
  if (s.includes('claiming') || s.includes('starter') || /\bclm\b/.test(s)) {
    return 'claiming';
  }
  return 'other';
}

/**
 * Parse a provider `distance_description` (e.g. "6 1/2 Furlongs",
 * "1 1/16 Miles", "1320 Yards") into a numeric furlong count, or null when
 * the unit can't be determined. 1 mile = 8 furlongs; 220 yards = 1 furlong.
 */
export function parseDistanceFurlongs(
  description: string | null | undefined,
): number | null {
  if (!description) return null;
  const text = description.toLowerCase();
  const match = text.match(/(\d+(?:\.\d+)?)(?:\s+(\d+)\s*\/\s*(\d+))?/);
  if (!match) return null;

  let value = Number(match[1]);
  if (match[2] && match[3]) {
    const denominator = Number(match[3]);
    if (denominator > 0) value += Number(match[2]) / denominator;
  }
  if (!Number.isFinite(value)) return null;

  let furlongs: number;
  if (text.includes('mile')) furlongs = value * 8;
  else if (text.includes('yard')) furlongs = value / 220;
  else if (text.includes('furlong')) furlongs = value;
  else return null;

  return Math.round(furlongs * 100) / 100;
}

// ---------------------------------------------------------------------------
// Track canonicalization
//
// The racing provider names a track differently from how a handicapper picks
// it during onboarding: the NYRA spring meet reports as "Belmont at the Big
// A", and "Santa Anita Park" reports as "Santa Anita". The digest matches a
// user's followed tracks against `races.track_canonical`, so ingestion must
// collapse these provider variants onto the onboarding vocabulary (the US
// `v1Tracks` set in lib/racing/regions.ts). A name with no known alias
// passes through trimmed, so non-v1 tracks are still stored coherently.
// ---------------------------------------------------------------------------

// Canonical track display name -> known provider name variants (lowercased).
// The canonical keys must stay in sync with the US `v1Tracks` vocabulary;
// `tests/racing-ingest.test.ts` asserts this.
const TRACK_ALIASES: Readonly<Record<string, readonly string[]>> = {
  Saratoga: ['saratoga race course'],
  // Belmont Park is closed for reconstruction; NYRA runs the Belmont meet at
  // the Aqueduct facility and reports it as "Belmont at the Big A".
  'Belmont Park': ['belmont at the big a'],
  Aqueduct: ['aqueduct racetrack'],
  'Churchill Downs': [],
  Keeneland: [],
  'Del Mar': ['del mar thoroughbred club'],
  'Santa Anita Park': ['santa anita'],
  'Gulfstream Park': ['gulfstream', 'gulfstream park west'],
  'Oaklawn Park': ['oaklawn'],
  'Fair Grounds': ['fair grounds race course'],
  'Tampa Bay Downs': [],
  'Kentucky Downs': [],
};

const TRACK_ALIAS_LOOKUP: ReadonlyMap<string, string> = new Map(
  Object.entries(TRACK_ALIASES).flatMap(([canonical, aliases]) => [
    [canonical.toLowerCase(), canonical] as const,
    ...aliases.map((alias) => [alias, canonical] as const),
  ]),
);

/** Canonical track display names covered by the v1 onboarding vocabulary. */
export const CANONICAL_TRACKS: readonly string[] = Object.keys(TRACK_ALIASES);

/**
 * Collapse a provider track name onto the onboarding track vocabulary.
 * Unknown tracks pass through trimmed; blank input becomes "Unknown".
 */
export function canonicalTrack(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return 'Unknown';
  return TRACK_ALIAS_LOOKUP.get(trimmed.toLowerCase()) ?? trimmed;
}

/**
 * Normalize a horse / person name to a stable lookup key — lower-cased and
 * whitespace-collapsed. The provider gives horses no id and sometimes omits
 * person ids, so ingestion synthesizes natural keys from normalized names.
 */
export function normalizeNameKey(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}
