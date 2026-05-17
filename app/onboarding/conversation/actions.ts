'use server';

import { redirect } from 'next/navigation';
import { getUserPreferences } from '@/db/queries';
import type { UserPreferencesRow } from '@/db/schema';
import { synthesizeFallbackProfile } from '@/lib/onboarding/fallback';
import {
  callSonnetForNextTurn,
  type NextTurnResult,
  OnboardingLlmError,
} from '@/lib/onboarding/llm';
import {
  finalizeProfile,
  getActiveConversation,
  saveConversationTurns,
} from '@/lib/onboarding/persistence';
import { renderStructuredContext } from '@/lib/onboarding/prompts';
import {
  type ConversationTurn,
  HandicapperProfileSchema,
} from '@/lib/onboarding/schema';
import { createClient } from '@/lib/supabase/server';
import type { SubmitTurnResult } from './types';

// Force the model to finalize once the user has answered this many times.
const HARD_CAP_USER_TURNS = 8;
// Defensive ceiling — finalize from structured data without calling the model.
const RUNAWAY_USER_TURNS = 10;
const MAX_ANSWER_CHARS = 4000;
const COST_ALERT_USD = 1;

function logConversationCost(
  userId: string,
  costUsd: number,
  userTurns: number,
  outcome: string,
): void {
  const line = `[onboarding] conversation user=${userId} outcome=${outcome} userTurns=${userTurns} cost=$${costUsd.toFixed(4)}`;
  if (costUsd > COST_ALERT_USD) {
    console.error(`${line} — COST ALERT: exceeded $${COST_ALERT_USD}`);
  } else {
    console.log(line);
  }
}

async function finalizeWithFallback(
  userId: string,
  prefs: UserPreferencesRow,
  turns: ConversationTurn[],
): Promise<void> {
  await finalizeProfile(userId, synthesizeFallbackProfile(prefs), turns);
}

/**
 * Advance the onboarding conversation by one turn. On completion (model
 * `done`, the hard cap, or an LLM failure) the profile is persisted and the
 * action redirects to the review screen.
 */
export async function submitTurn(
  answerRaw: string,
): Promise<SubmitTurnResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const answer = answerRaw.trim().slice(0, MAX_ANSWER_CHARS);
  if (!answer) {
    return { status: 'error', message: 'Type an answer to continue.' };
  }

  const conversation = await getActiveConversation(user.id);
  if (!conversation || conversation.expired) {
    return { status: 'expired' };
  }

  const prefs = await getUserPreferences(user.id);
  if (!prefs) redirect('/onboarding');

  const turns: ConversationTurn[] = [
    ...conversation.turns,
    { role: 'user', content: answer, timestamp: new Date().toISOString() },
  ];
  const userTurns = turns.filter((t) => t.role === 'user').length;

  // Runaway guard — unreachable under the hard cap, kept as defense in depth.
  if (userTurns > RUNAWAY_USER_TURNS) {
    logConversationCost(user.id, conversation.costUsd, userTurns, 'runaway');
    await finalizeWithFallback(user.id, prefs, turns);
    redirect('/onboarding/review');
  }

  const forceFinish = userTurns >= HARD_CAP_USER_TURNS;

  let result: NextTurnResult;
  try {
    result = await callSonnetForNextTurn({
      turns,
      structuredContext: renderStructuredContext(prefs),
      forceFinish,
    });
  } catch (err) {
    const usage = err instanceof OnboardingLlmError ? err.usage : null;
    logConversationCost(
      user.id,
      conversation.costUsd + (usage?.costUsd ?? 0),
      userTurns,
      'llm-error',
    );
    await finalizeWithFallback(user.id, prefs, turns);
    redirect('/onboarding/review');
  }

  const totalCost = conversation.costUsd + result.usage.costUsd;

  if (result.response.done) {
    const candidate = { ...result.response.profile, version: 1 as const };
    const validated = HandicapperProfileSchema.safeParse(candidate);
    const profile = validated.success
      ? validated.data
      : synthesizeFallbackProfile(prefs);
    logConversationCost(user.id, totalCost, userTurns, 'completed');
    await finalizeProfile(user.id, profile, turns);
    redirect('/onboarding/review');
  }

  // The model ignored the force-finish instruction — finalize anyway.
  if (forceFinish) {
    logConversationCost(user.id, totalCost, userTurns, 'forced-fallback');
    await finalizeWithFallback(user.id, prefs, turns);
    redirect('/onboarding/review');
  }

  const updatedTurns: ConversationTurn[] = [
    ...turns,
    {
      role: 'assistant',
      content: result.response.next_question,
      timestamp: new Date().toISOString(),
    },
  ];
  await saveConversationTurns(user.id, updatedTurns, totalCost);

  return {
    status: 'question',
    question: result.response.next_question,
    questionNumber: updatedTurns.filter((t) => t.role === 'assistant').length,
  };
}
