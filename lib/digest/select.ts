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

export type MatchStrength = 'strong' | 'weak';

export interface ScoredRace {
  race: RaceRow;
  /** Plain-language reasons the race matched, one per satisfied preference. */
  matchReasons: string[];
  /** Preferences the race missed — populated for weak matches, empty for strong. */
  missReasons: string[];
  /** 'strong' = cleared every active preference; 'weak' = a closest-fit fallback. */
  strength: MatchStrength;
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

interface RaceEvaluation {
  /** Reasons for each preference the race satisfied. */
  reasons: string[];
  /** Reasons for each active preference the race missed. */
  misses: string[];
  /** Count of active preferences satisfied — used to rank weak matches. */
  satisfied: number;
  /** True only when every active preference is satisfied. */
  strong: boolean;
}

/**
 * Score one race against a user's structured preferences. Surface and
 * field-size drop out as constraints when the user follows "all" / "any";
 * class and distance are always active.
 */
function evaluateRace(
  prefs: UserPreferencesRow,
  race: RaceRow,
): RaceEvaluation {
  const reasons: string[] = [];
  const misses: string[] = [];
  let satisfied = 0;

  const anySurface = prefs.surfaces.includes('all');
  const surfaceOk =
    anySurface || prefs.surfaces.includes(race.surfaceCanonical);
  if (!anySurface) {
    if (surfaceOk) satisfied += 1;
    else
      misses.push(
        `runs on ${race.surface ? race.surface.toLowerCase() : 'an unlisted surface'}, not a surface you follow`,
      );
  }
  if (surfaceOk && race.surface) {
    reasons.push(`Runs on ${race.surface.toLowerCase()}`);
  }

  const classOk = prefs.raceClasses.includes(race.raceClassCanonical);
  if (classOk) {
    satisfied += 1;
    reasons.push(`${race.raceClassCanonical} race — a class you follow`);
  } else {
    misses.push(
      `${race.raceClassCanonical} race — outside the classes you follow`,
    );
  }

  const range = distanceRangeOf(race.distanceFurlongs);
  let distanceOk = false;
  if (range === null) {
    misses.push('distance not listed');
  } else if (prefs.distanceRanges.includes(range)) {
    distanceOk = true;
    satisfied += 1;
    reasons.push(`${DISTANCE_RANGE_LABEL[range]} at a distance you play`);
  } else {
    misses.push(
      `${DISTANCE_RANGE_LABEL[range]} — outside the distances you play`,
    );
  }

  const band = fieldSizeBandOf(race.fieldSize);
  const fieldActive = prefs.fieldSizeBand !== 'any';
  const fieldOk = !fieldActive || prefs.fieldSizeBand === band;
  if (fieldActive) {
    if (fieldOk) satisfied += 1;
    else
      misses.push(
        `${FIELD_SIZE_LABEL[band]} of ${race.fieldSize} — not your field size`,
      );
  }
  if (fieldOk) reasons.push(`${FIELD_SIZE_LABEL[band]} of ${race.fieldSize}`);

  return {
    reasons,
    misses,
    satisfied,
    strong: surfaceOk && classOk && distanceOk && fieldOk,
  };
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
  const selected: ScoredRace[] = [];
  for (const race of races) {
    const evaluation = evaluateRace(prefs, race);
    if (!evaluation.strong) continue;
    selected.push({
      race,
      matchReasons: evaluation.reasons,
      missReasons: [],
      strength: 'strong',
    });
  }
  return selected.sort(byPostTime);
}

/**
 * The closest non-matching races at the user's followed tracks, for days when
 * nothing cleared every filter. Ranked by how many preferences each race
 * satisfies (then post time) and capped at `limit`, so the digest can still
 * surface the best of a card rather than going dark.
 */
export function selectClosestRaces(
  prefs: UserPreferencesRow,
  races: RaceRow[],
  limit: number,
): ScoredRace[] {
  const weak: { scored: ScoredRace; satisfied: number }[] = [];
  for (const race of races) {
    const evaluation = evaluateRace(prefs, race);
    if (evaluation.strong) continue;
    weak.push({
      scored: {
        race,
        matchReasons: evaluation.reasons,
        missReasons: evaluation.misses,
        strength: 'weak',
      },
      satisfied: evaluation.satisfied,
    });
  }
  weak.sort(
    (a, b) => b.satisfied - a.satisfied || byPostTime(a.scored, b.scored),
  );
  return weak.slice(0, limit).map((entry) => entry.scored);
}
