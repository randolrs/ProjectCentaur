'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { AdminUserListRow } from '@/db/queries';
import type { DigestOutcome, DigestRunSummary } from '@/lib/digest/pipeline';
import {
  getIngestedDay,
  triggerConditionPoll,
  triggerDigest,
  triggerDigestForEmail,
  triggerHistoryBackfill,
  triggerIngest,
  triggerSeedTracks,
} from './actions';
import type {
  ConditionPollActionResult,
  DigestActionResult,
  EmailDigestActionResult,
  IngestActionResult,
  IngestDayActionResult,
} from './types';

interface BackfillProgress {
  processedDays: number;
  entries: number;
  racesUpdated: number;
  entriesPlaced: number;
  errors: number;
  lastDate: string | null;
  done: boolean;
}

interface SeedProgress {
  daysScanned: number;
  meetsSeen: number;
  catalogTracks: number;
  done: boolean;
}

/** Today's date as YYYY-MM-DD for the date picker default. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const ONBOARDING_LABEL: Record<string, string> = {
  incomplete: 'incomplete',
  structured_complete: 'structured',
  conversation_complete: 'complete',
};

/** Active subscriptions read green; lapsed read amber; no subscription dim. */
function subscriptionStyle(status: string | null): string {
  if (status === 'active' || status === 'past_due') return 'text-emerald-400';
  if (!status) return 'text-neutral-500';
  return 'text-amber-400';
}

function formatDate(value: Date | string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
}

const OUTCOME_STYLE: Record<DigestOutcome, string> = {
  sent: 'text-emerald-400',
  already_done: 'text-neutral-400',
  skipped_no_races: 'text-amber-400',
  failed: 'text-red-400',
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function DigestSummary({ summary }: { summary: DigestRunSummary }) {
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Stat label="Onboarded" value={summary.considered} />
        <Stat label="Due" value={summary.due} />
        <Stat label="Sent" value={summary.sent} />
        <Stat label="Skipped" value={summary.skipped} />
        <Stat label="Failed" value={summary.failed} />
        <Stat label="Cost" value={`$${summary.totalCostUsd.toFixed(4)}`} />
      </dl>
      {summary.results.length > 0 && (
        <ul className="divide-y divide-neutral-800 rounded-md border border-neutral-800 text-sm">
          {summary.results.map((r) => (
            <li key={r.userId} className="space-y-1 px-3 py-2">
              <div className="flex flex-wrap items-center gap-x-3">
                <span className="text-neutral-100">{r.email}</span>
                <span className={OUTCOME_STYLE[r.outcome]}>{r.outcome}</span>
                <span className="text-neutral-500">
                  {r.raceCount} race{r.raceCount === 1 ? '' : 's'} · ${r.costUsd.toFixed(4)}
                  {r.generatedBy ? ` · ${r.generatedBy}` : ''}
                </span>
              </div>
              {r.error && <p className="text-xs text-red-400">{r.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Button({
  onClick,
  disabled,
  busy,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? 'Running…' : children}
    </button>
  );
}

export function AdminConsole({
  email,
  users,
}: {
  email: string;
  users: AdminUserListRow[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [ingest, setIngest] = useState<IngestActionResult | null>(null);
  const [tick, setTick] = useState<ConditionPollActionResult | null>(null);
  const [digest, setDigest] = useState<DigestActionResult | null>(null);
  const [day, setDay] = useState(todayIso());
  const [dayResult, setDayResult] = useState<IngestDayActionResult | null>(null);
  const [targetEmail, setTargetEmail] = useState('');
  const [emailResult, setEmailResult] =
    useState<EmailDigestActionResult | null>(null);
  const [backfillDays, setBackfillDays] = useState(60);
  const [backfillError, setBackfillError] = useState<string | null>(null);
  const [backfill, setBackfill] = useState<BackfillProgress | null>(null);
  const [seedDays, setSeedDays] = useState(365);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seed, setSeed] = useState<SeedProgress | null>(null);

  async function runIngest() {
    setBusy('ingest');
    setIngest(await triggerIngest());
    setBusy(null);
  }

  async function runTick() {
    setBusy('tick');
    setTick(await triggerConditionPoll());
    setBusy(null);
  }

  // Drive the resumable backfill chunk by chunk until the whole window is
  // covered, accumulating progress across each budgeted server call.
  async function runBackfill() {
    setBusy('backfill');
    setBackfillError(null);
    const totals: BackfillProgress = {
      processedDays: 0,
      entries: 0,
      racesUpdated: 0,
      entriesPlaced: 0,
      errors: 0,
      lastDate: null,
      done: false,
    };
    setBackfill({ ...totals });
    let remaining = backfillDays;
    let cursor: string | undefined;
    for (let chunk = 0; remaining > 0 && chunk < 120; chunk += 1) {
      let res: Awaited<ReturnType<typeof triggerHistoryBackfill>>;
      try {
        res = await triggerHistoryBackfill(remaining, cursor);
      } catch {
        setBackfillError(
          'A backfill chunk failed (likely a timeout). Re-run to resume — it picks up where it left off.',
        );
        break;
      }
      if (!res.ok) {
        setBackfillError(res.error);
        break;
      }
      const d = res.data;
      totals.processedDays += d.processed.length;
      totals.entries += d.entries;
      totals.racesUpdated += d.racesUpdated;
      totals.entriesPlaced += d.entriesPlaced;
      totals.errors += d.errors;
      totals.lastDate = d.processed.at(-1) ?? totals.lastDate;
      totals.done = d.done;
      setBackfill({ ...totals });
      if (d.done || !d.nextDate) break;
      cursor = d.nextDate;
      remaining = d.remainingDays;
    }
    setBusy(null);
  }

  // Drive the resumable track seed chunk by chunk until the whole window is
  // covered. `catalogTracks` reflects the live total after each upsert, so the
  // displayed count is the true distinct catalog size — not a sum of chunks.
  async function runSeedTracks() {
    setBusy('seed');
    setSeedError(null);
    const totals: SeedProgress = {
      daysScanned: 0,
      meetsSeen: 0,
      catalogTracks: 0,
      done: false,
    };
    setSeed({ ...totals });
    let remaining = seedDays;
    let cursor: string | undefined;
    for (let chunk = 0; remaining > 0 && chunk < 366; chunk += 1) {
      let res: Awaited<ReturnType<typeof triggerSeedTracks>>;
      try {
        res = await triggerSeedTracks(remaining, cursor);
      } catch {
        setSeedError(
          'A seed chunk failed (likely a timeout). Re-run to resume — it picks up where it left off.',
        );
        break;
      }
      if (!res.ok) {
        setSeedError(res.error);
        break;
      }
      const d = res.data;
      totals.daysScanned += d.daysScanned;
      totals.meetsSeen += d.meetsSeen;
      totals.catalogTracks = d.catalogTracks;
      totals.done = d.done;
      setSeed({ ...totals });
      if (d.done || !d.nextDate) break;
      cursor = d.nextDate;
      remaining = d.remainingDays;
    }
    setBusy(null);
  }

  async function runDigest(force: boolean) {
    setBusy(force ? 'digest-force' : 'digest-hourly');
    setDigest(await triggerDigest(force));
    setBusy(null);
  }

  async function lookUpDay() {
    setBusy('day');
    setDayResult(await getIngestedDay(day));
    setBusy(null);
  }

  async function sendToEmail() {
    setBusy('email');
    setEmailResult(await triggerDigestForEmail(targetEmail));
    setBusy(null);
  }

  const locked = busy !== null;

  return (
    <main className="flex min-h-screen flex-col items-center bg-neutral-950 px-6 text-neutral-100">
      <div className="w-full max-w-xl space-y-8 py-16">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Admin console</h1>
            <p className="text-sm text-neutral-400">{email}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/admin/races"
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:border-neutral-400"
            >
              Browse data
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:border-neutral-400"
            >
              Dashboard
            </Link>
          </div>
        </header>

        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Race ingestion</h2>
            <p className="text-sm text-neutral-400">
              Fetch today&apos;s US racecards and upsert them into the{' '}
              <code className="text-neutral-300">races</code> table. Run this
              before a digest — the digest has nothing to select otherwise.
            </p>
          </div>
          <Button onClick={runIngest} disabled={locked} busy={busy === 'ingest'}>
            Ingest today&apos;s races
          </Button>
          {ingest &&
            (ingest.ok ? (
              <div className="space-y-1 text-sm">
                <p className="text-emerald-400">
                  Ingested {ingest.data.races} race
                  {ingest.data.races === 1 ? '' : 's'} for {ingest.data.date}.
                </p>
                <p className="text-neutral-500">
                  {ingest.data.tracks} tracks · {ingest.data.meets} meets ·{' '}
                  {ingest.data.entries} entries · {ingest.data.horses} horses ·{' '}
                  {ingest.data.jockeys} jockeys · {ingest.data.trainers}{' '}
                  trainers
                </p>
              </div>
            ) : (
              <p className="text-sm text-red-400">{ingest.error}</p>
            ))}
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Condition poll</h2>
            <p className="text-sm text-neutral-400">
              Run one race-day tick now — the same work the{' '}
              <code className="text-neutral-300">*/15</code> cron does: refresh
              going for meets about to post, capture it into{' '}
              <code className="text-neutral-300">surface_condition</code>, and
              email subscribed followers when a track turns off (Sloppy, Off
              Turf…). A no-op outside racing hours.
            </p>
          </div>
          <Button onClick={runTick} disabled={locked} busy={busy === 'tick'}>
            Run tick now
          </Button>
          {tick &&
            (tick.ok ? (
              <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                <Stat label="Meets" value={tick.data.meetsRefreshed} />
                <Stat label="Races" value={tick.data.racesUpdated} />
                <Stat label="Off going" value={tick.data.offGoingDetected} />
                <Stat label="New alerts" value={tick.data.newAlerts} />
                <Stat label="Dispatched" value={tick.data.alertsDispatched} />
                <Stat label="Emails" value={tick.data.emailsSent} />
              </dl>
            ) : (
              <p className="text-sm text-red-400">{tick.error}</p>
            ))}
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Backfill history</h2>
            <p className="text-sm text-neutral-400">
              Replay past racing days — ingest each day&apos;s cards, then its
              results — to bootstrap the rolling form memory. Runs in budgeted
              chunks and resumes automatically until the whole window is
              covered. Safe to re-run; every step is idempotent.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={120}
              value={backfillDays}
              onChange={(event) =>
                setBackfillDays(Number(event.target.value) || 0)
              }
              disabled={locked}
              className="w-20 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm disabled:opacity-50"
            />
            <span className="text-sm text-neutral-500">days back</span>
            <Button
              onClick={runBackfill}
              disabled={locked}
              busy={busy === 'backfill'}
            >
              Run backfill
            </Button>
          </div>
          {backfill && (
            <div className="space-y-2">
              <p
                className={
                  backfill.done ? 'text-sm text-emerald-400' : 'text-sm text-neutral-300'
                }
              >
                {backfill.done ? 'Backfill complete.' : 'Backfilling…'}{' '}
                {backfill.processedDays} day
                {backfill.processedDays === 1 ? '' : 's'} processed
                {backfill.lastDate ? ` (through ${backfill.lastDate})` : ''}.
              </p>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Entries" value={backfill.entries} />
                <Stat label="Races resulted" value={backfill.racesUpdated} />
                <Stat label="Placed" value={backfill.entriesPlaced} />
                <Stat label="Errors" value={backfill.errors} />
              </dl>
            </div>
          )}
          {backfillError && <p className="text-sm text-red-400">{backfillError}</p>}
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Seed track catalog</h2>
            <p className="text-sm text-neutral-400">
              Scan the meets feed (no entries fetch) over the chosen window and
              upsert every distinct track into the{' '}
              <code className="text-neutral-300">tracks</code> table — the
              vocabulary onboarding and digest matching read from. Wager pools
              are filtered out. Runs in budgeted chunks and resumes
              automatically. Safe to re-run; idempotent on the track name.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={366}
              value={seedDays}
              onChange={(event) => setSeedDays(Number(event.target.value) || 0)}
              disabled={locked}
              className="w-20 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm disabled:opacity-50"
            />
            <span className="text-sm text-neutral-500">days back</span>
            <Button
              onClick={runSeedTracks}
              disabled={locked}
              busy={busy === 'seed'}
            >
              Seed tracks
            </Button>
          </div>
          {seed && (
            <div className="space-y-2">
              <p
                className={
                  seed.done ? 'text-sm text-emerald-400' : 'text-sm text-neutral-300'
                }
              >
                {seed.done ? 'Seed complete.' : 'Seeding…'} {seed.daysScanned} day
                {seed.daysScanned === 1 ? '' : 's'} scanned.
              </p>
              <dl className="grid grid-cols-2 gap-2">
                <Stat label="Meets seen" value={seed.meetsSeen} />
                <Stat label="Tracks in catalog" value={seed.catalogTracks} />
              </dl>
            </div>
          )}
          {seedError && <p className="text-sm text-red-400">{seedError}</p>}
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Digest delivery</h2>
            <p className="text-sm text-neutral-400">
              <strong className="text-neutral-200">Force send</strong> delivers
              to every onboarded user now, ignoring their delivery hour.{' '}
              <strong className="text-neutral-200">Hourly logic</strong> mirrors
              the cron — only users due this hour. Both skip a user who already
              has a digest for today.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => runDigest(true)}
              disabled={locked}
              busy={busy === 'digest-force'}
            >
              Force send to all users
            </Button>
            <Button
              onClick={() => runDigest(false)}
              disabled={locked}
              busy={busy === 'digest-hourly'}
            >
              Run hourly logic
            </Button>
          </div>
          {digest &&
            (digest.ok ? (
              <DigestSummary summary={digest.data} />
            ) : (
              <p className="text-sm text-red-400">{digest.error}</p>
            ))}
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Ingested data by day</h2>
            <p className="text-sm text-neutral-400">
              Inspect the races and entries stored for a racing day, broken
              down by track.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={day}
              onChange={(event) => setDay(event.target.value)}
              disabled={locked}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm disabled:opacity-50"
            />
            <Button onClick={lookUpDay} disabled={locked} busy={busy === 'day'}>
              Look up
            </Button>
          </div>
          {dayResult &&
            (dayResult.ok ? (
              dayResult.data.raceCount === 0 ? (
                <p className="text-sm text-amber-400">
                  Nothing ingested for {dayResult.data.date}.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-emerald-400">
                    {dayResult.data.raceCount} races ·{' '}
                    {dayResult.data.entryCount} entries across{' '}
                    {dayResult.data.tracks.length} tracks for{' '}
                    {dayResult.data.date}.
                  </p>
                  <ul className="divide-y divide-neutral-800 rounded-md border border-neutral-800 text-sm">
                    {dayResult.data.tracks.map((track) => (
                      <li
                        key={track.track}
                        className="flex justify-between px-3 py-2"
                      >
                        <span className="text-neutral-100">{track.track}</span>
                        <span className="tabular-nums text-neutral-500">
                          {track.races} race{track.races === 1 ? '' : 's'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            ) : (
              <p className="text-sm text-red-400">{dayResult.error}</p>
            ))}
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Send a digest to one email</h2>
            <p className="text-sm text-neutral-400">
              Build and deliver the digest for a single onboarded user, for
              their current racing day. This always sends — even if that user
              already received a digest today.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="email"
              value={targetEmail}
              onChange={(event) => setTargetEmail(event.target.value)}
              placeholder="user@example.com"
              disabled={locked}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm placeholder:text-neutral-600 disabled:opacity-50"
            />
            <Button
              onClick={sendToEmail}
              disabled={locked}
              busy={busy === 'email'}
            >
              Send digest
            </Button>
          </div>
          {emailResult &&
            (emailResult.ok ? (
              <div className="space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-x-3">
                  <span className="text-neutral-100">
                    {emailResult.data.email}
                  </span>
                  <span className={OUTCOME_STYLE[emailResult.data.outcome]}>
                    {emailResult.data.outcome}
                  </span>
                  <span className="text-neutral-500">
                    {emailResult.data.raceCount} race
                    {emailResult.data.raceCount === 1 ? '' : 's'} · $
                    {emailResult.data.costUsd.toFixed(4)}
                    {emailResult.data.generatedBy
                      ? ` · ${emailResult.data.generatedBy}`
                      : ''}
                  </span>
                </div>
                {emailResult.data.error && (
                  <p className="text-xs text-red-400">
                    {emailResult.data.error}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-red-400">{emailResult.error}</p>
            ))}
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Users ({users.length})</h2>
            <p className="text-sm text-neutral-400">
              Every account, newest first, with onboarding and subscription
              status.
            </p>
          </div>
          {users.length === 0 ? (
            <p className="text-sm text-neutral-500">No users yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-neutral-800">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-neutral-500">
                  <tr className="border-b border-neutral-800">
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Onboarding</th>
                    <th className="px-3 py-2 font-medium">Subscription</th>
                    <th className="px-3 py-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-3 py-2 text-neutral-100">{u.email}</td>
                      <td className="px-3 py-2 text-neutral-400">
                        {ONBOARDING_LABEL[u.onboardingStatus] ??
                          u.onboardingStatus}
                      </td>
                      <td className="px-3 py-2">
                        <span className={subscriptionStyle(u.subscriptionStatus)}>
                          {u.subscriptionStatus ?? 'none'}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-neutral-500">
                        {formatDate(u.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
