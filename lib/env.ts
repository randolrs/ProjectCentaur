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
