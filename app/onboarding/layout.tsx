import type { ReactNode } from 'react';
import { signOut } from '@/lib/actions/auth';

// Wraps every onboarding screen with a sign-out control, so a user mid-flow
// always has a way out.
export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <form action={signOut} className="absolute right-4 top-4 z-10">
        <button
          type="submit"
          className="text-sm text-neutral-400 hover:text-neutral-100"
        >
          Sign out
        </button>
      </form>
      {children}
    </div>
  );
}
