import { config } from 'dotenv';
import { describe, expect, it } from 'vitest';
import { hasRacingApiCredentials } from '@/lib/env';
import { RacingApiClient } from '@/lib/racing/client';

// Load credentials so the suite can decide whether to run. `.env.local`
// takes precedence; dotenv does not override already-set process.env vars.
config({ path: '.env.local' });
config();

// Skips gracefully when RACING_API_* credentials are absent (e.g. in CI).
const suite = hasRacingApiCredentials() ? describe : describe.skip;

suite('Racing API — live integration', () => {
  it("fetches and cleanly parses today's US racecards", async () => {
    const client = RacingApiClient.fromEnv();
    const cards = await client.fetchTodayUSRacecards();

    expect(Array.isArray(cards)).toBe(true);
    expect(cards.length).toBeGreaterThan(0);

    for (const card of cards) {
      expect(card.region).toBe('us');
      expect(typeof card.track).toBe('string');
      expect(Array.isArray(card.runners)).toBe(true);
    }
  }, 120_000);

  it('returns parseable Gulfstream Park data when the track is running', async (ctx) => {
    const client = RacingApiClient.fromEnv();
    const cards = await client.fetchTodayUSRacecards();
    const gulfstream = cards.filter((card) => /gulfstream/i.test(card.track));

    // Gulfstream is year-round but dark on some weekdays — skip if so.
    if (gulfstream.length === 0) {
      ctx.skip();
      return;
    }

    for (const card of gulfstream) {
      expect(card.region).toBe('us');
      expect(card.runners.length).toBeGreaterThan(0);
    }
  }, 120_000);
});
