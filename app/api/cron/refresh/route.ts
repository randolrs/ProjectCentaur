import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron';
import { runConditionPoll } from '@/lib/alerts/poller';

// Re-fetches going for imminent meets and emails subscribers on off-track
// changes. Scoped to a few active meets per run, so it stays well under the
// function ceiling; the `*/15` schedule lives in `vercel.json`.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Race-day condition poll. Guarded by the `CRON_SECRET` bearer token that
 * Vercel Cron attaches automatically; a manual run must send the same
 * `Authorization: Bearer <secret>` header. A no-op outside racing hours.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const denied = checkCronAuth(request);
  if (denied) return denied;

  try {
    const result = await runConditionPoll();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Condition poll failed.';
    console.error('[cron/refresh] poll failed:', message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
