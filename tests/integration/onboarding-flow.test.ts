import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock };
  },
}));

import { callSonnetForNextTurn } from '@/lib/onboarding/llm';
import { HandicapperProfileSchema } from '@/lib/onboarding/schema';
import type {
  ConversationTurn,
  ProfileWithoutVersion,
} from '@/lib/onboarding/schema';

// A scripted Sonnet: four follow-up questions, then a finishing turn.
const QUESTION_REPLIES = [
  'Sounds like you like lone speed — sprints, or routes too?',
  'What kind of race makes you pass no matter who is in it?',
  'When you bet, is it the right horse or the right price?',
  'How does that change between win bets and the Pick 4?',
].map((q) => JSON.stringify({ done: false, next_question: q }));

const FINAL_PROFILE = {
  style_summary:
    'Sequence player who builds Pick 4 tickets around a vulnerable favorite and singles lone speed.',
  loved_setups: ['lone speed in small fields', 'a vulnerable favorite to beat'],
  avoided_setups: ['short-priced singles with no backup'],
  value_threshold: 'mid_range',
  preferred_value_range: null,
  experience_level: 'expert',
  primary_bet_orientation: 'horizontals',
  notable_tracks_mentioned: ['Gulfstream Park'],
  notable_trainers_mentioned: [],
  notable_angles_mentioned: ['lone speed single'],
};

function fakeResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
    usage: {
      input_tokens: 1200,
      output_tokens: 300,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  };
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  createMock.mockReset();
});

describe('conversational onboarding — happy path', () => {
  it('runs a multi-turn conversation and produces a valid profile', async () => {
    let call = 0;
    createMock.mockImplementation(async () => {
      const text =
        call < QUESTION_REPLIES.length
          ? (QUESTION_REPLIES[call] as string)
          : JSON.stringify({ done: true, profile: FINAL_PROFILE });
      call += 1;
      return fakeResponse(text);
    });

    const turns: ConversationTurn[] = [
      { role: 'assistant', content: 'Opening question?', timestamp: 'ts' },
    ];
    let totalCost = 0;
    let finishedProfile: ProfileWithoutVersion | null = null;

    for (let i = 0; i < 8; i += 1) {
      turns.push({ role: 'user', content: `answer ${i}`, timestamp: 'ts' });
      const result = await callSonnetForNextTurn({
        turns,
        structuredContext: 'STRUCTURED CONTEXT',
        forceFinish: false,
      });
      totalCost += result.usage.costUsd;

      if (result.response.done) {
        finishedProfile = result.response.profile;
        break;
      }
      turns.push({
        role: 'assistant',
        content: result.response.next_question,
        timestamp: 'ts',
      });
    }

    expect(finishedProfile).not.toBeNull();

    const validated = HandicapperProfileSchema.safeParse({
      ...finishedProfile,
      version: 1,
    });
    expect(validated.success).toBe(true);

    // opener + four model questions
    expect(turns.filter((t) => t.role === 'assistant')).toHaveLength(5);
    // five model calls (four questions + the finishing turn)
    expect(createMock).toHaveBeenCalledTimes(5);
    // well under the $0.50 per-conversation budget
    expect(totalCost).toBeLessThan(0.5);
  });
});
