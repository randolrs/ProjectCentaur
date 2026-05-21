import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_TRACKS,
  canonicalRaceClass,
  canonicalSurface,
  canonicalTrack,
  parseDistanceFurlongs,
} from '@/lib/racing/canonical';
import {
  deriveResultPlacements,
  horseNaturalKey,
  personNaturalKey,
  racecardKey,
  racecardToRaceRow,
} from '@/lib/racing/ingest';
import { usRegionStrategy } from '@/lib/racing/regions';
import {
  naEntriesResponseSchema,
  type NaResultRace,
  type Person,
  type Racecard,
  type RawUsRacecardData,
  type Runner,
} from '@/lib/racing/types';

function fixture(name: string): unknown {
  const url = new URL(`./fixtures/racing/${name}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
}

/** Normalized racecards from the captured Aqueduct + Gulfstream fixtures. */
const cards: Racecard[] = (() => {
  const aqueduct = naEntriesResponseSchema.parse(fixture('entries-aqueduct.json'));
  const gulfstream = naEntriesResponseSchema.parse(fixture('entries-gulfstream.json'));
  const raw: RawUsRacecardData = {
    date: '2026-05-17',
    meets: [
      {
        meet: { meet_id: 'AQU', track_name: 'Aqueduct', date: '2026-05-17' },
        entries: aqueduct,
      },
      {
        meet: {
          meet_id: 'GP',
          track_name: 'Gulfstream Park',
          date: '2026-05-17',
        },
        entries: gulfstream,
      },
    ],
  };
  return usRegionStrategy.raceNormalization(raw);
})();

describe('canonicalSurface', () => {
  it('maps provider surface strings onto the onboarding surface set', () => {
    expect(canonicalSurface('Dirt')).toBe('dirt');
    expect(canonicalSurface('Turf')).toBe('turf');
    expect(canonicalSurface('Inner Turf')).toBe('turf');
    expect(canonicalSurface('Tapeta')).toBe('synthetic');
    expect(canonicalSurface('All Weather')).toBe('synthetic');
    expect(canonicalSurface('Polytrack')).toBe('synthetic');
    expect(canonicalSurface('')).toBe('other');
    expect(canonicalSurface(null)).toBe('other');
  });
});

describe('canonicalRaceClass', () => {
  it('collapses provider class strings, prioritising the more specific tier', () => {
    expect(canonicalRaceClass('MAIDEN SPECIAL WEIGHT')).toBe('maiden');
    expect(canonicalRaceClass('MAIDEN CLAIMING')).toBe('maiden');
    expect(canonicalRaceClass('CLAIMING')).toBe('claiming');
    expect(canonicalRaceClass('ALLOWANCE OPTIONAL CLAIMING')).toBe('allowance');
    expect(canonicalRaceClass('STAKES')).toBe('stakes');
    expect(canonicalRaceClass('Handicap')).toBe('stakes');
    expect(canonicalRaceClass('CLM')).toBe('claiming');
    expect(canonicalRaceClass('AOC')).toBe('allowance');
    expect(canonicalRaceClass(null)).toBe('other');
  });
});

describe('parseDistanceFurlongs', () => {
  it('parses furlong, mile, and yard distance descriptions', () => {
    expect(parseDistanceFurlongs('6 1/2 Furlongs')).toBe(6.5);
    expect(parseDistanceFurlongs('7 Furlongs')).toBe(7);
    expect(parseDistanceFurlongs('1 Mile')).toBe(8);
    expect(parseDistanceFurlongs('1 1/16 Miles')).toBe(8.5);
    expect(parseDistanceFurlongs('1 1/8 Miles')).toBe(9);
    expect(parseDistanceFurlongs('1320 Yards')).toBe(6);
  });

  it('returns null when the distance cannot be parsed', () => {
    expect(parseDistanceFurlongs('Five Furlongs')).toBeNull();
    expect(parseDistanceFurlongs('6')).toBeNull();
    expect(parseDistanceFurlongs(null)).toBeNull();
  });
});

describe('canonicalTrack', () => {
  it('collapses provider track variants onto the onboarding vocabulary', () => {
    expect(canonicalTrack('Belmont at the Big A')).toBe('Belmont Park');
    expect(canonicalTrack('Santa Anita')).toBe('Santa Anita Park');
    expect(canonicalTrack('gulfstream')).toBe('Gulfstream Park');
    expect(canonicalTrack('Churchill Downs')).toBe('Churchill Downs');
  });

  it('passes unknown tracks through trimmed', () => {
    expect(canonicalTrack('  Hawthorne  ')).toBe('Hawthorne');
    expect(canonicalTrack('')).toBe('Unknown');
    expect(canonicalTrack(null)).toBe('Unknown');
  });

  it('canonicalises every track in the onboarding vocabulary to itself', () => {
    for (const track of usRegionStrategy.vocabulary.v1Tracks) {
      expect(CANONICAL_TRACKS).toContain(track);
      expect(canonicalTrack(track)).toBe(track);
    }
  });
});

describe('racecardKey', () => {
  it('builds a deterministic region|date|track|race|day key', () => {
    expect(racecardKey(cards[0]!)).toMatch(/^us\|2026-05-17\|Aqueduct\|1\|/);
  });

  it('is stable across repeated calls for the same card', () => {
    expect(racecardKey(cards[2]!)).toBe(racecardKey(cards[2]!));
  });
});

describe('racecardToRaceRow', () => {
  it('derives canonical structured columns and links the meet', () => {
    const card = cards[0]!;
    const row = racecardToRaceRow(card, racecardKey(card), 'meet-1');
    expect(row.meetId).toBe('meet-1');
    expect(row.source).toBe('theracingapi');
    expect(row.track).toBe('Aqueduct');
    expect(row.trackCanonical).toBe('Aqueduct');
    expect(row.raceDate).toBe('2026-05-17');
    expect(row.surface).toBe('Dirt');
    expect(row.surfaceCanonical).toBe('dirt');
    expect(row.distance).toBe('6 1/2 Furlongs');
    expect(row.distanceFurlongs).toBe(6.5);
    expect(row.raceClassCanonical).toBe('maiden');
    expect(row.fieldSize).toBe(2);
    expect(row.purse).toBe(80000);
  });

  it('canonicalises a synthetic-surface maiden claimer', () => {
    const card = cards[4]!;
    const row = racecardToRaceRow(card, racecardKey(card), 'meet-1');
    expect(row.track).toBe('Gulfstream Park');
    expect(row.trackCanonical).toBe('Gulfstream Park');
    expect(row.surfaceCanonical).toBe('synthetic');
    expect(row.raceClassCanonical).toBe('maiden');
    expect(row.distanceFurlongs).toBe(5);
  });

  it('preserves the raw provider payload for raw_data', () => {
    const card = cards[2]!;
    const row = racecardToRaceRow(card, racecardKey(card), 'meet-1');
    expect(row.raceClassCanonical).toBe('stakes');
    expect(row.rawData).toMatchObject({ race_class: 'STAKES', grade: '2' });
  });
});

describe('horseNaturalKey', () => {
  it('combines the normalized name, sire, and dam', () => {
    const runner: Runner = {
      programNumber: '1',
      postPosition: '1',
      horseName: 'Al Amjaad',
      sireName: "Medaglia d'Oro",
      damName: 'Mahasen',
      jockey: null,
      trainer: null,
      morningLineOdds: null,
      weight: null,
      medication: null,
      equipment: null,
      scratched: false,
    };
    expect(horseNaturalKey(runner)).toBe("al amjaad|medaglia d'oro|mahasen");
  });
});

describe('personNaturalKey', () => {
  const person = (overrides: Partial<Person>): Person => ({
    providerId: null,
    name: 'Jose Ortiz',
    firstName: null,
    lastName: null,
    alias: null,
    ...overrides,
  });

  it('prefers the provider id when present', () => {
    expect(personNaturalKey(person({ providerId: 'jky_na_441324' }))).toBe(
      'jky_na_441324',
    );
  });

  it('falls back to a normalized-name key', () => {
    expect(personNaturalKey(person({ name: 'Joe  Sharp' }))).toBe(
      'name:joe sharp',
    );
  });
});

describe('deriveResultPlacements', () => {
  // Mirrors the live shape: in-the-money runners carry win/place/show payoffs,
  // with position implied by which payoff is non-zero.
  const race: NaResultRace = {
    runners: [
      { program_number: '3', win_payoff: 4.7, place_payoff: 2.9, show_payoff: 2.1 },
      { program_number: '4', win_payoff: 0, place_payoff: 4.1, show_payoff: 3.1 },
      { program_number: '5', win_payoff: 0, place_payoff: 0, show_payoff: 2.1 },
      { program_number: '2', win_payoff: 0, place_payoff: 0, show_payoff: 0 },
    ],
    track_condition_description: 'Fast',
  };

  it('maps win/place/show payoffs to finishing positions 1-3', () => {
    expect(deriveResultPlacements(race)).toEqual([
      { programNumber: '3', position: 1 },
      { programNumber: '4', position: 2 },
      { programNumber: '5', position: 3 },
    ]);
  });

  it('omits off-the-board runners and parses string payoffs', () => {
    const result = deriveResultPlacements({
      runners: [
        { program_number: '1', win_payoff: '6.40', place_payoff: '3.20', show_payoff: '2.80' },
        { program_number: '7', win_payoff: null, place_payoff: null, show_payoff: null },
      ],
    });
    expect(result).toEqual([{ programNumber: '1', position: 1 }]);
  });
});
