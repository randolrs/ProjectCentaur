import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron';
import { ingestResultsForDate } from '@/lib/racing/ingest';
import { usToday } from '@/lib/racing/regions';

// Results ingestion makes one provider call per meet we hold for the target
// day — opt out of static optimisation and allow a generous window. The
// Vercel cron schedule for this route lives in `vercel.json`.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** The US racing day immediately before `now`. */
function priorRacingDay(now = new Date()): string {
  return usToday(new Date(now.getTime() - 24 * 60 * 60 * 1000));
}

/**
 * Ingest the prior racing day's finishing results onto the entries we already
 * hold. Runs once each morning, after the prior day's cards have finished.
 *
 * Guarded by the `CRON_SECRET` bearer token, which Vercel Cron attaches
 * automatically when the env var is set; a manual run must send the same
 * `Authorization: Bearer <secret>` header. An explicit `?date=YYYY-MM-DD`
 * overrides the target day.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const denied = checkCronAuth(request);
  if (denied) return denied;

  const override = request.nextUrl.searchParams.get('date');
  const date = override && /^\d{4}-\d{2}-\d{2}$/.test(override)
    ? override
    : priorRacingDay();

  try {
    const result = await ingestResultsForDate(date);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Results run failed.';
    console.error('[cron/results] run failed:', message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
