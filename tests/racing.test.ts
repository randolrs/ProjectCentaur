import { describe, expect, it, vi } from 'vitest';
import { RacingApiClient } from '@/lib/racing/client';
import { ukRegionStrategy, usRegionStrategy, usToday } from '@/lib/racing/regions';
import type { RawUsRacecardData } from '@/lib/racing/types';

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

  it('normalizes raw NA data into region-agnostic racecards', () => {
    const raw: RawUsRacecardData = {
      date: '2026-05-17',
      meets: [
        {
          meet: { meet_id: 'm1', track_name: 'Gulfstream Park', country: 'USA' },
          entries: {
            track_name: 'Gulfstream Park',
            races: [
              {
                race_id: 'r1',
                race_number: '3',
                post_time: '2026-05-17T18:30:00Z',
                surface: 'Dirt',
                distance: '6f',
                race_class: 'Allowance',
                conditions: 'For three year olds and upward',
                runners: [
                  {
                    program_number: 1,
                    horse_name: 'Centaur Bay',
                    jockey: 'J. Rosario',
                    trainer: 'T. Pletcher',
                    morning_line_odds: '5/2',
                  },
                  { program_number: 2, horse_name: 'Railbird', jockey: 'I. Ortiz' },
                ],
              },
            ],
          },
        },
      ],
    };

    const cards = usRegionStrategy.raceNormalization(raw);
    expect(cards).toHaveLength(1);

    const card = cards[0]!;
    expect(card.region).toBe('us');
    expect(card.track).toBe('Gulfstream Park');
    expect(card.raceNumber).toBe(3);
    expect(card.surface).toBe('Dirt');
    expect(card.distance).toBe('6f');
    expect(card.raceClass).toBe('Allowance');
    expect(card.fieldSize).toBe(2);
    expect(card.runners[0]!.horseName).toBe('Centaur Bay');
    expect(card.runners[0]!.programNumber).toBe('1');
    expect(card.runners[1]!.morningLineOdds).toBeNull();
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
        JSON.stringify({ meets: [{ meet_id: 'm1', track_name: 'Gulfstream Park' }] }),
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
