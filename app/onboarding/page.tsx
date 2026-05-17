import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getUserPreferences } from '@/db/queries';
import { saveOnboarding } from '@/lib/actions/onboarding';
import {
  BANKROLL_TIER_OPTIONS,
  BET_TYPE_OPTIONS,
  DAYS_PER_WEEK_OPTIONS,
  DISTANCE_RANGE_OPTIONS,
  FIELD_SIZE_BAND_OPTIONS,
  type Option,
  RACE_CLASS_OPTIONS,
  SURFACE_OPTIONS,
  TIMEZONE_OPTIONS,
  TRACK_OPTIONS,
} from '@/lib/onboarding/options';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { createClient } from '@/lib/supabase/server';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-neutral-800 pt-6">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-neutral-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function CheckboxGroup({
  name,
  options,
}: {
  name: string;
  options: readonly Option[];
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <label key={option.value} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            value={option.value}
            className="accent-neutral-100"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

function RadioGroup({
  name,
  options,
}: {
  name: string;
  options: readonly Option[];
}) {
  return (
    <div className="space-y-2">
      {options.map((option) => (
        <label key={option.value} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={name}
            value={option.value}
            required
            className="accent-neutral-100"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

const selectClass =
  'w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-400';

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

  const trackOptions: Option[] = TRACK_OPTIONS.map((track) => ({
    value: track,
    label: track,
  }));

  return (
    <main className="flex min-h-screen flex-col items-center bg-neutral-950 px-6 text-neutral-100">
      <div className="w-full max-w-xl space-y-6 py-16">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Set up your handicapping profile
          </h1>
          <p className="text-sm text-neutral-400">
            This tells [PRODUCT_NAME] which races to surface each morning. You
            can refine it later.
          </p>
        </header>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <form action={saveOnboarding} className="space-y-6">
          <Section
            title="Tracks"
            description="Which tracks do you want covered? Pick at least one."
          >
            <CheckboxGroup name="tracks" options={trackOptions} />
          </Section>

          <Section
            title="Race classes"
            description="Which class levels do you play?"
          >
            <CheckboxGroup name="raceClasses" options={RACE_CLASS_OPTIONS} />
          </Section>

          <Section
            title="Distance ranges"
            description="Sprints, routes, or longer."
          >
            <CheckboxGroup
              name="distanceRanges"
              options={DISTANCE_RANGE_OPTIONS}
            />
          </Section>

          <Section title="Surfaces" description="Which surfaces do you follow?">
            <CheckboxGroup name="surfaces" options={SURFACE_OPTIONS} />
          </Section>

          <Section
            title="Field size"
            description="Field size you most like to bet into."
          >
            <RadioGroup name="fieldSizeBand" options={FIELD_SIZE_BAND_OPTIONS} />
          </Section>

          <Section
            title="Bet types"
            description="Which wagers do you typically make?"
          >
            <CheckboxGroup name="betTypes" options={BET_TYPE_OPTIONS} />
          </Section>

          <Section
            title="Bankroll"
            description="Roughly what bankroll do you play with?"
          >
            <RadioGroup name="bankrollTier" options={BANKROLL_TIER_OPTIONS} />
          </Section>

          <Section
            title="Days per week"
            description="How many days a week are you active?"
          >
            <select
              name="daysPerWeek"
              required
              defaultValue=""
              className={selectClass}
            >
              <option value="" disabled>
                Select…
              </option>
              {DAYS_PER_WEEK_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {days}
                </option>
              ))}
            </select>
          </Section>

          <Section
            title="Timezone"
            description="Used to time your morning digest."
          >
            <select
              name="timezone"
              required
              defaultValue=""
              className={selectClass}
            >
              <option value="" disabled>
                Select…
              </option>
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </Section>

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
