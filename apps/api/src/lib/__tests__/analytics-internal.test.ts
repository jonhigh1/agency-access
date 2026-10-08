import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env.js', () => ({
  env: {
    ANALYTICS_INTERNAL_IDS: ['agency-internal', ' user_internal '],
    INTERNAL_ADMIN_USER_IDS: ['user_admin'],
    META_REVIEW_LAB_USER_IDS: [],
  },
}));

import {
  buildAnalyticsInternalIdSet,
  isAnalyticsInternal,
  matchesAnalyticsInternalIds,
} from '../analytics-internal.js';

describe('analytics-internal', () => {
  it('matches agency ids and Clerk user ids from every allowlist', () => {
    expect(isAnalyticsInternal(['agency-internal'])).toBe(true);
    expect(isAnalyticsInternal(['agency-x', 'user_internal'])).toBe(true);
    expect(isAnalyticsInternal(['agency-x', 'user_admin'])).toBe(true);
  });

  it('is false for unknown, null, or missing candidates', () => {
    expect(isAnalyticsInternal(['agency-x', 'user_x'])).toBe(false);
    expect(isAnalyticsInternal([null, undefined])).toBe(false);
    expect(isAnalyticsInternal([])).toBe(false);
  });

  it('defaults to not internal when the allowlist is empty', () => {
    expect(matchesAnalyticsInternalIds(['anything'], buildAnalyticsInternalIdSet([[], undefined]))).toBe(
      false
    );
  });

  it('trims and drops blank entries', () => {
    const ids = buildAnalyticsInternalIdSet([[' a ', '', '  '], ['b']]);
    expect([...ids].sort()).toEqual(['a', 'b']);
  });
});
