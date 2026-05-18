import { redirect } from 'next/navigation';
import { PreferencesFields } from '@/app/_components/preferences-fields';
import { getUserPreferences } from '@/db/queries';
import { saveOnboarding } from '@/lib/actions/onboarding';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { createClient } from '@/lib/supabase/server';

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
            This tells Furlong which races to surface each morning. You can
            refine it later.
          </p>
        </header>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <form action={saveOnboarding} className="space-y-6">
          <PreferencesFields />
          <button
            type="submit"
            className="w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white"
          >
            Save profile
          </button>
        </form>
      </div>
    </main>
  );
}
