'use client';

import { type FormEvent, useRef, useState } from 'react';
import type { ConversationTurn } from '@/lib/onboarding/schema';
import {
  finishConversation,
  generateAdaptiveQuestion,
  saveProgress,
} from './actions';

// How far ahead Sonnet works: answering question N kicks off generation of
// question N+2, so it resolves in the background while the user answers
// N+1 — step progression is never blocked on the model.
const LOOKAHEAD = 2;
// Questions 0 and 1 are deterministic openers; 2+ are adaptively generated.
const FIRST_ADAPTIVE_INDEX = 2;

function nowIso(): string {
  return new Date().toISOString();
}

/** Build the {question, answer} transcript for questions 0..lastIndex. */
function buildTurns(
  lastIndex: number,
  questions: readonly string[],
  answers: readonly string[],
): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  for (let i = 0; i <= lastIndex; i += 1) {
    turns.push({
      role: 'assistant',
      content: questions[i] ?? '',
      timestamp: nowIso(),
    });
    turns.push({ role: 'user', content: answers[i] ?? '', timestamp: nowIso() });
  }
  return turns;
}

export function ConversationClient({
  baselineQuestions,
  initialQuestions,
  initialAnswers,
  initialIndex,
}: {
  baselineQuestions: readonly string[];
  initialQuestions: readonly string[];
  initialAnswers: readonly string[];
  initialIndex: number;
}) {
  const total = baselineQuestions.length;
  const [questions, setQuestions] = useState<string[]>([...initialQuestions]);
  const [answers, setAnswers] = useState<string[]>([...initialAnswers]);
  const [index, setIndex] = useState(initialIndex);
  const [draft, setDraft] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live mirrors so background callbacks see current values.
  const indexRef = useRef(index);
  indexRef.current = index;
  const questionsRef = useRef(questions);
  questionsRef.current = questions;
  // Adaptive-question generations still in flight, keyed by question index.
  const pending = useRef<Map<number, Promise<void>>>(new Map());

  function kickGeneration(slot: number, turns: ConversationTurn[]): void {
    if (slot < FIRST_ADAPTIVE_INDEX || slot >= total) return;
    if (pending.current.has(slot)) return;
    const job = generateAdaptiveQuestion(turns)
      .then((result) => {
        pending.current.delete(slot);
        // Apply only if the user hasn't already moved past this slot.
        if (result.status === 'question' && indexRef.current <= slot) {
          setQuestions((current) => {
            const next = [...current];
            next[slot] = result.question;
            return next;
          });
        }
      })
      .catch(() => {
        pending.current.delete(slot);
      });
    pending.current.set(slot, job);
  }

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (waiting || finalizing) return;
    const answer = draft.trim();
    if (!answer) return;
    setError(null);

    const nextAnswers = [...answers];
    nextAnswers[index] = answer;
    setAnswers(nextAnswers);

    const turns = buildTurns(index, questionsRef.current, nextAnswers);

    // Persist progress and prepare a later question — both in the background.
    void saveProgress(turns);
    kickGeneration(index + LOOKAHEAD, turns);

    // Last question answered — hand off to background synthesis.
    if (index + 1 >= total) {
      setFinalizing(true);
      try {
        await finishConversation(turns);
      } catch {
        // A redirect throws here on success; a real failure lands below.
        return;
      }
      return;
    }

    const nextIndex = index + 1;
    // If the next question is still being generated, wait briefly for it
    // rather than fall back to the generic baseline.
    const inFlight = pending.current.get(nextIndex);
    if (inFlight) {
      setWaiting(true);
      await inFlight;
      setWaiting(false);
    }
    setIndex(nextIndex);
    setDraft('');
  }

  if (finalizing) {
    return (
      <div className="space-y-3">
        <p className="text-lg text-neutral-100">
          Putting your profile together…
        </p>
        <p className="text-sm text-neutral-400">
          Reading back through your answers. This only takes a moment.
        </p>
      </div>
    );
  }

  const lastQuestion = index + 1 >= total;

  return (
    <div className="space-y-5">
      <p className="text-xs uppercase tracking-wide text-neutral-500">
        Question {index + 1} of {total}
      </p>

      <p className="text-lg leading-relaxed text-neutral-100">
        {questions[index]}
      </p>

      <form onSubmit={onSubmit} className="space-y-3">
        <textarea
          name="answer"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          required
          disabled={waiting}
          placeholder="Answer in your own words — specifics help."
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-400 disabled:opacity-60"
        />
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={waiting || !draft.trim()}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
        >
          {waiting
            ? 'Lining up your next question…'
            : lastQuestion
              ? 'Finish'
              : 'Continue'}
        </button>
      </form>
    </div>
  );
}
