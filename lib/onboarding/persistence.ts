import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import {
  handicapperProfile,
  onboardingConversations,
  users,
} from '@/db/schema';
import type { ConversationTurn, HandicapperProfile } from './schema';

// ---------------------------------------------------------------------------
// Persistence for the M2 conversation flow.
//
// `onboarding_conversations` holds the transient transcript while a
// conversation is in progress; the row is deleted once the profile is
// finalized into `handicapper_profile`.
// ---------------------------------------------------------------------------

// A conversation idle longer than this is considered expired; the user
// restarts from a fresh opener.
const IDLE_EXPIRY_MS = 30 * 60 * 1000;

export interface ActiveConversation {
  turns: ConversationTurn[];
  costUsd: number;
  expired: boolean;
}

/** The in-progress conversation for a user, or null if none exists. */
export async function getActiveConversation(
  userId: string,
): Promise<ActiveConversation | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(onboardingConversations)
    .where(eq(onboardingConversations.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const idleMs = Date.now() - row.updatedAt.getTime();
  return {
    turns: row.turns,
    costUsd: row.costUsd,
    expired: idleMs > IDLE_EXPIRY_MS,
  };
}

/** Start (or reset) a conversation with the deterministic opener turn. */
export async function startConversation(
  userId: string,
  opener: ConversationTurn,
): Promise<ConversationTurn[]> {
  const db = getDb();
  const turns = [opener];
  const now = new Date();
  await db
    .insert(onboardingConversations)
    .values({ userId, turns, costUsd: 0 })
    .onConflictDoUpdate({
      target: onboardingConversations.userId,
      set: { turns, costUsd: 0, startedAt: now, updatedAt: now },
    });
  return turns;
}

/** Overwrite the stored transcript and accumulated cost for a conversation. */
export async function saveConversationTurns(
  userId: string,
  turns: ConversationTurn[],
  costUsd: number,
): Promise<void> {
  const db = getDb();
  await db
    .update(onboardingConversations)
    .set({ turns, costUsd, updatedAt: new Date() })
    .where(eq(onboardingConversations.userId, userId));
}

export async function deleteConversation(userId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(onboardingConversations)
    .where(eq(onboardingConversations.userId, userId));
}

function profileColumns(profile: HandicapperProfile) {
  return {
    styleSummary: profile.style_summary,
    lovedSetups: profile.loved_setups,
    avoidedSetups: profile.avoided_setups,
    valueThreshold: profile.value_threshold,
    preferredValueRange: profile.preferred_value_range,
    experienceLevel: profile.experience_level,
    primaryBetOrientation: profile.primary_bet_orientation,
    notableTracksMentioned: profile.notable_tracks_mentioned,
    notableTrainersMentioned: profile.notable_trainers_mentioned,
    notableAnglesMentioned: profile.notable_angles_mentioned,
    version: profile.version,
  };
}

/**
 * Persist the finished profile, mark onboarding complete, and clear the
 * transient conversation row — all in one transaction.
 */
export async function finalizeProfile(
  userId: string,
  profile: HandicapperProfile,
  rawConversationLog: ConversationTurn[],
): Promise<void> {
  const db = getDb();
  const columns = profileColumns(profile);
  await db.transaction(async (tx) => {
    await tx
      .insert(handicapperProfile)
      .values({ userId, ...columns, rawConversationLog })
      .onConflictDoUpdate({
        target: handicapperProfile.userId,
        set: { ...columns, rawConversationLog },
      });
    await tx
      .update(users)
      .set({ onboardingStatus: 'conversation_complete' })
      .where(eq(users.id, userId));
    await tx
      .delete(onboardingConversations)
      .where(eq(onboardingConversations.userId, userId));
  });
}

/** Update the structured fields of an existing profile (the review-edit form). */
export async function updateProfileFields(
  userId: string,
  profile: HandicapperProfile,
): Promise<void> {
  const db = getDb();
  await db
    .update(handicapperProfile)
    .set(profileColumns(profile))
    .where(eq(handicapperProfile.userId, userId));
}
