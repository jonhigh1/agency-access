import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { UnifiedOnboardingProvider, useUnifiedOnboarding } from '../unified-onboarding-context';
import { onboardingDraftKey, saveOnboardingDraft } from '@/lib/onboarding/onboarding-draft';

vi.mock('@/lib/analytics/affiliate', () => ({ trackAffiliateEvent: vi.fn() }));
vi.mock('@/lib/agency-meta-oauth', () => ({ startAgencyMetaOAuth: vi.fn() }));

const mockGetToken = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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

const FLAG = 'NEXT_PUBLIC_META_PENDING_APPROVAL';
const original = process.env[FLAG];

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ data, error: null }) });

function routeFetch() {
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
    if (url.includes('/agency-platforms/available')) return ok([{ platform: 'google', connected: true }]);
    if (url.includes('/api/clients') && method === 'POST') return ok({ id: 'client-1' });
    if (url.includes('/api/access-requests') && method === 'POST') return ok({ id: 'req-1', uniqueToken: 'tok' });
    return ok(null);
  });
}

function seedDraft(selectedPlatforms: Record<string, string[]>) {
  saveOnboardingDraft(window.sessionStorage, 'user_test', {
    currentStep: 3,
    agencyName: 'Draft Agency Name',
    agencySettings: { timezone: 'UTC', industry: 'other', website: '' },
    clientName: 'Example Client',
    clientEmail: 'client@example.com',
    selectedPlatforms,
  });
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <UnifiedOnboardingProvider enableProgressHydration>{children}</UnifiedOnboardingProvider>
);

describe('unified onboarding: Meta pending approval flag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/onboarding/unified');
    mockGetToken.mockResolvedValue('token');
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
    (global as any).fetch = routeFetch();
  });

  afterEach(() => {
    if (original === undefined) delete process.env[FLAG];
    else process.env[FLAG] = original;
  });

  it('flag on: preselects Google by default', () => {
    process.env[FLAG] = 'true';
    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });
    expect(result.current.state.selectedPlatforms).toEqual({ google: ['google'] });
  });

  it('flag on: a restored draft with Meta drops Meta and step 4 can continue', async () => {
    process.env[FLAG] = 'true';
    seedDraft({ google: ['google'], meta: ['meta'] });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });

    await waitFor(() => {
      expect(result.current.state.currentStep).toBe(3);
      expect(result.current.state.agencyId).toBe('agency-1');
    });
    expect(result.current.state.selectedPlatforms).toEqual({ google: ['google'] });
    expect(result.current.state.metaReadiness.status).toBe('idle');
    expect(result.current.canGoNext()).toBe(true);

    // The saved draft no longer carries Meta either.
    await waitFor(() => {
      const saved = JSON.parse(window.sessionStorage.getItem(onboardingDraftKey('user_test')) || '{}');
      expect(saved.selectedPlatforms).toEqual({ google: ['google'] });
    });
  });

  it('flag on: a Meta-only draft falls back to Google', async () => {
    process.env[FLAG] = 'true';
    seedDraft({ meta: ['meta'] });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.state.currentStep).toBe(3));
    expect(result.current.state.selectedPlatforms).toEqual({ google: ['google'] });
    expect(result.current.canGoNext()).toBe(true);
  });

  it('flag on: Meta cannot be added through updatePlatforms', async () => {
    process.env[FLAG] = 'true';
    seedDraft({ google: ['google'] });
    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });
    await waitFor(() => expect(result.current.state.currentStep).toBe(3));

    act(() => {
      result.current.updatePlatforms({ google: ['google'], meta: ['meta'], linkedin: ['linkedin'] });
    });
    expect(result.current.state.selectedPlatforms).toEqual({ google: ['google'], linkedin: ['linkedin'] });
  });

  it('flag off: a restored draft keeps Meta exactly as today', async () => {
    delete process.env[FLAG];
    seedDraft({ google: ['google'], meta: ['meta'] });

    const { result } = renderHook(() => useUnifiedOnboarding(), { wrapper });
    await waitFor(() => {
      expect(result.current.state.currentStep).toBe(3);
      expect(result.current.state.agencyId).toBe('agency-1');
    });
    expect(result.current.state.selectedPlatforms).toEqual({ google: ['google'], meta: ['meta'] });
    await waitFor(() => expect(result.current.state.metaReadiness.status).toBe('not_connected'));
    expect(result.current.canGoNext()).toBe(false);
  });
});
