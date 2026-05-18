'use server';

import { getDigestEligibleUsers, getIngestSummaryForDate } from '@/db/queries';
import { isAdminEmail } from '@/lib/admin';
import {
  runDigestForAllUsers,
  runDigestForUser,
  runHourlyDigest,
} from '@/lib/digest/pipeline';
import { localParts } from '@/lib/digest/schedule';
import { ingestTodaysUsRaces } from '@/lib/racing/ingest';
import { createClient } from '@/lib/supabase/server';
import type {
  DigestActionResult,
  EmailDigestActionResult,
  IngestActionResult,
  IngestDayActionResult,
} from './types';

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

/** Summarize the races and entries ingested for a racing day. */
export async function getIngestedDay(
  date: string,
): Promise<IngestDayActionResult> {
  if (!(await isCallerAdmin())) return { ok: false, error: 'Not authorized.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Pick a valid date.' };
  }
  try {
    return { ok: true, data: await getIngestSummaryForDate(date) };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Build and deliver one onboarded user's digest by email, for their current
 * racing day — bypassing the idempotency check, so it sends even if that
 * user already received a digest today.
 */
export async function triggerDigestForEmail(
  email: string,
): Promise<EmailDigestActionResult> {
  if (!(await isCallerAdmin())) return { ok: false, error: 'Not authorized.' };
  const target = email.trim().toLowerCase();
  if (!target) return { ok: false, error: 'Enter an email address.' };
  try {
    const eligible = await getDigestEligibleUsers();
    const match = eligible.find((e) => e.user.email.toLowerCase() === target);
    if (!match) {
      return {
        ok: false,
        error: `No onboarded user found for ${email.trim()}.`,
      };
    }
    const { date } = localParts(match.user.timezone, new Date());
    return { ok: true, data: await runDigestForUser(match, date) };
  } catch (error) {
    return fail(error);
  }
}
