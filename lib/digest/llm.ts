import Anthropic from '@anthropic-ai/sdk';
import type { HandicapperProfileRow, UserPreferencesRow } from '@/db/schema';
import { getAnthropicApiKey } from '@/lib/env';
import { digestSystemPrompt, renderDigestContext } from './prompts';
import { type DigestLlmOutput, parseDigestOutput } from './schema';
import type { ScoredRace } from './select';

// ---------------------------------------------------------------------------
// Sonnet 4.6 wrapper for daily digest generation.
//
// One call produces the whole digest for one user: an intro plus reasoning
// for every selected race. The call is retried once on a transient failure
// or an unparseable response; after MAX_ATTEMPTS it throws DigestLlmError and
// the pipeline falls back to a deterministic digest (see render.ts).
// ---------------------------------------------------------------------------

const MODEL = 'claude-sonnet-4-6';
// Output ceiling. Raising this lets adaptive thinking run longer, which
// can push the call past the per-attempt timeout — 8k is the level the
// model reliably completes within budget for a full multi-race digest.
const MAX_TOKENS = 8000;
const MAX_ATTEMPTS = 2;
// Each attempt gets real time for a long generation, but the total across
// attempts is capped under the digest route's 300s maxDuration — a slow model
// yields a clean DigestLlmError (and the deterministic fallback digest)
// rather than a function-level 504.
const PER_ATTEMPT_TIMEOUT_MS = 150_000;
const TOTAL_BUDGET_MS = 270_000;

// Sonnet 4.6 list pricing, USD per million tokens.
const PRICE_INPUT = 3;
const PRICE_OUTPUT = 15;
const PRICE_CACHE_WRITE = 3.75;
const PRICE_CACHE_READ = 0.3;

export interface DigestUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
}

export interface GenerateDigestInput {
  profile: HandicapperProfileRow;
  prefs: UserPreferencesRow;
  scored: ScoredRace[];
  raceDate: string;
}

export interface GenerateDigestResult {
  output: DigestLlmOutput;
  usage: DigestUsage;
}

export class DigestLlmError extends Error {
  readonly usage: DigestUsage;
  constructor(message: string, usage: DigestUsage) {
    super(message);
    this.name = 'DigestLlmError';
    this.usage = usage;
  }
}

function emptyUsage(): DigestUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    costUsd: 0,
  };
}

function addUsage(a: DigestUsage, res: Anthropic.Usage): DigestUsage {
  const inputTokens = res.input_tokens ?? 0;
  const outputTokens = res.output_tokens ?? 0;
  const cacheReadTokens = res.cache_read_input_tokens ?? 0;
  const cacheCreationTokens = res.cache_creation_input_tokens ?? 0;
  const costUsd =
    (inputTokens * PRICE_INPUT +
      outputTokens * PRICE_OUTPUT +
      cacheCreationTokens * PRICE_CACHE_WRITE +
      cacheReadTokens * PRICE_CACHE_READ) /
    1_000_000;
  return {
    inputTokens: a.inputTokens + inputTokens,
    outputTokens: a.outputTokens + outputTokens,
    cacheReadTokens: a.cacheReadTokens + cacheReadTokens,
    cacheCreationTokens: a.cacheCreationTokens + cacheCreationTokens,
    costUsd: a.costUsd + costUsd,
  };
}

/** Generate a user's daily digest. Throws DigestLlmError after MAX_ATTEMPTS. */
export async function generateDigest(
  input: GenerateDigestInput,
): Promise<GenerateDigestResult> {
  const client = new Anthropic({ apiKey: getAnthropicApiKey() });
  const context = renderDigestContext(
    input.profile,
    input.prefs,
    input.scored,
    input.raceDate,
  );

  let total = emptyUsage();
  let lastError = 'unknown error';
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
    // Don't start an attempt there isn't time to finish.
    if (remaining < 15_000) break;
    try {
      const res = await client.messages.create(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          thinking: { type: 'adaptive' },
          system: [
            {
              type: 'text',
              text: digestSystemPrompt(),
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: [{ role: 'user', content: context }],
        },
        { timeout: Math.min(PER_ATTEMPT_TIMEOUT_MS, remaining), maxRetries: 0 },
      );

      total = addUsage(total, res.usage);

      const text = res.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const parsed = parseDigestOutput(text);
      if (parsed) {
        return { output: parsed, usage: total };
      }
      lastError = 'model response did not match the expected JSON shape';
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new DigestLlmError(
    `Sonnet digest generation failed after ${MAX_ATTEMPTS} attempts: ${lastError}`,
    total,
  );
}
