// Baseline questions for the M2 onboarding conversation.
//
// The conversation always shows six questions. The first two are asked
// verbatim — there is nothing to adapt from yet. Questions 3-6 are upgraded
// in the background by Sonnet to follow the thread of the handicapper's
// earlier answers; these baselines are the fallback shown when an adaptive
// question has not resolved in time or the model call fails.

export const ONBOARDING_QUESTIONS = [
  // 1 — deterministic opener.
  "You've told us the basics — now I want to hear how you actually play. " +
    'Tell me about a race you bet recently that felt like your kind of spot. ' +
    'What was it about it that made you want in?',
  // 2 — deterministic.
  'When you scan a card, what makes you stop on a race — the kind of setup ' +
    'or angle you actively hunt for?',
  // 3 — adaptive (baseline: avoided setups).
  "What's the kind of race you pass on every time, no matter which horses " +
    'are entered?',
  // 4 — adaptive (baseline: value discipline).
  "When you're deciding whether to bet, how much does the price matter? Are " +
    'you backing the horse you think wins, or do you need the odds to be ' +
    'generous first?',
  // 5 — adaptive (baseline: bet construction).
  'How do you actually play a race you like — win bets, exactas, multi-race ' +
    'tickets? Does that change when you are more or less confident?',
  // 6 — adaptive (baseline: notable specifics).
  'Are there particular tracks, trainers, or angles you keep coming back ' +
    'to — spots where you feel you have a real edge?',
] as const;
