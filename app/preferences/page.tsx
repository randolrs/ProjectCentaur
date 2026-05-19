import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PreferencesFields } from '@/app/_components/preferences-fields';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  getCanonicalTracks,
  getUserPreferences,
  getUserProfile,
} from '@/db/queries';
import { updatePreferences } from '@/lib/actions/onboarding';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { createClient } from '@/lib/supabase/server';

export default async function PreferencesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
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
  const trackOptions = await getCanonicalTracks();

  const sp = await searchParams;
  const error = firstParam(sp.error);

  const current = {
    // Drop any followed tracks no longer in the synced data model.
    tracks: prefs.tracks.filter((t) => trackOptions.includes(t)),
    raceClasses: prefs.raceClasses,
    distanceRanges: prefs.distanceRanges,
    surfaces: prefs.surfaces,
    fieldSizeBand: prefs.fieldSizeBand,
    betTypes: prefs.betTypes,
    activeDays: prefs.activeDays,
    timezone: profile?.timezone ?? '',
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-neutral-950 px-6 text-neutral-100">
      <div className="w-full max-w-xl space-y-6 py-16">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Edit your preferences
          </h1>
          <p className="text-sm text-neutral-400">
            Changes apply to your next morning digest.
          </p>
        </header>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <form action={updatePreferences} className="space-y-6">
          <PreferencesFields current={current} trackOptions={trackOptions} />
          <div className="flex gap-2">
            <SubmitButton
              pendingText="Saving…"
              className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
            >
              Save changes
            </SubmitButton>
            <Link
              href="/dashboard"
              className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:border-neutral-400"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
