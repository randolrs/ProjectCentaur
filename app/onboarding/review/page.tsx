import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getHandicapperProfile } from '@/db/queries';
import type { HandicapperProfileRow } from '@/db/schema';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { createClient } from '@/lib/supabase/server';
import { confirmProfile, saveProfileEdits } from './actions';

const VALUE_THRESHOLD_LABELS: Record<string, string> = {
  favorites_ok: 'Favorites are fine when the horse is right',
  mid_range: 'Mid-range prices — some edge required',
  overlays_only: 'Overlays only — never below morning-line value',
};

const EXPERIENCE_LABELS: Record<string, string> = {
  casual: 'Casual',
  serious: 'Serious',
  expert: 'Expert',
};

const BET_ORIENTATION_LABELS: Record<string, string> = {
  win: 'Win bets',
  place_show: 'Place / Show',
  exactas: 'Exactas & trifectas',
  horizontals: 'Multi-race wagers (Pick 3/4/5/6)',
  mixed: 'A mix of bet types',
};

const VALUE_THRESHOLD_OPTIONS = Object.keys(VALUE_THRESHOLD_LABELS);
const EXPERIENCE_OPTIONS = Object.keys(EXPERIENCE_LABELS);
const BET_ORIENTATION_OPTIONS = Object.keys(BET_ORIENTATION_LABELS);

const inputClass =
  'w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-400';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="block text-sm font-medium text-neutral-200">
        {label}
      </span>
      {children}
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">None captured.</p>;
  }
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-100">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function SummaryView({ profile }: { profile: HandicapperProfileRow }) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">
          Here&apos;s how we read your style
        </h1>
        <p className="text-sm text-neutral-400">
          Built from your conversation. If it sounds like you, you&apos;re
          done. If not, edit any part of it.
        </p>
      </header>

      <p className="rounded-md border border-neutral-800 bg-neutral-900 p-4 text-sm leading-relaxed text-neutral-100">
        {profile.styleSummary}
      </p>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Setups you look for</h2>
        <Bullets items={profile.lovedSetups} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Setups you pass on</h2>
        <Bullets items={profile.avoidedSetups} />
      </section>

      <dl className="divide-y divide-neutral-800 rounded-md border border-neutral-800">
        {(
          [
            ['Price discipline', VALUE_THRESHOLD_LABELS[profile.valueThreshold]],
            ['Preferred odds', profile.preferredValueRange ?? '—'],
            ['Experience', EXPERIENCE_LABELS[profile.experienceLevel]],
            [
              'Mainly bets',
              BET_ORIENTATION_LABELS[profile.primaryBetOrientation],
            ],
            [
              'Tracks mentioned',
              profile.notableTracksMentioned.join(', ') || '—',
            ],
            [
              'Trainers mentioned',
              profile.notableTrainersMentioned.join(', ') || '—',
            ],
            [
              'Angles mentioned',
              profile.notableAnglesMentioned.join(', ') || '—',
            ],
          ] as ReadonlyArray<readonly [string, string]>
        ).map(([label, value]) => (
          <div key={label} className="flex gap-4 px-4 py-3 text-sm">
            <dt className="w-36 shrink-0 text-neutral-500">{label}</dt>
            <dd className="text-neutral-100">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center gap-3">
        <form action={confirmProfile}>
          <button
            type="submit"
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white"
          >
            Looks right
          </button>
        </form>
        <Link
          href="/onboarding/review?edit=1"
          className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:border-neutral-400"
        >
          Edit
        </Link>
      </div>
    </div>
  );
}

function EditView({
  profile,
  error,
}: {
  profile: HandicapperProfileRow;
  error?: string;
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">
          Edit your profile
        </h1>
        <p className="text-sm text-neutral-400">
          Adjust any field. Put one setup per line; separate names with commas.
        </p>
      </header>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <form action={saveProfileEdits} className="space-y-4">
        <Field label="Style summary">
          <textarea
            name="style_summary"
            rows={4}
            required
            defaultValue={profile.styleSummary}
            className={inputClass}
          />
        </Field>

        <Field label="Setups you look for (one per line)">
          <textarea
            name="loved_setups"
            rows={4}
            required
            defaultValue={profile.lovedSetups.join('\n')}
            className={inputClass}
          />
        </Field>

        <Field label="Setups you pass on (one per line)">
          <textarea
            name="avoided_setups"
            rows={4}
            required
            defaultValue={profile.avoidedSetups.join('\n')}
            className={inputClass}
          />
        </Field>

        <Field label="Price discipline">
          <select
            name="value_threshold"
            defaultValue={profile.valueThreshold}
            className={inputClass}
          >
            {VALUE_THRESHOLD_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {VALUE_THRESHOLD_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Preferred odds range (optional)">
          <input
            name="preferred_value_range"
            type="text"
            defaultValue={profile.preferredValueRange ?? ''}
            placeholder="e.g. 5-1 to 12-1"
            className={inputClass}
          />
        </Field>

        <Field label="Experience level">
          <select
            name="experience_level"
            defaultValue={profile.experienceLevel}
            className={inputClass}
          >
            {EXPERIENCE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {EXPERIENCE_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Mainly bets">
          <select
            name="primary_bet_orientation"
            defaultValue={profile.primaryBetOrientation}
            className={inputClass}
          >
            {BET_ORIENTATION_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {BET_ORIENTATION_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tracks mentioned (comma-separated)">
          <input
            name="notable_tracks_mentioned"
            type="text"
            defaultValue={profile.notableTracksMentioned.join(', ')}
            className={inputClass}
          />
        </Field>

        <Field label="Trainers mentioned (comma-separated)">
          <input
            name="notable_trainers_mentioned"
            type="text"
            defaultValue={profile.notableTrainersMentioned.join(', ')}
            className={inputClass}
          />
        </Field>

        <Field label="Angles mentioned (comma-separated)">
          <input
            name="notable_angles_mentioned"
            type="text"
            defaultValue={profile.notableAnglesMentioned.join(', ')}
            className={inputClass}
          />
        </Field>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white"
          >
            Save changes
          </button>
          <Link
            href="/onboarding/review"
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:border-neutral-400"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default async function ReviewPage({
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

  const profile = await getHandicapperProfile(user.id);
  if (!profile) {
    redirect('/onboarding/conversation');
  }

  const sp = await searchParams;
  const editing = firstParam(sp.edit) === '1';
  const error = firstParam(sp.error);

  return (
    <main className="flex min-h-screen flex-col items-center bg-neutral-950 px-6 text-neutral-100">
      <div className="w-full max-w-xl py-16">
        {editing ? (
          <EditView profile={profile} error={error} />
        ) : (
          <SummaryView profile={profile} />
        )}
      </div>
    </main>
  );
}
