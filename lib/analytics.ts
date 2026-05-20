import { PostHog } from 'posthog-node';

// ---------------------------------------------------------------------------
// Server-side analytics — funnel events captured from server actions, the
// digest pipeline, and the Stripe webhook. PostHog's project API key is read
// from NEXT_PUBLIC_POSTHOG_KEY so client + server share one identity space;
// when the key is absent (local dev, preview without env), capture is a
// no-op so analytics never blocks the request.
//
// Funnel events emitted today:
//   signup_completed          (lib/actions/auth.ts)
//   onboarding_completed      (lib/actions/onboarding.ts)
//   conversation_completed    (app/onboarding/conversation/actions.ts)
//   profile_confirmed         (app/onboarding/review/actions.ts)
//   digest_sent               (lib/digest/pipeline.ts)
//   subscription_activated    (app/api/stripe/webhook/route.ts)
// ---------------------------------------------------------------------------

const DEFAULT_HOST = 'https://us.i.posthog.com';

let cached: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!cached) {
    cached = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_HOST,
      // Send immediately — serverless functions exit before any batching window.
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return cached;
}

/** Capture one server-side event. Awaits delivery so the function isn't
 *  killed before the request goes out. Errors are logged, never thrown. */
export async function trackEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    client.capture({ distinctId, event, properties });
    await client.flush();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[analytics] ${event} capture failed: ${message}`);
  }
}
