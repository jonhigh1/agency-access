import { beforeEach, describe, expect, it, vi } from 'vitest';

const deleteSecretMock = vi.fn();

vi.mock('@/lib/infisical.js', () => ({
  infisical: {
    deleteSecret: (...args: unknown[]) => deleteSecretMock(...args),
    getPlainSecret: vi.fn(async () => null),
    storePlainSecret: vi.fn(),
  },
}));

vi.mock('@/services/audit.service.js', () => ({
  auditService: { createAuditLog: vi.fn(async () => ({ data: {}, error: null })) },
}));

vi.mock('@/lib/env.js', () => ({
  env: {
    META_REVIEW_DEMO_MOCK_GRAPH: false,
    META_REVIEW_AGENCY_BM_ID: '3808519629379919',
  },
}));

describe('reviewDemoService.disconnectMeta', () => {
  beforeEach(() => {
    vi.resetModules();
    deleteSecretMock.mockReset();
  });

  it('deletes only the clerk user review_demo secret and never meta_tier_cron_token', async () => {
    const { reviewDemoService } = await import('../review-demo.service.js');
    await reviewDemoService.disconnectMeta({
      clerkUserId: 'user_lab',
      userEmail: 'lab@test.example',
    });

    expect(deleteSecretMock).toHaveBeenCalledTimes(1);
    expect(deleteSecretMock).toHaveBeenCalledWith('review_demo_meta_user_lab');
    expect(deleteSecretMock).not.toHaveBeenCalledWith('meta_tier_cron_token');
  });
});
