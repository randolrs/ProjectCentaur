import { notFound } from 'next/navigation';
import { AdminShell } from '@/app/admin/_components/admin-shell';
import { AppearanceList } from '@/app/admin/_components/appearance-list';
import { getTrainerWithEntries } from '@/db/queries';

export default async function AdminTrainerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getTrainerWithEntries(id);
  if (!data) notFound();
  const { trainer, appearances } = data;

  return (
    <AdminShell
      title={trainer.name}
      subtitle="Trainer"
      backHref="/admin/races"
      backLabel="Races"
    >
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Runners ({appearances.length})</h2>
        <AppearanceList appearances={appearances} omit="trainer" />
      </section>
    </AdminShell>
  );
}
