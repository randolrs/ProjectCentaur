import Link from 'next/link';
import { AdminShell } from '@/app/admin/_components/admin-shell';
import { getRacesForDate } from '@/db/queries';
import { firstParam, type SearchParams } from '@/lib/search-params';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function AdminRacesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const date = firstParam(sp.date) ?? todayIso();
  const races = await getRacesForDate(date);

  return (
    <AdminShell
      title="Races"
      subtitle={`${races.length} ingested for ${date}`}
      backHref="/admin"
      backLabel="Admin console"
    >
      <form className="flex gap-2">
        <input
          type="date"
          name="date"
          defaultValue={date}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:border-neutral-400"
        >
          Go
        </button>
      </form>

      {races.length === 0 ? (
        <p className="text-sm text-amber-400">Nothing ingested for {date}.</p>
      ) : (
        <ul className="divide-y divide-neutral-800 rounded-md border border-neutral-800 text-sm">
          {races.map((race) => (
            <li key={race.id}>
              <Link
                href={`/admin/races/${race.id}`}
                className="flex flex-wrap items-center justify-between gap-x-3 px-3 py-2 hover:bg-neutral-900"
              >
                <span className="text-neutral-100">
                  {race.trackCanonical} — Race {race.raceNumber ?? '?'}
                </span>
                <span className="text-neutral-500">
                  {[race.raceClassCanonical, race.surfaceCanonical, race.postTime]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
