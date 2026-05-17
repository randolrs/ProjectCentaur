'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { userPreferences, users } from '@/db/schema';
import { onboardingSchema } from '@/lib/onboarding/options';
import { createClient } from '@/lib/supabase/server';

export async function saveOnboarding(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const parsed = onboardingSchema.safeParse({
    tracks: formData.getAll('tracks'),
    raceClasses: formData.getAll('raceClasses'),
    distanceRanges: formData.getAll('distanceRanges'),
    surfaces: formData.getAll('surfaces'),
    fieldSizeBand: formData.get('fieldSizeBand'),
    betTypes: formData.getAll('betTypes'),
    bankrollTier: formData.get('bankrollTier'),
    daysPerWeek: formData.get('daysPerWeek'),
    timezone: formData.get('timezone'),
  });
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? 'Please complete every field.';
    redirect(`/onboarding?error=${encodeURIComponent(message)}`);
  }

  const prefs = parsed.data;
  const db = getDb();

  // Upsert the profile row (the signup trigger normally creates it; this
  // keeps onboarding correct even if the trigger is absent) and set timezone.
  await db
    .insert(users)
    .values({ id: user.id, email: user.email ?? '', timezone: prefs.timezone })
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
    .values({ userId: user.id, ...values })
    .onConflictDoUpdate({ target: userPreferences.userId, set: values });

  // Structured answers saved — continue to the M2 conversational onboarding.
  redirect('/onboarding/conversation');
}
