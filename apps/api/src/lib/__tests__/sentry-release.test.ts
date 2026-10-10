import { describe, expect, it } from 'vitest';
import { resolveSentryRelease } from '../sentry-release.js';

describe('resolveSentryRelease', () => {
  it('returns the first non-blank candidate', () => {
    expect(resolveSentryRelease(undefined, '  ', 'abc123', 'other')).toBe('abc123');
    expect(resolveSentryRelease('v1.2.3', 'abc123')).toBe('v1.2.3');
  });

  it('returns undefined when nothing usable is set', () => {
    expect(resolveSentryRelease()).toBeUndefined();
    expect(resolveSentryRelease('', '   ', undefined)).toBeUndefined();
  });
});
