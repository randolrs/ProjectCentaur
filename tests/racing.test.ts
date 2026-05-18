import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { RacingApiClient } from '@/lib/racing/client';
import { ukRegionStrategy, usRegionStrategy, usToday } from '@/lib/racing/regions';
import {
  naEntriesResponseSchema,
  naMeetsResponseSchema,
  type RawUsRacecardData,
} from '@/lib/racing/types';

/** Load and JSON-parse a captured Racing API fixture. */
function fixture(name: string): unknown {
  const url = new URL(`./fixtures/racing/${name}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
}

describe('usToday', () => {
  it('formats the current racing day as YYYY-MM-DD', () => {
    expect(usToday(new Date('2026-05-17T12:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('UsRegionStrategy', () => {
  it('exposes US vocabulary and onboarding defaults', () => {
    expect(usRegionStrategy.region).toBe('us');
    expect(usRegionStrategy.defaultDigestDeliveryHour).toBe(7);
    expect(usRegionStrategy.vocabulary.v1Tracks).toContain('Gulfstream Park');
    expect(usRegionStrategy.vocabulary.currency).toBe('USD');
    expect(usRegionStrategy.suggestedBetTypes).toContain('exacta');
  });
});

describe('US racecard normalization', () => {
  const meets = naMeetsResponseSchema.parse(fixture('meets.json'));
  const aqueduct = naEntriesResponseSchema.parse(fixture('entries-aqueduct.json'));
  const gulfstream = naEntriesResponseSchema.parse(fixture('entries-gulfstream.json'));

  const raw: RawUsRacecardData = {
    date: '2026-05-17',
    meets: [
      { meet: meets.meets![0]!, entries: aqueduct },
      { meet: meets.meets![1]!, entries: gulfstream },
    ],
  };
  const cards = usRegionStrategy.raceNormalization(raw);

  it('produces one card per race across every meet', () => {
    expect(cards).toHaveLength(5); // 3 Aqueduct races + 2 Gulfstream races
  });

  it('drops multi-track wager pools that masquerade as tracks', () => {
    const poolRaw: RawUsRacecardData = {
      date: '2026-05-17',
      meets: [
        {
          meet: meets.meets![0]!,
          entries: { ...aqueduct, track_name: 'Cross Country Pick 5' },
        },
      ],
    };
    expect(usRegionStrategy.raceNormalization(poolRaw)).toHaveLength(0);
  });

  it('reads the nested race number and provider display fields', () => {
    const race1 = cards[0]!;
    expect(race1.region).toBe('us');
    expect(race1.track).toBe('Aqueduct');
    expect(race1.raceNumber).toBe(1);
    expect(race1.surface).toBe('Dirt');
    expect(race1.distance).toBe('6 1/2 Furlongs');
    expect(race1.raceClass).toBe('MAIDEN SPECIAL WEIGHT');
    expect(race1.postTime).toBe('12:40 PM');
    expect(race1.postTimestamp).toBe(1779033600000);
    expect(race1.purse).toBe(80000);
  });

  it('flattens jockey and trainer objects into Person records', () => {
    const felonious = cards[0]!.runners[0]!;
    expect(felonious.horseName).toBe('Felonious');
    expect(felonious.jockey?.name).toBe('Ricardo Santana, Jr.');
    expect(felonious.trainer?.name).toBe('Todd A. Pletcher');
    expect(felonious.morningLineOdds).toBe('5/2');
  });

  it('falls back to the alias when a person has no name parts', () => {
    expect(cards[0]!.runners[1]!.jockey?.name).toBe('Ortiz I Jr');
  });

  it('tolerates a null jockey', () => {
    expect(cards[1]!.runners[1]!.jockey).toBeNull();
  });

  it('marks scratched runners and excludes them from field size', () => {
    const race1 = cards[0]!;
    expect(race1.runners).toHaveLength(3);
    expect(race1.runners[2]!.scratched).toBe(true);
    expect(race1.runners[0]!.scratched).toBe(false);
    expect(race1.fieldSize).toBe(2);
  });

  it('synthesizes conditions from the restriction fields', () => {
    expect(cards[1]!.conditions).toBe(
      '3 Year Olds And Up · Fillies And Mares · Non-winners of two races',
    );
  });

  it('retains the raw race object for the races.raw_data column', () => {
    expect(cards[0]!.raw).toMatchObject({ race_class: 'MAIDEN SPECIAL WEIGHT' });
  });
});

describe('UkRegionStrategy stub', () => {
  it('is identifiable but throws on every operational member', () => {
    expect(ukRegionStrategy.region).toBe('uk');
    expect(() => ukRegionStrategy.vocabulary).toThrow('UK racing not yet supported');
    expect(() => ukRegionStrategy.defaultDigestDeliveryHour).toThrow('UK racing not yet supported');
    expect(() => ukRegionStrategy.suggestedBetTypes).toThrow('UK racing not yet supported');
    expect(() => ukRegionStrategy.dataFetch()).toThrow('UK racing not yet supported');
    expect(() => ukRegionStrategy.raceNormalization()).toThrow('UK racing not yet supported');
  });
});

describe('RacingApiClient', () => {
  it('sends HTTP Basic auth and parses the meets response', async () => {
    const fakeFetch = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      expect(String(input)).toContain('/v1/north-america/meets');
      return new Response(
        JSON.stringify({
          limit: 50,
          skip: 0,
          query: [],
          meets: [{ meet_id: 'm1', track_id: 'GP', track_name: 'Gulfstream Park', country: 'USA' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    const client = new RacingApiClient({
      baseUrl: 'https://api.example.com',
      username: 'u',
      password: 'p',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });

    const result = await client.listNorthAmericaMeets('2026-05-17');
    expect(result.meets).toHaveLength(1);

    const init = fakeFetch.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('u:p').toString('base64')}`);
  });

  it('throws RacingApiError on a non-2xx response', async () => {
    const fakeFetch = vi.fn(async () => new Response('forbidden', { status: 403 }));
    const client = new RacingApiClient({
      baseUrl: 'https://api.example.com',
      username: 'u',
      password: 'p',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });

    await expect(client.get('/v1/north-america/meets')).rejects.toThrow(/403/);
  });
});
