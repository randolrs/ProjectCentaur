import type { UserPreferencesRow } from '@/db/schema';
import { ONBOARDING_PROFILE_EXAMPLES } from '@/lib/llm/prompts/us/onboarding_examples';
import { ONBOARDING_QUESTIONS } from '@/lib/llm/prompts/us/onboarding_questions';
import { ONBOARDING_SYSTEM_PROMPT } from '@/lib/llm/prompts/us/onboarding_system';

// Region-agnostic accessors for the onboarding conversation prompts. v1 is
// US-only; when other regions are added this module resolves the right set.

/** The full system prompt (persona + rules + few-shot examples). */
export function systemPrompt(): string {
  return `${ONBOARDING_SYSTEM_PROMPT}\n\n${ONBOARDING_PROFILE_EXAMPLES}`;
}

/** The fixed baseline questions shown when an adaptive question isn't ready. */
export function baselineQuestions(): readonly string[] {
  return ONBOARDING_QUESTIONS;
}

/**
 * Render the user's structured M1 answers as a background message for the
 * model. Sent as the first `user` message ahead of the conversation turns.
 */
export function renderStructuredContext(prefs: UserPreferencesRow): string {
  return [
    'Here is what this handicapper told us in the structured intake form.',
    'Treat it as background — go deeper than this, do not simply re-ask it.',
    '',
    `- Tracks followed: ${prefs.tracks.join(', ')}`,
    `- Race classes played: ${prefs.raceClasses.join(', ')}`,
    `- Distance ranges: ${prefs.distanceRanges.join(', ')}`,
    `- Surfaces: ${prefs.surfaces.join(', ')}`,
    `- Preferred field size: ${prefs.fieldSizeBand}`,
    `- Bet types used: ${prefs.betTypes.join(', ')}`,
    `- Active racing days: ${prefs.activeDays.join(', ')}`,
  ].join('\n');
}
