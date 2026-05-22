import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { tracks, type NewTrackRow } from '@/db/schema';
import { RacingApiClient } from './client';
import { canonicalTrack } from './canonical';
import { isUsMeet, isWagerPoolMeet, usToday } from './regions';

// ---------------------------------------------------------------------------
// Track vocabulary seed
//
// The Racing API's North America add-on has no master "tracks"/"courses"
// endpoint — the only place a track is named is the meets feed. So the
// authoritative US track list is the set of distinct, non-wager-pool
// `track_name`s seen across a window of racing days. This walks that window
// using only the lightweight meets listing (no entries fetch) and upserts the
// vocabulary the same way ingestion does, so onboarding and digest matching
// see every track that has run — not just the handful in days already
// ingested. Idempotent: re-running refreshes existing rows on `name_canonical`.
// ---------------------------------------------------------------------------

/** Shift a YYYY-MM-DD date by whole days (UTC). */
function shiftDate(date: string, deltaDays: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export interface SeedTracksResult {
  /** Most-recent day this invocation started from. */
  startDate: string;
  /** Number of days actually scanned this invocation (newest first). */
  daysScanned: number;
  /** US, non-wager-pool meets encountered across the scanned days. */
  meetsSeen: number;
  /** Distinct canonical tracks upserted. */
  tracksUpserted: number;
  /** True once the whole requested window has been covered. */
  done: boolean;
  /** Most-recent unscanned day to resume from, or null when done. */
  nextDate: string | null;
  /** Days still remaining when the budget ran out, for the resume call. */
  remainingDays: number;
}

/**
 * Seed the `tracks` table from `days` racing days ending at `startDate`
 * (default: today), newest first. Stops when `budgetMs` of wall-clock is spent
 * and returns a resume cursor (`nextDate`), mirroring `backfillHistory`.
 */
export async function seedTracksFromMeets(
  opts: {
    days?: number;
    startDate?: string;
    budgetMs?: number;
    client?: RacingApiClient;
  } = {},
): Promise<SeedTracksResult> {
  const days = opts.days ?? 365;
  const startDate = opts.startDate ?? usToday();
  const budgetMs = opts.budgetMs ?? 240_000;
  const api = opts.client ?? RacingApiClient.fromEnv();
  const began = Date.now();

  const trackRows = new Map<string, NewTrackRow>();
  let meetsSeen = 0;

  let i = 0;
  for (; i < days; i += 1) {
    if (i > 0 && Date.now() - began > budgetMs) break;
    const date = shiftDate(startDate, -i);

    // The meets endpoint paginates (max 50 per page); walk every page.
    const pageSize = 50;
    for (let skip = 0; ; skip += pageSize) {
      const response = await api.listNorthAmericaMeets(date, pageSize, skip);
      const page = response.meets ?? [];
      for (const meet of page) {
        if (!isUsMeet(meet)) continue;
        const name = meet.track_name.trim();
        if (!name || isWagerPoolMeet(name)) continue;
        meetsSeen += 1;
        const nameCanonical = canonicalTrack(name);
        if (!trackRows.has(nameCanonical)) {
          trackRows.set(nameCanonical, {
            providerTrackId: meet.track_id ?? null,
            name,
            nameCanonical,
            region: 'us',
          });
        }
      }
      if (page.length < pageSize) break;
    }
  }

  let tracksUpserted = 0;
  if (trackRows.size > 0) {
    const result = await getDb()
      .insert(tracks)
      .values([...trackRows.values()])
      .onConflictDoUpdate({
        target: tracks.nameCanonical,
        set: {
          providerTrackId: sql`excluded.provider_track_id`,
          name: sql`excluded.name`,
          region: sql`excluded.region`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: tracks.id });
    tracksUpserted = result.length;
  }

  const done = i >= days;
  return {
    startDate,
    daysScanned: i,
    meetsSeen,
    tracksUpserted,
    done,
    nextDate: done ? null : shiftDate(startDate, -i),
    remainingDays: done ? 0 : days - i,
  };
}
