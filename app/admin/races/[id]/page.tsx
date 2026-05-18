import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminShell } from '@/app/admin/_components/admin-shell';
import { getRaceWithEntries } from '@/db/queries';

export default async function AdminRacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getRaceWithEntries(id);
  if (!data) notFound();
  const { race, entries } = data;

  const facts: ReadonlyArray<readonly [string, string]> = [
    ['Track', race.track],
    ['Date', race.raceDate],
    ['Post time', race.postTime ?? '—'],
    [
      'Surface',
      [race.surface, race.surfaceCanonical].filter(Boolean).join(' · ') || '—',
    ],
    [
      'Distance',
      [race.distance, race.distanceFurlongs ? `${race.distanceFurlongs}f` : null]
        .filter(Boolean)
        .join(' · ') || '—',
    ],
    [
      'Class',
      [race.raceClass, race.raceClassCanonical].filter(Boolean).join(' · ') ||
        '—',
    ],
    ['Purse', race.purse ? `$${race.purse.toLocaleString('en-US')}` : '—'],
    ['Field size', String(race.fieldSize)],
    ['Conditions', race.conditions ?? '—'],
  ];

  return (
    <AdminShell
      title={`${race.trackCanonical} — Race ${race.raceNumber ?? '?'}`}
      subtitle={race.raceDate}
      backHref={`/admin/races?date=${race.raceDate}`}
      backLabel="Races"
    >
      <dl className="divide-y divide-neutral-800 rounded-md border border-neutral-800">
        {facts.map(([key, value]) => (
          <div key={key} className="flex gap-4 px-4 py-2.5 text-sm">
            <dt className="w-28 shrink-0 text-neutral-500">{key}</dt>
            <dd className="text-neutral-100">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Entries ({entries.length})</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-neutral-500">No entries.</p>
        ) : (
          <ul className="divide-y divide-neutral-800 rounded-md border border-neutral-800 text-sm">
            {entries.map(({ entry, horse, jockey, trainer }) => (
              <li key={entry.id} className="space-y-1 px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-3">
                  {entry.programNumber && (
                    <span className="tabular-nums text-neutral-500">
                      #{entry.programNumber}
                    </span>
                  )}
                  <Link
                    href={`/admin/horses/${horse.id}`}
                    className="text-neutral-100 underline hover:text-white"
                  >
                    {horse.name}
                  </Link>
                  {entry.morningLineOdds && (
                    <span className="text-neutral-500">
                      ML {entry.morningLineOdds}
                    </span>
                  )}
                  {entry.scratched && (
                    <span className="text-amber-400">scratched</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 text-neutral-400">
                  {jockey && (
                    <Link
                      href={`/admin/jockeys/${jockey.id}`}
                      className="underline hover:text-neutral-100"
                    >
                      J: {jockey.name}
                    </Link>
                  )}
                  {trainer && (
                    <Link
                      href={`/admin/trainers/${trainer.id}`}
                      className="underline hover:text-neutral-100"
                    >
                      T: {trainer.name}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
