import { describe, expect, it } from 'vitest';
import { runnerLine } from '@/lib/digest/prompts';
import { buildHorseForm } from '@/lib/digest/stats';
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

  it('appends form and connection stats when attached', () => {
    const line = runnerLine(runner(), {
      jockey: { starts: 66, wins: 12 },
      trainer: { starts: 6, wins: 1 },
      horse: buildHorseForm(
        [
          { raceDate: '2026-05-03', finishPosition: 1 },
          { raceDate: '2026-04-01', finishPosition: 2 },
        ],
        '2026-05-24',
      ),
    });
    expect(line).toBe(
      '    1. Al Amjaad (ML 4-1) — J Jose Ortiz / T Joe Sharp · PP 1 · 118 lbs · L · Blk-O · form 1-2 (2 starts, off 21d) · J 18% (12/66) · T 1/6',
    );
  });
});
