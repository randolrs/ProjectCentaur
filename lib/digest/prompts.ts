import type { HandicapperProfileRow, UserPreferencesRow } from '@/db/schema';
import { DIGEST_SYSTEM_PROMPT } from '@/lib/llm/prompts/us/digest_system';
import type { Runner } from '@/lib/racing/types';
import type { ScoredRace } from './select';

// Region-agnostic accessors for the digest prompts. v1 is US-only.

/** The static digest system prompt (sent with prompt caching). */
export function digestSystemPrompt(): string {
  return DIGEST_SYSTEM_PROMPT;
}

function profileSection(
  profile: HandicapperProfileRow,
  prefs: UserPreferencesRow,
): string {
  const list = (xs: string[]) => (xs.length > 0 ? xs.join('; ') : 'none noted');
  return [
    'HANDICAPPER PROFILE',
    `- How they play: ${profile.styleSummary}`,
    `- Setups they love: ${list(profile.lovedSetups)}`,
    `- Setups they avoid: ${list(profile.avoidedSetups)}`,
    `- Value threshold: ${profile.valueThreshold}` +
      (profile.preferredValueRange
        ? ` (preferred range ${profile.preferredValueRange})`
        : ''),
    `- Experience level: ${profile.experienceLevel}`,
    `- Primary bet orientation: ${profile.primaryBetOrientation}`,
    `- Notable tracks: ${list(profile.notableTracksMentioned)}`,
    `- Notable trainers: ${list(profile.notableTrainersMentioned)}`,
    `- Notable angles: ${list(profile.notableAnglesMentioned)}`,
    `- Bet types used: ${prefs.betTypes.join(', ')}`,
  ].join('\n');
}

/**
 * One runner line for the digest prompt: program number, horse, ML odds,
 * and the field detail a handicapper reads — jockey, trainer, post
 * position, weight, and any medication / equipment. Absent fields are
 * omitted cleanly.
 */
export function runnerLine(runner: Runner): string {
  const number = runner.programNumber ? `${runner.programNumber}. ` : '';
  const name = runner.horseName ?? 'Unknown';
  const odds = runner.morningLineOdds ? ` (ML ${runner.morningLineOdds})` : '';
  const connections = [
    runner.jockey ? `J ${runner.jockey.name}` : null,
    runner.trainer ? `T ${runner.trainer.name}` : null,
  ].filter((part): part is string => part !== null);
  const extras = [
    runner.postPosition ? `PP ${runner.postPosition}` : null,
    runner.weight ? `${runner.weight} lbs` : null,
    runner.medication,
    runner.equipment,
  ].filter((part): part is string => Boolean(part));
  const detail = [connections.join(' / '), ...extras]
    .filter((part) => part.length > 0)
    .join(' · ');
  return `    ${number}${name}${odds}${detail ? ` — ${detail}` : ''}`;
}

/** Read a number from a raw provider field that may arrive as number or string. */
function pickAmount(raw: unknown, key: string): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = (raw as Record<string, unknown>)[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** Format a US dollar amount compactly — $5,000 → $5K, $7,500 → $7.5K. */
function dollarsCompact(amount: number): string {
  if (amount >= 1000 && amount % 1000 === 0) return `$${amount / 1000}K`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString('en-US')}`;
}

/** "claim $5K-$10K" / "claim $5K" — the actual class tag of a claiming race. */
function claimRangeText(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) {
    return min === max
      ? `claim ${dollarsCompact(min)}`
      : `claim ${dollarsCompact(min)}-${dollarsCompact(max)}`;
  }
  const single = (min ?? max) as number;
  return `claim ${dollarsCompact(single)}`;
}

function raceSection(scored: ScoredRace): string {
  const { race } = scored;
  const number = race.raceNumber === null ? '' : ` Race ${race.raceNumber}`;
  const post = race.postTime ? ` · post ${race.postTime}` : '';
  const live = race.runners.filter((r) => !r.scratched).slice(0, 14);

  const claim = claimRangeText(
    pickAmount(race.rawData, 'min_claim_price'),
    pickAmount(race.rawData, 'max_claim_price'),
  );
  const purseText = race.purse
    ? ` · purse $${race.purse.toLocaleString('en-US')}`
    : '';
  const claimText = claim ? ` · ${claim}` : '';

  return [
    `[race_key: ${race.key}]`,
    `${race.track}${number}${post}`,
    `  ${race.raceClass ?? 'Class n/a'} · ${race.surface ?? 'Surface n/a'} · ` +
      `${race.distance ?? 'Distance n/a'} · field of ${race.fieldSize}` +
      `${purseText}${claimText}`,
    race.conditions ? `  Conditions: ${race.conditions}` : null,
    `  Cleared your filters because: ${scored.matchReasons.join('; ')}.`,
    live.length > 0 ? '  Runners:' : '  Runners: none listed',
    ...live.map(runnerLine),
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

/**
 * Render the user message for a digest run: the handicapper profile followed
 * by every selected race with its `race_key`, structured fields, and runners.
 */
export function renderDigestContext(
  profile: HandicapperProfileRow,
  prefs: UserPreferencesRow,
  scored: ScoredRace[],
  raceDate: string,
): string {
  return [
    profileSection(profile, prefs),
    '',
    `TODAY'S RACES (${raceDate}) — ${scored.length} in total`,
    '',
    ...scored.map(raceSection),
    '',
    'Write the digest now. Cover every race above, each exactly once.',
  ].join('\n');
}
