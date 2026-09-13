import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PlanComparison } from '../plan-comparison';

const mockUseSubscription = vi.fn();
const mockMutateAsync = vi.fn();
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
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

describe('PlanComparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageState.clear();
    vi.stubGlobal('localStorage', localStorageMock);
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    });
    mockMutateAsync.mockResolvedValue({
      checkoutUrl: 'https://checkout.example.com/session_123',
    });

    vi.stubGlobal('location', {
      origin: 'http://localhost',
      href: 'http://localhost/settings?tab=billing',
    });
  });

  it('marks Starter as current plan for STARTER subscriptions', () => {
    mockUseSubscription.mockReturnValue({
      data: {
        id: 'sub_123',
        tier: 'STARTER',
        status: 'active',
        cancelAtPeriodEnd: false,
      },
      isLoading: false,
    });

    render(<PlanComparison />);

    const starterCard = screen.getAllByText('Starter')
      .map((node) => node.closest('div.relative'))
      .find(Boolean);
    expect(starterCard).toBeTruthy();
    expect(within(starterCard as HTMLElement).getByText('Current Plan')).toBeInTheDocument();
  });

  it('marks Scale as current plan for SCALE subscriptions', () => {
    mockUseSubscription.mockReturnValue({
      data: {
        id: 'sub_456',
        tier: 'SCALE',
        status: 'active',
        cancelAtPeriodEnd: false,
      },
      isLoading: false,
    });

    render(<PlanComparison />);

    const agencyCard = screen.getAllByText('Scale')
      .map((node) => node.closest('div.relative'))
      .find(Boolean);
    expect(agencyCard).toBeTruthy();
    expect(within(agencyCard as HTMLElement).getByText('Current Plan')).toBeInTheDocument();
  });

  it('marks Growth as current plan for GROWTH subscriptions', () => {
    mockUseSubscription.mockReturnValue({
      data: {
        id: 'sub_789',
        tier: 'GROWTH',
        status: 'active',
        cancelAtPeriodEnd: false,
      },
      isLoading: false,
    });

    render(<PlanComparison />);

    const growthCard = screen.getAllByText('Growth')
      .map((node) => node.closest('div.relative'))
      .find(Boolean);
    expect(growthCard).toBeTruthy();
    expect(within(growthCard as HTMLElement).getByText('Current Plan')).toBeInTheDocument();
  });

  it('uses persisted interval from localStorage for checkout payload', async () => {
    localStorageMock.setItem('selectedBillingInterval', 'monthly');
    mockUseSubscription.mockReturnValue({
      data: null,
      isLoading: false,
    });

    render(<PlanComparison />);

    const growthCard = screen.getAllByText('Growth')
      .map((node) => node.closest('div.relative'))
      .find(Boolean);
    expect(growthCard).toBeTruthy();

    fireEvent.click(
      within(growthCard as HTMLElement).getByRole('button', { name: /start free trial/i })
    );

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'GROWTH',
          billingInterval: 'monthly',
        })
      );
    });
  });

  it('updates localStorage and checkout payload when interval toggles', async () => {
    mockUseSubscription.mockReturnValue({
      data: null,
      isLoading: false,
    });

    render(<PlanComparison />);

    const growthCard = screen.getAllByText('Growth')
      .map((node) => node.closest('div.relative'))
      .find(Boolean);
    expect(growthCard).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^monthly$/i }));
    fireEvent.click(
      within(growthCard as HTMLElement).getByRole('button', { name: /start free trial/i })
    );

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'GROWTH',
          billingInterval: 'monthly',
        })
      );
    });

    expect(localStorageMock.getItem('selectedBillingInterval')).toBe('monthly');
  });

  it('offers a free trial on every tier, including Starter, when there is no subscription', () => {
    mockUseSubscription.mockReturnValue({ data: null, isLoading: false });

    render(<PlanComparison />);

    expect(screen.queryByText('Current Plan')).toBeNull();
    expect(screen.getAllByRole('button', { name: /start free trial/i }).length).toBeGreaterThanOrEqual(3);
  });
});
