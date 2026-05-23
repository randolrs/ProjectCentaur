'use server';

import {
  getCanonicalTracks,
  getDigestEligibleUsers,
  getIngestSummaryForDate,
} from '@/db/queries';
import { isAdminEmail } from '@/lib/admin';
import {
  runDigestForAllUsers,
  runDigestForUser,
  runHourlyDigest,
} from '@/lib/digest/pipeline';
import { localParts } from '@/lib/digest/schedule';
import { backfillHistory, ingestTodaysUsRaces } from '@/lib/racing/ingest';
import { seedTracksFromMeets } from '@/lib/racing/seed-tracks';
import { createClient } from '@/lib/supabase/server';
import type {
  BackfillActionResult,
  DigestActionResult,
  EmailDigestActionResult,
  IngestActionResult,
  IngestDayActionResult,
  SeedTracksActionResult,
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

/**
 * Backfill historical cards + results, newest first, to bootstrap results
 * memory. Processes one budgeted chunk per call and returns a cursor; the
 * caller re-invokes from `nextDate` with `remainingDays` until `done`.
 */
export async function triggerHistoryBackfill(
  days: number,
  startDate?: string,
): Promise<BackfillActionResult> {
  if (!(await isCallerAdmin())) return { ok: false, error: 'Not authorized.' };
  if (!Number.isInteger(days) || days < 1 || days > 120) {
    return { ok: false, error: 'Days must be between 1 and 120.' };
  }
  if (startDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false, error: 'Start date must be YYYY-MM-DD.' };
  }
  try {
    return { ok: true, data: await backfillHistory({ days, startDate }) };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Seed the track vocabulary from the meets feed (no entries fetch), so
 * onboarding and digest matching see every track that has run — not just
 * those in already-ingested days. Resumable: processes one budgeted chunk per
 * call and returns a cursor; the caller re-invokes from `nextDate` until
 * `done`. Reports the catalog's total US track count after each upsert.
 */
export async function triggerSeedTracks(
  days: number,
  startDate?: string,
): Promise<SeedTracksActionResult> {
  if (!(await isCallerAdmin())) return { ok: false, error: 'Not authorized.' };
  if (!Number.isInteger(days) || days < 1 || days > 366) {
    return { ok: false, error: 'Days must be between 1 and 366.' };
  }
  if (startDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false, error: 'Start date must be YYYY-MM-DD.' };
  }
  try {
    const data = await seedTracksFromMeets({ days, startDate });
    const catalogTracks = (await getCanonicalTracks('us')).length;
    return { ok: true, data: { ...data, catalogTracks } };
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
