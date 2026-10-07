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

const createStateMock = vi.fn(async () => ({ data: 'oauth-state-token', error: null }));
const getAuthUrlMock = vi.fn((_state: string, _scopes: string[], redirectUri: string) => {
  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', 'oauth-state-token');
  return url.toString();
});

vi.mock('@/services/oauth-state.service.js', () => ({
  oauthStateService: {
    createState: (...args: unknown[]) => createStateMock(...args),
    peekState: vi.fn(async () => ({ data: null, error: null })),
    validateState: vi.fn(async () => ({ data: null, error: null })),
  },
}));

vi.mock('@/services/connectors/meta.js', () => ({
  MetaConnector: class {
    getAuthUrl = getAuthUrlMock;
  },
}));

vi.mock('@/routes/client-auth/redirect-uri.js', () => ({
  resolveClientInviteCallbackUrl: () => 'https://review.authhub.co/invite/oauth-callback',
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
    createStateMock.mockClear();
    getAuthUrlMock.mockClear();
  });

  it('reports a connected mock session without Infisical tokens when mock graph is enabled', async () => {
    const { reviewDemoService } = await import('../review-demo.service.js');
    const session = await reviewDemoService.getSession('user_test', 'pages_show_list');

    expect(session.connected).toBe(true);
    expect(session.identity?.name).toContain('Review');
    expect(session.grantedPermissions).toContain('pages_show_list');
  });

  it('builds Meta OAuth redirect_uri without query params for App Review lab connect', async () => {
    const { reviewDemoService } = await import('../review-demo.service.js');
    const result = await reviewDemoService.createMetaAuthUrl({
      clerkUserId: 'user_test',
      userEmail: 'lab@test.example',
      headers: { origin: 'https://review.authhub.co' },
    });

    const authUrl = new URL(result.authUrl);
    expect(authUrl.searchParams.get('redirect_uri')).toBe('https://review.authhub.co/invite/oauth-callback');
    expect(authUrl.searchParams.get('redirect_uri')).not.toContain('flow=');

    expect(createStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewDemo: true,
        clerkUserId: 'user_test',
        redirectUrl: 'https://review.authhub.co/invite/oauth-callback',
      })
    );
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
