'use client';

import { type FormEvent, useState } from 'react';
import { submitTurn } from './actions';

// Rough expected length, shown to the user as "Question N of ~6".
const APPROX_TOTAL = 6;

export function ConversationClient({
  initialQuestion,
  initialQuestionNumber,
}: {
  initialQuestion: string;
  initialQuestionNumber: number;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [questionNumber, setQuestionNumber] = useState(initialQuestionNumber);
  const [answer, setAnswer] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending || !answer.trim()) return;
    setPending(true);
    setError(null);

    // When the conversation completes, the server action redirects and this
    // promise resolves to undefined as navigation takes over.
    const result = await submitTurn(answer);
    if (!result) return;

    setPending(false);
    if (result.status === 'expired') {
      setExpired(true);
      return;
    }
    if (result.status === 'error') {
      setError(result.message);
      return;
    }
    setQuestion(result.question);
    setQuestionNumber(result.questionNumber);
    setAnswer('');
  }

  if (expired) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-300">
          This conversation timed out after a long pause. No problem — start a
          fresh one and it&apos;ll only take a few minutes.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign('/onboarding/conversation')}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white"
        >
          Start over
        </button>
      </div>
    );
  }

  const displayNumber = Math.min(questionNumber, APPROX_TOTAL);

  return (
    <div className="space-y-5">
      <p className="text-xs uppercase tracking-wide text-neutral-500">
        Question {displayNumber} of ~{APPROX_TOTAL}
      </p>

      <p className="text-lg leading-relaxed text-neutral-100">{question}</p>

      <form onSubmit={onSubmit} className="space-y-3">
        <textarea
          name="answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={5}
          required
          disabled={pending}
          placeholder="Answer in your own words — specifics help."
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-400 disabled:opacity-60"
        />
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={pending || !answer.trim()}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
        >
          {pending ? 'Thinking…' : 'Send answer'}
        </button>
      </form>
    </div>
  );
}
