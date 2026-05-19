import {
  ACTIVE_DAY_OPTIONS,
  BET_TYPE_OPTIONS,
  DISTANCE_RANGE_OPTIONS,
  FIELD_SIZE_BAND_OPTIONS,
  type Option,
  RACE_CLASS_OPTIONS,
  SURFACE_OPTIONS,
  TIMEZONE_OPTIONS,
} from '@/lib/onboarding/options';
import { MultiPillGroup, SinglePillGroup } from './pill-group';

// Shared handicapping-preference form fields, rendered inside a <form> by
// both onboarding (blank) and the /preferences edit page (pre-filled).

/** Current values used to pre-fill the form; omit for a blank form. */
export interface PreferenceValues {
  tracks: readonly string[];
  raceClasses: readonly string[];
  distanceRanges: readonly string[];
  surfaces: readonly string[];
  fieldSizeBand: string;
  betTypes: readonly string[];
  activeDays: readonly string[];
  timezone: string;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-neutral-800 pt-6">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-neutral-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function PreferencesFields({
  current,
  trackOptions,
}: {
  current?: PreferenceValues;
  /** Canonical track names from the synced data model. */
  trackOptions: readonly string[];
}) {
  const trackOptionList: Option[] = trackOptions.map((track) => ({
    value: track,
    label: track,
  }));

  return (
    <>
      <Section
        title="Tracks"
        description="Every track we cover is on by default — switch off any you don't follow."
      >
        <MultiPillGroup
          name="tracks"
          options={trackOptionList}
          defaultSelected={current ? current.tracks : trackOptions}
        />
      </Section>

      <Section
        title="Race classes"
        description="On by default — switch off the class levels you don't play."
      >
        <MultiPillGroup
          name="raceClasses"
          options={RACE_CLASS_OPTIONS}
          defaultSelected={
            current
              ? current.raceClasses
              : RACE_CLASS_OPTIONS.map((option) => option.value)
          }
        />
      </Section>

      <Section title="Distance ranges" description="Sprints, routes, or longer.">
        <MultiPillGroup
          name="distanceRanges"
          options={DISTANCE_RANGE_OPTIONS}
          defaultSelected={current?.distanceRanges ?? []}
        />
      </Section>

      <Section title="Surfaces" description="Which surfaces do you follow?">
        <MultiPillGroup
          name="surfaces"
          options={SURFACE_OPTIONS}
          defaultSelected={current?.surfaces ?? []}
        />
      </Section>

      <Section
        title="Field size"
        description="Field size you most like to bet into."
      >
        <SinglePillGroup
          name="fieldSizeBand"
          options={FIELD_SIZE_BAND_OPTIONS}
          defaultValue={current?.fieldSizeBand || undefined}
        />
      </Section>

      <Section
        title="Bet types"
        description="Which wagers do you typically make?"
      >
        <MultiPillGroup
          name="betTypes"
          options={BET_TYPE_OPTIONS}
          defaultSelected={current?.betTypes ?? []}
        />
      </Section>

      <Section
        title="Active days"
        description="Pick the mornings you want your digest — we'll only send it on the days you choose."
      >
        <MultiPillGroup
          name="activeDays"
          options={ACTIVE_DAY_OPTIONS}
          defaultSelected={
            current
              ? current.activeDays
              : ACTIVE_DAY_OPTIONS.map((option) => option.value)
          }
        />
      </Section>

      <Section
        title="Timezone"
        description="Used to time your morning digest — we'll detect yours automatically."
      >
        <SinglePillGroup
          name="timezone"
          options={TIMEZONE_OPTIONS}
          defaultValue={current?.timezone || undefined}
          autoDetect
        />
      </Section>
    </>
  );
}
