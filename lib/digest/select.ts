import type { RaceRow, UserPreferencesRow } from '@/db/schema';
import type { TrackForecast } from '@/lib/weather/nws';

// ---------------------------------------------------------------------------
// Deterministic race selection.
//
// The digest pipeline first narrows the day's races at a user's followed
// tracks down to those that match their structured onboarding preferences —
// surface, race class, distance range, and field-size band. This is a pure
// SQL-shaped filter; the qualitative reasoning (why a race is worth the
// handicapper's attention) is left to the LLM layer, which only ever sees
// races that already cleared this filter.
// ---------------------------------------------------------------------------

export type DistanceRange = 'sprint' | 'route' | 'marathon';
export type FieldSizeBand = 'small' | 'medium' | 'large';

/**
 * Bucket a furlong distance into an onboarding distance range, or null when
 * the distance is unknown. Mirrors DISTANCE_RANGE_OPTIONS: sprint is under a
 * mile (8f), route is 1 to 1¼ miles (8-10f), marathon is beyond that.
 */
export function distanceRangeOf(furlongs: number | null): DistanceRange | null {
  if (furlongs === null) return null;
  if (furlongs < 8) return 'sprint';
  if (furlongs <= 10) return 'route';
  return 'marathon';
}

/** Bucket a runner count into an onboarding field-size band. */
export function fieldSizeBandOf(fieldSize: number): FieldSizeBand {
  if (fieldSize <= 7) return 'small';
  if (fieldSize <= 10) return 'medium';
  return 'large';
}

const DISTANCE_RANGE_LABEL: Record<DistanceRange, string> = {
  sprint: 'a sprint',
  route: 'a route',
  marathon: 'a marathon',
};

const FIELD_SIZE_LABEL: Record<FieldSizeBand, string> = {
  small: 'a small field',
  medium: 'a medium field',
  large: 'a large field',
};

export interface ScoredRace {
  race: RaceRow;
  /** Plain-language reasons the race matched, one per satisfied preference. */
  matchReasons: string[];
  /** Forecast at the track on the racing day, attached by the pipeline. */
  weather?: TrackForecast | null;
}

/** Post-time order with unknown post times sorted last, then track / race. */
function byPostTime(a: ScoredRace, b: ScoredRace): number {
  const at = a.race.postTimestamp ?? Number.POSITIVE_INFINITY;
  const bt = b.race.postTimestamp ?? Number.POSITIVE_INFINITY;
  if (at !== bt) return at - bt;
  if (a.race.track !== b.race.track) {
    return a.race.track.localeCompare(b.race.track);
  }
  return (a.race.raceNumber ?? 0) - (b.race.raceNumber ?? 0);
}

/**
 * Filter races down to those matching every structured preference. The
 * caller is expected to have already scoped `races` to the user's followed
 * tracks (see `getRacesForTracks`).
 */
export function selectRacesForUser(
  prefs: UserPreferencesRow,
  races: RaceRow[],
): ScoredRace[] {
  const anySurface = prefs.surfaces.includes('all');
  const selected: ScoredRace[] = [];

  for (const race of races) {
    const reasons: string[] = [];

    const surfaceOk =
      anySurface || prefs.surfaces.includes(race.surfaceCanonical);
    if (!surfaceOk) continue;
    if (race.surface) reasons.push(`Runs on ${race.surface.toLowerCase()}`);

    const classOk = prefs.raceClasses.includes(race.raceClassCanonical);
    if (!classOk) continue;
    reasons.push(`${race.raceClassCanonical} race — a class you follow`);

    const range = distanceRangeOf(race.distanceFurlongs);
    if (range === null || !prefs.distanceRanges.includes(range)) continue;
    reasons.push(`${DISTANCE_RANGE_LABEL[range]} at a distance you play`);

    const band = fieldSizeBandOf(race.fieldSize);
    if (prefs.fieldSizeBand !== 'any' && prefs.fieldSizeBand !== band) continue;
    reasons.push(`${FIELD_SIZE_LABEL[band]} of ${race.fieldSize}`);

    selected.push({ race, matchReasons: reasons });
  }

  return selected.sort(byPostTime);
}
