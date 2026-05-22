import {
  type DigestEligibleUser,
  getDigestEligibleUser,
  getDigestEligibleUsers,
  getRacesForTracks,
  getSentDigestCountByUser,
  getTrackCoordinates,
} from '@/db/queries';
import { renderDigestEmail } from './email';
import { DigestLlmError, generateDigest } from './llm';
import { getDigest, recordDigest } from './persistence';
import { buildDarkDigest, buildRenderedDigest } from './render';
import type { DigestTier } from './schema';
import { isUserDue, localParts, localWeekday } from './schedule';
import {
  type ScoredRace,
  selectClosestRaces,
  selectRacesForUser,
} from './select';
import { trackEvent } from '@/lib/analytics';
import { sendEmail } from '@/lib/email/resend';
import { getSiteUrl } from '@/lib/env';
import { isSubscriptionActive } from '@/lib/stripe/subscription';
import { TRACK_COORDINATES } from '@/lib/weather/coordinates';
import { getCachedForecast } from '@/lib/weather/nws';

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

// On a day with no strong matches, how many of the closest-fit races to
// surface instead of going dark — kept small since these are weaker reads.
const MAX_WEAK_MATCH_RACES = 5;

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
  tier?: DigestTier;
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

/** Attach the NWS forecast for each distinct track to its scored races. */
async function attachWeather(
  scored: readonly ScoredRace[],
  raceDate: string,
): Promise<ScoredRace[]> {
  const distinctTracks = Array.from(new Set(scored.map((s) => s.race.track)));
  // Prefer coordinates resolved at ingest (covers any track); fall back to
  // the curated map so the known tracks get weather even before a backfill.
  const dbCoords = await getTrackCoordinates(distinctTracks);
  const forecasts = new Map<
    string,
    Awaited<ReturnType<typeof getCachedForecast>>
  >();
  await Promise.all(
    distinctTracks.map(async (track) => {
      const coords = dbCoords.get(track) ?? TRACK_COORDINATES[track];
      if (!coords) return;
      forecasts.set(track, await getCachedForecast(track, coords, raceDate));
    }),
  );
  return scored.map((entry) => ({
    ...entry,
    weather: forecasts.get(entry.race.track) ?? null,
  }));
}

/**
 * Send a "dark day" note — none of the user's followed tracks are running, so
 * there are no races to show. Recorded under the `dark` status so it does not
 * count against the free-digest allotment. Never throws.
 */
async function deliverDarkNote(
  eligible: DigestEligibleUser,
  raceDate: string,
): Promise<UserDigestResult> {
  const { user, prefs } = eligible;
  const base = { userId: user.id, email: user.email, raceDate };
  const digest = buildDarkDigest(prefs.tracks);
  const subscribed = isSubscriptionActive(eligible.subscription?.status);
  const email = renderDigestEmail(
    digest,
    raceDate,
    subscribed ? {} : { upgradeUrl: `${getSiteUrl()}/subscribe` },
  );

  let sent = false;
  let resendId: string | null = null;
  let error: string | undefined;
  try {
    const result = await sendEmail({ to: user.email, ...email });
    resendId = result.id;
    sent = true;
  } catch (sendError) {
    error = sendError instanceof Error ? sendError.message : String(sendError);
    console.error(
      `[cron/digest] dark-day send failed for ${user.email}: ${error}`,
    );
  }

  await recordDigest({
    userId: user.id,
    raceDate,
    status: sent ? 'dark' : 'failed',
    raceCount: 0,
    subject: email.subject,
    content: digest,
    costUsd: 0,
    resendId,
    error: error ?? null,
  });

  if (sent) {
    await trackEvent(user.id, 'digest_sent', {
      race_date: raceDate,
      race_count: 0,
      generated_by: digest.generatedBy,
      subscribed,
      cost_usd: 0,
      tier: 'dark',
    });
  }

  return {
    ...base,
    outcome: sent ? 'sent' : 'failed',
    tier: 'dark',
    raceCount: 0,
    costUsd: 0,
    generatedBy: digest.generatedBy,
    error,
  };
}

/**
 * Build and deliver one user's digest for a racing day. Always records a
 * `digests` row; never throws — delivery and model failures are captured in
 * the returned result.
 *
 * Tier logic, so the user is never left in the dark:
 * - 'strong': races that cleared every filter (the normal digest).
 * - 'weak': no strong matches, so the closest fits at their tracks are sent,
 *   flagged so the copy is honest about the weaker fit.
 * - 'dark': none of their tracks are running — a short no-card note.
 */
export async function runDigestForUser(
  eligible: DigestEligibleUser,
  raceDate: string,
): Promise<UserDigestResult> {
  const { user, prefs, profile } = eligible;
  const base = { userId: user.id, email: user.email, raceDate };

  const races = await getRacesForTracks(raceDate, prefs.tracks);
  if (races.length === 0) {
    return deliverDarkNote(eligible, raceDate);
  }

  const strong = selectRacesForUser(prefs, races);
  const tier: DigestTier = strong.length > 0 ? 'strong' : 'weak';
  const baseScored =
    tier === 'strong'
      ? strong.slice(0, MAX_RACES_PER_DIGEST)
      : selectClosestRaces(prefs, races, MAX_WEAK_MATCH_RACES);
  const scored = await attachWeather(baseScored, raceDate);

  // Generate the digest; on model failure fall back to deterministic copy so
  // the user still receives a usable digest.
  let llmOutput = null;
  let costUsd = 0;
  try {
    const result = await generateDigest({
      profile,
      prefs,
      scored,
      raceDate,
      tier,
    });
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

  const digest = buildRenderedDigest(llmOutput, scored, tier);
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
    const result = await sendEmail({ to: user.email, ...email });
    resendId = result.id;
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

  if (outcome === 'sent') {
    await trackEvent(user.id, 'digest_sent', {
      race_date: raceDate,
      race_count: scored.length,
      generated_by: digest.generatedBy,
      subscribed,
      cost_usd: costUsd,
      tier,
    });
  }

  return {
    ...base,
    outcome,
    tier,
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
      // A delivered digest — a real send ('sent') or a dark-day note ('dark')
      // — blocks a re-run. A prior `skipped_no_races` or `failed` row is
      // retried, so a re-trigger recovers once races are ingested or a
      // transient send failure clears.
      if (existing?.status === 'sent' || existing?.status === 'dark') {
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
 * free allotment — for whom `now` is their configured delivery hour on a
 * weekday they marked active.
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
      ) &&
      isUserDue(e.user, now) &&
      e.prefs.activeDays.includes(localWeekday(e.user.timezone, now)),
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
