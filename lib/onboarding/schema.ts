import { z } from 'zod';

// ---------------------------------------------------------------------------
// M2 conversational onboarding — Zod schemas.
//
// `HandicapperProfileSchema` is the structured output persisted to Postgres.
// `TurnResponseSchema` is the contract for what Sonnet returns at each turn.
// `parseTurnResponse` tolerantly extracts and validates a turn response from
// raw model text (the model is prompted for JSON, but may add stray prose).
//
// Field names are snake_case to match the LLM-facing JSON contract; the
// Drizzle table uses camelCase columns, mapped in lib/onboarding/persistence.ts.
// ---------------------------------------------------------------------------

export const HandicapperProfileSchema = z.object({
  // A specific, vivid one-paragraph description of how the person plays.
  style_summary: z.string().min(20).max(500),
  // Concrete setups/angles the handicapper favors.
  loved_setups: z.array(z.string().max(200)).min(1).max(8),
  // Concrete race profiles the handicapper passes on sight.
  avoided_setups: z.array(z.string().max(200)).min(1).max(8),
  // overlays_only = won't bet below morning-line value.
  value_threshold: z.enum(['favorites_ok', 'mid_range', 'overlays_only']),
  // e.g. "5-1 to 12-1"; null when it never surfaced in conversation.
  preferred_value_range: z.string().max(50).nullable(),
  experience_level: z.enum(['casual', 'serious', 'expert']),
  // horizontals = multi-race wagers (Pick 3/4/5/6).
  primary_bet_orientation: z.enum([
    'win',
    'place_show',
    'exactas',
    'horizontals',
    'mixed',
  ]),
  notable_tracks_mentioned: z.array(z.string()).max(10),
  notable_trainers_mentioned: z.array(z.string()).max(10),
  notable_angles_mentioned: z.array(z.string()).max(10),
  version: z.literal(1),
});

export type HandicapperProfile = z.infer<typeof HandicapperProfileSchema>;

// The model returns the profile without `version`; we stamp it on persist.
export const ProfileWithoutVersionSchema = HandicapperProfileSchema.omit({
  version: true,
});
export type ProfileWithoutVersion = z.infer<typeof ProfileWithoutVersionSchema>;

export const ConversationTurnSchema = z.object({
  role: z.enum(['assistant', 'user']),
  content: z.string(),
  timestamp: z.string(),
});
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;

export const ConversationStateSchema = z.object({
  user_id: z.string(),
  turns: z.array(ConversationTurnSchema),
  started_at: z.string(),
});
export type ConversationState = z.infer<typeof ConversationStateSchema>;

// What Sonnet returns at each turn: either the next question, or `done` with
// the synthesized profile. Keyed on the boolean `done` discriminator.
export const TurnResponseSchema = z.discriminatedUnion('done', [
  z.object({
    done: z.literal(false),
    next_question: z.string().min(10).max(500),
    internal_notes: z.string().optional(),
  }),
  z.object({
    done: z.literal(true),
    profile: ProfileWithoutVersionSchema,
    internal_notes: z.string().optional(),
  }),
]);
export type TurnResponse = z.infer<typeof TurnResponseSchema>;

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  return raw.slice(start, end + 1);
}

/**
 * Parse a turn response out of raw model text. Returns null when the text
 * contains no JSON object, is not valid JSON, or does not match the schema.
 */
export function parseTurnResponse(raw: string): TurnResponse | null {
  const json = extractJsonObject(raw);
  if (json === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  const result = TurnResponseSchema.safeParse(parsed);
  return result.success ? result.data : null;
}
