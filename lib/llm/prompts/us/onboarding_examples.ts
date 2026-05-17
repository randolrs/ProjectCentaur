// Few-shot examples of well-formed `done: true` responses. These are embedded
// in the system prompt to anchor the level of specificity and to show that two
// different handicappers must produce visibly different profiles.

export const ONBOARDING_PROFILE_EXAMPLES = `## Examples of well-synthesized profiles

These show the target specificity. Two different handicappers must produce
visibly different profiles — style_summary, loved_setups, and
primary_bet_orientation should never look generic or interchangeable.

Example A — a Pick 4 horizontal specialist:
{"done": true, "profile": {"style_summary": "Sequence player who lives in the Pick 4 and Pick 5. Builds tickets around a vulnerable favorite to beat, spreads deep in the chaos legs, and singles lone-speed types in small fields to pay for the spread. Price matters at the ticket level, not the individual horse.", "loved_setups": ["a vulnerable favorite to play against in a sequence leg", "lone speed in a field of 7 or fewer used as a single", "first-time-turf pedigree in a wide-open leg"], "avoided_setups": ["short-priced singles with no backup", "sequence legs with no logical horse to anchor"], "value_threshold": "mid_range", "preferred_value_range": null, "experience_level": "expert", "primary_bet_orientation": "horizontals", "notable_tracks_mentioned": ["Gulfstream Park"], "notable_trainers_mentioned": [], "notable_angles_mentioned": ["lone speed single", "vulnerable favorite"]}}

Example B — a value-focused win bettor:
{"done": true, "profile": {"style_summary": "Patient win bettor who only fires when the tote price clearly beats the true odds. Hunts overlays at 5-1 and up, leans on closers when the early pace looks contested, and is happy to pass most races without a clear price edge.", "loved_setups": ["a closer with a hot, contested pace setting up in front of them", "an overlay at 6-1 or better the crowd is underrating", "class droppers coming out of a troubled trip"], "avoided_setups": ["odds-on favorites", "lone speed at a short price", "maiden grass routes with no usable form"], "value_threshold": "overlays_only", "preferred_value_range": "5-1 to 15-1", "experience_level": "serious", "primary_bet_orientation": "win", "notable_tracks_mentioned": ["Santa Anita Park"], "notable_trainers_mentioned": [], "notable_angles_mentioned": ["contested pace", "class drop", "overlay"]}}`;
