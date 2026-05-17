import { redirect } from 'next/navigation';
import { getHandicapperProfile, getUserPreferences } from '@/db/queries';
import {
  getActiveConversation,
  startConversation,
} from '@/lib/onboarding/persistence';
import { openingQuestion } from '@/lib/onboarding/prompts';
import type { ConversationTurn } from '@/lib/onboarding/schema';
import { createClient } from '@/lib/supabase/server';
import { ConversationClient } from './conversation-client';

export default async function ConversationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Structured onboarding must come first; the conversation builds on it.
  const prefs = await getUserPreferences(user.id);
  if (!prefs) {
    redirect('/onboarding');
  }

  // The conversation is one-time — onboarded users move on.
  const profile = await getHandicapperProfile(user.id);
  if (profile) {
    redirect('/dashboard');
  }

  let conversation = await getActiveConversation(user.id);
  if (!conversation || conversation.expired) {
    const opener: ConversationTurn = {
      role: 'assistant',
      content: openingQuestion(),
      timestamp: new Date().toISOString(),
    };
    const turns = await startConversation(user.id, opener);
    conversation = { turns, costUsd: 0, expired: false };
  }

  const assistantTurns = conversation.turns.filter(
    (t) => t.role === 'assistant',
  );
  const currentQuestion =
    assistantTurns[assistantTurns.length - 1]?.content ?? openingQuestion();

  return (
    <main className="flex min-h-screen flex-col items-center bg-neutral-950 px-6 text-neutral-100">
      <div className="w-full max-w-xl space-y-6 py-16">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Tell us how you actually play
          </h1>
          <p className="text-sm text-neutral-400">
            About five minutes, six questions, one at a time. This is the part
            a checklist can&apos;t capture — talk to us like you&apos;d talk to
            someone at the rail.
          </p>
        </header>

        <ConversationClient
          initialQuestion={currentQuestion}
          initialQuestionNumber={assistantTurns.length}
        />
      </div>
    </main>
  );
}
