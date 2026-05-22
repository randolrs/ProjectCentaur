import type {
  DigestLlmOutput,
  DigestTier,
  RenderedDigest,
  RenderedDigestItem,
} from './schema';
import type { ScoredRace } from './select';

// ---------------------------------------------------------------------------
// Digest assembly.
//
// `buildRenderedDigest` merges the model's prose with the structured race
// fields into the self-contained `RenderedDigest` that is persisted and
// emailed. When the model call fails it is called with `null` and produces a
// deterministic fallback digest from the match reasons alone — mirroring the
// onboarding fallback, the pipeline always yields a usable digest.
// ---------------------------------------------------------------------------

function raceLabel(scored: ScoredRace): string {
  const { race } = scored;
  const number = race.raceNumber === null ? '' : ` Race ${race.raceNumber}`;
  return `${race.track}${number}`;
}

/** Deterministic per-race copy used when the model did not cover a race. */
function fallbackItem(scored: ScoredRace): RenderedDigestItem {
  const { race } = scored;
  const bits = [race.raceClass, race.surface, race.distance]
    .map((b) => b?.trim())
    .filter((b): b is string => Boolean(b));
  return {
    raceKey: race.key,
    track: race.track,
    raceNumber: race.raceNumber,
    postTime: race.postTime,
    surface: race.surface,
    distance: race.distance,
    raceClass: race.raceClass,
    fieldSize: race.fieldSize,
    headline: bits.length > 0 ? `${raceLabel(scored)} — ${bits.join(', ')}` : raceLabel(scored),
    reasoning: `Matches your profile: ${scored.matchReasons.join('; ')}.`,
  };
}

function fallbackIntro(scored: ScoredRace[], tier: DigestTier): string {
  const tracks = [...new Set(scored.map((s) => s.race.track))];
  const raceWord = scored.length === 1 ? 'race' : 'races';
  if (tier === 'weak') {
    const verb = scored.length === 1 ? 'is' : 'are';
    return (
      `Nothing at ${tracks.join(', ')} strongly matched your profile today, ` +
      `so here ${verb} the ${scored.length} closest ${raceWord} to look over.`
    );
  }
  return (
    `${scored.length} ${raceWord} at ${tracks.join(', ')} fit your profile ` +
    'today. Here is the rundown.'
  );
}

/**
 * Merge an LLM digest response with the selected races. Pass `output: null`
 * to assemble the deterministic fallback digest. Races the model omitted
 * fall back to deterministic copy; race order follows `scored`.
 */
export function buildRenderedDigest(
  output: DigestLlmOutput | null,
  scored: ScoredRace[],
  tier: DigestTier,
): RenderedDigest {
  if (output === null) {
    return {
      intro: fallbackIntro(scored, tier),
      tier,
      generatedBy: 'fallback',
      items: scored.map(fallbackItem),
    };
  }

  const byKey = new Map(output.races.map((r) => [r.race_key, r]));
  const items = scored.map((scoredRace) => {
    const written = byKey.get(scoredRace.race.key);
    if (!written) return fallbackItem(scoredRace);
    const { race } = scoredRace;
    return {
      raceKey: race.key,
      track: race.track,
      raceNumber: race.raceNumber,
      postTime: race.postTime,
      surface: race.surface,
      distance: race.distance,
      raceClass: race.raceClass,
      fieldSize: race.fieldSize,
      headline: written.headline,
      reasoning: written.reasoning,
    } satisfies RenderedDigestItem;
  });

  return { intro: output.intro, tier, generatedBy: 'llm', items };
}

/**
 * The digest for a "dark" day — none of the user's followed tracks are
 * running. A short, race-less note so the user still hears from us rather
 * than getting silence.
 */
export function buildDarkDigest(tracks: string[]): RenderedDigest {
  const where = tracks.length > 0 ? tracks.join(', ') : 'your tracks';
  return {
    intro:
      `No racing at ${where} today — none of your tracks have a card. ` +
      "We'll be back with your next digest the day they run.",
    tier: 'dark',
    generatedBy: 'fallback',
    items: [],
  };
}
