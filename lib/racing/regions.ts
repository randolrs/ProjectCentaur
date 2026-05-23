import type { RacingApiClient } from './client';
import type {
  NaMeet,
  NaPerson,
  NaRace,
  NaRunner,
  Person,
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
  /**
   * Fetch raw provider data for a racing day (YYYY-MM-DD). Defaults to the
   * region's current racing day; an explicit date drives backfill.
   */
  dataFetch(client: RacingApiClient, date?: string): Promise<TRaw>;
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

function toNumber(value: string | number | null | undefined): number | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toStringOrNull(value: string | number | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

/** NA add-on covers the US + Canada; keep only US meets for v1. */
export function isUsMeet(meet: NaMeet): boolean {
  const marker = (meet.country ?? '').toLowerCase();
  if (!marker) return true; // Keep unlabelled meets rather than silently drop.
  return /usa|united states|^us$/.test(marker);
}

// Multi-track wager pools (cross-track Pick N and Daily Double products)
// surface in the NA meets feed as if they were tracks; their "races" duplicate
// real-track cards. They are otherwise structurally identical to real meets,
// so detection is necessarily a name heuristic: named products like "Sunset
// Six", and the generic "<Event> Pick 5" / "<Event> Preakness Double" forms.
// No US racetrack name contains a "pick N" or "double" token.
const WAGER_POOL_MEETS: ReadonlySet<string> = new Set([
  'sunset six',
  'coast to coast pick 5',
  'cross country pick 5',
]);

const WAGER_POOL_PATTERN = /\b(pick\s*\d|double)\b/;

/** True when a meet name is a wagering pool rather than a real racetrack. */
export function isWagerPoolMeet(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return WAGER_POOL_MEETS.has(normalized) || WAGER_POOL_PATTERN.test(normalized);
}

/** Build a display name from a jockey / trainer person object. */
function personName(person: NaPerson): string | null {
  const full = [person.first_name, person.middle_name, person.last_name]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');
  return toStringOrNull(full) ?? toStringOrNull(person.alias);
}

/** Normalize a jockey / trainer object, or null when it has no usable name. */
function normalizePerson(person: NaPerson | null | undefined): Person | null {
  if (!person) return null;
  const name = personName(person);
  if (!name) return null;
  return {
    providerId: toStringOrNull(person.id),
    name,
    firstName: toStringOrNull(person.first_name),
    lastName: toStringOrNull(person.last_name),
    alias: toStringOrNull(person.alias),
  };
}

function normalizeRunner(runner: NaRunner): Runner {
  // `scratch_indicator` is "N" for a live entry; anything else means scratched.
  const indicator = (runner.scratch_indicator ?? '').trim().toUpperCase();
  return {
    programNumber: toStringOrNull(runner.program_number ?? runner.post_pos),
    postPosition: toStringOrNull(runner.post_pos),
    horseName: toStringOrNull(runner.horse_name),
    sireName: toStringOrNull(runner.sire_name),
    damName: toStringOrNull(runner.dam_name),
    jockey: normalizePerson(runner.jockey),
    trainer: normalizePerson(runner.trainer),
    morningLineOdds: toStringOrNull(runner.morning_line_odds),
    weight: toStringOrNull(runner.weight),
    medication: toStringOrNull(runner.medication),
    equipment: toStringOrNull(runner.equipment),
    scratched: indicator !== '' && indicator !== 'N',
  };
}

/** Synthesize conditions text from the race's restriction descriptions. */
function buildConditions(race: NaRace): string | null {
  const restrictions = [
    race.age_restriction_description,
    race.sex_restriction_description,
    race.race_restriction_description,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return toStringOrNull(restrictions.join(' · ')) ?? toStringOrNull(race.race_name);
}

/** Identity and shared fields of the meet a race belongs to. */
interface MeetContext {
  region: Region;
  providerMeetId: string;
  providerTrackId: string | null;
  track: string;
  country: string | null;
  raceDate: string;
}

function normalizeRace(meet: MeetContext, race: NaRace): Racecard {
  const runners = race.runners.map(normalizeRunner);
  return {
    region: meet.region,
    providerMeetId: meet.providerMeetId,
    providerTrackId: meet.providerTrackId,
    track: meet.track,
    country: meet.country,
    raceDate: meet.raceDate,
    dayEvening: toStringOrNull(race.race_key?.day_evening),
    raceNumber: toNumber(race.race_key?.race_number),
    postTime: toStringOrNull(race.post_time),
    postTimestamp: toNumber(race.post_time_long),
    conditions: buildConditions(race),
    surface: toStringOrNull(race.surface_description),
    distance: toStringOrNull(race.distance_description),
    raceClass:
      toStringOrNull(race.race_class) ??
      toStringOrNull(race.race_type_description) ??
      toStringOrNull(race.race_type),
    purse: toNumber(race.purse),
    fieldSize: runners.filter((runner) => !runner.scratched).length,
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

  async dataFetch(
    client: RacingApiClient,
    date: string = usToday(),
  ): Promise<RawUsRacecardData> {
    // The meets endpoint paginates (max 50 per page); walk every page.
    const pageSize = 50;
    const allMeets: NaMeet[] = [];
    for (let skip = 0; ; skip += pageSize) {
      const response = await client.listNorthAmericaMeets(date, pageSize, skip);
      const page = response.meets ?? [];
      allMeets.push(...page);
      if (page.length < pageSize) break;
    }

    const usMeets = allMeets.filter(isUsMeet);
    const meets: RawUsRacecardData['meets'] = [];
    for (const meet of usMeets) {
      const entries = await client.getNorthAmericaEntries(meet.meet_id);
      meets.push({ meet, entries });
    }

    return { date, meets };
  }

  raceNormalization(raw: RawUsRacecardData): Racecard[] {
    const cards: Racecard[] = [];
    for (const { meet, entries } of raw.meets) {
      const track =
        toStringOrNull(entries.track_name) ??
        toStringOrNull(meet.track_name) ??
        'Unknown';
      if (isWagerPoolMeet(track)) continue;
      const context: MeetContext = {
        region: 'us',
        providerMeetId: meet.meet_id,
        providerTrackId:
          toStringOrNull(entries.track_id) ?? toStringOrNull(meet.track_id),
        track,
        country: toStringOrNull(entries.country) ?? toStringOrNull(meet.country),
        raceDate: toStringOrNull(meet.date) ?? toStringOrNull(entries.date) ?? raw.date,
      };
      for (const race of entries.races) {
        cards.push(normalizeRace(context, race));
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
