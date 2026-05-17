import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicApiKey } from '@/lib/env';
import { systemPrompt } from './prompts';
import {
  type ConversationTurn,
  parseTurnResponse,
  type TurnResponse,
} from './schema';

// ---------------------------------------------------------------------------
// Sonnet 4.6 wrapper for the conversational onboarding interview.
//
// One call advances the conversation by one turn: given the transcript so
// far it returns either the next question or the synthesized profile. The
// call is retried on a transient failure or an unparseable response; after
// MAX_ATTEMPTS it throws OnboardingLlmError and the caller falls back to a
// profile synthesized from the structured M1 data.
// ---------------------------------------------------------------------------

const MODEL = 'claude-sonnet-4-6';
// Generous ceiling so adaptive thinking has room before the JSON output.
const MAX_TOKENS = 16000;
const TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 2;

// Sonnet 4.6 list pricing, USD per million tokens.
const PRICE_INPUT = 3;
const PRICE_OUTPUT = 15;
const PRICE_CACHE_WRITE = 3.75;
const PRICE_CACHE_READ = 0.3;

const FORCE_FINISH_INSTRUCTION =
  'That was the final question of the interview. Do not ask anything else. ' +
  'Respond now with a "done": true JSON object containing the synthesized ' +
  'handicapper profile, based on everything said so far.';

export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
}

export interface NextTurnInput {
  /** Stored conversation; turns[0] is the deterministic assistant opener. */
  turns: ConversationTurn[];
  /** Rendered M1 structured answers, sent as the first user message. */
  structuredContext: string;
  /** When true, instruct the model to finalize rather than ask again. */
  forceFinish: boolean;
}

export interface NextTurnResult {
  response: TurnResponse;
  usage: TurnUsage;
}

export class OnboardingLlmError extends Error {
  readonly usage: TurnUsage;
  constructor(message: string, usage: TurnUsage) {
    super(message);
    this.name = 'OnboardingLlmError';
    this.usage = usage;
  }
}

function emptyUsage(): TurnUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    costUsd: 0,
  };
}

function usageFromResponse(usage: Anthropic.Usage): TurnUsage {
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
  const costUsd =
    (inputTokens * PRICE_INPUT +
      outputTokens * PRICE_OUTPUT +
      cacheCreationTokens * PRICE_CACHE_WRITE +
      cacheReadTokens * PRICE_CACHE_READ) /
    1_000_000;
  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    costUsd,
  };
}

function addUsage(a: TurnUsage, b: TurnUsage): TurnUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheCreationTokens: a.cacheCreationTokens + b.cacheCreationTokens,
    costUsd: a.costUsd + b.costUsd,
  };
}

/**
 * Build the Anthropic `messages` array. The structured context is a leading
 * `user` message so the array starts with `user` (turns[0] is `assistant`).
 */
export function buildTurnMessages(
  turns: ConversationTurn[],
  structuredContext: string,
  forceFinish: boolean,
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: structuredContext },
    ...turns.map((t) => ({ role: t.role, content: t.content })),
  ];
  if (forceFinish) {
    messages.push({ role: 'user', content: FORCE_FINISH_INSTRUCTION });
  }
  return messages;
}

/** Advance the conversation by one turn. Throws OnboardingLlmError on failure. */
export async function callSonnetForNextTurn(
  input: NextTurnInput,
): Promise<NextTurnResult> {
  const client = new Anthropic({ apiKey: getAnthropicApiKey() });
  const messages = buildTurnMessages(
    input.turns,
    input.structuredContext,
    input.forceFinish,
  );

  let total = emptyUsage();
  let lastError = 'unknown error';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await client.messages.create(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          thinking: { type: 'adaptive' },
          system: [
            {
              type: 'text',
              text: systemPrompt(),
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages,
        },
        { timeout: TIMEOUT_MS, maxRetries: 2 },
      );

      total = addUsage(total, usageFromResponse(res.usage));

      const text = res.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const parsed = parseTurnResponse(text);
      if (parsed) {
        return { response: parsed, usage: total };
      }
      lastError = 'model response did not match the expected JSON shape';
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new OnboardingLlmError(
    `Sonnet onboarding turn failed after ${MAX_ATTEMPTS} attempts: ${lastError}`,
    total,
  );
}
