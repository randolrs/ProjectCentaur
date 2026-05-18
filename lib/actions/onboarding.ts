'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { userPreferences, users } from '@/db/schema';
import {
  type OnboardingInput,
  onboardingSchema,
} from '@/lib/onboarding/options';
import { createClient } from '@/lib/supabase/server';

/** Pull the structured preference fields out of a submitted form. */
function readPreferencesForm(formData: FormData) {
  return {
    tracks: formData.getAll('tracks'),
    raceClasses: formData.getAll('raceClasses'),
    distanceRanges: formData.getAll('distanceRanges'),
    surfaces: formData.getAll('surfaces'),
    fieldSizeBand: formData.get('fieldSizeBand'),
    betTypes: formData.getAll('betTypes'),
    bankrollTier: formData.get('bankrollTier'),
    daysPerWeek: formData.get('daysPerWeek'),
    timezone: formData.get('timezone'),
  };
}

/** Upsert a user's timezone and structured preferences. */
async function persistPreferences(
  userId: string,
  email: string,
  prefs: OnboardingInput,
): Promise<void> {
  const db = getDb();

  // Upsert the profile row (the signup trigger normally creates it; this
  // keeps the flow correct even if the trigger is absent) and set timezone.
  await db
    .insert(users)
    .values({ id: userId, email, timezone: prefs.timezone })
    .onConflictDoUpdate({
      target: users.id,
      set: { timezone: prefs.timezone },
    });

  const values = {
    tracks: prefs.tracks,
    raceClasses: prefs.raceClasses,
    distanceRanges: prefs.distanceRanges,
    surfaces: prefs.surfaces,
    fieldSizeBand: prefs.fieldSizeBand,
    betTypes: prefs.betTypes,
    bankrollTier: prefs.bankrollTier,
    daysPerWeek: prefs.daysPerWeek,
  };
  await db
    .insert(userPreferences)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: userPreferences.userId, set: values });
}

/** First-time structured onboarding — saves, then continues to M2. */
export async function saveOnboarding(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const parsed = onboardingSchema.safeParse(readPreferencesForm(formData));
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? 'Please complete every field.';
    redirect(`/onboarding?error=${encodeURIComponent(message)}`);
  }

  await persistPreferences(user.id, user.email ?? '', parsed.data);

  // Structured answers saved — continue to the M2 conversational onboarding.
  redirect('/onboarding/conversation');
}

/** Self-serve preference edit from the dashboard — saves, then returns. */
export async function updatePreferences(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const parsed = onboardingSchema.safeParse(readPreferencesForm(formData));
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? 'Please complete every field.';
    redirect(`/preferences?error=${encodeURIComponent(message)}`);
  }

  await persistPreferences(user.id, user.email ?? '', parsed.data);
  redirect('/dashboard');
}
