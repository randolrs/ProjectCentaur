import { describe, expect, it } from 'vitest';
import { onboardingSchema } from '@/lib/onboarding/options';

const validInput = {
  tracks: ['Gulfstream Park', 'Santa Anita Park'],
  raceClasses: ['allowance', 'stakes'],
  distanceRanges: ['sprint'],
  surfaces: ['dirt', 'turf'],
  fieldSizeBand: 'medium',
  betTypes: ['win', 'exacta'],
  bankrollTier: 'regular',
  daysPerWeek: '4',
  timezone: 'America/New_York',
};

describe('onboardingSchema', () => {
  it('accepts a complete, valid submission and coerces daysPerWeek', () => {
    const result = onboardingSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.daysPerWeek).toBe(4);
      expect(result.data.tracks).toHaveLength(2);
    }
  });

  it('rejects an empty track list', () => {
    expect(
      onboardingSchema.safeParse({ ...validInput, tracks: [] }).success,
    ).toBe(false);
  });

  it('rejects a track outside the v1 list', () => {
    expect(
      onboardingSchema.safeParse({ ...validInput, tracks: ['Hialeah Park'] })
        .success,
    ).toBe(false);
  });

  it('rejects an invalid enum value', () => {
    expect(
      onboardingSchema.safeParse({ ...validInput, bankrollTier: 'whale' })
        .success,
    ).toBe(false);
  });

  it('rejects days per week outside 1-7', () => {
    expect(
      onboardingSchema.safeParse({ ...validInput, daysPerWeek: '0' }).success,
    ).toBe(false);
    expect(
      onboardingSchema.safeParse({ ...validInput, daysPerWeek: '9' }).success,
    ).toBe(false);
  });

  it('rejects a submission missing a required field', () => {
    const { timezone: _omitted, ...withoutTimezone } = validInput;
    expect(onboardingSchema.safeParse(withoutTimezone).success).toBe(false);
  });
});
