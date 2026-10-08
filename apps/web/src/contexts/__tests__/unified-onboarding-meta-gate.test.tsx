import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { UnifiedOnboardingProvider, useUnifiedOnboarding } from '../unified-onboarding-context';
import {
  ONBOARDING_RETURN_INTENT_KEY,
  onboardingDraftKey,
  saveOnboardingDraft,
} from '@/lib/onboarding/onboarding-draft';

vi.mock('@/lib/analytics/affiliate', () => ({ trackAffiliateEvent: vi.fn() }));

const startAgencyMetaOAuthMock = vi.fn();
vi.mock('@/lib/agency-meta-oauth', () => ({
  startAgencyMetaOAuth: (...args: unknown[]) => startAgencyMetaOAuthMock(...args),
}));

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockGetToken = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ userId: 'user_test', orgId: null, getToken: mockGetToken }),
  useUser: () => ({
    user: {
      id: 'user_test',
      firstName: 'Test',
      lastName: 'User',
      emailAddresses: [{ emailAddress: 'owner@example.com' }],
      primaryEmailAddress: { emailAddress: 'owner@example.com' },
    },
  }),
}));

type MetaEntry = { platform: string; connected: boolean; metadata?: Record<string, unknown> } | null;

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ data, error: null }) });

function routeFetch(options: { meta: () => MetaEntry; accessRequestError?: { code: string; message: string } }) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.includes('/api/agencies?clerkUserId=')) return ok([{ id: 'agency-1', name: 'Example Agency' }]);
    if (url.includes('/onboarding-status')) {
      return ok({
        status: 'in_progress',
        completed: false,
        lifecycle: { status: 'in_progress', lastVisitedStep: 3 },
        step: { profile: true, members: false, firstRequest: false },
      });
    }
    if (url.includes('/agency-platforms/available')) {
      const meta = options.meta();
      return ok(meta ? [{ platform: 'google', connected: true }, meta] : [{ platform: 'google', connected: true }]);
    }
    if (url.includes('/api/access-requests') && method === 'POST' && options.accessRequestError) {
      return { ok: false, status: 400, json: async () => ({ data: null, error: options.accessRequestError }) };
    }
    if (url.includes('/api/clients') && method === 'POST') return ok({ id: 'client-1' });
    if (url.includes('/api/access-requests') && method === 'POST') return ok({ id: 'req-1', uniqueToken: 'tok' });
    if (url.match(/\/api\/agencies\/agency-1$/) && method === 'PATCH') return ok({ id: 'agency-1' });
    return ok(null);
  });
}

function seedDraft(selectedPlatforms: Record<string, string[]>, currentStep = 3) {
  saveOnboardingDraft(window.sessionStorage, 'user_test', {
    currentStep,
    agencyName: 'Draft Agency Name',
    agencySettings: { timezone: 'UTC', industry: 'other', website: '' },
    clientName: 'Example Client',
    clientEmail: 'client@example.com',
    selectedPlatforms,
  });
}

const persistentWrapper = ({ children }: { children: ReactNode }) => (
  <UnifiedOnboardingProvider enableProgressHydration>{children}</UnifiedOnboardingProvider>
);

describe('unified onboarding: agency Meta portfolio gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/onboarding/unified');
    mockGetToken.mockResolvedValue('token');
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
  });

  it('restores the platform step with the Meta choice after a reload', async () => {
    (global as any).fetch = routeFetch({ meta: () => null });
    seedDraft({ google: ['google'], meta: ['meta'] });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper: persistentWrapper });

    await waitFor(() => {
      expect(result.current.state.currentStep).toBe(3);
      expect(result.current.state.agencyId).toBe('agency-1');
    });
    expect(result.current.state.selectedPlatforms).toEqual({ google: ['google'], meta: ['meta'] });
    expect(result.current.state.clientEmail).toBe('client@example.com');
    // The typed agency name survives too (not replaced by the email-domain suggestion).
    expect(result.current.state.agencyName).toBe('Draft Agency Name');
  });

  it('saves the selection as it changes so a reload keeps it', async () => {
    (global as any).fetch = routeFetch({ meta: () => null });
    seedDraft({ google: ['google'] });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper: persistentWrapper });
    await waitFor(() => expect(result.current.state.currentStep).toBe(3));

    act(() => {
      result.current.updatePlatforms({ google: ['google'], meta: ['meta'] });
    });

    await waitFor(() => {
      const saved = JSON.parse(window.sessionStorage.getItem(onboardingDraftKey('user_test')) || '{}');
      expect(saved.selectedPlatforms).toEqual({ google: ['google'], meta: ['meta'] });
      expect(saved.currentStep).toBe(3);
    });
  });

  it('blocks Continue while the agency Meta portfolio is not connected, and unblocks when Meta is deselected', async () => {
    (global as any).fetch = routeFetch({ meta: () => null });
    seedDraft({ google: ['google'], meta: ['meta'] });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper: persistentWrapper });

    await waitFor(() => expect(result.current.state.metaReadiness.status).toBe('not_connected'));
    expect(result.current.canGoNext()).toBe(false);

    let response: any;
    await act(async () => {
      response = await result.current.createAgencyAndAccessRequest();
    });
    expect(response.ok).toBe(false);
    expect(result.current.state.error).toMatch(/connect your agency meta business portfolio/i);

    act(() => {
      result.current.updatePlatforms({ google: ['google'] });
    });
    expect(result.current.canGoNext()).toBe(true);
  });

  it('waits for the agency lookup instead of flashing "not connected" on return', async () => {
    let releaseAgencyLookup!: () => void;
    const agencyLookupGate = new Promise<void>((resolve) => {
      releaseAgencyLookup = resolve;
    });
    const routed = routeFetch({
      meta: () => ({ platform: 'meta', connected: true, metadata: { selectedBusinessId: 'biz-1' } }),
    });
    (global as any).fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/api/agencies?clerkUserId=')) await agencyLookupGate;
      return routed(input, init);
    });
    seedDraft({ google: ['google'], meta: ['meta'] });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper: persistentWrapper });
    await waitFor(() => expect(result.current.state.currentStep).toBe(3));

    expect(result.current.state.metaReadiness.status).toBe('idle');
    expect(result.current.canGoNext()).toBe(false);

    await act(async () => {
      releaseAgencyLookup();
    });
    await waitFor(() => expect(result.current.state.metaReadiness.status).toBe('ready'));
    expect(result.current.canGoNext()).toBe(true);
  });

  it('asks for a portfolio when Meta is connected without one', async () => {
    (global as any).fetch = routeFetch({ meta: () => ({ platform: 'meta', connected: true, metadata: {} }) });
    seedDraft({ google: ['google'], meta: ['meta'] });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper: persistentWrapper });

    await waitFor(() => expect(result.current.state.metaReadiness.status).toBe('needs_portfolio'));
    expect(result.current.canGoNext()).toBe(false);
  });

  it('lets Continue through once the portfolio is selected (OAuth return)', async () => {
    (global as any).fetch = routeFetch({
      meta: () => ({
        platform: 'meta',
        connected: true,
        metadata: { selectedBusinessId: 'biz-1', selectedBusinessName: 'Example Portfolio' },
      }),
    });
    seedDraft({ google: ['google'], meta: ['meta'] });
    window.sessionStorage.setItem(
      ONBOARDING_RETURN_INTENT_KEY,
      JSON.stringify({ v: 1, path: '/onboarding/unified', step: 3, platform: 'meta', createdAt: Date.now() })
    );
    window.history.replaceState(null, '', '/onboarding/unified?meta=connected');

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper: persistentWrapper });

    await waitFor(() =>
      expect(result.current.state.metaReadiness).toEqual({ status: 'ready', portfolioName: 'Example Portfolio' })
    );
    expect(result.current.state.currentStep).toBe(3);
    expect(result.current.state.selectedPlatforms).toEqual({ google: ['google'], meta: ['meta'] });
    expect(result.current.state.metaJustConnected).toBe(true);
    expect(result.current.canGoNext()).toBe(true);
    expect(window.location.search).toBe('');
    expect(window.sessionStorage.getItem(ONBOARDING_RETURN_INTENT_KEY)).toBeNull();

    let response: any;
    await act(async () => {
      response = await result.current.createAgencyAndAccessRequest();
    });
    expect(response.ok).toBe(true);
    // The link exists now, so the pre-link draft is dropped.
    await waitFor(() => expect(window.sessionStorage.getItem(onboardingDraftKey('user_test'))).toBeNull());
  });

  it('does not block or call the platforms endpoint when Meta is not selected', async () => {
    const fetchMock = routeFetch({ meta: () => null });
    (global as any).fetch = fetchMock;
    seedDraft({ google: ['google'] });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper: persistentWrapper });
    await waitFor(() => expect(result.current.state.agencyId).toBe('agency-1'));

    expect(result.current.canGoNext()).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/agency-platforms/available'))).toBe(false);
  });

  it('starts the existing agency Meta OAuth and remembers where to return', async () => {
    (global as any).fetch = routeFetch({ meta: () => null });
    startAgencyMetaOAuthMock.mockResolvedValue(undefined);
    seedDraft({ google: ['google'], meta: ['meta'] });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper: persistentWrapper });
    await waitFor(() => expect(result.current.state.metaReadiness.status).toBe('not_connected'));

    await act(async () => {
      await result.current.connectMetaPortfolio();
    });

    expect(startAgencyMetaOAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({ agencyId: 'agency-1', userEmail: 'owner@example.com' })
    );
    expect(JSON.parse(window.sessionStorage.getItem(ONBOARDING_RETURN_INTENT_KEY) || '{}')).toMatchObject({
      step: 3,
      platform: 'meta',
    });
    const saved = JSON.parse(window.sessionStorage.getItem(onboardingDraftKey('user_test')) || '{}');
    expect(saved.currentStep).toBe(3);
    expect(saved.selectedPlatforms).toEqual({ google: ['google'], meta: ['meta'] });
  });

  it('clears the return intent if starting OAuth fails', async () => {
    (global as any).fetch = routeFetch({ meta: () => null });
    startAgencyMetaOAuthMock.mockRejectedValue(new Error('Meta is unavailable'));
    seedDraft({ google: ['google'], meta: ['meta'] });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper: persistentWrapper });
    await waitFor(() => expect(result.current.state.metaReadiness.status).toBe('not_connected'));

    await act(async () => {
      await result.current.connectMetaPortfolio();
    });

    expect(window.sessionStorage.getItem(ONBOARDING_RETURN_INTENT_KEY)).toBeNull();
    expect(result.current.state.error).toBe('Meta is unavailable');
    expect(result.current.state.loading).toBe(false);
  });

  it('re-checks readiness when the API reports the Meta destination is not ready', async () => {
    let metaReady = true;
    const fetchMock = routeFetch({
      meta: () =>
        metaReady ? { platform: 'meta', connected: true, metadata: { selectedBusinessId: 'biz-1' } } : null,
      accessRequestError: { code: 'META_DESTINATION_NOT_READY', message: 'not ready' },
    });
    (global as any).fetch = fetchMock;
    seedDraft({ google: ['google'], meta: ['meta'] });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper: persistentWrapper });
    await waitFor(() => expect(result.current.state.metaReadiness.status).toBe('ready'));

    metaReady = false;
    await act(async () => {
      await result.current.createAgencyAndAccessRequest();
    });

    await waitFor(() => expect(result.current.state.metaReadiness.status).toBe('not_connected'));
    expect(result.current.canGoNext()).toBe(false);
    expect(result.current.state.error).toMatch(/connect your agency meta business portfolio/i);
  });
});
