import { describe, expect, it } from 'vitest';
import type { RaceRow } from '@/db/schema';
import { raceSection, runnerLine } from '@/lib/digest/prompts';
import type { ScoredRace } from '@/lib/digest/select';
import type { Person, Runner } from '@/lib/racing/types';

const person = (name: string): Person => ({
  providerId: null,
  name,
  firstName: null,
  lastName: null,
  alias: null,
});

function runner(overrides: Partial<Runner> = {}): Runner {
  return {
    programNumber: '1',
    postPosition: '1',
    horseName: 'Al Amjaad',
    sireName: "Medaglia d'Oro",
    damName: 'Mahasen',
    jockey: person('Jose Ortiz'),
    trainer: person('Joe Sharp'),
    morningLineOdds: '4-1',
    weight: '118',
    medication: 'L',
    equipment: 'Blk-O',
    scratched: false,
    ...overrides,
  };
}

describe('runnerLine', () => {
  it('renders the full field detail — odds, connections, PP, weight, gear', () => {
    expect(runnerLine(runner())).toBe(
      '    1. Al Amjaad (ML 4-1) — J Jose Ortiz / T Joe Sharp · PP 1 · 118 lbs · L · Blk-O',
    );
  });

  it('omits absent fields without leaving stray separators', () => {
    const line = runnerLine(
      runner({
        jockey: null,
        morningLineOdds: null,
        weight: null,
        medication: null,
        equipment: null,
      }),
    );
    expect(line).toBe('    1. Al Amjaad — T Joe Sharp · PP 1');
  });
});

function scoredRace(overrides: Partial<RaceRow> = {}): ScoredRace {
  const now = new Date('2026-05-17T12:00:00Z');
  const race: RaceRow = {
    id: 'race-id',
    key: 'us|2026-05-17|Churchill Downs|11',
    meetId: 'meet-id',
    source: 'theracingapi',
    region: 'us',
    raceDate: '2026-05-17',
    track: 'Churchill Downs',
    trackCanonical: 'Churchill Downs',
    raceNumber: 11,
    dayEvening: 'D',
    postTime: '6:57 PM',
    postTimestamp: 1_000,
    surface: 'Dirt',
    surfaceCanonical: 'dirt',
    surfaceCondition: null,
    distance: '10 Furlongs',
    distanceFurlongs: 10,
    raceClass: 'Stakes',
    raceClassCanonical: 'stakes',
    conditions: null,
    purse: 5_000_000,
    fieldSize: 2,
    runners: [
      { ...runner({ programNumber: '1' }) },
      { ...runner({ programNumber: '2', scratched: true }) },
    ],
    rawData: { grade: '1', race_name: 'Kentucky Derby' },
    ingestedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  return { race, matchReasons: [], missReasons: [], strength: 'strong' };
}

describe('raceSection', () => {
  it('surfaces stakes grade, race name, and scratch count from raw data', () => {
    const section = raceSection(scoredRace());
    expect(section).toContain('Stakes (Grade 1)');
    expect(section).toContain('Race: Kentucky Derby');
    expect(section).toContain('field of 2 (1 scratched)');
  });

  it('omits the grade, name, and scratch note when none are present', () => {
    const section = raceSection(
      scoredRace({
        rawData: {},
        runners: [{ ...runner({ programNumber: '1' }) }],
        fieldSize: 1,
      }),
    );
    expect(section).toContain('Stakes · Dirt');
    expect(section).not.toContain('(Grade');
    expect(section).not.toContain('Race:');
    expect(section).not.toContain('scratched');
  });

  it('passes a non-numeric grade through unchanged', () => {
    const section = raceSection(scoredRace({ rawData: { grade: 'Listed' } }));
    expect(section).toContain('Stakes (Listed)');
  });
});
