import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useAuthMock = vi.fn();
const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const useAuthOrBypassMock = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/lib/dev-auth', () => ({
  DEV_BYPASS_TOKEN: 'dev-bypass-token',
  useAuthOrBypass: (...args: unknown[]) => useAuthOrBypassMock(...args),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => useQueryMock(options),
  useMutation: (options: any) => useMutationMock(options),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

import {
  useAffiliatePortalOverview,
  useAffiliatePortalCommissionHistory,
  useCreateAffiliatePortalLink,
} from '../affiliate';

describe('affiliate query hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      userId: 'user_123',
      isLoaded: true,
      getToken: vi.fn().mockResolvedValue('token_123'),
    });
    useAuthOrBypassMock.mockReturnValue({
      userId: 'user_123',
      orgId: null,
      isLoaded: true,
      isDevelopmentBypass: false,
    });
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          partner: {
            id: 'partner_1',
            name: 'Partner One',
            email: 'partner@example.com',
            status: 'approved',
            defaultCommissionBps: 3000,
            commissionDurationMonths: 12,
          },
          metrics: {
            clicks: 42,
            referrals: 5,
            customers: 2,
            pendingCommissionCents: 12500,
            paidCommissionCents: 6400,
          },
          primaryLink: {
            id: 'link_1',
            code: 'partner-one',
            status: 'active',
            destinationPath: '/pricing',
            url: 'https://www.authhub.co/r/partner-one',
          },
          links: [],
        },
        error: null,
      }),
    });
  });

  it('fetches affiliate portal overview for authenticated users', async () => {
    let capturedOptions: any;
    useQueryMock.mockImplementation((options: any) => {
      capturedOptions = options;
      return {
        data: undefined,
        isLoading: false,
        error: null,
      };
    });

    renderHook(() => useAffiliatePortalOverview());

    const data = await capturedOptions.queryFn();
    expect(data.metrics.clicks).toBe(42);
    expect((global as any).fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/affiliate/portal/overview'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token_123',
        }),
      })
    );
  });

  it('preserves HTTP authorization status on portal errors', async () => {
    let capturedOptions: any;
    useQueryMock.mockImplementation((options: any) => {
      capturedOptions = options;
      return { data: undefined, isLoading: false, error: null };
    });
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { code: 'FORBIDDEN', message: 'Approved affiliate partner access is required' } }),
    });

    renderHook(() => useAffiliatePortalOverview());

    await expect(capturedOptions.queryFn()).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('creates an affiliate campaign link variant', async () => {
    useMutationMock.mockImplementation((options: any) => ({
      mutateAsync: options.mutationFn,
    }));
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'link_2',
          code: 'partner-one-newsletter',
          status: 'active',
          destinationPath: '/pricing',
          campaign: 'Newsletter',
          url: 'https://www.authhub.co/r/partner-one-newsletter',
        },
        error: null,
      }),
    });

    const { result } = renderHook(() => useCreateAffiliatePortalLink());

    await act(async () => {
      const link = await result.current.mutateAsync({
        campaign: 'Newsletter',
        destinationPath: '/pricing',
      });

      expect(link.code).toBe('partner-one-newsletter');
    });
  });

  it('fetches affiliate commission history for authenticated users', async () => {
    let capturedOptions: any;
    useQueryMock.mockImplementation((options: any) => {
      capturedOptions = options;
      return {
        data: undefined,
        isLoading: false,
        error: null,
      };
    });
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          commissions: [
            {
              id: 'commission_1',
              customerName: 'Acme Agency',
              status: 'pending',
              currency: 'usd',
              amountCents: 3000,
              revenueAmountCents: 10000,
              commissionBps: 3000,
              invoiceDate: '2026-01-01T00:00:00.000Z',
              holdUntil: '2026-02-01T00:00:00.000Z',
              approvedAt: null,
              paidAt: null,
              voidedAt: null,
              createdAt: '2026-01-02T00:00:00.000Z',
              payoutBatchId: null,
              payoutBatchStatus: null,
            },
          ],
          payouts: [],
        },
        error: null,
      }),
    });

    renderHook(() => useAffiliatePortalCommissionHistory());

    const data = await capturedOptions.queryFn();
    expect(data.commissions).toHaveLength(1);
    expect((global as any).fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/affiliate/portal/commissions'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token_123',
        }),
      })
    );
  });

  it('uses the dev bypass token when auth bypass is active', async () => {
    const originalBypass = process.env.NEXT_PUBLIC_BYPASS_AUTH;
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NEXT_PUBLIC_BYPASS_AUTH = 'true';
    process.env.NODE_ENV = 'development';

    useAuthMock.mockReturnValue({
      userId: null,
      isLoaded: true,
      getToken: vi.fn().mockResolvedValue(null),
    });
    useAuthOrBypassMock.mockReturnValue({
      userId: 'dev_user_test_123456789',
      orgId: 'dev_org_test_987654321',
      isLoaded: true,
      isDevelopmentBypass: true,
    });

    let capturedOptions: any;
    useQueryMock.mockImplementation((options: any) => {
      capturedOptions = options;
      return {
        data: undefined,
        isLoading: false,
        error: null,
      };
    });

    renderHook(() => useAffiliatePortalOverview());

    await capturedOptions.queryFn();

    expect((global as any).fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/affiliate/portal/overview'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer dev-bypass-token',
        }),
      })
    );

    process.env.NEXT_PUBLIC_BYPASS_AUTH = originalBypass;
    process.env.NODE_ENV = originalNodeEnv;
  });
});
