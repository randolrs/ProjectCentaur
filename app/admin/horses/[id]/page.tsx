import { notFound } from 'next/navigation';
import { AdminShell } from '@/app/admin/_components/admin-shell';
import { AppearanceList } from '@/app/admin/_components/appearance-list';
import { getHorseWithEntries } from '@/db/queries';

export default async function AdminHorsePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getHorseWithEntries(id);
  if (!data) notFound();
  const { horse, appearances } = data;

  const pedigree = [
    horse.sireName ? `Sire: ${horse.sireName}` : null,
    horse.damName ? `Dam: ${horse.damName}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <AdminShell
      title={horse.name}
      subtitle={pedigree || undefined}
      backHref="/admin/races"
      backLabel="Races"
    >
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          Race entries ({appearances.length})
        </h2>
        <AppearanceList appearances={appearances} omit="horse" />
      </section>
    </AdminShell>
  );
}
