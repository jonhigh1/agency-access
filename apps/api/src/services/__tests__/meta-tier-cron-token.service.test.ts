import { beforeEach, describe, expect, it, vi } from 'vitest';

const getPlainSecretMock = vi.fn();
const storePlainSecretMock = vi.fn();

vi.mock('@/lib/infisical.js', () => ({
  infisical: {
    getPlainSecret: (...args: unknown[]) => getPlainSecretMock(...args),
    storePlainSecret: (...args: unknown[]) => storePlainSecretMock(...args),
  },
}));

vi.mock('@/lib/env.js', () => ({
  env: {
    META_MARKETING_API_TIER_CRON_LAB_USER_ID: 'user_alex',
    META_REVIEW_LAB_USER_IDS: ['user_alex'],
  },
}));

describe('meta-tier-cron-token.service', () => {
  beforeEach(() => {
    vi.resetModules();
    getPlainSecretMock.mockReset();
    storePlainSecretMock.mockReset();
  });

  it('skips seed when meta_tier_cron_token already has an access token', async () => {
    getPlainSecretMock.mockImplementation(async (name: string) => {
      if (name === 'meta_tier_cron_token') {
        return JSON.stringify({ accessToken: 'existing-cron-token' });
      }
      throw new Error('not found');
    });

    const { seedMetaTierCronTokenFromReviewDemo } = await import('../meta-tier-cron-token.service.js');
    const result = await seedMetaTierCronTokenFromReviewDemo();

    expect(result.alreadyPresent).toBe(true);
    expect(result.seeded).toBe(false);
    expect(storePlainSecretMock).not.toHaveBeenCalled();
  });

  it('copies review_demo token into meta_tier_cron_token idempotently', async () => {
    getPlainSecretMock.mockImplementation(async (name: string) => {
      if (name === 'meta_tier_cron_token') {
        throw new Error('not found');
      }
      if (name === 'review_demo_meta_user_alex') {
        return JSON.stringify({ accessToken: 'alex-review-token', identity: { id: '61595281164997' } });
      }
      throw new Error('unexpected');
    });
    storePlainSecretMock.mockResolvedValue('meta_tier_cron_token');

    const { seedMetaTierCronTokenFromReviewDemo } = await import('../meta-tier-cron-token.service.js');
    const result = await seedMetaTierCronTokenFromReviewDemo();

    expect(result.seeded).toBe(true);
    expect(storePlainSecretMock).toHaveBeenCalledWith('meta_tier_cron_token', expect.any(String));
  });
});
