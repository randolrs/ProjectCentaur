'use client';

import { usePostHog } from 'posthog-js/react';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// Identifies the current PostHog session with the authenticated user's id by
// reading the Supabase session in the browser. Doing this client-side keeps
// the root layout from reading the auth cookie, which would otherwise force
// every page (including the static marketing pages) into dynamic rendering.
export function IdentifyUser() {
  const posthog = usePostHog();

  useEffect(() => {
    if (!posthog || typeof window === 'undefined') return;

    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        posthog.identify(
          session.user.id,
          session.user.email ? { email: session.user.email } : undefined,
        );
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        posthog.identify(
          session.user.id,
          session.user.email ? { email: session.user.email } : undefined,
        );
      } else {
        posthog.reset();
      }
    });

    return () => subscription.unsubscribe();
  }, [posthog]);

  return null;
}
