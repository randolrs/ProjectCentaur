import {
  type DigestEligibleUser,
  getDigestEligibleUser,
  getDigestEligibleUsers,
  getRacesForTracks,
  getSentDigestCountByUser,
} from '@/db/queries';
import { renderDigestEmail } from './email';
import { DigestLlmError, generateDigest } from './llm';
import { getDigest, recordDigest } from './persistence';
import { buildRenderedDigest } from './render';
import { isUserDue, localParts } from './schedule';
import { selectRacesForUser } from './select';
import { sendEmail } from '@/lib/email/resend';
import { getSiteUrl } from '@/lib/env';
import { isSubscriptionActive } from '@/lib/stripe/subscription';

// ---------------------------------------------------------------------------
// Digest pipeline orchestration.
//
// `runHourlyDigest` is the cron entry point: it walks every onboarded user,
// delivers to the ones for whom it is currently their chosen delivery hour,
// and is idempotent — a user who already has a digest row for their local
// racing day is skipped. Each user is isolated in a try/catch so one
// failure never aborts the run.
// ---------------------------------------------------------------------------

// Upper bound on races sent to the model in one digest — keeps token cost
// bounded and respects the digest schema's 12-race ceiling.
const MAX_RACES_PER_DIGEST = 10;

// Per-user spend tripwire: a digest costing more than this logs an alert.
const COST_ALERT_USD = 0.5;

// Digests an unsubscribed user receives free before the paywall applies —
// the immediate one at onboarding plus their first scheduled morning digest.
const FREE_DIGEST_LIMIT = 2;

/**
 * Whether a user should receive a digest now: active subscribers always, and
 * unsubscribed users until they have received their free allotment.
 */
export function canReceiveDigest(
  subscriptionStatus: string | null | undefined,
  sentDigestCount: number,
): boolean {
  return (
    isSubscriptionActive(subscriptionStatus) ||
    sentDigestCount < FREE_DIGEST_LIMIT
  );
}

export type DigestOutcome =
  | 'sent'
  | 'skipped_no_races'
  | 'failed'
  | 'already_done';

export interface UserDigestResult {
  userId: string;
  email: string;
  raceDate: string;
  outcome: DigestOutcome;
  raceCount: number;
  costUsd: number;
  generatedBy?: 'llm' | 'fallback';
  error?: string;
}

export interface DigestRunSummary {
  triggeredAt: string;
  considered: number;
  due: number;
  sent: number;
  skipped: number;
  failed: number;
  totalCostUsd: number;
  results: UserDigestResult[];
}

/**
 * Build and deliver one user's digest for a racing day. Always records a
 * `digests` row; never throws — delivery and model failures are captured in
 * the returned result.
 */
export async function runDigestForUser(
  eligible: DigestEligibleUser,
  raceDate: string,
): Promise<UserDigestResult> {
  const { user, prefs, profile } = eligible;
  const base = { userId: user.id, email: user.email, raceDate };

  const races = await getRacesForTracks(raceDate, prefs.tracks);
  const scored = selectRacesForUser(prefs, races).slice(0, MAX_RACES_PER_DIGEST);

  if (scored.length === 0) {
    await recordDigest({
      userId: user.id,
      raceDate,
      status: 'skipped_no_races',
      raceCount: 0,
    });
    return { ...base, outcome: 'skipped_no_races', raceCount: 0, costUsd: 0 };
  }

  // Generate the digest; on model failure fall back to deterministic copy so
  // the user still receives a usable digest.
  let llmOutput = null;
  let costUsd = 0;
  try {
    const result = await generateDigest({ profile, prefs, scored, raceDate });
    llmOutput = result.output;
    costUsd = result.usage.costUsd;
  } catch (error) {
    if (error instanceof DigestLlmError) costUsd = error.usage.costUsd;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cron/digest] LLM failed for ${user.email}: ${message}`);
  }

  if (costUsd > COST_ALERT_USD) {
    console.warn(
      `[cron/digest] COST ALERT: digest for ${user.email} cost $${costUsd.toFixed(4)}`,
    );
  }

  const digest = buildRenderedDigest(llmOutput, scored);
  // Unsubscribed users (those on a free digest) get an upgrade call to action.
  const subscribed = isSubscriptionActive(eligible.subscription?.status);
  const email = renderDigestEmail(
    digest,
    raceDate,
    subscribed ? {} : { upgradeUrl: `${getSiteUrl()}/subscribe` },
  );

  let outcome: DigestOutcome = 'sent';
  let resendId: string | null = null;
  let error: string | undefined;
  try {
    const sent = await sendEmail({ to: user.email, ...email });
    resendId = sent.id;
  } catch (sendError) {
    outcome = 'failed';
    error = sendError instanceof Error ? sendError.message : String(sendError);
    console.error(`[cron/digest] send failed for ${user.email}: ${error}`);
  }

  await recordDigest({
    userId: user.id,
    raceDate,
    status: outcome,
    raceCount: scored.length,
    subject: email.subject,
    content: digest,
    costUsd,
    resendId,
    error: error ?? null,
  });

  return {
    ...base,
    outcome,
    raceCount: scored.length,
    costUsd,
    generatedBy: digest.generatedBy,
    error,
  };
}

/**
 * Deliver digests to a prepared set of users. Shared by the scheduled and
 * the forced (admin) entry points; `considered` is the size of the full
 * onboarded population so the summary can tell "no users" apart from
 * "no users due this hour".
 */
async function deliverDigests(
  due: DigestEligibleUser[],
  considered: number,
  now: Date,
): Promise<DigestRunSummary> {
  const results: UserDigestResult[] = [];

  for (const candidate of due) {
    const { date } = localParts(candidate.user.timezone, now);
    try {
      const existing = await getDigest(candidate.user.id, date);
      // Only a delivered digest blocks a re-run. A prior `skipped_no_races`
      // or `failed` row is retried, so a re-trigger recovers once races are
      // ingested or a transient send failure clears.
      if (existing?.status === 'sent') {
        results.push({
          userId: candidate.user.id,
          email: candidate.user.email,
          raceDate: date,
          outcome: 'already_done',
          raceCount: existing.raceCount,
          costUsd: 0,
        });
        continue;
      }
      results.push(await runDigestForUser(candidate, date));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[cron/digest] unexpected failure for ${candidate.user.email}: ${message}`,
      );
      results.push({
        userId: candidate.user.id,
        email: candidate.user.email,
        raceDate: date,
        outcome: 'failed',
        raceCount: 0,
        costUsd: 0,
        error: message,
      });
    }
  }

  const summary: DigestRunSummary = {
    triggeredAt: now.toISOString(),
    considered,
    due: due.length,
    sent: results.filter((r) => r.outcome === 'sent').length,
    skipped: results.filter(
      (r) => r.outcome === 'skipped_no_races' || r.outcome === 'already_done',
    ).length,
    failed: results.filter((r) => r.outcome === 'failed').length,
    totalCostUsd: results.reduce((sum, r) => sum + r.costUsd, 0),
    results,
  };
  console.log(
    `[cron/digest] due=${summary.due} sent=${summary.sent} ` +
      `skipped=${summary.skipped} failed=${summary.failed} ` +
      `cost=$${summary.totalCostUsd.toFixed(4)}`,
  );
  return summary;
}

/**
 * Cron entry point. Delivers digests to every onboarded user who may receive
 * one now — an active subscriber, or an unsubscribed user still inside their
 * free allotment — for whom `now` is their configured delivery hour.
 */
export async function runHourlyDigest(
  now: Date = new Date(),
): Promise<DigestRunSummary> {
  const eligible = await getDigestEligibleUsers();
  const sentCounts = await getSentDigestCountByUser();
  const due = eligible.filter(
    (e) =>
      canReceiveDigest(
        e.subscription?.status,
        sentCounts.get(e.user.id) ?? 0,
      ) && isUserDue(e.user, now),
  );
  return deliverDigests(due, eligible.length, now);
}

/**
 * Forced run: deliver to every onboarded user who may receive a digest now,
 * ignoring each user's configured delivery hour. Idempotency still holds — a
 * user who already has a digest for the current racing day is skipped. Used
 * by the admin console.
 */
export async function runDigestForAllUsers(
  now: Date = new Date(),
): Promise<DigestRunSummary> {
  const eligible = await getDigestEligibleUsers();
  const sentCounts = await getSentDigestCountByUser();
  const deliverable = eligible.filter((e) =>
    canReceiveDigest(e.subscription?.status, sentCounts.get(e.user.id) ?? 0),
  );
  return deliverDigests(deliverable, eligible.length, now);
}

/**
 * Send a user their digest immediately on finishing onboarding — their first
 * free digest, today's card. Best-effort: a missing profile or a send failure
 * is swallowed, since the hourly cron still covers the user afterward.
 */
export async function triggerImmediateDigest(userId: string): Promise<void> {
  try {
    const eligible = await getDigestEligibleUser(userId);
    if (!eligible) return;
    const { date } = localParts(eligible.user.timezone, new Date());
    // Don't double up if a digest for today already exists.
    if (await getDigest(userId, date)) return;
    await runDigestForUser(eligible, date);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[digest] immediate trigger failed for ${userId}: ${message}`,
    );
  }
}
