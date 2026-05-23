import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron';
import { seedTracksFromMeets } from '@/lib/racing/seed-tracks';

// Seeding walks a year of the meets feed — opt out of static optimisation and
// allow a generous execution window. This is a manually-triggered backfill,
// not a scheduled cron, so it is intentionally absent from `vercel.json`.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Seed the `tracks` vocabulary from the North America meets feed.
 *
 * Guarded by the `CRON_SECRET` bearer token. Optional query params:
 *   - `days`      — window size to scan (default 365)
 *   - `startDate` — YYYY-MM-DD to scan back from (default today); pass the
 *                   previous response's `nextDate` to resume an unfinished run.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const denied = checkCronAuth(request);
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const daysParam = params.get('days');
  const startDate = params.get('startDate') ?? undefined;
  const days = daysParam !== null ? Number(daysParam) : undefined;

  if (days !== undefined && (!Number.isInteger(days) || days <= 0)) {
    return Response.json(
      { ok: false, error: 'days must be a positive integer.' },
      { status: 400 },
    );
  }

  try {
    const result = await seedTracksFromMeets({ days, startDate });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Track seed failed.';
    console.error('[cron/seed-tracks] seed failed:', message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
