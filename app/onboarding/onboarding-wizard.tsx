'use client';

import { useMemo, useState } from 'react';
import { Pill } from '@/app/_components/pill-group';
import { saveOnboarding } from '@/lib/actions/onboarding';
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

// One-at-a-time structured onboarding. Each deterministic characteristic is
// its own step; "Skip" stores the no-filter value (every option / "any"),
// never an empty selection.

interface WizardStep {
  name: string;
  kind: 'multi' | 'single';
  title: string;
  description: string;
  options: readonly Option[];
  /** Values stored when the step is skipped; null = no skip (timezone). */
  skip: readonly string[] | null;
  skipLabel: string;
  autoDetect?: boolean;
}

function buildSteps(trackOptions: readonly string[]): WizardStep[] {
  return [
    {
      name: 'tracks',
      kind: 'multi',
      title: 'Tracks',
      description: 'Which tracks do you want covered?',
      options: trackOptions.map((t) => ({ value: t, label: t })),
      skip: trackOptions,
      skipLabel: 'Skip — all tracks',
    },
    {
      name: 'raceClasses',
      kind: 'multi',
      title: 'Race classes',
      description: 'Which class levels do you play?',
      options: RACE_CLASS_OPTIONS,
      skip: RACE_CLASS_OPTIONS.map((o) => o.value),
      skipLabel: 'Skip — all classes',
    },
    {
      name: 'distanceRanges',
      kind: 'multi',
      title: 'Distance ranges',
      description: 'Sprints, routes, or longer?',
      options: DISTANCE_RANGE_OPTIONS,
      skip: DISTANCE_RANGE_OPTIONS.map((o) => o.value),
      skipLabel: 'Skip — all distances',
    },
    {
      name: 'surfaces',
      kind: 'multi',
      title: 'Surfaces',
      description: 'Which surfaces do you follow?',
      options: SURFACE_OPTIONS.filter((o) => o.value !== 'all'),
      skip: ['all'],
      skipLabel: 'Skip — any surface',
    },
    {
      name: 'fieldSizeBand',
      kind: 'single',
      title: 'Field size',
      description: 'The field size you most like to bet into.',
      options: FIELD_SIZE_BAND_OPTIONS.filter((o) => o.value !== 'any'),
      skip: ['any'],
      skipLabel: 'Skip — no preference',
    },
    {
      name: 'betTypes',
      kind: 'multi',
      title: 'Bet types',
      description: 'Which wagers do you typically make?',
      options: BET_TYPE_OPTIONS,
      skip: BET_TYPE_OPTIONS.map((o) => o.value),
      skipLabel: 'Skip — all bet types',
    },
    {
      name: 'activeDays',
      kind: 'multi',
      title: 'Active days',
      description: 'Which mornings do you want your digest?',
      options: ACTIVE_DAY_OPTIONS,
      skip: ACTIVE_DAY_OPTIONS.map((o) => o.value),
      skipLabel: 'Skip — every day',
    },
    {
      name: 'timezone',
      kind: 'single',
      title: 'Timezone',
      description: "Used to time your morning digest — we've detected yours.",
      options: TIMEZONE_OPTIONS,
      skip: null,
      skipLabel: '',
      autoDetect: true,
    },
  ];
}

/** Starting selection for a step — a saved value, the detected timezone, or none. */
function initialSelection(
  step: WizardStep,
  saved: readonly string[] | undefined,
): string[] {
  if (saved) return [...saved];
  if (step.autoDetect) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return step.options.some((o) => o.value === tz) ? [tz] : [];
  }
  return [];
}

export function OnboardingWizard({
  trackOptions,
}: {
  trackOptions: readonly string[];
}) {
  const steps = useMemo(() => buildSteps(trackOptions), [trackOptions]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [current, setCurrent] = useState<string[]>(() =>
    initialSelection(steps[0]!, undefined),
  );
  const [submitting, setSubmitting] = useState(false);

  const step = steps[index]!;
  const isLast = index === steps.length - 1;

  function toggle(value: string): void {
    if (step.kind === 'single') {
      setCurrent([value]);
      return;
    }
    setCurrent((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  async function commit(values: string[]): Promise<void> {
    const nextAnswers = { ...answers, [step.name]: values };
    if (isLast) {
      setSubmitting(true);
      const formData = new FormData();
      for (const s of steps) {
        for (const value of nextAnswers[s.name] ?? []) {
          formData.append(s.name, value);
        }
      }
      await saveOnboarding(formData);
      return;
    }
    setAnswers(nextAnswers);
    const next = steps[index + 1]!;
    setCurrent(initialSelection(next, nextAnswers[next.name]));
    setIndex(index + 1);
  }

  function goBack(): void {
    if (index === 0) return;
    const prev = steps[index - 1]!;
    setCurrent(initialSelection(prev, answers[prev.name]));
    setIndex(index - 1);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          Step {index + 1} of {steps.length}
        </p>
        <div className="h-1 w-full rounded bg-neutral-800">
          <div
            className="h-1 rounded bg-neutral-100 transition-all"
            style={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{step.title}</h2>
        <p className="text-sm text-neutral-400">{step.description}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {step.options.map((option) => (
          <Pill
            key={option.value}
            label={option.label}
            active={current.includes(option.value)}
            onClick={() => toggle(option.value)}
          />
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-neutral-800 pt-5">
        {index > 0 ? (
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="text-sm text-neutral-400 hover:text-neutral-100 disabled:opacity-50"
          >
            Back
          </button>
        ) : null}
        <div className="ml-auto flex items-center gap-3">
          {step.skip ? (
            <button
              type="button"
              onClick={() => commit([...(step.skip ?? [])])}
              disabled={submitting}
              className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:border-neutral-400 disabled:opacity-50"
            >
              {step.skipLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => commit(current)}
            disabled={submitting || current.length === 0}
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
          >
            {submitting ? 'Saving…' : isLast ? 'Finish' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
