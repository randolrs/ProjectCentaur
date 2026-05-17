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
