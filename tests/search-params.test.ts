import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from '@/lib/search-params';

describe('safeRedirectPath', () => {
  it('accepts a same-origin relative path', () => {
    expect(safeRedirectPath('/dashboard', '/onboarding')).toBe('/dashboard');
  });

  it('falls back when the value is missing', () => {
    expect(safeRedirectPath(null, '/onboarding')).toBe('/onboarding');
    expect(safeRedirectPath(undefined, '/onboarding')).toBe('/onboarding');
  });

  it('rejects absolute URLs', () => {
    expect(safeRedirectPath('https://evil.com', '/onboarding')).toBe(
      '/onboarding',
    );
  });

  it('rejects protocol-relative targets', () => {
    expect(safeRedirectPath('//evil.com', '/onboarding')).toBe('/onboarding');
  });

  it('rejects backslash-prefixed targets', () => {
    expect(safeRedirectPath('/\\evil.com', '/onboarding')).toBe('/onboarding');
  });

  it('rejects values that do not start with a slash', () => {
    expect(safeRedirectPath('dashboard', '/onboarding')).toBe('/onboarding');
  });
});
