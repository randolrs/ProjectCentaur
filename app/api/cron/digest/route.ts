import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron';
import { runHourlyDigest } from '@/lib/digest/pipeline';

// The digest pipeline makes one LLM call and one email send per due user —
// opt out of static optimisation and allow a generous execution window.
// The Vercel cron schedule for this route lives in `vercel.json`.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Deliver morning digests. Runs hourly; each invocation delivers to the
 * users for whom it is currently their configured delivery hour.
 *
 * Guarded by the `CRON_SECRET` bearer token, which Vercel Cron attaches
 * automatically when the env var is set; a manual run must send the same
 * `Authorization: Bearer <secret>` header.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const denied = checkCronAuth(request);
  if (denied) return denied;

  try {
    const summary = await runHourlyDigest();
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Digest run failed.';
    console.error('[cron/digest] run failed:', message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
