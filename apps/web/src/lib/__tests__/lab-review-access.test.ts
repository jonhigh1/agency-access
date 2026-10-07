import { describe, expect, it } from 'vitest';
import { hasLabReviewAccessForClerkUser, isReviewDemoRouteEnabled } from '../lab-review-access';

describe('lab-review-access', () => {
  it('reads review demo feature flag from public env', () => {
    const previous = process.env.NEXT_PUBLIC_META_REVIEW_DEMO_ENABLED;
    process.env.NEXT_PUBLIC_META_REVIEW_DEMO_ENABLED = 'true';
    expect(isReviewDemoRouteEnabled()).toBe(true);
    process.env.NEXT_PUBLIC_META_REVIEW_DEMO_ENABLED = previous;
  });

  it('allows lab reviewer metadata and configured user ids', () => {
    process.env.NEXT_PUBLIC_META_REVIEW_LAB_USER_IDS = 'user_lab_reviewer';
    expect(
      hasLabReviewAccessForClerkUser({ id: 'user_lab_reviewer', publicMetadata: {} })
    ).toBe(true);
    expect(
      hasLabReviewAccessForClerkUser({ id: 'other', publicMetadata: { labRole: 'reviewer' } })
    ).toBe(true);
    expect(hasLabReviewAccessForClerkUser({ id: 'other', publicMetadata: {} })).toBe(false);
  });
});
