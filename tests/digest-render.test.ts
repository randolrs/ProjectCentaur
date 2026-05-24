import { describe, expect, it } from 'vitest';
import type { RaceRow } from '@/db/schema';
import { renderDigestEmail } from '@/lib/digest/email';
import { buildDarkDigest, buildRenderedDigest } from '@/lib/digest/render';
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
    surfaceCondition: null,
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
  return {
    race: r,
    matchReasons: ['Runs on dirt', 'claiming race'],
    missReasons: [],
    strength: 'strong',
  };
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
      'strong',
    );
    expect(digest.generatedBy).toBe('llm');
    expect(digest.items).toHaveLength(2);
    expect(digest.items[0]!.headline).toBe('Aqueduct R3 — lone speed');
    expect(digest.items[0]!.track).toBe('Aqueduct');
  });

  it('carries the captured going onto each rendered item', () => {
    const sloppy = scoredRace('us|2026-05-17|Aqueduct|3', 'Aqueduct');
    sloppy.race.surfaceCondition = 'Sloppy';
    const digest = buildRenderedDigest(null, [sloppy], 'strong');
    expect(digest.items[0]!.surfaceCondition).toBe('Sloppy');
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
      'strong',
    );
    expect(digest.items).toHaveLength(2);
    expect(digest.items[1]!.reasoning).toContain('Matches your profile');
  });

  it('builds a full fallback digest when the model output is null', () => {
    const digest = buildRenderedDigest(null, scored, 'strong');
    expect(digest.generatedBy).toBe('fallback');
    expect(digest.items).toHaveLength(2);
    expect(digest.intro).toContain('fit your profile');
  });

  it('writes a weak-day fallback intro flagging the lack of strong matches', () => {
    const digest = buildRenderedDigest(null, scored, 'weak');
    expect(digest.tier).toBe('weak');
    expect(digest.intro).toContain('strongly matched');
    expect(digest.intro).toContain('closest');
  });
});

describe('buildDarkDigest', () => {
  it('builds a race-less dark-day note naming the tracks', () => {
    const digest = buildDarkDigest(['Parx Racing']);
    expect(digest.tier).toBe('dark');
    expect(digest.items).toHaveLength(0);
    expect(digest.intro).toContain('Parx Racing');
  });
});

describe('renderDigestEmail', () => {
  const digest: RenderedDigest = {
    intro: 'A lively card across two tracks.',
    tier: 'strong',
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

  it('shows the going folded into the surface when captured', () => {
    const offTrack: RenderedDigest = {
      ...digest,
      items: [{ ...digest.items[0]!, surface: 'Dirt', surfaceCondition: 'Sloppy' }],
    };
    const email = renderDigestEmail(offTrack, '2026-05-17');
    expect(email.html).toContain('Dirt (Sloppy)');
    expect(email.text).toContain('Dirt (Sloppy)');
  });

  it('omits the going parenthetical when none was captured', () => {
    const email = renderDigestEmail(digest, '2026-05-17');
    expect(email.html).toContain('Dirt');
    expect(email.html).not.toContain('Dirt (');
  });

  it('escapes HTML in model-written content', () => {
    const email = renderDigestEmail(digest, '2026-05-17');
    expect(email.html).toContain('&lt;worth a look&gt;');
    expect(email.html).not.toContain('<worth a look>');
  });

  it('renders newline-separated prose as distinct paragraphs', () => {
    const multi: RenderedDigest = {
      ...digest,
      intro: 'Lead read on the day.\n\nA second beat worth flagging.',
      items: [
        {
          ...digest.items[0]!,
          reasoning: 'The angle that should make you look.\n\nOne honest caveat to weigh.',
        },
      ],
    };
    const email = renderDigestEmail(multi, '2026-05-17');
    // Each beat lands in its own <p>, not one collapsed block.
    expect(email.html).toContain('>Lead read on the day.</p>');
    expect(email.html).toContain('>A second beat worth flagging.</p>');
    expect(email.html).toContain('>The angle that should make you look.</p>');
    expect(email.html).toContain('>One honest caveat to weigh.</p>');
    // Plain text keeps the blank line between beats.
    expect(email.text).toContain('Lead read on the day.\n\nA second beat worth flagging.');
  });

  it('flags a weak-match digest in the subject and body', () => {
    const email = renderDigestEmail({ ...digest, tier: 'weak' }, '2026-05-17');
    expect(email.subject).toContain('no strong matches');
    expect(email.html).toContain('closest looks at your tracks');
    expect(email.text).toContain('closest looks at your tracks');
  });

  it('renders a dark-day note with no race items', () => {
    const dark = buildDarkDigest(['Parx Racing']);
    const email = renderDigestEmail(dark, '2026-05-17');
    expect(email.subject).toContain('No racing at your tracks');
    expect(email.html).toContain('No racing today');
    expect(email.html).toContain('Parx Racing');
    expect(email.html).toContain('the day your tracks are running');
  });
});
