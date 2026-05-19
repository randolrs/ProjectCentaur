import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock };
  },
}));

import type {
  HandicapperProfileRow,
  RaceRow,
  UserPreferencesRow,
} from '@/db/schema';
import { DigestLlmError, generateDigest } from '@/lib/digest/llm';
import type { ScoredRace } from '@/lib/digest/select';

const now = new Date('2026-05-17T12:00:00Z');

const profile: HandicapperProfileRow = {
  id: 'p',
  userId: 'u',
  styleSummary: 'Plays lone speed in short fields at NYRA tracks.',
  lovedSetups: ['lone speed in fields of 6 or fewer'],
  avoidedSetups: ['turf routes with no pace'],
  valueThreshold: 'mid_range',
  preferredValueRange: '5-1 to 12-1',
  experienceLevel: 'serious',
  primaryBetOrientation: 'exactas',
  notableTracksMentioned: ['Aqueduct'],
  notableTrainersMentioned: [],
  notableAnglesMentioned: ['lone speed'],
  rawConversationLog: [],
  version: 1,
  createdAt: now,
  updatedAt: now,
};

const prefs: UserPreferencesRow = {
  id: 'pr',
  userId: 'u',
  tracks: ['Aqueduct'],
  raceClasses: ['claiming'],
  distanceRanges: ['sprint'],
  surfaces: ['dirt'],
  fieldSizeBand: 'small',
  betTypes: ['win', 'exacta'],
  activeDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  createdAt: now,
  updatedAt: now,
};

const race: RaceRow = {
  id: 'r',
  key: 'us|2026-05-17|Aqueduct|3',
  meetId: 'meet-id',
  source: 'theracingapi',
  region: 'us',
  raceDate: '2026-05-17',
  track: 'Aqueduct',
  trackCanonical: 'Aqueduct',
  raceNumber: 3,
  dayEvening: 'D',
  postTime: '1:15 PM',
  postTimestamp: 1_000,
  surface: 'Dirt',
  surfaceCanonical: 'dirt',
  distance: '6 Furlongs',
  distanceFurlongs: 6,
  raceClass: 'CLAIMING',
  raceClassCanonical: 'claiming',
  conditions: null,
  purse: 50_000,
  fieldSize: 6,
  runners: [],
  rawData: {},
  ingestedAt: now,
  createdAt: now,
  updatedAt: now,
};

const scored: ScoredRace[] = [{ race, matchReasons: ['Runs on dirt'] }];

const validJson = JSON.stringify({
  intro: 'A short sprint card built for your style today.',
  races: [
    {
      race_key: 'us|2026-05-17|Aqueduct|3',
      headline: 'Aqueduct R3 — lone speed',
      reasoning: 'Cheap speed in a six-horse claiming sprint fits you well.',
    },
  ],
});

function fakeResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
    usage: {
      input_tokens: 2000,
      output_tokens: 400,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  };
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  createMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateDigest', () => {
  it('returns the parsed digest and computed cost on a valid reply', async () => {
    createMock.mockResolvedValueOnce(fakeResponse(validJson));

    const result = await generateDigest({ profile, prefs, scored, raceDate: '2026-05-17' });

    expect(result.output.races[0]?.race_key).toBe('us|2026-05-17|Aqueduct|3');
    // 2000 input @ $3/M + 400 output @ $15/M = $0.012
    expect(result.usage.costUsd).toBeCloseTo(0.012, 6);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('retries once when the first response is unparseable', async () => {
    createMock
      .mockResolvedValueOnce(fakeResponse('not json'))
      .mockResolvedValueOnce(fakeResponse(validJson));

    const result = await generateDigest({ profile, prefs, scored, raceDate: '2026-05-17' });

    expect(result.output.intro).toContain('sprint card');
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it('throws DigestLlmError when every attempt is unparseable', async () => {
    createMock.mockResolvedValue(fakeResponse('still not json'));

    await expect(
      generateDigest({ profile, prefs, scored, raceDate: '2026-05-17' }),
    ).rejects.toBeInstanceOf(DigestLlmError);
  });

  it('throws DigestLlmError when the API call fails', async () => {
    createMock.mockRejectedValue(new Error('network down'));

    await expect(
      generateDigest({ profile, prefs, scored, raceDate: '2026-05-17' }),
    ).rejects.toBeInstanceOf(DigestLlmError);
  });
});
