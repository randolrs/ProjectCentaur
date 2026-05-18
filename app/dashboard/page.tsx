import Link from 'next/link';
import { redirect } from 'next/navigation';
import { openBillingPortal } from '@/app/subscribe/actions';
import {
  getHandicapperProfile,
  getSubscription,
  getUserPreferences,
  getUserProfile,
} from '@/db/queries';
import { signOut } from '@/lib/actions/auth';
import { isAdminEmail } from '@/lib/admin';
import { isSubscriptionActive } from '@/lib/stripe/subscription';
import { createClient } from '@/lib/supabase/server';

/** Calendar date, e.g. "May 18, 2026". */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

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

  // The conversational onboarding must be completed before the dashboard.
  const handicapper = await getHandicapperProfile(user.id);
  if (!handicapper) {
    redirect('/onboarding/conversation');
  }
  const profile = await getUserProfile(user.id);
  const subscription = await getSubscription(user.id);
  const subscribed = isSubscriptionActive(subscription?.status);

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
          <div className="flex shrink-0 items-center gap-2">
            {isAdminEmail(user.email) && (
              <Link
                href="/admin"
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:border-neutral-400"
              >
                Admin
              </Link>
            )}
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:border-neutral-400"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <p className="text-sm text-neutral-400">
          Your handicapping profile is saved. Each morning we email you a
          personalized digest of races at your tracks that fit how you play.
        </p>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Subscription</h2>
          {subscribed ? (
            <div className="flex items-center justify-between gap-4 rounded-md border border-neutral-800 bg-neutral-900 p-4">
              <div className="text-sm">
                <p className="font-medium text-emerald-400">Active</p>
                {subscription?.currentPeriodEnd && (
                  <p className="text-neutral-500">
                    {subscription.cancelAtPeriodEnd ? 'Cancels' : 'Renews'}{' '}
                    {formatDate(subscription.currentPeriodEnd)}
                  </p>
                )}
              </div>
              <form action={openBillingPortal}>
                <button
                  type="submit"
                  className="shrink-0 rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:border-neutral-400"
                >
                  Manage billing
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-3 rounded-md border border-amber-900/60 bg-amber-950/30 p-4">
              <p className="text-sm text-amber-200">
                You won&apos;t receive your morning digest until you subscribe.
              </p>
              <Link
                href="/subscribe"
                className="inline-block rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-semibold text-neutral-950 hover:bg-white"
              >
                Subscribe
              </Link>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">How you play</h2>
          <p className="rounded-md border border-neutral-800 bg-neutral-900 p-4 text-sm leading-relaxed text-neutral-100">
            {handicapper.styleSummary}
          </p>
        </section>

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
