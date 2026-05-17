import { describe, expect, it } from 'vitest';
import {
  HandicapperProfileSchema,
  parseTurnResponse,
  TurnResponseSchema,
} from '@/lib/onboarding/schema';

const validProfileNoVersion = {
  style_summary:
    'Patient win bettor who only fires when the tote price beats the true odds.',
  loved_setups: ['a closer with a contested pace setting up in front'],
  avoided_setups: ['odds-on favorites'],
  value_threshold: 'overlays_only',
  preferred_value_range: '5-1 to 15-1',
  experience_level: 'serious',
  primary_bet_orientation: 'win',
  notable_tracks_mentioned: ['Santa Anita Park'],
  notable_trainers_mentioned: [],
  notable_angles_mentioned: ['contested pace', 'overlay'],
};

const validProfile = { ...validProfileNoVersion, version: 1 };

describe('HandicapperProfileSchema', () => {
  it('accepts a complete, valid profile', () => {
    expect(HandicapperProfileSchema.safeParse(validProfile).success).toBe(true);
  });

  it('rejects a style summary shorter than 20 characters', () => {
    expect(
      HandicapperProfileSchema.safeParse({
        ...validProfile,
        style_summary: 'too short',
      }).success,
    ).toBe(false);
  });

  it('rejects an empty loved_setups list', () => {
    expect(
      HandicapperProfileSchema.safeParse({ ...validProfile, loved_setups: [] })
        .success,
    ).toBe(false);
  });

  it('rejects an out-of-range value_threshold', () => {
    expect(
      HandicapperProfileSchema.safeParse({
        ...validProfile,
        value_threshold: 'whatever',
      }).success,
    ).toBe(false);
  });

  it('rejects a version other than 1', () => {
    expect(
      HandicapperProfileSchema.safeParse({ ...validProfile, version: 2 })
        .success,
    ).toBe(false);
  });
});

describe('TurnResponseSchema', () => {
  it('accepts a continuing turn (done: false)', () => {
    const result = TurnResponseSchema.safeParse({
      done: false,
      next_question: 'What kind of race do you pass on every time?',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a finishing turn (done: true)', () => {
    const result = TurnResponseSchema.safeParse({
      done: true,
      profile: validProfileNoVersion,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a continuing turn missing next_question', () => {
    expect(TurnResponseSchema.safeParse({ done: false }).success).toBe(false);
  });

  it('rejects a finishing turn with an invalid profile', () => {
    expect(
      TurnResponseSchema.safeParse({
        done: true,
        profile: { ...validProfileNoVersion, experience_level: 'guru' },
      }).success,
    ).toBe(false);
  });
});

describe('parseTurnResponse', () => {
  it('parses a clean JSON object', () => {
    const parsed = parseTurnResponse(
      JSON.stringify({ done: false, next_question: 'Tell me more about that.' }),
    );
    expect(parsed?.done).toBe(false);
  });

  it('parses JSON embedded in surrounding prose or code fences', () => {
    const raw =
      'Here is my response:\n```json\n' +
      JSON.stringify({ done: false, next_question: 'And what made you pass?' }) +
      '\n```\n';
    const parsed = parseTurnResponse(raw);
    expect(parsed && !parsed.done && parsed.next_question).toBe(
      'And what made you pass?',
    );
  });

  it('parses a finishing turn and exposes the profile', () => {
    const parsed = parseTurnResponse(
      JSON.stringify({ done: true, profile: validProfileNoVersion }),
    );
    expect(parsed?.done).toBe(true);
    if (parsed?.done) {
      expect(parsed.profile.primary_bet_orientation).toBe('win');
    }
  });

  it('returns null for text with no JSON object', () => {
    expect(parseTurnResponse('I could not produce a response.')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseTurnResponse('{ done: false, next_question: }')).toBeNull();
  });

  it('returns null for valid JSON that violates the schema', () => {
    expect(
      parseTurnResponse(JSON.stringify({ done: false, question: 'wrong key' })),
    ).toBeNull();
  });
});
