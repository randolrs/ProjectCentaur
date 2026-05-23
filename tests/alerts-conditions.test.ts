import { describe, expect, it } from 'vitest';
import {
  deriveConditionEvents,
  isOffGoing,
  renderConditionAlertEmail,
  surfaceKindOf,
} from '@/lib/alerts/conditions';
import type { Racecard } from '@/lib/racing/types';

function card(overrides: Partial<Racecard> = {}): Racecard {
  return {
    region: 'us',
    providerMeetId: 'meet-1',
    providerTrackId: null,
    track: 'Churchill Downs',
    country: 'USA',
    raceDate: '2026-05-23',
    dayEvening: 'D',
    raceNumber: 1,
    postTime: '1:00 PM',
    postTimestamp: 1_000,
    conditions: null,
    surface: 'Dirt',
    trackCondition: null,
    distance: '6 Furlongs',
    raceClass: 'CLAIMING',
    purse: 50_000,
    fieldSize: 8,
    runners: [],
    raw: {},
    ...overrides,
  };
}

describe('isOffGoing', () => {
  it('treats Fast/Firm/Standard and blanks as normal', () => {
    for (const going of ['Fast', 'firm', 'STANDARD', '', null, undefined]) {
      expect(isOffGoing(going)).toBe(false);
    }
  });

  it('flags off/wet going regardless of case', () => {
    for (const going of ['Sloppy', 'Muddy', 'Off Turf', 'yielding', 'Good']) {
      expect(isOffGoing(going)).toBe(true);
    }
  });
});

describe('surfaceKindOf', () => {
  it('maps turf-ish surfaces to turf and everything else to dirt', () => {
    expect(surfaceKindOf('Turf')).toBe('turf');
    expect(surfaceKindOf('Inner Turf')).toBe('turf');
    expect(surfaceKindOf('Dirt')).toBe('dirt');
    expect(surfaceKindOf('Synthetic')).toBe('dirt');
    expect(surfaceKindOf(null)).toBe('dirt');
  });
});

describe('deriveConditionEvents', () => {
  it('emits only off-going races, deduped per meet/surface/condition', () => {
    const events = deriveConditionEvents([
      card({ raceNumber: 1, surface: 'Dirt', trackCondition: 'Fast' }),
      card({ raceNumber: 2, surface: 'Dirt', trackCondition: 'Sloppy' }),
      card({ raceNumber: 3, surface: 'Dirt', trackCondition: 'Sloppy' }),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      trackCanonical: 'Churchill Downs',
      surfaceKind: 'dirt',
      condition: 'Sloppy',
    });
  });

  it('separates a dirt change from a turf change at the same meet', () => {
    const events = deriveConditionEvents([
      card({ raceNumber: 1, surface: 'Dirt', trackCondition: 'Sloppy' }),
      card({ raceNumber: 2, surface: 'Turf', trackCondition: 'Off Turf' }),
    ]);
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.surfaceKind).sort()).toEqual(['dirt', 'turf']);
  });

  it('returns nothing when every track is running normal', () => {
    const events = deriveConditionEvents([
      card({ surface: 'Dirt', trackCondition: 'Fast' }),
      card({ surface: 'Turf', trackCondition: 'Firm' }),
    ]);
    expect(events).toEqual([]);
  });
});

describe('renderConditionAlertEmail', () => {
  it('frames a dirt going change with the condition in the subject', () => {
    const email = renderConditionAlertEmail({
      trackName: 'Churchill Downs',
      surfaceKind: 'dirt',
      condition: 'Sloppy',
      raceDate: '2026-05-23',
    });
    expect(email.subject).toContain('Sloppy');
    expect(email.html).toContain('main track is now Sloppy');
    expect(email.text).toContain('Sloppy');
  });

  it('frames an off-turf change as races coming off the grass', () => {
    const email = renderConditionAlertEmail({
      trackName: 'Gulfstream Park',
      surfaceKind: 'turf',
      condition: 'Off Turf',
      raceDate: '2026-05-23',
    });
    expect(email.subject).toContain('Off Turf at Gulfstream Park');
    expect(email.html).toContain('off the grass');
  });

  it('escapes HTML in the track name', () => {
    const email = renderConditionAlertEmail({
      trackName: 'Track <x>',
      surfaceKind: 'dirt',
      condition: 'Muddy',
      raceDate: '2026-05-23',
    });
    expect(email.html).toContain('&lt;x&gt;');
    expect(email.html).not.toContain('<x>');
  });
});
