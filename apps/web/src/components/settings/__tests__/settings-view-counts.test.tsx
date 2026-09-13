/**
 * Settings — rendered per-view design counts (R2, R4)
 *
 * Renders the real settings page per tab with mocked data hooks and counts
 * what the DOM actually carries: one `.ink-panel` per view, at most one
 * brutalist button outside it, at most three hard shadows. Source-text
 * counts cannot see conditional variants or Button-carried shadows, so the
 * contract lives here.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '@/app/(authenticated)/settings/page';

let searchParamsState = new URLSearchParams();
const { mockUseSubscription, mutation } = vi.hoisted(() => ({
  mockUseSubscription: vi.fn(),
  mutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => searchParamsState,
  usePathname: () => '/settings',
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ orgId: 'org_1', userId: 'user_1', getToken: vi.fn().mockResolvedValue('t') }),
  useUser: () => ({ user: { id: 'user_1' } }),
}));

vi.mock('@/components/marketing/reveal', () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/use-user-agency', () => ({
  useUserAgency: () => ({ data: { id: 'ag_1', name: 'Acme' }, isLoading: false }),
}));

vi.mock('@/lib/query/quota', () => ({
  useQuota: () => ({
    data: {
      currentTier: 'GROWTH',
      updatedAt: new Date(),
      clients: { used: 2, limit: 10, remaining: 8 },
      members: { used: 1, limit: 5, remaining: 4 },
      accessRequests: { used: 3, limit: 20, remaining: 17 },
      templates: { used: 1, limit: 'unlimited', remaining: 0 },
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/lib/query/billing', () => ({
  useSubscription: () => mockUseSubscription(),
  useTierDetails: () => ({
    data: { tier: 'GROWTH', status: 'active', limits: { clients: { limit: 10, used: 2, remaining: 8 }, members: { limit: 5, used: 1, remaining: 4 }, accessRequests: { limit: 20, used: 3, remaining: 17 }, templates: { limit: 5, used: 1, remaining: 4 } }, features: [] },
    isLoading: false,
  }),
  usePaymentMethods: () => ({ data: [], isLoading: false }),
  useInvoices: () => ({ data: [], isLoading: false }),
  useBillingDetails: () => ({ data: null, isLoading: false }),
  useOpenPortal: mutation,
  useCreateCheckout: mutation,
  useUpdateBillingDetails: mutation,
  useUpgradeSubscription: mutation,
  useCancelSubscription: mutation,
  usePrefetchBillingData: () => vi.fn(),
}));

vi.mock('@/lib/analytics/billing', () => ({
  trackPricingViewed: vi.fn(),
  trackSubscriptionStarted: vi.fn(),
  trackTrialStarted: vi.fn(),
  trackBillingCheckoutFailed: vi.fn(),
  trackPlanSelected: vi.fn(),
  buildSubscriptionStartedProps: vi.fn(() => ({})),
  buildPlanSelectedProps: vi.fn(() => ({})),
  subscriptionTierToPlanSlug: vi.fn(() => 'growth'),
}));

vi.mock('@/lib/api/authorized-api-fetch', () => ({
  authorizedApiFetch: vi.fn(async (url: string) => {
    if (url.startsWith('/api/agencies')) {
      return { data: [{ id: 'ag_1', name: 'Acme', settings: {} }], error: null };
    }
    return { data: null };
  }),
}));

vi.mock('@/lib/api/agents', () => ({
  listAgentGrants: vi.fn().mockResolvedValue([]),
  createAgentGrant: vi.fn(),
  updateAgentGrant: vi.fn(),
  revokeAgentGrant: vi.fn(),
}));

vi.mock('@/lib/api/webhooks', () => ({
  getWebhookEndpoint: vi.fn().mockResolvedValue({
    id: 'ep_1',
    agencyId: 'ag_1',
    url: 'https://example.com/hooks',
    status: 'active',
    subscribedEvents: ['access_request.completed'],
    failureCount: 0,
    secretLastFour: '1234',
    lastDeliveredAt: '2026-09-01T00:00:00.000Z',
    lastFailedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  }),
  listWebhookDeliveries: vi.fn().mockResolvedValue({ endpoint: null, deliveries: [] }),
  upsertWebhookEndpoint: vi.fn(),
  rotateWebhookEndpointSecret: vi.fn(),
  disableWebhookEndpoint: vi.fn(),
  sendWebhookTestEvent: vi.fn(),
}));

const BRUTALIST_MARKERS = ['uppercase', 'bg-coral', 'border-2'];

function isBrutalist(el: Element): boolean {
  const cls = el.className ?? '';
  return BRUTALIST_MARKERS.every((marker) => cls.split(/\s+/).includes(marker));
}

async function renderTab(query: string) {
  searchParamsState = new URLSearchParams(query);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>
  );
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const { container } = utils;
  const panels = container.querySelectorAll('.ink-panel');
  const brutalistButtons = Array.from(container.querySelectorAll('button, a')).filter(isBrutalist);
  const shadows = container.querySelectorAll('[class*="shadow-brutalist"]');
  return { container, panels, brutalistButtons, shadows };
}

function expectBrutalistOutsidePanel(brutalistButtons: Element[], panels: NodeListOf<Element>) {
  for (const button of brutalistButtons) {
    for (const panel of Array.from(panels)) {
      expect(panel.contains(button)).toBe(false);
    }
  }
}

describe('Settings — rendered per-view counts', () => {
  const originalFlag = process.env.NEXT_PUBLIC_BILLING_V2_ENABLED;

  beforeEach(() => {
    mockUseSubscription.mockReturnValue({
      data: { id: 'sub_1', tier: 'GROWTH', status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: '2026-10-01T00:00:00.000Z' },
      isLoading: false,
    });
    delete process.env.NEXT_PUBLIC_BILLING_V2_ENABLED;
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.NEXT_PUBLIC_BILLING_V2_ENABLED;
    else process.env.NEXT_PUBLIC_BILLING_V2_ENABLED = originalFlag;
  });

  it('General: one ink-panel, one brutalist button outside it, ≤3 shadows', async () => {
    const { panels, brutalistButtons, shadows } = await renderTab('tab=general');
    expect(panels).toHaveLength(1);
    expect(brutalistButtons).toHaveLength(1);
    expectBrutalistOutsidePanel(brutalistButtons, panels);
    expect(shadows.length).toBeLessThanOrEqual(3);
  });

  it.each([
    ['PAID', { id: 'sub_1', tier: 'GROWTH', status: 'active', cancelAtPeriodEnd: false }],
    ['TRIALING', { id: 'sub_1', tier: 'STARTER', status: 'trialing', cancelAtPeriodEnd: false, trialEnd: '2026-10-01T00:00:00.000Z' }],
    ['FREE', null],
  ])('Billing v2 %s: one ink-panel, one brutalist button outside it, ≤3 shadows', async (_label, subscription) => {
    mockUseSubscription.mockReturnValue({ data: subscription, isLoading: false });
    const { panels, brutalistButtons, shadows } = await renderTab('tab=billing');
    expect(panels).toHaveLength(1);
    expect(brutalistButtons).toHaveLength(1);
    expectBrutalistOutsidePanel(brutalistButtons, panels);
    expect(shadows.length).toBeLessThanOrEqual(3);
  });

  it('Billing legacy branch: no ink-panel, no brutalist button, ≤3 shadows', async () => {
    process.env.NEXT_PUBLIC_BILLING_V2_ENABLED = 'false';
    const { panels, brutalistButtons, shadows } = await renderTab('tab=billing');
    expect(panels).toHaveLength(0);
    expect(brutalistButtons).toHaveLength(0);
    expect(shadows.length).toBeLessThanOrEqual(3);
  });

  it('Webhooks: one ink-panel, one brutalist button outside it, ≤3 shadows', async () => {
    const { panels, brutalistButtons, shadows } = await renderTab('tab=webhooks');
    expect(panels).toHaveLength(1);
    expect(brutalistButtons).toHaveLength(1);
    expectBrutalistOutsidePanel(brutalistButtons, panels);
    expect(shadows.length).toBeLessThanOrEqual(3);
  });

  it('Agents without connect=: one ink-panel, no brutalist button', async () => {
    const { panels, brutalistButtons, shadows } = await renderTab('tab=agents');
    expect(panels).toHaveLength(1);
    expect(brutalistButtons).toHaveLength(0);
    expect(shadows.length).toBeLessThanOrEqual(3);
  });

  it('Agents with connect=abc: one ink-panel, one brutalist "Approve agent" outside it', async () => {
    const { panels, brutalistButtons, shadows } = await renderTab('tab=agents&connect=abc');
    expect(panels).toHaveLength(1);
    expect(brutalistButtons).toHaveLength(1);
    expect(brutalistButtons[0].textContent).toMatch(/approve agent/i);
    expectBrutalistOutsidePanel(brutalistButtons, panels);
    expect(shadows.length).toBeLessThanOrEqual(3);
  });
});
