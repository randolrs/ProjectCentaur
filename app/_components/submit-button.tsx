'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

/** Submit button for server-action <form>s — disables and shows pending
 *  text while the action is in flight. Must be rendered inside the form. */
export function SubmitButton({
  children,
  pendingText,
  className,
}: {
  children: ReactNode;
  pendingText: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}
