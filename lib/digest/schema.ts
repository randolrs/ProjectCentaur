import { z } from 'zod';

// ---------------------------------------------------------------------------
// M4 digest pipeline — types and the LLM output contract.
//
// `DigestLlmOutputSchema` is what Claude returns: an intro plus one
// reasoning entry per race. `RenderedDigest` is the self-contained structure
// persisted to `digests.content` and rendered into the email — it merges the
// model's prose with the structured race fields so neither the email
// renderer nor a future dashboard view needs to re-join the `races` table.
// ---------------------------------------------------------------------------

// Length ceilings are clamped, not rejected: one over-long reasoning from the
// model shouldn't sink the entire digest into deterministic fallback mode.
const clampTo = (max: number) => (s: string) => s.slice(0, max);

/** One race's reasoning, as returned by the model. */
export const DigestRaceReasoningSchema = z.object({
  // Must echo a `race_key` supplied in the prompt.
  race_key: z.string().min(1),
  headline: z.string().min(3).transform(clampTo(240)),
  reasoning: z.string().min(15).transform(clampTo(1500)),
});

/** The full model response for a user's daily digest. */
export const DigestLlmOutputSchema = z.object({
  intro: z.string().min(10).transform(clampTo(1000)),
  races: z.array(DigestRaceReasoningSchema).min(1).max(12),
});
export type DigestLlmOutput = z.infer<typeof DigestLlmOutputSchema>;

/** A single race as stored in / rendered from a finished digest. */
export interface RenderedDigestItem {
  raceKey: string;
  track: string;
  raceNumber: number | null;
  postTime: string | null;
  surface: string | null;
  distance: string | null;
  raceClass: string | null;
  fieldSize: number;
  headline: string;
  reasoning: string;
}

/**
 * How well the day's card fit the user's criteria:
 * - 'strong': races that cleared every filter (the normal digest).
 * - 'weak': no strong matches, so the closest fits at their tracks are shown.
 * - 'dark': none of their tracks were running — a short no-card note.
 */
export type DigestTier = 'strong' | 'weak' | 'dark';

/** The complete digest persisted to `digests.content`. */
export interface RenderedDigest {
  intro: string;
  tier: DigestTier;
  // 'llm' for a model-written digest; 'fallback' when the model call failed
  // and the digest was assembled deterministically from the match reasons.
  generatedBy: 'llm' | 'fallback';
  items: RenderedDigestItem[];
}

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  return raw.slice(start, end + 1);
}

/**
 * Parse a digest response out of raw model text. Returns null when the text
 * contains no JSON object, is not valid JSON, or fails schema validation.
 */
export function parseDigestOutput(raw: string): DigestLlmOutput | null {
  const json = extractJsonObject(raw);
  if (json === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  const result = DigestLlmOutputSchema.safeParse(parsed);
  return result.success ? result.data : null;
}
