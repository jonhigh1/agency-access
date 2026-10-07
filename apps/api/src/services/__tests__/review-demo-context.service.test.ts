import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env.js', () => ({
  env: {
    META_REVIEW_BM_ID: '695982475048959',
    META_REVIEW_AD_ACCOUNT_ID: '557538895783894',
    META_REVIEW_PAGE_ID: '1373353139192376',
    META_REVIEW_AGENCY_BM_ID: '3808519629379919',
    META_REVIEW_SANDBOX_META_USER_ID: '61595281164997',
  },
}));

const getDebugTokenDetailsMock = vi.fn();
const getBusinessAccountsMock = vi.fn();

vi.mock('@/services/connectors/meta.js', () => ({
  MetaConnector: class {
    getDebugTokenDetails = getDebugTokenDetailsMock;
    getBusinessAccounts = getBusinessAccountsMock;
  },
}));

vi.mock('@/lib/meta-graph-instrumentation.js', () => ({
  metaGraphFetch: vi.fn(async (url: string) => {
    if (url.includes('/me/accounts')) {
      return {
        ok: true,
        json: async () => ({
          data: [{ id: 'page-reviewer-1', name: 'Reviewer Page' }],
        }),
      };
    }
    if (url.includes('/me/adaccounts')) {
      return {
        ok: true,
        json: async () => ({
          data: [{ id: 'act_999', name: 'Reviewer Ad Account' }],
        }),
      };
    }
    throw new Error(`Unexpected URL ${url}`);
  }),
}));

describe('reviewDemoContextService', () => {
  beforeEach(() => {
    vi.resetModules();
    getDebugTokenDetailsMock.mockReset();
    getBusinessAccountsMock.mockReset();
  });

  it('uses sandbox META_REVIEW ids for the configured sandbox Meta user', async () => {
    const { reviewDemoContextService } = await import('../review-demo-context.service.js');
    const resolved = await reviewDemoContextService.resolveAssets({
      accessToken: 'token',
      identity: { id: '61595281164997', name: 'Alex' },
    });

    expect(resolved.mode).toBe('sandbox');
    expect(resolved.pageId).toBe('1373353139192376');
    expect(resolved.adAccountId).toBe('act_557538895783894');
  });

  it('derives assets from the connected reviewer token when not the sandbox user', async () => {
    getDebugTokenDetailsMock.mockResolvedValue({
      isValid: true,
      granularScopes: [],
    });
    getBusinessAccountsMock.mockResolvedValue({
      businesses: [{ id: 'bm-reviewer', name: 'Reviewer BM' }],
      hasAccess: true,
    });

    const { reviewDemoContextService } = await import('../review-demo-context.service.js');
    const resolved = await reviewDemoContextService.resolveAssets({
      accessToken: 'token',
      identity: { id: '999888777', name: 'Meta Reviewer' },
    });

    expect(resolved.mode).toBe('connected');
    expect(resolved.pageId).toBe('page-reviewer-1');
    expect(resolved.adAccountId).toBe('act_999');
    expect(resolved.businessManagerId).toBe('bm-reviewer');
  });

  it('returns null asset ids when the reviewer token exposes no pages or ad accounts', async () => {
    vi.resetModules();
    vi.doMock('@/lib/env.js', () => ({
      env: {
        META_REVIEW_BM_ID: '695982475048959',
        META_REVIEW_AD_ACCOUNT_ID: '557538895783894',
        META_REVIEW_PAGE_ID: '1373353139192376',
        META_REVIEW_AGENCY_BM_ID: '3808519629379919',
        META_REVIEW_SANDBOX_META_USER_ID: '61595281164997',
      },
    }));
    vi.doMock('@/services/connectors/meta.js', () => ({
      MetaConnector: class {
        getDebugTokenDetails = vi.fn(async () => ({ isValid: true, granularScopes: [] }));
        getBusinessAccounts = vi.fn(async () => ({ businesses: [], hasAccess: false }));
      },
    }));
    vi.doMock('@/lib/meta-graph-instrumentation.js', () => ({
      metaGraphFetch: vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: [] }),
      })),
    }));

    const { reviewDemoContextService } = await import('../review-demo-context.service.js');
    const resolved = await reviewDemoContextService.resolveAssets({
      accessToken: 'token',
      identity: { id: '111222333', name: 'Empty Reviewer' },
    });

    expect(resolved.mode).toBe('connected');
    expect(resolved.pageId).toBeNull();
    expect(resolved.adAccountId).toBeNull();
    expect(resolved.businessManagerId).toBeNull();
  });
});
