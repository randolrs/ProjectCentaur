// Typed access to environment variables. Values are read lazily at call
// time so importing a module never fails for an unrelated missing var.

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getDatabaseUrl(): string {
  return requireEnv('DATABASE_URL');
}

export interface RacingApiConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export function getRacingApiConfig(): RacingApiConfig {
  return {
    baseUrl: process.env.RACING_API_BASE_URL || 'https://api.theracingapi.com',
    username: requireEnv('RACING_API_USERNAME'),
    password: requireEnv('RACING_API_PASSWORD'),
  };
}

/** True when Racing API credentials are present — used to skip live tests. */
export function hasRacingApiCredentials(): boolean {
  return Boolean(process.env.RACING_API_USERNAME && process.env.RACING_API_PASSWORD);
}

export function getAnthropicApiKey(): string {
  return requireEnv('ANTHROPIC_API_KEY');
}

/** Shared secret guarding the cron endpoints (ingest + digest). */
export function getCronSecret(): string {
  return requireEnv('CRON_SECRET');
}

/** True when an Anthropic API key is present — used to skip live LLM tests. */
export function hasAnthropicApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Resend API key for digest email delivery. */
export function getResendApiKey(): string {
  return requireEnv('RESEND_API_KEY');
}

/**
 * The `From` address for digest emails. Defaults to Resend's shared dev
 * sender, which needs no domain verification but only delivers to the Resend
 * account owner. Set `DIGEST_FROM_EMAIL` to a verified sender for real delivery.
 */
export function getDigestFromEmail(): string {
  return process.env.DIGEST_FROM_EMAIL || 'onboarding@resend.dev';
}

/** True when Resend delivery is configured — used to skip live email tests. */
export function hasResendCredentials(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

// --- Stripe (subscription billing) -----------------------------------------

/** Stripe secret API key (server-side). */
export function getStripeSecretKey(): string {
  return requireEnv('STRIPE_SECRET_KEY');
}

/** Signing secret for the `/api/stripe/webhook` endpoint. */
export function getStripeWebhookSecret(): string {
  return requireEnv('STRIPE_WEBHOOK_SECRET');
}

/** The recurring Price the subscription Checkout is created against. */
export function getStripePriceId(): string {
  return requireEnv('STRIPE_PRICE_ID');
}

/** Publishable key — safe to expose to the browser (Payment Element). */
export function getStripePublishableKey(): string {
  return requireEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
}
