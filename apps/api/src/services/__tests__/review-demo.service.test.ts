import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRecordedMetaGraphOps } from '@/lib/meta-graph-instrumentation.js';

vi.mock('@/services/audit.service.js', () => ({
  auditService: { createAuditLog: vi.fn(async () => ({ data: {}, error: null })) },
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

const verifyAdAccountAgencyAccessMock = vi.fn();
const grantAgencyPartnerAccessMock = vi.fn();
const verifyAgencyPartnerAccessMock = vi.fn();
const resolvePageAccessTokenPhaseMock = vi.fn();

vi.mock('@/services/meta-partner.service.js', () => ({
  metaPartnerService: {
    verifyAdAccountAgencyAccess: (...args: unknown[]) => verifyAdAccountAgencyAccessMock(...args),
    grantAgencyPartnerAccess: (...args: unknown[]) => grantAgencyPartnerAccessMock(...args),
    verifyAgencyPartnerAccess: (...args: unknown[]) => verifyAgencyPartnerAccessMock(...args),
    resolvePageAccessTokenPhase: (...args: unknown[]) => resolvePageAccessTokenPhaseMock(...args),
  },
}));

vi.mock('@/lib/infisical.js', () => ({
  infisical: {
    getPlainSecret: vi.fn(async () =>
      JSON.stringify({
        accessToken: 'client-token',
        identity: { id: '122095319343509372', name: 'Alex Reviewer' },
      })
    ),
    storePlainSecret: vi.fn(async () => 'review_demo_meta_user_test'),
  },
}));

vi.mock('@/lib/env.js', () => ({
  env: {
    META_REVIEW_DEMO_MOCK_GRAPH: true,
    META_REVIEW_BM_ID: '695982475048959',
    META_REVIEW_AD_ACCOUNT_ID: '557538895783894',
    META_REVIEW_PAGE_ID: '1373353139192376',
    META_REVIEW_AGENCY_BM_ID: '3808519629379919',
    META_REVIEW_LAB_AGENCY_ID: 'review-lab-agency',
    META_REVIEW_SANDBOX_META_USER_ID: '122095319343509372',
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

describe('reviewDemoService manual ad account check access', () => {
  beforeEach(() => {
    vi.resetModules();
    clearRecordedMetaGraphOps();
    verifyAdAccountAgencyAccessMock.mockReset();
    grantAgencyPartnerAccessMock.mockReset();
  });

  it('uses Graph readback only and never posts ad account partner grant', async () => {
    vi.doMock('@/lib/env.js', () => ({
      env: {
        META_REVIEW_DEMO_MOCK_GRAPH: false,
        META_REVIEW_BM_ID: '695982475048959',
        META_REVIEW_AD_ACCOUNT_ID: '557538895783894',
        META_REVIEW_PAGE_ID: '1373353139192376',
        META_REVIEW_AGENCY_BM_ID: '3808519629379919',
        META_REVIEW_LAB_AGENCY_ID: 'review-lab-agency',
      },
    }));

    verifyAdAccountAgencyAccessMock.mockResolvedValue({
      verified: true,
      assignedTasks: ['ADVERTISE', 'ANALYZE'],
    });

    vi.doMock('@/lib/meta-graph-instrumentation.js', () => ({
      getRecordedMetaGraphOps: () => [],
      metaGraphFetch: vi.fn(async (url: string) => {
        if (url.includes('act_557538895783894?fields')) {
          return {
            ok: true,
            json: async () => ({ id: 'act_557538895783894', name: 'Review Ad Account' }),
          };
        }
        if (url.includes('3808519629379919?fields')) {
          return { ok: true, json: async () => ({ id: '3808519629379919', name: 'Agency BM' }) };
        }
        throw new Error(`Unexpected graph URL: ${url}`);
      }),
    }));

    const { reviewDemoService } = await import('../review-demo.service.js');
    const payload = await reviewDemoService.checkAdAccountAgencyPartner({
      clerkUserId: 'user_test',
      userEmail: 'lab@test.example',
    });

    expect(grantAgencyPartnerAccessMock).not.toHaveBeenCalled();
    expect(verifyAdAccountAgencyAccessMock).toHaveBeenCalled();
    expect(payload.stepId).toBe('ads_management');
    if (payload.stepId === 'ads_management') {
      expect(payload.agencyPartner.verified).toBe(true);
    }
  });

  it('surfaces Meta Graph error codes when partner readback fails', async () => {
    vi.doMock('@/lib/env.js', () => ({
      env: {
        META_REVIEW_DEMO_MOCK_GRAPH: false,
        META_REVIEW_BM_ID: '695982475048959',
        META_REVIEW_AD_ACCOUNT_ID: '557538895783894',
        META_REVIEW_PAGE_ID: '1373353139192376',
        META_REVIEW_AGENCY_BM_ID: '3808519629379919',
        META_REVIEW_LAB_AGENCY_ID: 'review-lab-agency',
      },
    }));

    verifyAdAccountAgencyAccessMock.mockRejectedValue(
      new Error(
        'Failed to verify Meta agency permissions: {"error":{"code":3,"message":"Application does not have the capability to make this API call"}}'
      )
    );

    vi.doMock('@/lib/meta-graph-instrumentation.js', () => ({
      getRecordedMetaGraphOps: () => [],
      metaGraphFetch: vi.fn(async (url: string) => {
        if (url.includes('act_557538895783894?fields')) {
          return {
            ok: true,
            json: async () => ({ id: 'act_557538895783894', name: 'Review Ad Account' }),
          };
        }
        if (url.includes('3808519629379919?fields')) {
          return { ok: true, json: async () => ({ id: '3808519629379919', name: 'Agency BM' }) };
        }
        throw new Error(`Unexpected graph URL: ${url}`);
      }),
    }));

    const { reviewDemoService } = await import('../review-demo.service.js');
    const payload = await reviewDemoService.checkAdAccountAgencyPartner({
      clerkUserId: 'user_test',
      userEmail: 'lab@test.example',
    });

    expect(payload.stepId).toBe('ads_management');
    if (payload.stepId === 'ads_management') {
      expect(payload.emptyState?.code).toBe('graph_error');
      expect(payload.agencyPartner.metaErrorCode).toBe(3);
    }
  });
});

describe('reviewDemoService business_management sandbox scope', () => {
  beforeEach(() => {
    vi.resetModules();
    clearRecordedMetaGraphOps();
    verifyAdAccountAgencyAccessMock.mockReset();
    verifyAgencyPartnerAccessMock.mockReset();
    resolvePageAccessTokenPhaseMock.mockReset();
    resolvePageAccessTokenPhaseMock.mockResolvedValue({ obtained: true, source: 'page_fields' });
    verifyAgencyPartnerAccessMock.mockResolvedValue({
      verified: false,
      assignedTasks: [],
    });
  });

  it('returns only configured sandbox assets instead of the full BM inventory', async () => {
    vi.doMock('@/lib/env.js', () => ({
      env: {
        META_REVIEW_DEMO_MOCK_GRAPH: false,
        META_REVIEW_BM_ID: '695982475048959',
        META_REVIEW_AD_ACCOUNT_ID: '557538895783894',
        META_REVIEW_PAGE_ID: '1373353139192376',
        META_REVIEW_AGENCY_BM_ID: '3808519629379919',
        META_REVIEW_LAB_AGENCY_ID: 'review-lab-agency',
      },
    }));

    verifyAdAccountAgencyAccessMock.mockResolvedValue({
      verified: true,
      assignedTasks: ['ADVERTISE', 'ANALYZE'],
    });

    vi.doMock('@/lib/meta-graph-instrumentation.js', () => ({
      getRecordedMetaGraphOps: () => [],
      metaGraphFetch: vi.fn(async (url: string) => {
        if (url.includes('695982475048959?fields')) {
          return { ok: true, json: async () => ({ id: '695982475048959', name: 'Review BM' }) };
        }
        if (url.includes('1373353139192376?fields')) {
          return { ok: true, json: async () => ({ id: '1373353139192376', name: 'Ah-Review-Page' }) };
        }
        if (url.includes('act_557538895783894?fields')) {
          return {
            ok: true,
            json: async () => ({ id: 'act_557538895783894', name: 'Review Ad Account' }),
          };
        }
        if (url.includes('3808519629379919?fields')) {
          return { ok: true, json: async () => ({ id: '3808519629379919', name: 'Agency BM' }) };
        }
        throw new Error(`Unexpected graph URL: ${url}`);
      }),
    }));

    const { reviewDemoService } = await import('../review-demo.service.js');
    const payload = await reviewDemoService.loadStepPayload({
      clerkUserId: 'user_test',
      userEmail: 'lab@test.example',
      stepId: 'business_management',
    });

    expect(payload.stepId).toBe('business_management');
    if (payload.stepId === 'business_management') {
      expect(payload.assets).toHaveLength(3);
      expect(payload.assets.map((asset) => asset.id)).toEqual([
        '695982475048959',
        '1373353139192376',
        'act_557538895783894',
      ]);
      expect(payload.assets.some((asset) => asset.name.includes('ATX'))).toBe(false);
    }
  });

  it('returns a misconfigured state when sandbox env ids are missing', async () => {
    vi.doMock('@/lib/env.js', () => ({
      env: {
        META_REVIEW_DEMO_MOCK_GRAPH: false,
        META_REVIEW_BM_ID: '',
        META_REVIEW_AD_ACCOUNT_ID: '',
        META_REVIEW_PAGE_ID: '',
        META_REVIEW_AGENCY_BM_ID: '3808519629379919',
        META_REVIEW_LAB_AGENCY_ID: 'review-lab-agency',
      },
    }));

    vi.doMock('@/lib/meta-graph-instrumentation.js', () => ({
      getRecordedMetaGraphOps: () => [],
      metaGraphFetch: vi.fn(async () => {
        throw new Error('Graph should not be called when sandbox is misconfigured');
      }),
    }));

    const { reviewDemoService } = await import('../review-demo.service.js');
    const payload = await reviewDemoService.loadStepPayload({
      clerkUserId: 'user_test',
      userEmail: 'lab@test.example',
      stepId: 'business_management',
    });

    expect(payload.stepId).toBe('business_management');
    if (payload.stepId === 'business_management') {
      expect(payload.sandboxMisconfigured).toBe(true);
      expect(payload.assets).toEqual([]);
    }
  });

  it('shows a neutral pending state when Page token cannot be resolved on load', async () => {
    vi.doMock('@/lib/env.js', () => ({
      env: {
        META_REVIEW_DEMO_MOCK_GRAPH: false,
        META_REVIEW_BM_ID: '695982475048959',
        META_REVIEW_AD_ACCOUNT_ID: '557538895783894',
        META_REVIEW_PAGE_ID: '1373353139192376',
        META_REVIEW_AGENCY_BM_ID: '3808519629379919',
        META_REVIEW_LAB_AGENCY_ID: 'review-lab-agency',
      },
    }));

    verifyAdAccountAgencyAccessMock.mockResolvedValue({
      verified: true,
      assignedTasks: ['ADVERTISE', 'ANALYZE'],
    });
    resolvePageAccessTokenPhaseMock.mockResolvedValue({ obtained: false });

    vi.doMock('@/lib/meta-graph-instrumentation.js', () => ({
      getRecordedMetaGraphOps: () => [],
      metaGraphFetch: vi.fn(async (url: string) => {
        if (url.includes('695982475048959?fields')) {
          return { ok: true, json: async () => ({ id: '695982475048959', name: 'Review BM' }) };
        }
        if (url.includes('1373353139192376?fields')) {
          return { ok: true, json: async () => ({ id: '1373353139192376', name: 'Ah-Review-Page' }) };
        }
        if (url.includes('act_557538895783894?fields')) {
          return {
            ok: true,
            json: async () => ({ id: 'act_557538895783894', name: 'Review Ad Account' }),
          };
        }
        if (url.includes('3808519629379919?fields')) {
          return { ok: true, json: async () => ({ id: '3808519629379919', name: 'Agency BM' }) };
        }
        throw new Error(`Unexpected graph URL: ${url}`);
      }),
    }));

    const { reviewDemoService } = await import('../review-demo.service.js');
    const payload = await reviewDemoService.loadStepPayload({
      clerkUserId: 'user_test',
      userEmail: 'lab@test.example',
      stepId: 'business_management',
    });

    expect(verifyAgencyPartnerAccessMock).not.toHaveBeenCalled();
    expect(payload.stepId).toBe('business_management');
    if (payload.stepId === 'business_management') {
      expect(payload.pagePartner?.pendingMessage).toContain('Not checked yet');
      expect(payload.pagePartner?.graphError).toBeUndefined();
    }
  });
});
