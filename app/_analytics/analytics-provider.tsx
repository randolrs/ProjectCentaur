'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { type ReactNode, useEffect } from 'react';

// Client-side PostHog provider. App Router pageview capture is manual (see
// pageview-tracker.tsx) because the SDK's auto-capture doesn't reliably
// fire on Next.js client navigations.

let initialized = false;

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (initialized) return;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    posthog.init(key, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      capture_pageview: false,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
    });
    initialized = true;
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
