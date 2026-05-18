import { describe, expect, it } from 'vitest';
import type { RaceRow, UserPreferencesRow } from '@/db/schema';
import {
  distanceRangeOf,
  fieldSizeBandOf,
  selectRacesForUser,
} from '@/lib/digest/select';

function race(overrides: Partial<RaceRow>): RaceRow {
  const now = new Date('2026-05-17T12:00:00Z');
  return {
    id: 'race-id',
    key: 'us|2026-05-17|Aqueduct|1',
    source: 'theracingapi',
    region: 'us',
    raceDate: '2026-05-17',
    track: 'Aqueduct',
    raceNumber: 1,
    postTime: '1:00 PM',
    postTimestamp: 1_000,
    surface: 'Dirt',
    surfaceCanonical: 'dirt',
    distance: '6 Furlongs',
    distanceFurlongs: 6,
    raceClass: 'CLAIMING',
    raceClassCanonical: 'claiming',
    conditions: null,
    purse: 50_000,
    fieldSize: 8,
    runners: [],
    rawData: {},
    ingestedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function prefs(overrides: Partial<UserPreferencesRow>): UserPreferencesRow {
  const now = new Date('2026-05-17T12:00:00Z');
  return {
    id: 'prefs-id',
    userId: 'user-id',
    tracks: ['Aqueduct'],
    raceClasses: ['claiming', 'maiden'],
    distanceRanges: ['sprint', 'route'],
    surfaces: ['dirt'],
    fieldSizeBand: 'any',
    betTypes: ['win'],
    bankrollTier: 'regular',
    daysPerWeek: 3,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('distanceRangeOf', () => {
  it('buckets furlong distances into onboarding ranges', () => {
    expect(distanceRangeOf(5)).toBe('sprint');
    expect(distanceRangeOf(7.5)).toBe('sprint');
    expect(distanceRangeOf(8)).toBe('route');
    expect(distanceRangeOf(10)).toBe('route');
    expect(distanceRangeOf(10.5)).toBe('marathon');
    expect(distanceRangeOf(null)).toBeNull();
  });
});

describe('fieldSizeBandOf', () => {
  it('buckets runner counts into field-size bands', () => {
    expect(fieldSizeBandOf(5)).toBe('small');
    expect(fieldSizeBandOf(7)).toBe('small');
    expect(fieldSizeBandOf(8)).toBe('medium');
    expect(fieldSizeBandOf(10)).toBe('medium');
    expect(fieldSizeBandOf(11)).toBe('large');
  });
});

describe('selectRacesForUser', () => {
  it('keeps a race that matches every structured preference', () => {
    const selected = selectRacesForUser(prefs({}), [race({})]);
    expect(selected).toHaveLength(1);
    expect(selected[0]!.matchReasons.length).toBeGreaterThanOrEqual(3);
  });

  it('drops races on an unfollowed surface', () => {
    const turf = race({ surface: 'Turf', surfaceCanonical: 'turf' });
    expect(selectRacesForUser(prefs({ surfaces: ['dirt'] }), [turf])).toHaveLength(0);
  });

  it("'all' surfaces matches any surface", () => {
    const turf = race({ surface: 'Turf', surfaceCanonical: 'turf' });
    expect(
      selectRacesForUser(prefs({ surfaces: ['all'] }), [turf]),
    ).toHaveLength(1);
  });

  it('drops races outside the followed class set', () => {
    const stakes = race({ raceClass: 'STAKES', raceClassCanonical: 'stakes' });
    expect(
      selectRacesForUser(prefs({ raceClasses: ['claiming'] }), [stakes]),
    ).toHaveLength(0);
  });

  it('drops races outside the preferred distance ranges', () => {
    const marathon = race({ distanceFurlongs: 12, distance: '1 1/2 Miles' });
    expect(
      selectRacesForUser(prefs({ distanceRanges: ['sprint'] }), [marathon]),
    ).toHaveLength(0);
  });

  it('drops races with an unknown distance', () => {
    const unknown = race({ distanceFurlongs: null, distance: null });
    expect(selectRacesForUser(prefs({}), [unknown])).toHaveLength(0);
  });

  it('enforces the field-size band when it is not "any"', () => {
    const large = race({ fieldSize: 12 });
    expect(
      selectRacesForUser(prefs({ fieldSizeBand: 'small' }), [large]),
    ).toHaveLength(0);
    expect(
      selectRacesForUser(prefs({ fieldSizeBand: 'large' }), [large]),
    ).toHaveLength(1);
  });

  it('orders the selection by post time', () => {
    const late = race({ key: 'late', postTimestamp: 5_000 });
    const early = race({ key: 'early', postTimestamp: 1_000 });
    const selected = selectRacesForUser(prefs({}), [late, early]);
    expect(selected.map((s) => s.race.key)).toEqual(['early', 'late']);
  });
});
