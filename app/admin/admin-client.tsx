'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { DigestOutcome, DigestRunSummary } from '@/lib/digest/pipeline';
import { triggerDigest, triggerIngest } from './actions';
import type { DigestActionResult, IngestActionResult } from './types';

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

export function AdminConsole({ email }: { email: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [ingest, setIngest] = useState<IngestActionResult | null>(null);
  const [digest, setDigest] = useState<DigestActionResult | null>(null);

  async function runIngest() {
    setBusy('ingest');
    setIngest(await triggerIngest());
    setBusy(null);
  }

  async function runDigest(force: boolean) {
    setBusy(force ? 'digest-force' : 'digest-hourly');
    setDigest(await triggerDigest(force));
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
          <Link
            href="/dashboard"
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:border-neutral-400"
          >
            Dashboard
          </Link>
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
      </div>
    </main>
  );
}
