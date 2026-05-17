import type { RacingApiClient } from './client';
import type {
  NaMeet,
  NaRace,
  Racecard,
  RawUsRacecardData,
  Region,
  Runner,
} from './types';

// ---------------------------------------------------------------------------
// Region strategy
//
// Each supported region provides one `RegionStrategy`: how to fetch its raw
// data, how to normalize it into region-agnostic `Racecard`s, plus the
// vocabulary and defaults that downstream onboarding / digest logic needs.
// v1 ships `UsRegionStrategy` only; `UkRegionStrategy` is a typed stub so the
// architecture is proven without committing to UK behaviour (SPEC: UK/IE is
// an explicit non-goal, "architecture supports, ingest disabled").
// ---------------------------------------------------------------------------

export interface RegionVocabulary {
  /** Surface terms used by handicappers in this region. */
  readonly surfaces: readonly string[];
  /** Race class / condition tiers. */
  readonly raceClasses: readonly string[];
  /** Unit distances are expressed in. */
  readonly distanceUnit: string;
  /** ISO currency code for purses / bankroll. */
  readonly currency: string;
  /** Tracks covered in v1 for this region. */
  readonly v1Tracks: readonly string[];
}

export interface RegionStrategy<TRaw = unknown> {
  readonly region: Region;
  readonly vocabulary: RegionVocabulary;
  /** Default digest delivery hour (0-23) in the region's primary timezone. */
  readonly defaultDigestDeliveryHour: number;
  /** Bet types surfaced as defaults during onboarding. */
  readonly suggestedBetTypes: readonly string[];
  /** Fetch raw provider data for the region's current racing day. */
  dataFetch(client: RacingApiClient): Promise<TRaw>;
  /** Translate raw provider data into normalized racecards. */
  raceNormalization(raw: TRaw): Racecard[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** YYYY-MM-DD for the current racing day in US Eastern time. */
export function usToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
  }).format(now);
}

function toNumber(value: string | number | undefined): number | null {
  if (value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toStringOrNull(value: string | number | undefined): string | null {
  if (value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function isUsMeet(meet: NaMeet): boolean {
  const marker = (meet.country ?? meet.region ?? '').toLowerCase();
  if (!marker) return true; // NA add-on is US + Canada; keep when unlabelled.
  return /usa|united states|^us\b|u\.s\./.test(marker);
}

function normalizeRunner(runner: NonNullable<NaRace['runners']>[number]): Runner {
  return {
    programNumber: toStringOrNull(runner.program_number ?? runner.post_position),
    horseName: runner.horse_name ?? runner.horse ?? null,
    jockey: runner.jockey ?? null,
    trainer: runner.trainer ?? null,
    morningLineOdds: toStringOrNull(runner.morning_line_odds),
  };
}

function normalizeRace(region: Region, track: string, race: NaRace): Racecard {
  const runners = race.runners.map(normalizeRunner);
  return {
    region,
    track,
    raceNumber: toNumber(race.race_number),
    postTime: race.post_time ?? race.off_time ?? null,
    conditions: race.conditions ?? null,
    surface: race.surface ?? null,
    distance: toStringOrNull(race.distance),
    raceClass: race.race_class ?? race.race_type ?? null,
    fieldSize: runners.length,
    runners,
    raw: race,
  };
}

// ---------------------------------------------------------------------------
// US region strategy (v1)
// ---------------------------------------------------------------------------

const US_VOCABULARY: RegionVocabulary = {
  surfaces: ['dirt', 'turf', 'synthetic'],
  raceClasses: ['maiden', 'claiming', 'allowance', 'stakes'],
  distanceUnit: 'furlongs',
  currency: 'USD',
  v1Tracks: [
    'Saratoga',
    'Belmont Park',
    'Aqueduct',
    'Churchill Downs',
    'Keeneland',
    'Del Mar',
    'Santa Anita Park',
    'Gulfstream Park',
    'Oaklawn Park',
    'Fair Grounds',
    'Tampa Bay Downs',
    'Kentucky Downs',
  ],
};

class UsRegionStrategy implements RegionStrategy<RawUsRacecardData> {
  readonly region: Region = 'us';
  readonly vocabulary = US_VOCABULARY;
  /** SPEC: digest delivery defaults to 7 AM ET. */
  readonly defaultDigestDeliveryHour = 7;
  readonly suggestedBetTypes = [
    'win',
    'place',
    'show',
    'exacta',
    'trifecta',
    'pick_3',
    'pick_4',
  ] as const;

  async dataFetch(client: RacingApiClient): Promise<RawUsRacecardData> {
    const date = usToday();
    const meetsResponse = await client.listNorthAmericaMeets(date);
    const usMeets = meetsResponse.meets.filter(isUsMeet);

    const meets: RawUsRacecardData['meets'] = [];
    for (const meet of usMeets) {
      const meetId = meet.meet_id ?? meet.id;
      if (!meetId) continue;
      const entries = await client.getNorthAmericaEntries(meetId);
      meets.push({ meet, entries });
    }

    return { date, meets };
  }

  raceNormalization(raw: RawUsRacecardData): Racecard[] {
    const cards: Racecard[] = [];
    for (const { meet, entries } of raw.meets) {
      const track =
        entries.track_name ??
        entries.track ??
        entries.course ??
        meet.track_name ??
        meet.track ??
        meet.course ??
        'Unknown';
      for (const race of entries.races) {
        cards.push(normalizeRace('us', track, race));
      }
    }
    return cards;
  }
}

// ---------------------------------------------------------------------------
// UK region strategy — stub only (SPEC non-goal: ingest disabled in v1)
// ---------------------------------------------------------------------------

const UK_NOT_SUPPORTED = 'UK racing not yet supported';

class UkRegionStrategy implements RegionStrategy {
  readonly region: Region = 'uk';

  get vocabulary(): RegionVocabulary {
    throw new Error(UK_NOT_SUPPORTED);
  }

  get defaultDigestDeliveryHour(): number {
    throw new Error(UK_NOT_SUPPORTED);
  }

  get suggestedBetTypes(): readonly string[] {
    throw new Error(UK_NOT_SUPPORTED);
  }

  dataFetch(): Promise<never> {
    throw new Error(UK_NOT_SUPPORTED);
  }

  raceNormalization(): Racecard[] {
    throw new Error(UK_NOT_SUPPORTED);
  }
}

export const usRegionStrategy = new UsRegionStrategy();
export const ukRegionStrategy = new UkRegionStrategy();
