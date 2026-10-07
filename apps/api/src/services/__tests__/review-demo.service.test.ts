import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRecordedMetaGraphOps } from '@/lib/meta-graph-instrumentation.js';

vi.mock('@/services/audit.service.js', () => ({
  auditService: { createAuditLog: vi.fn(async () => ({ data: {}, error: null })) },
}));

vi.mock('@/lib/infisical.js', () => ({
  infisical: {
    getPlainSecret: vi.fn(async () => null),
    storePlainSecret: vi.fn(async () => 'review_demo_meta_user_test'),
  },
}));

vi.mock('@/lib/env.js', () => ({
  env: {
    META_REVIEW_DEMO_MOCK_GRAPH: true,
    META_REVIEW_BM_ID: '695982475048959',
    META_REVIEW_AD_ACCOUNT_ID: '557538895783894',
    META_REVIEW_PAGE_ID: '61595193599205',
    META_REVIEW_CATALOG_ID: '1858948598873838',
    META_REVIEW_LAB_AGENCY_ID: 'review-lab-agency',
  },
}));

describe('reviewDemoService mock graph payloads', () => {
  beforeEach(() => {
    clearRecordedMetaGraphOps();
  });

  it('returns sandbox-friendly pages_show_list proof', async () => {
    const { reviewDemoService } = await import('../review-demo.service.js');
    const payload = await reviewDemoService.loadStepPayload({
      clerkUserId: 'user_test',
      userEmail: 'lab@test.example',
      stepId: 'pages_show_list',
    });

    expect(payload.stepId).toBe('pages_show_list');
    if (payload.stepId === 'pages_show_list') {
      expect(payload.pages[0]?.name).toContain('Review');
    }
  });
});
