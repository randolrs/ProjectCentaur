'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { useEffect } from 'react';

// Fires a $pageview on every client navigation so PostHog's auto-capture
// (disabled in the provider) is replaced by an App-Router-aware version.
export function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (!pathname || !posthog) return;
    const qs = searchParams?.toString() ?? '';
    const url = `${window.location.origin}${pathname}${qs ? `?${qs}` : ''}`;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams, posthog]);

  return null;
}
