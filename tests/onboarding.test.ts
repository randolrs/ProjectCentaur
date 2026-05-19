import { describe, expect, it } from 'vitest';
import { onboardingSchema } from '@/lib/onboarding/options';

const validInput = {
  tracks: ['Gulfstream Park', 'Santa Anita Park'],
  raceClasses: ['allowance', 'stakes'],
  distanceRanges: ['sprint'],
  surfaces: ['dirt', 'turf'],
  fieldSizeBand: 'medium',
  betTypes: ['win', 'exacta'],
  activeDays: ['mon', 'wed', 'sat'],
  timezone: 'America/New_York',
};

describe('onboardingSchema', () => {
  it('accepts a complete, valid submission', () => {
    const result = onboardingSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeDays).toHaveLength(3);
      expect(result.data.tracks).toHaveLength(2);
    }
  });

  it('rejects an empty track list', () => {
    expect(
      onboardingSchema.safeParse({ ...validInput, tracks: [] }).success,
    ).toBe(false);
  });

  it('rejects an invalid enum value', () => {
    expect(
      onboardingSchema.safeParse({ ...validInput, fieldSizeBand: 'huge' })
        .success,
    ).toBe(false);
  });

  it('rejects an empty active-days list', () => {
    expect(
      onboardingSchema.safeParse({ ...validInput, activeDays: [] }).success,
    ).toBe(false);
  });

  it('rejects an unrecognized day', () => {
    expect(
      onboardingSchema.safeParse({ ...validInput, activeDays: ['funday'] })
        .success,
    ).toBe(false);
  });

  it('rejects a submission missing a required field', () => {
    const { timezone: _omitted, ...withoutTimezone } = validInput;
    expect(onboardingSchema.safeParse(withoutTimezone).success).toBe(false);
  });
});
