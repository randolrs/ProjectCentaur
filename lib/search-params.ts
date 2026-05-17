// Next.js passes search params as `string | string[] | undefined`. These
// helpers keep page components tidy when reading single-value params.

export type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Guards post-auth redirects against open-redirect attacks: only same-origin
// relative paths are accepted. Protocol-relative (`//host`) and backslash
// (`/\host`, which some browsers normalize to `//host`) targets are rejected.
export function safeRedirectPath(
  value: string | null | undefined,
  fallback: string,
): string {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return fallback;
  }
  if (value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
}
