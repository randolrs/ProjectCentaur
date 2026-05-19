'use server';

import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { getUserPreferences } from '@/db/queries';
import { synthesizeFallbackProfile } from '@/lib/onboarding/fallback';
import { callSonnetForNextTurn } from '@/lib/onboarding/llm';
import {
  finalizeProfile,
  saveConversationTurns,
} from '@/lib/onboarding/persistence';
import { renderStructuredContext } from '@/lib/onboarding/prompts';
import {
  type ConversationTurn,
  ConversationTurnSchema,
  HandicapperProfileSchema,
} from '@/lib/onboarding/schema';
import { createClient } from '@/lib/supabase/server';
import type { GenerateQuestionResult } from './types';

const MAX_ANSWER_CHARS = 4000;
// Sanity cap on the client-supplied transcript (6 questions + 6 answers).
const MAX_TURNS = 24;

/** Validate and clamp the transcript a client sends with each request. */
function sanitizeTurns(raw: unknown): ConversationTurn[] {
  const list = Array.isArray(raw) ? raw.slice(0, MAX_TURNS) : [];
  const turns: ConversationTurn[] = [];
  for (const entry of list) {
    const parsed = ConversationTurnSchema.safeParse(entry);
    if (parsed.success) {
      turns.push({
        ...parsed.data,
        content: parsed.data.content.slice(0, MAX_ANSWER_CHARS),
      });
    }
  }
  return turns;
}

function logCost(userId: string, label: string, costUsd: number): void {
  console.log(
    `[onboarding] ${label} user=${userId} cost=$${costUsd.toFixed(4)}`,
  );
}

/**
 * Generate the next adaptive question from the transcript so far. Called in
 * the background while the user answers the intervening question, so a slow
 * model never blocks step progression. On any failure the caller falls back
 * to the deterministic baseline question.
 */
export async function generateAdaptiveQuestion(
  turnsRaw: unknown,
): Promise<GenerateQuestionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'failed' };

  const prefs = await getUserPreferences(user.id);
  if (!prefs) return { status: 'failed' };

  const turns = sanitizeTurns(turnsRaw);
  if (turns.length === 0) return { status: 'failed' };

  try {
    const result = await callSonnetForNextTurn({
      turns,
      structuredContext: renderStructuredContext(prefs),
      forceFinish: false,
    });
    logCost(user.id, 'adaptive-question', result.usage.costUsd);
    if (!result.response.done) {
      return { status: 'question', question: result.response.next_question };
    }
    return { status: 'failed' };
  } catch {
    return { status: 'failed' };
  }
}

/** Persist the in-progress transcript so a refresh can resume the flow. */
export async function saveProgress(turnsRaw: unknown): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await saveConversationTurns(user.id, sanitizeTurns(turnsRaw), 0);
}

/**
 * Finish the conversation: persist the final transcript, then synthesize the
 * handicapper profile in the background and redirect the user straight to the
 * review screen, which waits for the profile to land.
 */
export async function finishConversation(turnsRaw: unknown): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const prefs = await getUserPreferences(user.id);
  if (!prefs) redirect('/onboarding');

  const userId = user.id;
  const turns = sanitizeTurns(turnsRaw);
  const structuredContext = renderStructuredContext(prefs);

  // Keep the transcript on record so the review screen can tell that a
  // synthesis is in progress (the row is deleted once the profile lands).
  await saveConversationTurns(userId, turns, 0);

  after(async () => {
    let profile = synthesizeFallbackProfile(prefs);
    try {
      const result = await callSonnetForNextTurn({
        turns,
        structuredContext,
        forceFinish: true,
      });
      logCost(userId, 'profile-synthesis', result.usage.costUsd);
      if (result.response.done) {
        const validated = HandicapperProfileSchema.safeParse({
          ...result.response.profile,
          version: 1,
        });
        if (validated.success) profile = validated.data;
      }
    } catch {
      // Fall back to the profile synthesized from the M1 structured answers.
    }
    await finalizeProfile(userId, profile, turns);
  });

  redirect('/onboarding/review');
}
