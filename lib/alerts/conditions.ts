import { canonicalTrack } from '@/lib/racing/canonical';
import type { Racecard } from '@/lib/racing/types';

// ---------------------------------------------------------------------------
// Race-day going alerts.
//
// The provider fills `track_condition` only on race day, so the race-day
// refresh is the first time we see a track's going. A track opening — or
// turning — "off" (Sloppy, Muddy, Off Turf, Yielding, …) is the single
// biggest day-of change a handicapper reacts to, so we surface it. "Fast"
// (dirt) and "Firm" (turf) are the normal states and never alert.
// ---------------------------------------------------------------------------

export type SurfaceKind = 'dirt' | 'turf';

/** Going values that are NOT worth an alert — the normal, expected states. */
const NORMAL_GOING: ReadonlySet<string> = new Set(['fast', 'firm', 'standard']);

/** True when a going string represents an off/wet track worth flagging. */
export function isOffGoing(raw: string | null | undefined): boolean {
  const going = (raw ?? '').trim().toLowerCase();
  if (going === '') return false;
  return !NORMAL_GOING.has(going);
}

/** Which surface a card runs on, for grouping going changes. */
export function surfaceKindOf(surface: string | null | undefined): SurfaceKind {
  return /turf|grass/i.test(surface ?? '') ? 'turf' : 'dirt';
}

export interface ConditionEventCandidate {
  providerMeetId: string;
  trackCanonical: string;
  raceDate: string;
  surfaceKind: SurfaceKind;
  /** The off-going value as the provider wrote it, e.g. "Sloppy". */
  condition: string;
}

/**
 * Distinct off-going transitions in a freshly fetched set of cards, one per
 * (meet, surface, going) — a track turning Sloppy on the dirt and Off Turf on
 * the grass yields two candidates. Normal going (Fast/Firm) is ignored.
 */
export function deriveConditionEvents(
  cards: Racecard[],
): ConditionEventCandidate[] {
  const seen = new Set<string>();
  const out: ConditionEventCandidate[] = [];
  for (const card of cards) {
    const condition = (card.trackCondition ?? '').trim();
    if (!isOffGoing(condition)) continue;
    const surfaceKind = surfaceKindOf(card.surface);
    const key = `${card.providerMeetId}|${surfaceKind}|${condition.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      providerMeetId: card.providerMeetId,
      trackCanonical: canonicalTrack(card.track),
      raceDate: card.raceDate,
      surfaceKind,
      condition,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Email rendering — inline styles only (email clients ignore <style> blocks).
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function displayDate(raceDate: string): string {
  const parsed = new Date(`${raceDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return raceDate;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

export interface ConditionAlertEmailInput {
  trackName: string;
  surfaceKind: SurfaceKind;
  condition: string;
  raceDate: string;
  /** When set, append a subscribe call to action (unused for subscribers). */
  upgradeUrl?: string;
}

export interface RenderedAlertEmail {
  subject: string;
  html: string;
  text: string;
}

/** One going-change alert as a deliverable email. */
export function renderConditionAlertEmail(
  input: ConditionAlertEmailInput,
): RenderedAlertEmail {
  const where = input.surfaceKind === 'turf' ? 'turf course' : 'main track';
  const offTurf = /off\s*turf/i.test(input.condition);
  const headline = offTurf
    ? `${input.trackName}: turf races coming off the grass`
    : `${input.trackName} ${where} is now ${input.condition}`;
  const subject = offTurf
    ? `Off Turf at ${input.trackName} — ${displayDate(input.raceDate)}`
    : `${input.trackName} going change: ${input.condition}`;
  const body = offTurf
    ? `Rain has moved ${input.trackName}'s turf racing off the grass. Watch for scratches and a reshaped pace, and recheck any turf-route angle before you commit.`
    : `The ${where} at ${input.trackName} is now playing ${input.condition}. Surface bias and pace can shift on an off track — worth a second look before you size up.`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;">
        <tr><td style="padding:32px 32px 24px 32px;">
          <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#999999;">
            ${escapeHtml(displayDate(input.raceDate))} · going change
          </div>
          <h1 style="font-size:20px;color:#111111;margin:8px 0 0 0;">${escapeHtml(headline)}</h1>
          <p style="font-size:14px;line-height:1.6;color:#333333;margin:16px 0 0 0;">
            ${escapeHtml(body)}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `${displayDate(input.raceDate)} — going change`,
    '',
    headline,
    '',
    body,
  ].join('\n');

  return { subject, html, text };
}
