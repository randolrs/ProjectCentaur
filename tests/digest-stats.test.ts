import { describe, expect, it } from 'vitest';
import {
  buildHorseForm,
  formatConnection,
  formatHorseForm,
  type HorseFinish,
  runnerStatSegments,
  windowStartDate,
} from '@/lib/digest/stats';

describe('windowStartDate', () => {
  it('subtracts whole days in UTC', () => {
    expect(windowStartDate('2026-05-24', 365)).toBe('2025-05-24');
    expect(windowStartDate('2026-01-01', 1)).toBe('2025-12-31');
  });
});

describe('buildHorseForm', () => {
  const finishes: HorseFinish[] = [
    { raceDate: '2026-05-01', finishPosition: 1 },
    { raceDate: '2026-04-10', finishPosition: null },
    { raceDate: '2026-03-15', finishPosition: 2 },
  ];

  it('summarizes finishes most-recent-first with a layoff', () => {
    const form = buildHorseForm(finishes, '2026-05-24');
    expect(form.starts).toBe(3);
    expect(form.wins).toBe(1);
    expect(form.finishes).toEqual([1, null, 2]);
    expect(form.daysSinceLastStart).toBe(23);
  });

  it('caps the form line at the requested number of races', () => {
    const many: HorseFinish[] = Array.from({ length: 9 }, (_, i) => ({
      raceDate: `2026-05-${String(20 - i).padStart(2, '0')}`,
      finishPosition: 3,
    }));
    const form = buildHorseForm(many, '2026-05-24', 6);
    expect(form.finishes).toHaveLength(6);
    expect(form.starts).toBe(9);
  });

  it('yields a zero-start form for a horse with no history', () => {
    const form = buildHorseForm([], '2026-05-24');
    expect(form.starts).toBe(0);
    expect(form.daysSinceLastStart).toBeNull();
  });
});

describe('formatConnection', () => {
  it('shows a percent once the sample clears the floor', () => {
    expect(formatConnection('J', { starts: 66, wins: 12 })).toBe('J 18% (12/66)');
  });

  it('shows a raw fraction for a small sample', () => {
    expect(formatConnection('T', { starts: 6, wins: 1 })).toBe('T 1/6');
  });

  it('omits a connection with no recorded starts', () => {
    expect(formatConnection('J', { starts: 0, wins: 0 })).toBeNull();
    expect(formatConnection('J', null)).toBeNull();
  });
});

describe('formatHorseForm', () => {
  it('renders the form line, start count, and layoff', () => {
    const form = buildHorseForm(
      [
        { raceDate: '2026-05-03', finishPosition: 1 },
        { raceDate: '2026-04-01', finishPosition: null },
      ],
      '2026-05-24',
    );
    expect(formatHorseForm(form)).toBe('form 1-x (2 starts, off 21d)');
  });

  it('uses the singular for a single start', () => {
    const form = buildHorseForm(
      [{ raceDate: '2026-05-20', finishPosition: 2 }],
      '2026-05-24',
    );
    expect(formatHorseForm(form)).toBe('form 2 (1 start, off 4d)');
  });

  it('omits a horse with no history', () => {
    expect(formatHorseForm(buildHorseForm([], '2026-05-24'))).toBeNull();
    expect(formatHorseForm(null)).toBeNull();
  });
});

describe('runnerStatSegments', () => {
  it('orders form first, then jockey, then trainer, dropping empties', () => {
    const segments = runnerStatSegments({
      jockey: { starts: 66, wins: 12 },
      trainer: null,
      horse: buildHorseForm(
        [{ raceDate: '2026-05-20', finishPosition: 1 }],
        '2026-05-24',
      ),
    });
    expect(segments).toEqual(['form 1 (1 start, off 4d)', 'J 18% (12/66)']);
  });

  it('returns nothing when no stats are attached', () => {
    expect(runnerStatSegments(undefined)).toEqual([]);
  });
});
