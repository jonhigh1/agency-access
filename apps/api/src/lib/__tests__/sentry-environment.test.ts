import { describe, expect, it } from 'vitest';
import { resolveSentryEnvironment } from '@/lib/sentry-environment';

describe('resolveSentryEnvironment', () => {
  it('keeps NODE_ENV when SENTRY_ENVIRONMENT is unset (prod unchanged)', () => {
    expect(resolveSentryEnvironment(undefined, 'production')).toBe('production');
    expect(resolveSentryEnvironment('', 'production')).toBe('production');
    expect(resolveSentryEnvironment('   ', 'test')).toBe('test');
  });

  it('prefers SENTRY_ENVIRONMENT when set', () => {
    expect(resolveSentryEnvironment('staging', 'production')).toBe('staging');
    expect(resolveSentryEnvironment(' staging ', 'production')).toBe('staging');
  });

  it('falls back to development when nothing is set', () => {
    expect(resolveSentryEnvironment(undefined, undefined)).toBe('development');
    expect(resolveSentryEnvironment()).toBe('development');
  });
});
