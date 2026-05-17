import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock };
  },
}));

import {
  buildTurnMessages,
  callSonnetForNextTurn,
  OnboardingLlmError,
} from '@/lib/onboarding/llm';
import type { ConversationTurn } from '@/lib/onboarding/schema';

const turns: ConversationTurn[] = [
  { role: 'assistant', content: 'Opening question?', timestamp: '2026-05-17' },
  { role: 'user', content: 'My answer.', timestamp: '2026-05-17' },
];

function fakeResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
    usage: {
      input_tokens: 1000,
      output_tokens: 200,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  };
}

const questionJson = JSON.stringify({
  done: false,
  next_question: 'What about a race you passed on recently?',
});

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  createMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildTurnMessages', () => {
  it('starts with the structured-context user message, then the turns', () => {
    const messages = buildTurnMessages(turns, 'STRUCTURED', false);
    expect(messages[0]).toEqual({ role: 'user', content: 'STRUCTURED' });
    expect(messages[1]?.role).toBe('assistant');
    expect(messages).toHaveLength(3);
  });

  it('appends a force-finish instruction when forceFinish is set', () => {
    const messages = buildTurnMessages(turns, 'STRUCTURED', true);
    expect(messages).toHaveLength(4);
    expect(messages.at(-1)?.role).toBe('user');
  });
});

describe('callSonnetForNextTurn', () => {
  it('returns the parsed response and computed cost on a valid reply', async () => {
    createMock.mockResolvedValueOnce(fakeResponse(questionJson));

    const result = await callSonnetForNextTurn({
      turns,
      structuredContext: 'STRUCTURED',
      forceFinish: false,
    });

    expect(result.response.done).toBe(false);
    // 1000 input @ $3/M + 200 output @ $15/M = $0.006
    expect(result.usage.costUsd).toBeCloseTo(0.006, 6);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('retries once when the first response is unparseable', async () => {
    createMock
      .mockResolvedValueOnce(fakeResponse('not json at all'))
      .mockResolvedValueOnce(fakeResponse(questionJson));

    const result = await callSonnetForNextTurn({
      turns,
      structuredContext: 'STRUCTURED',
      forceFinish: false,
    });

    expect(result.response.done).toBe(false);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it('throws OnboardingLlmError when every attempt is unparseable', async () => {
    createMock.mockResolvedValue(fakeResponse('still not json'));

    await expect(
      callSonnetForNextTurn({
        turns,
        structuredContext: 'STRUCTURED',
        forceFinish: false,
      }),
    ).rejects.toBeInstanceOf(OnboardingLlmError);
  });

  it('throws OnboardingLlmError when the API call fails', async () => {
    createMock.mockRejectedValue(new Error('network down'));

    await expect(
      callSonnetForNextTurn({
        turns,
        structuredContext: 'STRUCTURED',
        forceFinish: false,
      }),
    ).rejects.toBeInstanceOf(OnboardingLlmError);
  });
});
