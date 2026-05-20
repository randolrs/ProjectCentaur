'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type { ProfileListField } from '@/lib/onboarding/persistence';
import { removeProfileListItem } from './actions';

/** A bulleted list with a per-item remove (×) button. Used on the review
 *  screen so a handicapper can prune a verbose synthesized list inline,
 *  without entering the full Edit form. */
export function EditableList({
  field,
  items,
  emptyLabel = 'None captured.',
}: {
  field: ProfileListField;
  items: readonly string[];
  emptyLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span className="mt-0.5 text-neutral-500">•</span>
          <span className="flex-1 text-neutral-100">{item}</span>
          <button
            type="button"
            disabled={pending}
            aria-label={`Remove ${item}`}
            onClick={() =>
              startTransition(async () => {
                await removeProfileListItem(field, item);
                router.refresh();
              })
            }
            className="px-1 text-base leading-none text-neutral-500 hover:text-neutral-100 disabled:opacity-50"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
