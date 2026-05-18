import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron';
import { ingestTodaysUsRaces } from '@/lib/racing/ingest';

// Ingestion makes many sequential provider calls — opt out of static
// optimisation and allow a generous execution window. The Vercel cron
// schedule for this route lives in `vercel.json`.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Trigger ingestion of today's US racecards.
 *
 * Guarded by the `CRON_SECRET` bearer token, which Vercel Cron attaches
 * automatically when the env var is set; a manual run must send the same
 * `Authorization: Bearer <secret>` header.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const denied = checkCronAuth(request);
  if (denied) return denied;

  try {
    const result = await ingestTodaysUsRaces();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ingestion failed.';
    console.error('[cron/ingest] ingestion failed:', message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
