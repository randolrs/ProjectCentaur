// ---------------------------------------------------------------------------
// Connection + form stats for the digest prompt.
//
// These are computed from race results this product has recorded (the
// `finish_position` / `result_recorded_at` fields ingestion stamps onto
// `race_entries`). The queries in `db/queries.ts` return the raw records; the
// pure helpers here assemble and format them for the prompt, gating small
// samples so the model is never handed an unreliable percentage.
// ---------------------------------------------------------------------------

/** Trailing window for trainer / jockey win-rate, in days. */
export const CONNECTION_WINDOW_DAYS = 365;

/** Below this many resulted starts a win-rate is shown raw, without a percent. */
export const MIN_STARTS_FOR_PCT = 10;

/** How many recent finishes to show in a horse's form line. */
export const FORM_RACES = 6;

/** A trainer's or jockey's resulted record over the trailing window. */
export interface ConnectionRecord {
  starts: number;
  wins: number;
}

/** One resulted finish for a horse — position is null when it ran off the board. */
export interface HorseFinish {
  raceDate: string;
  finishPosition: number | null;
}

/** A horse's recent-form summary, assembled from its resulted finishes. */
export interface HorseForm {
  starts: number;
  wins: number;
  /** Recent finishes, most recent first; capped at FORM_RACES. */
  finishes: (number | null)[];
  /** Days from the horse's last start to the race date, or null with no history. */
  daysSinceLastStart: number | null;
}

/** Per-runner stats attached to a scored race for the prompt. */
export interface RunnerStats {
  jockey: ConnectionRecord | null;
  trainer: ConnectionRecord | null;
  horse: HorseForm | null;
}

/** The window's start date (YYYY-MM-DD), `days` before `asOfDate`. */
export function windowStartDate(
  asOfDate: string,
  days = CONNECTION_WINDOW_DAYS,
): string {
  const d = new Date(`${asOfDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromDate: string, toDate: string): number {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/**
 * Assemble a horse's form from its resulted finishes (passed most-recent
 * first). An empty list yields a zero-start form, which the formatter omits.
 */
export function buildHorseForm(
  finishes: HorseFinish[],
  asOfDate: string,
  formRaces = FORM_RACES,
): HorseForm {
  const last = finishes[0]?.raceDate ?? null;
  return {
    starts: finishes.length,
    wins: finishes.filter((f) => f.finishPosition === 1).length,
    finishes: finishes.slice(0, formRaces).map((f) => f.finishPosition),
    daysSinceLastStart: last === null ? null : daysBetween(last, asOfDate),
  };
}

function winPct(wins: number, starts: number): number {
  return Math.round((wins / starts) * 100);
}

/**
 * A connection's win-rate segment, or null with no recorded starts. Under
 * MIN_STARTS_FOR_PCT the raw `wins/starts` is shown instead of a percent so a
 * tiny sample never reads as a headline rate.
 */
export function formatConnection(
  label: string,
  rec: ConnectionRecord | null,
): string | null {
  if (!rec || rec.starts === 0) return null;
  if (rec.starts < MIN_STARTS_FOR_PCT) return `${label} ${rec.wins}/${rec.starts}`;
  return `${label} ${winPct(rec.wins, rec.starts)}% (${rec.wins}/${rec.starts})`;
}

function finishIndicator(pos: number | null): string {
  return pos === null ? 'x' : String(pos);
}

/** A horse's form segment (`form 1-2-x (12 starts, off 21d)`), or null with no history. */
export function formatHorseForm(form: HorseForm | null): string | null {
  if (!form || form.starts === 0) return null;
  const line = form.finishes.map(finishIndicator).join('-');
  const detail = [`${form.starts} ${form.starts === 1 ? 'start' : 'starts'}`];
  if (form.daysSinceLastStart !== null) {
    detail.push(`off ${form.daysSinceLastStart}d`);
  }
  return `form ${line} (${detail.join(', ')})`;
}

/** Stat segments to append to a runner line — form first, then the connections. */
export function runnerStatSegments(stats: RunnerStats | undefined): string[] {
  if (!stats) return [];
  return [
    formatHorseForm(stats.horse),
    formatConnection('J', stats.jockey),
    formatConnection('T', stats.trainer),
  ].filter((segment): segment is string => segment !== null);
}
