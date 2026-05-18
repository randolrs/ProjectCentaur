import { describe, expect, it } from 'vitest';
import { runnerLine } from '@/lib/digest/prompts';
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
  it('renders the full field detail — odds, connections, weight, gear', () => {
    expect(runnerLine(runner())).toBe(
      '    1. Al Amjaad (ML 4-1) — J Jose Ortiz / T Joe Sharp · 118 lbs · L · Blk-O',
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
    expect(line).toBe('    1. Al Amjaad — T Joe Sharp');
  });
});
