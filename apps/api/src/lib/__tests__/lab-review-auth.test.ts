import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveLabReviewAccess } from '../lab-review-auth.js';

vi.mock('../env.js', () => ({
  env: {
    META_REVIEW_DEMO_ENABLED: true,
    META_REVIEW_LAB_USER_IDS: ['user_3KLeCX4cZ6OTWYjNm8Y9Z5dqdnC'],
    META_REVIEW_LAB_EMAILS: [],
  },
}));

describe('resolveLabReviewAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows configured lab reviewer user ids', async () => {
    const result = await resolveLabReviewAccess({ sub: 'user_3KLeCX4cZ6OTWYjNm8Y9Z5dqdnC' });
    expect(result.error).toBeNull();
    expect(result.data?.userId).toBe('user_3KLeCX4cZ6OTWYjNm8Y9Z5dqdnC');
  });

  it('rejects users without lab metadata or allowlist', async () => {
    const result = await resolveLabReviewAccess({ sub: 'user_other' });
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe('FORBIDDEN');
  });
});
