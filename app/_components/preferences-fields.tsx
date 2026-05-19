import type { ReactNode } from 'react';
import {
  BET_TYPE_OPTIONS,
  DAYS_PER_WEEK_OPTIONS,
  DISTANCE_RANGE_OPTIONS,
  FIELD_SIZE_BAND_OPTIONS,
  type Option,
  RACE_CLASS_OPTIONS,
  SURFACE_OPTIONS,
  TIMEZONE_OPTIONS,
  TRACK_OPTIONS,
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
  daysPerWeek: number;
  timezone: string;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
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

function CheckboxGroup({
  name,
  options,
  selected,
}: {
  name: string;
  options: readonly Option[];
  selected: readonly string[];
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <label key={option.value} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            value={option.value}
            defaultChecked={selected.includes(option.value)}
            className="accent-neutral-100"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

function RadioGroup({
  name,
  options,
  selected,
}: {
  name: string;
  options: readonly Option[];
  selected: string | undefined;
}) {
  return (
    <div className="space-y-2">
      {options.map((option) => (
        <label key={option.value} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={name}
            value={option.value}
            defaultChecked={selected === option.value}
            required
            className="accent-neutral-100"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

const TRACK_OPTION_LIST: Option[] = TRACK_OPTIONS.map((track) => ({
  value: track,
  label: track,
}));

const DAYS_OPTION_LIST: Option[] = DAYS_PER_WEEK_OPTIONS.map((days) => ({
  value: String(days),
  label: String(days),
}));

export function PreferencesFields({ current }: { current?: PreferenceValues }) {
  return (
    <>
      <Section
        title="Tracks"
        description="Every track we cover is on by default — switch off any you don't follow."
      >
        <MultiPillGroup
          name="tracks"
          options={TRACK_OPTION_LIST}
          defaultSelected={current ? current.tracks : TRACK_OPTIONS}
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
        <CheckboxGroup
          name="distanceRanges"
          options={DISTANCE_RANGE_OPTIONS}
          selected={current?.distanceRanges ?? []}
        />
      </Section>

      <Section title="Surfaces" description="Which surfaces do you follow?">
        <CheckboxGroup
          name="surfaces"
          options={SURFACE_OPTIONS}
          selected={current?.surfaces ?? []}
        />
      </Section>

      <Section
        title="Field size"
        description="Field size you most like to bet into."
      >
        <RadioGroup
          name="fieldSizeBand"
          options={FIELD_SIZE_BAND_OPTIONS}
          selected={current?.fieldSizeBand}
        />
      </Section>

      <Section
        title="Bet types"
        description="Which wagers do you typically make?"
      >
        <CheckboxGroup
          name="betTypes"
          options={BET_TYPE_OPTIONS}
          selected={current?.betTypes ?? []}
        />
      </Section>

      <Section
        title="Days per week"
        description="How many days a week are you active?"
      >
        <SinglePillGroup
          name="daysPerWeek"
          options={DAYS_OPTION_LIST}
          defaultValue={current ? String(current.daysPerWeek) : undefined}
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
