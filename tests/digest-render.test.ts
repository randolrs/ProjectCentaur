import { describe, expect, it } from 'vitest';
import type { RaceRow } from '@/db/schema';
import { renderDigestEmail } from '@/lib/digest/email';
import { buildRenderedDigest } from '@/lib/digest/render';
import { parseDigestOutput, type RenderedDigest } from '@/lib/digest/schema';
import type { ScoredRace } from '@/lib/digest/select';

function scoredRace(key: string, track: string): ScoredRace {
  const now = new Date('2026-05-17T12:00:00Z');
  const r: RaceRow = {
    id: key,
    key,
    meetId: 'meet-id',
    source: 'theracingapi',
    region: 'us',
    raceDate: '2026-05-17',
    track,
    trackCanonical: track,
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
    fieldSize: 8,
    runners: [],
    rawData: {},
    ingestedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  return { race: r, matchReasons: ['Runs on dirt', 'claiming race'] };
}

const scored = [
  scoredRace('us|2026-05-17|Aqueduct|3', 'Aqueduct'),
  scoredRace('us|2026-05-17|Belmont Park|5', 'Belmont Park'),
];

describe('parseDigestOutput', () => {
  it('parses a valid digest object, ignoring surrounding prose', () => {
    const raw =
      'Here you go: {"intro":"Solid card today.","races":[' +
      '{"race_key":"us|2026-05-17|Aqueduct|3","headline":"Aqueduct R3",' +
      '"reasoning":"A claiming sprint that fits your lone-speed angle well."}]}';
    const parsed = parseDigestOutput(raw);
    expect(parsed?.races[0]?.race_key).toBe('us|2026-05-17|Aqueduct|3');
  });

  it('returns null for non-JSON or schema-invalid text', () => {
    expect(parseDigestOutput('no json here')).toBeNull();
    expect(parseDigestOutput('{"intro":"hi","races":[]}')).toBeNull();
  });
});

describe('buildRenderedDigest', () => {
  it('merges model prose with the structured race fields', () => {
    const digest = buildRenderedDigest(
      {
        intro: 'Two races worth a look.',
        races: [
          {
            race_key: 'us|2026-05-17|Aqueduct|3',
            headline: 'Aqueduct R3 — lone speed',
            reasoning: 'Cheap speed in a soft claiming sprint.',
          },
          {
            race_key: 'us|2026-05-17|Belmont Park|5',
            headline: 'Belmont R5 — class drop',
            reasoning: 'A drop-down off a layoff worth a play.',
          },
        ],
      },
      scored,
    );
    expect(digest.generatedBy).toBe('llm');
    expect(digest.items).toHaveLength(2);
    expect(digest.items[0]!.headline).toBe('Aqueduct R3 — lone speed');
    expect(digest.items[0]!.track).toBe('Aqueduct');
  });

  it('fills races the model omitted with deterministic copy', () => {
    const digest = buildRenderedDigest(
      {
        intro: 'One race.',
        races: [
          {
            race_key: 'us|2026-05-17|Aqueduct|3',
            headline: 'Aqueduct R3',
            reasoning: 'A claiming sprint that fits your angle.',
          },
        ],
      },
      scored,
    );
    expect(digest.items).toHaveLength(2);
    expect(digest.items[1]!.reasoning).toContain('Matches your profile');
  });

  it('builds a full fallback digest when the model output is null', () => {
    const digest = buildRenderedDigest(null, scored);
    expect(digest.generatedBy).toBe('fallback');
    expect(digest.items).toHaveLength(2);
    expect(digest.intro).toContain('fit your profile');
  });
});

describe('renderDigestEmail', () => {
  const digest: RenderedDigest = {
    intro: 'A lively card across two tracks.',
    generatedBy: 'llm',
    items: [
      {
        raceKey: 'us|2026-05-17|Aqueduct|3',
        track: 'Aqueduct',
        raceNumber: 3,
        postTime: '1:15 PM',
        surface: 'Dirt',
        distance: '6 Furlongs',
        raceClass: 'Claiming',
        fieldSize: 8,
        headline: 'Aqueduct R3 — lone speed',
        reasoning: 'Cheap speed in a soft claiming sprint <worth a look>.',
      },
    ],
  };

  it('produces a subject and both body formats', () => {
    const email = renderDigestEmail(digest, '2026-05-17');
    expect(email.subject).toContain('1 race');
    expect(email.html).toContain('Aqueduct R3 — lone speed');
    expect(email.text).toContain('A lively card across two tracks.');
  });

  it('escapes HTML in model-written content', () => {
    const email = renderDigestEmail(digest, '2026-05-17');
    expect(email.html).toContain('&lt;worth a look&gt;');
    expect(email.html).not.toContain('<worth a look>');
  });
});
