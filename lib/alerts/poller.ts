import {
  getDigestEligibleUsers,
  getMeetIdsByProvider,
  getPendingConditionAlerts,
  insertConditionAlerts,
  markConditionAlertsNotified,
} from '@/db/queries';
import type { NewConditionAlertRow } from '@/db/schema';
import { sendEmail } from '@/lib/email/resend';
import { canonicalTrack } from '@/lib/racing/canonical';
import { refreshRaceDayConditions } from '@/lib/racing/ingest';
import { isSubscriptionActive } from '@/lib/stripe/subscription';
import { deriveConditionEvents, renderConditionAlertEmail } from './conditions';

// ---------------------------------------------------------------------------
// Condition poll orchestration.
//
// One tick: refresh going for imminent meets (capture), record any off-going
// transitions deduped against earlier polls, then email subscribed followers
// of each affected track. Capture and alerting are independent — a tick with
// no subscribers still captures going into `races.surface_condition`.
// ---------------------------------------------------------------------------

export interface ConditionPollResult {
  meetsRefreshed: number;
  racesUpdated: number;
  offGoingDetected: number;
  /** New off-going transitions recorded this tick (deduped). */
  newAlerts: number;
  /** Pending alerts dispatched this tick (includes any from prior ticks). */
  alertsDispatched: number;
  emailsSent: number;
}

/**
 * Email every subscribed follower of an affected track for each pending
 * going alert, then mark those alerts dispatched. Failed sends are logged
 * but never re-queued mid-run; the alert is marked dispatched once attempted,
 * so a track change is emailed at most once per follower.
 */
async function dispatchPendingAlerts(): Promise<{
  alertsDispatched: number;
  emailsSent: number;
}> {
  const pending = await getPendingConditionAlerts();
  if (pending.length === 0) return { alertsDispatched: 0, emailsSent: 0 };

  const subscribers = (await getDigestEligibleUsers()).filter((eligible) =>
    isSubscriptionActive(eligible.subscription?.status),
  );

  const dispatched: string[] = [];
  let emailsSent = 0;
  for (const alert of pending) {
    const recipients = subscribers.filter((eligible) =>
      eligible.prefs.tracks.some(
        (track) => canonicalTrack(track) === alert.trackCanonical,
      ),
    );
    const email = renderConditionAlertEmail({
      trackName: alert.trackCanonical,
      surfaceKind: alert.surfaceKind === 'turf' ? 'turf' : 'dirt',
      condition: alert.condition,
      raceDate: alert.raceDate,
    });
    for (const recipient of recipients) {
      try {
        await sendEmail({
          to: recipient.user.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });
        emailsSent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[alert] send to ${recipient.user.email} failed: ${message}`);
      }
    }
    dispatched.push(alert.id);
  }
  await markConditionAlertsNotified(dispatched);
  return { alertsDispatched: dispatched.length, emailsSent };
}

/** Run one race-day condition poll: capture going, then alert on off-tracks. */
export async function runConditionPoll(
  opts: Parameters<typeof refreshRaceDayConditions>[0] = {},
): Promise<ConditionPollResult> {
  const refresh = await refreshRaceDayConditions(opts);
  const candidates = deriveConditionEvents(refresh.cards);

  let newAlerts = 0;
  if (candidates.length > 0) {
    const meetIdByProvider = await getMeetIdsByProvider([
      ...new Set(candidates.map((candidate) => candidate.providerMeetId)),
    ]);
    const rows: NewConditionAlertRow[] = [];
    for (const candidate of candidates) {
      const meetId = meetIdByProvider.get(candidate.providerMeetId);
      if (!meetId) continue;
      rows.push({
        meetId,
        trackCanonical: candidate.trackCanonical,
        raceDate: candidate.raceDate,
        surfaceKind: candidate.surfaceKind,
        condition: candidate.condition,
      });
    }
    newAlerts = (await insertConditionAlerts(rows)).length;
  }

  const dispatch = await dispatchPendingAlerts();
  return {
    meetsRefreshed: refresh.meetsRefreshed,
    racesUpdated: refresh.racesUpdated,
    offGoingDetected: candidates.length,
    newAlerts,
    alertsDispatched: dispatch.alertsDispatched,
    emailsSent: dispatch.emailsSent,
  };
}
