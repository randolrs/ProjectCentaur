import { redirect } from 'next/navigation';
import { getUserPreferences, getUserProfile } from '@/db/queries';
import { signOut } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const prefs = await getUserPreferences(user.id);
  if (!prefs) {
    redirect('/onboarding');
  }
  const profile = await getUserProfile(user.id);

  const rows: ReadonlyArray<readonly [string, string]> = [
    ['Tracks', prefs.tracks.join(', ')],
    ['Race classes', prefs.raceClasses.join(', ')],
    ['Distance ranges', prefs.distanceRanges.join(', ')],
    ['Surfaces', prefs.surfaces.join(', ')],
    ['Field size', prefs.fieldSizeBand],
    ['Bet types', prefs.betTypes.join(', ')],
    ['Bankroll tier', prefs.bankrollTier],
    ['Days per week', String(prefs.daysPerWeek)],
    ['Timezone', profile?.timezone ?? '—'],
  ];

  return (
    <main className="flex min-h-screen flex-col items-center bg-neutral-950 px-6 text-neutral-100">
      <div className="w-full max-w-xl space-y-6 py-16">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">
              Your profile
            </h1>
            <p className="text-sm text-neutral-400">{user.email}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:border-neutral-400"
            >
              Sign out
            </button>
          </form>
        </header>

        <p className="text-sm text-neutral-400">
          Your handicapping profile is saved. Your personalized morning digest
          starts once the digest pipeline ships (M4).
        </p>

        <dl className="divide-y divide-neutral-800 rounded-md border border-neutral-800">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-4 px-4 py-3 text-sm">
              <dt className="w-32 shrink-0 text-neutral-500">{label}</dt>
              <dd className="text-neutral-100">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </main>
  );
}
