import type { UserPreferencesRow } from '@/db/schema';
import type { HandicapperProfile } from './schema';

// ---------------------------------------------------------------------------
// Fallback profile synthesis.
//
// Used when the conversation cannot be completed by the LLM (repeated parse
// failures, API errors, or the hard turn cap). Produces a minimal but valid
// HandicapperProfile from the deterministic M1 structured answers alone, so
// onboarding always terminates with a usable profile.
// ---------------------------------------------------------------------------

function experienceFromBankroll(
  tier: string,
): HandicapperProfile['experience_level'] {
  if (tier === 'serious') return 'expert';
  if (tier === 'regular') return 'serious';
  return 'casual';
}

function betOrientation(
  betTypes: readonly string[],
): HandicapperProfile['primary_bet_orientation'] {
  const has = (v: string) => betTypes.includes(v);
  if (betTypes.some((t) => t.startsWith('pick_'))) return 'horizontals';
  if (has('exacta') || has('trifecta')) return 'exactas';
  if ((has('place') || has('show')) && !has('win')) return 'place_show';
  if (has('win')) return 'win';
  return 'mixed';
}

/** Build a minimal, schema-valid profile from the M1 structured answers. */
export function synthesizeFallbackProfile(
  prefs: UserPreferencesRow,
): HandicapperProfile {
  const tracks = prefs.tracks.join(', ');
  const surfaces = prefs.surfaces.join(', ');

  const style_summary =
    `Handicapper focused on ${prefs.fieldSizeBand} fields across ${tracks}, ` +
    `playing ${prefs.raceClasses.join(', ')} races on ${surfaces}. ` +
    'Profile assembled from the structured intake; the onboarding ' +
    'conversation did not complete.';

  return {
    style_summary: style_summary.slice(0, 500),
    loved_setups: [
      `${prefs.fieldSizeBand} fields`,
      `${prefs.distanceRanges.join(', ')} distances on ${surfaces}`,
    ],
    avoided_setups: ['races outside the followed tracks and class levels'],
    value_threshold: 'mid_range',
    preferred_value_range: null,
    experience_level: experienceFromBankroll(prefs.bankrollTier),
    primary_bet_orientation: betOrientation(prefs.betTypes),
    notable_tracks_mentioned: prefs.tracks.slice(0, 10),
    notable_trainers_mentioned: [],
    notable_angles_mentioned: [],
    version: 1,
  };
}
