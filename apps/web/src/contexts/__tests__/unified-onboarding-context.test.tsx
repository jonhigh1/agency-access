import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { UnifiedOnboardingProvider, useUnifiedOnboarding } from '../unified-onboarding-context';

const trackAffiliateEventMock = vi.fn();
vi.mock('@/lib/analytics/affiliate', () => ({
  trackAffiliateEvent: (...args: any[]) => trackAffiliateEventMock(...args),
}));

const mockPush = vi.fn();
const mockGetToken = vi.fn();
let mockOrgId: string | null = null;
let mockUser: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddresses: Array<{ emailAddress: string }>;
  primaryEmailAddress: { emailAddress: string } | null;
} | null = null;

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    userId: 'user_123',
    orgId: mockOrgId,
    getToken: mockGetToken,
  }),
  useUser: () => ({
    user: mockUser,
  }),
}));

describe('UnifiedOnboardingContext', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    trackAffiliateEventMock.mockReset();
    mockOrgId = null;
    mockUser = {
      id: 'user_123',
      firstName: 'Jane',
      lastName: 'Doe',
      emailAddresses: [{ emailAddress: 'jane@example.com' }],
      primaryEmailAddress: { emailAddress: 'jane@example.com' },
    };
    mockGetToken.mockResolvedValue('token-123');
    (global as any).fetch = fetchMock;
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    process.env.NEXT_PUBLIC_APP_URL = 'https://authhub.co';
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <UnifiedOnboardingProvider enableProgressHydration={false}>{children}</UnifiedOnboardingProvider>
  );

  const hydrationWrapper = ({ children }: { children: ReactNode }) => (
    <UnifiedOnboardingProvider enableProgressHydration>{children}</UnifiedOnboardingProvider>
  );

  it('prefills agency name from email domain', async () => {
    mockUser = {
      id: 'user_123',
      firstName: 'Jon',
      lastName: 'Doe',
      emailAddresses: [{ emailAddress: 'jon@pillaraiagency.com' }],
      primaryEmailAddress: { emailAddress: 'jon@pillaraiagency.com' },
    };

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.state.agencyName).toBe('Pillar AI Agency');
    });
  });

  it('falls back to "My Agency" when Clerk user has no email addresses array', async () => {
    mockUser = {
      id: 'user_123',
      firstName: 'Jon',
      lastName: 'Doe',
      emailAddresses: undefined as any,
      primaryEmailAddress: null,
    } as any;

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.state.agencyName).toBe('My Agency');
    });
  });

  it('stores website URL in agency settings when creating agency from onboarding', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [], error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'agency-1' }, error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'client-1' }, error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'req-1', uniqueToken: 'abc123' }, error: null }),
      });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    act(() => {
      result.current.updateAgency({
        name: 'Acme Agency',
        settings: {
          timezone: 'America/New_York',
          industry: 'digital_marketing',
          website: 'https://acmeagency.com',
        },
      });
      result.current.updateClient({
        name: 'Acme Client',
        email: 'client@acme.com',
      });
    });

    await act(async () => {
      await result.current.createAgencyAndAccessRequest();
    });

    const createAgencyCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/api/agencies') && call[1]?.method === 'POST'
    );

    expect(createAgencyCall).toBeDefined();
    const body = JSON.parse(createAgencyCall?.[1]?.body as string);
    expect(body.settings.website).toBe('https://acmeagency.com');
  });

  it('returns deterministic result and stores agency/access ids when creating onboarding request', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [], error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'agency-1' }, error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'client-1' }, error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'req-1', uniqueToken: 'abc123' }, error: null }),
      });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    act(() => {
      result.current.updateAgency({
        name: 'Acme Agency',
        settings: {
          timezone: 'America/New_York',
          industry: 'digital_marketing',
        },
      });
      result.current.updateClient({
        name: 'Acme Client',
        email: 'client@acme.com',
      });
    });

    let response: any;
    await act(async () => {
      response = await result.current.createAgencyAndAccessRequest();
    });

    expect(response.ok).toBe(true);
    expect(response.agencyId).toBe('agency-1');
    expect(response.accessRequestId).toBe('req-1');
    expect(result.current.state.agencyId).toBe('agency-1');
    expect(result.current.state.accessRequestId).toBe('req-1');
    expect(result.current.state.accessLink).toBe('https://authhub.co/authorize/abc123');
  });

  it('passes affiliate click token when present in browser cookies', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [], error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'agency-1' }, error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'client-1' }, error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'req-1', uniqueToken: 'abc123' }, error: null }),
      });

    document.cookie = 'ah_aff_click=click_123; path=/';

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    act(() => {
      result.current.updateAgency({
        name: 'Acme Agency',
        settings: {
          timezone: 'America/New_York',
          industry: 'digital_marketing',
        },
      });
      result.current.updateClient({
        name: 'Acme Client',
        email: 'client@acme.com',
      });
    });

    await act(async () => {
      await result.current.createAgencyAndAccessRequest();
    });

    const createAgencyCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/api/agencies') && call[1]?.method === 'POST'
    );

    expect(createAgencyCall).toBeDefined();
    const body = JSON.parse(createAgencyCall?.[1]?.body as string);
    expect(body.affiliateClickToken).toBe('click_123');
    expect(trackAffiliateEventMock).toHaveBeenCalledWith('affiliate_signup_claimed', {
      source: 'affiliate_cookie',
      surface: 'unified_onboarding',
    });
  });

  it('submits team invites to bulk members endpoint and returns success flag', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: [], error: null }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { id: 'agency-1' }, error: null }) })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ data: { id: 'client-1' }, error: null }) })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ data: { id: 'req-1', uniqueToken: 'abc123' }, error: null }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            agencyId: 'agency-1',
            lifecycle: {
              status: 'activated',
            },
          },
          error: null,
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { invited: 1 }, error: null }) });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    act(() => {
      result.current.updateAgency({
        name: 'Acme Agency',
        settings: {
          timezone: 'America/New_York',
          industry: 'digital_marketing',
        },
      });
      result.current.updateClient({
        name: 'Acme Client',
        email: 'client@acme.com',
      });
      result.current.addTeamInvite({
        email: 'teammate@acme.com',
        role: 'member',
      });
    });

    await act(async () => {
      await result.current.createAgencyAndAccessRequest();
    });

    let inviteResult: boolean | undefined;
    await act(async () => {
      inviteResult = await result.current.sendTeamInvites();
    });

    expect(inviteResult).toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/agencies/agency-1/members/bulk',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('uses org principal for agency resolution and invite target in org context', async () => {
    mockOrgId = 'org_123';

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'agency-org' }], error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'agency-org' }, error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'client-1' }, error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'req-1', uniqueToken: 'abc123', agencyId: 'agency-org' }, error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            agencyId: 'agency-org',
            lifecycle: {
              status: 'activated',
            },
          },
          error: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { invited: 1 }, error: null }),
      });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    act(() => {
      result.current.updateAgency({
        name: 'Acme Agency',
        settings: {
          timezone: 'America/New_York',
          industry: 'digital_marketing',
        },
      });
      result.current.updateClient({
        name: 'Acme Client',
        email: 'client@acme.com',
      });
      result.current.addTeamInvite({
        email: 'teammate@acme.com',
        role: 'member',
      });
    });

    await act(async () => {
      await result.current.createAgencyAndAccessRequest();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/agencies?clerkUserId=org_123',
      expect.objectContaining({ method: 'GET' })
    );

    await act(async () => {
      await result.current.sendTeamInvites();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/agencies/agency-org/members/bulk',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('allows back navigation through platform selection and locks after link generation', () => {
    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    // Step 0 (welcome): cannot go back or skip
    expect(result.current.state.currentStep).toBe(0);
    expect(result.current.canGoBack()).toBe(false);
    expect(result.current.canSkip()).toBe(false);

    // Step 1 (agency): can go back, cannot skip
    act(() => result.current.nextStep());
    expect(result.current.state.currentStep).toBe(1);
    expect(result.current.canGoBack()).toBe(true);
    expect(result.current.canSkip()).toBe(false);

    // Step 2 (client): can go back, cannot skip
    act(() => result.current.nextStep());
    expect(result.current.state.currentStep).toBe(2);
    expect(result.current.canGoBack()).toBe(true);
    expect(result.current.canSkip()).toBe(false);

    // Step 3 (platform selection): can still go back before link generation, cannot skip
    act(() => result.current.nextStep());
    expect(result.current.state.currentStep).toBe(3);
    expect(result.current.canGoBack()).toBe(true);
    expect(result.current.canSkip()).toBe(false);

    // Step 4 (success link): locked back navigation, cannot skip
    act(() => result.current.nextStep());
    expect(result.current.state.currentStep).toBe(4);
    expect(result.current.canGoBack()).toBe(false);
    expect(result.current.canSkip()).toBe(false);

    // Step 5 (team): skippable
    act(() => result.current.nextStep());
    expect(result.current.state.currentStep).toBe(5);
    expect(result.current.canSkip()).toBe(true);

    // Step 6 (final): no skip
    act(() => result.current.nextStep());
    expect(result.current.state.currentStep).toBe(6);
    expect(result.current.canSkip()).toBe(false);
  });

  it('skips /api/clients lookup when no agency exists yet', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [], error: null }),
    });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    await act(async () => {
      await result.current.loadExistingClients();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/agencies?clerkUserId=user_123',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result.current.state.existingClients).toEqual([]);
    expect(result.current.state.error).toBeNull();
  });

  it('loads clients only after agency lookup succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'agency-1' }], error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            data: [{ id: 'client-1', name: 'Acme', email: 'client@acme.com' }],
          },
          error: null,
        }),
      });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    await act(async () => {
      await result.current.loadExistingClients();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.com/api/agencies?clerkUserId=user_123',
      expect.objectContaining({ method: 'GET' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.com/api/clients',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result.current.state.existingClients).toEqual([
      { id: 'client-1', name: 'Acme', email: 'client@acme.com' },
    ]);
  });

  it('fails before making API calls when creating access request without a valid client', async () => {
    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    act(() => {
      result.current.updateAgency({
        name: 'Acme Agency',
        settings: {
          timezone: 'America/New_York',
          industry: 'digital_marketing',
        },
      });
      result.current.updateClient({
        name: '',
        email: '',
      });
      result.current.updatePlatforms({
        google: ['google_ads'],
      });
    });

    let response: any;
    await act(async () => {
      response = await result.current.createAgencyAndAccessRequest();
    });

    expect(response).toEqual({
      ok: false,
      error: 'Select or create a client with a valid name and email before generating your first access link.',
    });
    expect(result.current.state.error).toBe(
      'Select or create a client with a valid name and email before generating your first access link.'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ensures agency exists on completion so dashboard does not loop back to onboarding', async () => {
    mockOrgId = 'org_123';

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [], error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'agency-org' }, error: null }),
      });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    await act(async () => {
      await result.current.completeOnboarding();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.com/api/agencies?clerkUserId=org_123',
      expect.objectContaining({ method: 'GET' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.com/api/agencies',
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('hydrates onboarding step from persisted onboarding status when agency already exists', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'agency-1' }], error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            status: 'in_progress',
            completed: false,
            lifecycle: {
              status: 'in_progress',
              lastVisitedStep: 3,
            },
            step: {
              profile: true,
              members: false,
              firstRequest: false,
            },
          },
          error: null,
        }),
      });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper: hydrationWrapper });

    await waitFor(() => {
      expect(result.current.state.currentStep).toBe(3);
      expect(result.current.state.agencyId).toBe('agency-1');
    });
  });

  it('persists updated agency name when onboarding resumes with an existing agency id', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();

      if (url.endsWith('/api/agencies?clerkUserId=user_123') && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: 'agency-1' }], error: null }),
        };
      }

      if (url.endsWith('/api/agencies/agency-1/onboarding-status') && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              status: 'in_progress',
              completed: false,
              lifecycle: {
                status: 'in_progress',
                lastVisitedStep: 3,
              },
              step: {
                profile: true,
                members: false,
                firstRequest: false,
              },
            },
            error: null,
          }),
        };
      }

      if (url.endsWith('/api/agencies/agency-1') && method === 'PATCH') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { id: 'agency-1' }, error: null }),
        };
      }

      if (url.endsWith('/api/clients') && method === 'POST') {
        return {
          ok: true,
          status: 201,
          json: async () => ({ data: { id: 'client-1' }, error: null }),
        };
      }

      if (url.endsWith('/api/access-requests') && method === 'POST') {
        return {
          ok: true,
          status: 201,
          json: async () => ({ data: { id: 'req-1', uniqueToken: 'abc123', agencyId: 'agency-1' }, error: null }),
        };
      }

      if (url.endsWith('/api/agencies/agency-1/onboarding-progress') && method === 'PATCH') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { agencyId: 'agency-1' }, error: null }),
        };
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({ error: { code: 'NOT_FOUND', message: `Unhandled test request: ${method} ${url}` } }),
      };
    });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper: hydrationWrapper });

    await waitFor(() => {
      expect(result.current.state.agencyId).toBe('agency-1');
    });

    act(() => {
      result.current.updateAgency({
        name: 'Updated Agency Name',
        settings: {
          timezone: 'America/New_York',
          industry: 'digital_marketing',
        },
      });
      result.current.updateClient({
        name: 'Acme Client',
        email: 'client@acme.com',
      });
    });

    await act(async () => {
      await result.current.createAgencyAndAccessRequest();
    });

    const patchAgencyCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).endsWith('/api/agencies/agency-1') && (call[1]?.method || 'GET').toUpperCase() === 'PATCH'
    );

    expect(patchAgencyCall).toBeDefined();
    const patchBody = JSON.parse(patchAgencyCall?.[1]?.body as string);
    expect(patchBody.name).toBe('Updated Agency Name');
  });

  it('persists activated onboarding lifecycle after creating first access request', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [], error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'agency-1' }, error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'client-1' }, error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'req-1', uniqueToken: 'abc123' }, error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            agencyId: 'agency-1',
            lifecycle: {
              status: 'activated',
              accessRequestId: 'req-1',
            },
          },
          error: null,
        }),
      });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    act(() => {
      result.current.updateAgency({
        name: 'Acme Agency',
        settings: {
          timezone: 'America/New_York',
          industry: 'digital_marketing',
        },
      });
      result.current.updateClient({
        name: 'Acme Client',
        email: 'client@acme.com',
      });
    });

    await act(async () => {
      await result.current.createAgencyAndAccessRequest();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/agencies/agency-1/onboarding-progress',
      expect.objectContaining({
        method: 'PATCH',
      })
    );
  });

  it('requires a valid client before continuing from the client step', () => {
    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    act(() => {
      result.current.nextStep();
      result.current.updateAgency({
        name: 'Acme Agency',
        settings: {
          timezone: 'America/New_York',
          industry: 'digital_marketing',
        },
      });
      result.current.nextStep();
      result.current.updateClient({
        name: '',
        email: '',
      });
    });

    expect(result.current.state.currentStep).toBe(2);
    expect(result.current.canGoNext()).toBe(false);
  });

  it('allows continuing from the client step once the client is valid', () => {
    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    act(() => {
      result.current.nextStep();
      result.current.updateAgency({
        name: 'Acme Agency',
        settings: {
          timezone: 'America/New_York',
          industry: 'digital_marketing',
        },
      });
      result.current.nextStep();
      result.current.updateClient({
        name: 'Acme Client',
        email: 'client@acme.com',
      });
    });

    expect(result.current.state.currentStep).toBe(2);
    expect(result.current.canGoNext()).toBe(true);
  });

  it('reuses an existing client without creating a duplicate client record', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'agency-1' }], error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'agency-1' }, error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'req-1', uniqueToken: 'abc123', agencyId: 'agency-1' }, error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            agencyId: 'agency-1',
            lifecycle: {
              status: 'activated',
              accessRequestId: 'req-1',
            },
          },
          error: null,
        }),
      });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    act(() => {
      result.current.updateAgency({
        name: 'Acme Agency',
        settings: {
          timezone: 'America/New_York',
          industry: 'digital_marketing',
        },
      });
      result.current.updateClient({
        id: 'client-existing',
        name: 'Existing Client',
        email: 'existing@client.com',
      });
      result.current.updatePlatforms({
        google: ['google_ads'],
      });
    });

    await act(async () => {
      await result.current.createAgencyAndAccessRequest();
    });

    const createClientCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/api/clients') && call[1]?.method === 'POST'
    );
    expect(createClientCall).toBeUndefined();

    const createRequestCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/api/access-requests')
    );
    expect(createRequestCall).toBeDefined();
    const requestBody = JSON.parse(createRequestCall?.[1]?.body as string);
    expect(requestBody.clientId).toBe('client-existing');
  });

  it('allows a deferred dashboard exit without creating a client or access request', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [], error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'agency-1' }, error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            agencyId: 'agency-1',
            lifecycle: {
              status: 'in_progress',
              lastVisitedStep: 2,
            },
          },
          error: null,
        }),
      });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    act(() => {
      result.current.updateAgency({
        name: 'Acme Agency',
        settings: {
          timezone: 'America/New_York',
          industry: 'digital_marketing',
        },
      });
    });

    await act(async () => {
      await result.current.deferUntilClientReady();
    });

    expect(mockPush).toHaveBeenCalledWith('/dashboard');

    const createClientCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/api/clients') && call[1]?.method === 'POST'
    );
    const createRequestCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/api/access-requests') && call[1]?.method === 'POST'
    );

    expect(createClientCall).toBeUndefined();
    expect(createRequestCall).toBeUndefined();
  });

  it('pre-selects Google only as the default platform (Meta remains available)', () => {
    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    expect(result.current.state.preSelectedPlatforms).toEqual(['google']);
    expect(result.current.state.selectedPlatforms).toEqual({ google: ['google'] });
    expect(result.current.state.selectedPlatforms.meta).toBeUndefined();
  });

  it('persists resumable onboarding progress at the client step when deferring', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'agency-1' }], error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            agencyId: 'agency-1',
            lifecycle: {
              status: 'in_progress',
              lastVisitedStep: 2,
            },
          },
          error: null,
        }),
      });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    act(() => {
      result.current.updateAgency({
        name: 'Acme Agency',
        settings: {
          timezone: 'America/New_York',
          industry: 'digital_marketing',
        },
      });
    });

    await act(async () => {
      await result.current.deferUntilClientReady();
    });

    const persistCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/api/agencies/agency-1/onboarding-progress')
    );

    expect(persistCall).toBeDefined();
    const body = JSON.parse(persistCall?.[1]?.body as string);
    expect(body.status).toBe('in_progress');
    expect(body.lastVisitedStep).toBe(2);
    expect(body.lastCompletedStep).toBe(1);
  });
});
