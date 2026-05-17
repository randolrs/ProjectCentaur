import { eq } from 'drizzle-orm';
import { getDb } from './index';
import { handicapperProfile, userPreferences, users } from './schema';

/** The user's deterministic onboarding preferences, or null if not onboarded. */
export async function getUserPreferences(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** The extended public.users profile row, or null if missing. */
export async function getUserProfile(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** The M2 conversational handicapper profile, or null if not yet built. */
export async function getHandicapperProfile(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(handicapperProfile)
    .where(eq(handicapperProfile.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}
