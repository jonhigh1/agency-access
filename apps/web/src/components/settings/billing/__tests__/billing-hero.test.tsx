import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BillingHero } from '../billing-hero';

const mockUseSubscription = vi.fn();
const mockCreateCheckoutMutateAsync = vi.fn();
const mockOpenPortalMutateAsync = vi.fn();
const trackPlanSelectedMock = vi.fn();
const storageState = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storageState.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storageState.set(key, value);
  }),
  clear: vi.fn(() => {
    storageState.clear();
  }),
};

vi.mock('@/lib/query/billing', () => ({
  useSubscription: () => mockUseSubscription(),
  useCreateCheckout: () => ({
    mutateAsync: mockCreateCheckoutMutateAsync,
    isPending: false,
  }),
  useOpenPortal: () => ({
    mutateAsync: mockOpenPortalMutateAsync,
    isPending: false,
  }),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ orgId: 'org_123', userId: 'user_123' }),
}));

vi.mock('@/lib/analytics/billing', () => ({
  trackPlanSelected: (...args: any[]) => trackPlanSelectedMock(...args),
  buildPlanSelectedProps: vi.fn(() => ({
    plan: 'starter',
    billing_period: 'yearly',
    price_cents: 29000,
    surface: 'checkout',
    creem_product_id: 'prod_6Hyydvn6jh0numRxJecMol',
  })),
}));

describe('BillingHero', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageState.clear();
    vi.stubGlobal('localStorage', localStorageMock);
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    });
    mockCreateCheckoutMutateAsync.mockResolvedValue({
      checkoutUrl: 'https://checkout.example.com/session_123',
    });
    mockOpenPortalMutateAsync.mockResolvedValue({
      portalUrl: 'https://portal.example.com/session_123',
    });

    vi.stubGlobal('location', {
      origin: 'http://localhost',
      href: 'http://localhost/settings?tab=billing',
    });
  });

  it('shows free trial CTA for free users and starts checkout', async () => {
    mockUseSubscription.mockReturnValue({ data: null, isLoading: false });

    render(<BillingHero />);

    fireEvent.click(screen.getByRole('button', { name: /start free trial/i }));

    await waitFor(() => {
      expect(mockCreateCheckoutMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'STARTER',
          billingInterval: 'yearly',
        })
      );
    });
  });

  it('shows activate paid plan CTA for trialing users', async () => {
    mockUseSubscription.mockReturnValue({
      data: {
        id: 'sub_123',
        tier: 'STARTER',
        status: 'trialing',
        cancelAtPeriodEnd: false,
        trialEnd: '2026-03-10T00:00:00.000Z',
      },
      isLoading: false,
    });

    render(<BillingHero />);

    expect(screen.getByRole('button', { name: /activate paid plan/i })).toBeInTheDocument();
  });

  it('renders the lifecycle CTA as the one brutalist button, outside the ink-panel (KTD4, KTD5)', () => {
    mockUseSubscription.mockReturnValue({ data: null, isLoading: false });

    const { container } = render(<BillingHero />);

    const panels = container.querySelectorAll('.ink-panel');
    expect(panels).toHaveLength(1);
    expect(panels[0].querySelector('button')).toBeNull();

    const cta = screen.getByRole('button', { name: /start free trial/i });
    for (const marker of ['uppercase', 'bg-coral', 'border-2']) {
      expect(cta.className.split(/\s+/)).toContain(marker);
    }
    expect(panels[0].contains(cta)).toBe(false);
  });

  it('shows plan name, status, and next bill in the panel for paid users', () => {
    mockUseSubscription.mockReturnValue({
      data: {
        id: 'sub_789',
        tier: 'GROWTH',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: '2026-10-01T12:00:00.000Z',
      },
      isLoading: false,
    });

    const { container } = render(<BillingHero />);

    const panel = container.querySelector('.ink-panel') as HTMLElement;
    expect(within(panel).getByText('Growth')).toBeInTheDocument();
    expect(within(panel).getByText('Active')).toBeInTheDocument();
    expect(within(panel).getByText(/October 1, 2026/)).toBeInTheDocument();
  });

  it('keeps one shell while loading: same panel heading, — values, disabled CTA', () => {
    mockUseSubscription.mockReturnValue({ data: undefined, isLoading: true });

    const { container } = render(<BillingHero />);

    const panel = container.querySelector('.ink-panel') as HTMLElement;
    expect(panel).toBeInTheDocument();
    expect(within(panel).getByText('Subscription')).toBeInTheDocument();
    expect(within(panel).getAllByText('—').length).toBeGreaterThanOrEqual(3);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toBeDisabled();
    expect(panel.contains(buttons[0])).toBe(false);
  });

  it('uses billing portal CTA for past due users', async () => {
    mockUseSubscription.mockReturnValue({
      data: {
        id: 'sub_456',
        tier: 'STARTER',
        status: 'past_due',
        cancelAtPeriodEnd: false,
      },
      isLoading: false,
    });

    render(<BillingHero />);

    fireEvent.click(screen.getByRole('button', { name: /manage in billing portal/i }));

    await waitFor(() => {
      expect(mockOpenPortalMutateAsync).toHaveBeenCalled();
    });
  });
});
