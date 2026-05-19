import { redirect } from 'next/navigation';
import { getCanonicalTracks, getUserPreferences } from '@/db/queries';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { createClient } from '@/lib/supabase/server';
import { OnboardingWizard } from './onboarding-wizard';

export default async function OnboardingPage({
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

  // Structured onboarding is one-time; once it's done the user moves on to
  // the M2 conversational onboarding.
  const existing = await getUserPreferences(user.id);
  if (existing) {
    redirect('/onboarding/conversation');
  }

  const trackOptions = await getCanonicalTracks();
  const sp = await searchParams;
  const error = firstParam(sp.error);

  return (
    <main className="flex min-h-screen flex-col items-center bg-neutral-950 px-6 text-neutral-100">
      <div className="w-full max-w-xl space-y-6 py-16">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Set up your handicapping profile
          </h1>
          <p className="text-sm text-neutral-400">
            A few quick questions, one at a time. Skip any you don&apos;t want
            to narrow down.
          </p>
        </header>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <OnboardingWizard trackOptions={trackOptions} />
      </div>
    </main>
  );
}
