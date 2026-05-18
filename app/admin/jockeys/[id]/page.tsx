import { notFound } from 'next/navigation';
import { AdminShell } from '@/app/admin/_components/admin-shell';
import { AppearanceList } from '@/app/admin/_components/appearance-list';
import { getJockeyWithEntries } from '@/db/queries';

export default async function AdminJockeyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getJockeyWithEntries(id);
  if (!data) notFound();
  const { jockey, appearances } = data;

  return (
    <AdminShell
      title={jockey.name}
      subtitle="Jockey"
      backHref="/admin/races"
      backLabel="Races"
    >
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Mounts ({appearances.length})</h2>
        <AppearanceList appearances={appearances} omit="jockey" />
      </section>
    </AdminShell>
  );
}
