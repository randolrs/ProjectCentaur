'use server';

import { isAdminEmail } from '@/lib/admin';
import { runDigestForAllUsers, runHourlyDigest } from '@/lib/digest/pipeline';
import { ingestTodaysUsRaces } from '@/lib/racing/ingest';
import { createClient } from '@/lib/supabase/server';
import type { DigestActionResult, IngestActionResult } from './types';

// ---------------------------------------------------------------------------
// Admin console server actions.
//
// Each action re-checks the caller against the admin allowlist — the page
// guard alone is not a security boundary, since actions are POST endpoints
// that can be invoked directly.
// ---------------------------------------------------------------------------

async function isCallerAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return isAdminEmail(user?.email);
}

function fail(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

/** Ingest today's US racecards into the `races` table. */
export async function triggerIngest(): Promise<IngestActionResult> {
  if (!(await isCallerAdmin())) return { ok: false, error: 'Not authorized.' };
  try {
    return { ok: true, data: await ingestTodaysUsRaces() };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Run the digest pipeline. `force` delivers to every onboarded user now;
 * otherwise only users due in the current hour receive a digest.
 */
export async function triggerDigest(force: boolean): Promise<DigestActionResult> {
  if (!(await isCallerAdmin())) return { ok: false, error: 'Not authorized.' };
  try {
    const summary = force ? await runDigestForAllUsers() : await runHourlyDigest();
    return { ok: true, data: summary };
  } catch (error) {
    return fail(error);
  }
}
