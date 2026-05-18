import Link from 'next/link';
import type { RaceEntryAppearance } from '@/db/queries';

/**
 * A list of race entries, each linking to its race and connections. `omit`
 * drops the column for the entity whose page is already being viewed.
 */
export function AppearanceList({
  appearances,
  omit,
}: {
  appearances: RaceEntryAppearance[];
  omit?: 'horse' | 'jockey' | 'trainer';
}) {
  if (appearances.length === 0) {
    return <p className="text-sm text-neutral-500">No race entries yet.</p>;
  }

  return (
    <ul className="divide-y divide-neutral-800 rounded-md border border-neutral-800 text-sm">
      {appearances.map(({ entry, race, horse, jockey, trainer }) => (
        <li key={entry.id} className="space-y-1 px-3 py-2">
          <div className="flex flex-wrap items-center gap-x-3">
            <span className="tabular-nums text-neutral-500">{race.raceDate}</span>
            <Link
              href={`/admin/races/${race.id}`}
              className="text-neutral-100 underline hover:text-white"
            >
              {race.trackCanonical} R{race.raceNumber ?? '?'}
            </Link>
            {entry.programNumber && (
              <span className="text-neutral-500">#{entry.programNumber}</span>
            )}
            {entry.scratched && <span className="text-amber-400">scratched</span>}
          </div>
          <div className="flex flex-wrap gap-x-3 text-neutral-400">
            {omit !== 'horse' && (
              <Link
                href={`/admin/horses/${horse.id}`}
                className="underline hover:text-neutral-100"
              >
                {horse.name}
              </Link>
            )}
            {omit !== 'jockey' && jockey && (
              <Link
                href={`/admin/jockeys/${jockey.id}`}
                className="underline hover:text-neutral-100"
              >
                J: {jockey.name}
              </Link>
            )}
            {omit !== 'trainer' && trainer && (
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
  );
}
