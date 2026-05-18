import type { NextRequest } from 'next/server';
import { getCronSecret } from '@/lib/env';

// ---------------------------------------------------------------------------
// Cron endpoint authorization.
//
// Both cron routes (ingest, digest) are guarded by the `CRON_SECRET` bearer
// token, which Vercel Cron attaches automatically when the env var is set.
// A manual run must send the same `Authorization: Bearer <secret>` header.
// ---------------------------------------------------------------------------

/**
 * Validate a cron request's bearer token. Returns an error `Response` when
 * the request is unconfigured (503) or unauthorized (401), or `null` when
 * the caller may proceed.
 */
export function checkCronAuth(request: NextRequest): Response | null {
  let expected: string;
  try {
    expected = `Bearer ${getCronSecret()}`;
  } catch {
    return Response.json(
      { ok: false, error: 'Cron is not configured (missing CRON_SECRET).' },
      { status: 503 },
    );
  }

  if (request.headers.get('authorization') !== expected) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  return null;
}
