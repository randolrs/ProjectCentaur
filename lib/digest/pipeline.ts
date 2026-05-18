import {
  type DigestEligibleUser,
  getDigestEligibleUsers,
  getRacesForTracks,
} from '@/db/queries';
import { renderDigestEmail } from './email';
import { DigestLlmError, generateDigest } from './llm';
import { getDigest, recordDigest } from './persistence';
import { buildRenderedDigest } from './render';
import { localParts } from './schedule';
import { isUserDue } from './schedule';
import { selectRacesForUser } from './select';
import { sendEmail } from '@/lib/email/resend';

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
  const email = renderDigestEmail(digest, raceDate);

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
 * Cron entry point. Delivers digests to every onboarded user for whom `now`
 * is their configured delivery hour and who has no digest yet for their
 * local racing day.
 */
export async function runHourlyDigest(
  now: Date = new Date(),
): Promise<DigestRunSummary> {
  const eligible = await getDigestEligibleUsers();
  const due = eligible.filter((e) => isUserDue(e.user, now));
  const results: UserDigestResult[] = [];

  for (const candidate of due) {
    const { date } = localParts(candidate.user.timezone, now);
    try {
      const existing = await getDigest(candidate.user.id, date);
      if (existing) {
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
    considered: eligible.length,
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
