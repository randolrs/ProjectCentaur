'use server';

import { redirect } from 'next/navigation';
import { getHandicapperProfile } from '@/db/queries';
import { triggerImmediateDigest } from '@/lib/digest/pipeline';
import { updateProfileFields } from '@/lib/onboarding/persistence';
import { HandicapperProfileSchema } from '@/lib/onboarding/schema';
import { createClient } from '@/lib/supabase/server';

function asString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asLines(value: FormDataEntryValue | null): string[] {
  return asString(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function asCommaList(value: FormDataEntryValue | null): string[] {
  return asString(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * "Looks right" — onboarding is complete. Send the user their first digest
 * immediately (best-effort), then move to the dashboard.
 */
export async function confirmProfile(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await triggerImmediateDigest(user.id);
  }
  redirect('/dashboard');
}

/** Persist edits made on the review screen's structured-field form. */
export async function saveProfileEdits(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const existing = await getHandicapperProfile(user.id);
  if (!existing) {
    redirect('/onboarding/conversation');
  }

  const preferredValueRange = asString(formData.get('preferred_value_range'));
  const candidate = {
    style_summary: asString(formData.get('style_summary')),
    loved_setups: asLines(formData.get('loved_setups')),
    avoided_setups: asLines(formData.get('avoided_setups')),
    value_threshold: asString(formData.get('value_threshold')),
    preferred_value_range: preferredValueRange === '' ? null : preferredValueRange,
    experience_level: asString(formData.get('experience_level')),
    primary_bet_orientation: asString(formData.get('primary_bet_orientation')),
    notable_tracks_mentioned: asCommaList(
      formData.get('notable_tracks_mentioned'),
    ),
    notable_trainers_mentioned: asCommaList(
      formData.get('notable_trainers_mentioned'),
    ),
    notable_angles_mentioned: asCommaList(
      formData.get('notable_angles_mentioned'),
    ),
    version: 1,
  };

  const parsed = HandicapperProfileSchema.safeParse(candidate);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? 'Please check the fields and retry.';
    redirect(`/onboarding/review?edit=1&error=${encodeURIComponent(message)}`);
  }

  await updateProfileFields(user.id, parsed.data);
  redirect('/onboarding/review');
}
