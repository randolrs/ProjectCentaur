'use client';

import { useEffect, useState } from 'react';
import type { Option } from '@/lib/onboarding/options';

// Toggle-pill selectors for the handicapping form. Each group keeps its
// selection in client state and mirrors it into hidden <input>s, so the
// surrounding native <form> submits exactly as the old checkboxes did.

const pillBase =
  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors';
const pillActive =
  'border-transparent bg-neutral-100 font-medium text-neutral-900';
const pillIdle =
  'border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200';

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`${pillBase} ${active ? pillActive : pillIdle}`}
    >
      {/* Always rendered so the pill keeps a stable width when toggled. */}
      <span aria-hidden="true" className={active ? '' : 'opacity-0'}>
        ✓
      </span>
      {label}
    </button>
  );
}

/** Multi-select pill group — submits one hidden input per selected value. */
export function MultiPillGroup({
  name,
  options,
  defaultSelected,
}: {
  name: string;
  options: readonly Option[];
  defaultSelected: readonly string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultSelected),
  );

  function toggle(value: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Pill
          key={option.value}
          label={option.label}
          active={selected.has(option.value)}
          onClick={() => toggle(option.value)}
        />
      ))}
      {[...selected].map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
    </div>
  );
}

/** Single-select pill group — submits one hidden input for the chosen value. */
export function SinglePillGroup({
  name,
  options,
  defaultValue,
  autoDetect,
}: {
  name: string;
  options: readonly Option[];
  defaultValue?: string;
  autoDetect?: boolean;
}) {
  const [value, setValue] = useState<string>(defaultValue ?? '');

  // When no value is pre-filled, seed it from the browser's timezone.
  useEffect(() => {
    if (!autoDetect || value) return;
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (options.some((option) => option.value === detected)) {
      setValue(detected);
    }
  }, [autoDetect, options, value]);

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Pill
          key={option.value}
          label={option.label}
          active={value === option.value}
          onClick={() => setValue(option.value)}
        />
      ))}
      {value ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}
