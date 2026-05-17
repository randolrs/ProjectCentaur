import type { NextRequest } from 'next/server';
import { getCronSecret } from '@/lib/env';
import { ingestTodaysUsRaces } from '@/lib/racing/ingest';

// Ingestion makes many sequential provider calls — opt out of static
// optimisation and allow a generous execution window. The M4 milestone wires
// the actual Vercel cron schedule against this route.
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
  let expected: string;
  try {
    expected = `Bearer ${getCronSecret()}`;
  } catch {
    return Response.json(
      { ok: false, error: 'Ingestion is not configured (missing CRON_SECRET).' },
      { status: 503 },
    );
  }

  if (request.headers.get('authorization') !== expected) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const result = await ingestTodaysUsRaces();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ingestion failed.';
    console.error('[cron/ingest] ingestion failed:', message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
