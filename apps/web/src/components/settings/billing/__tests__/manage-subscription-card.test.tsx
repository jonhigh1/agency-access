import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ManageSubscriptionCard } from '../manage-subscription-card';

const mockUseSubscription = vi.fn();
const mockMutateAsync = vi.fn();
const mockCreateCheckoutMutateAsync = vi.fn();

vi.mock('@/lib/query/billing', () => ({
  useSubscription: () => mockUseSubscription(),
  useUpgradeSubscription: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useCreateCheckout: () => ({
    mutateAsync: mockCreateCheckoutMutateAsync,
    isPending: false,
  }),
}));

vi.mock('../cancel-subscription-modal', () => ({
  CancelSubscriptionModal: () => null,
}));

describe('ManageSubscriptionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({
      tier: 'SCALE',
      status: 'active',
    });
    mockCreateCheckoutMutateAsync.mockResolvedValue({
      checkoutUrl: 'https://checkout.example.com/session_123',
    });
  });

  it('shows Starter, Growth, and Scale labels in tier selector', async () => {
    mockUseSubscription.mockReturnValue({
      data: {
        id: 'sub_123',
        tier: 'STARTER',
        status: 'active',
        cancelAtPeriodEnd: false,
      },
      isLoading: false,
    });

    render(<ManageSubscriptionCard />);

    fireEvent.click(screen.getByRole('button', { name: /change plan/i }));

    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Growth')).toBeInTheDocument();
    expect(screen.getByText('Scale')).toBeInTheDocument();
  });

  it('uses tier name in success copy after plan change', async () => {
    mockUseSubscription.mockReturnValue({
      data: {
        id: 'sub_456',
        tier: 'STARTER',
        status: 'active',
        cancelAtPeriodEnd: false,
      },
      isLoading: false,
    });

    render(<ManageSubscriptionCard />);

    fireEvent.click(screen.getByRole('button', { name: /change plan/i }));
    fireEvent.click(screen.getByRole('button', { name: /Scale.*149\/month/i }));
    fireEvent.click(screen.getByRole('button', { name: /Upgrade Now/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        newTier: 'SCALE',
        updateBehavior: 'next-cycle',
      });
    });

    expect(screen.getByText(/Successfully upgraded to Scale/i)).toBeInTheDocument();
  });

  it('shows manageable tiers when current subscription tier is SCALE', () => {
    mockUseSubscription.mockReturnValue({
      data: {
        id: 'sub_789',
        tier: 'SCALE',
        status: 'active',
        cancelAtPeriodEnd: false,
      },
      isLoading: false,
    });

    render(<ManageSubscriptionCard />);
    fireEvent.click(screen.getByRole('button', { name: /change plan/i }));

    expect(screen.getByText('Growth')).toBeInTheDocument();
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.queryByText(/legacy/i)).not.toBeInTheDocument();
  });

  it('treats Free as below Growth so Growth is an upgrade (not downgrade)', () => {
    mockUseSubscription.mockReturnValue({
      data: null,
      isLoading: false,
    });

    render(<ManageSubscriptionCard />);

    expect(screen.queryByRole('button', { name: /cancel subscription/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /change plan/i }));

    expect(screen.getByRole('button', { name: /Growth.*Upgrade/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Growth.*Downgrade/i })).not.toBeInTheDocument();
  });

  it('does not show action buttons until a tier is selected', () => {
    mockUseSubscription.mockReturnValue({
      data: {
        id: 'sub_999',
        tier: 'STARTER',
        status: 'active',
        cancelAtPeriodEnd: false,
      },
      isLoading: false,
    });

    render(<ManageSubscriptionCard />);

    fireEvent.click(screen.getByRole('button', { name: /change plan/i }));

    expect(screen.queryByRole('button', { name: /upgrade now/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /downgrade now/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument();
  });

  it('uses upgrade API when changing tier with no subscription row (normalized to STARTER)', async () => {
    mockUseSubscription.mockReturnValue({
      data: null,
      isLoading: false,
    });

    render(<ManageSubscriptionCard />);

    fireEvent.click(screen.getByRole('button', { name: /change plan/i }));
    fireEvent.click(screen.getByRole('button', { name: /Growth.*Upgrade/i }));
    fireEvent.click(screen.getByRole('button', { name: /Upgrade Now/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        newTier: 'GROWTH',
        updateBehavior: 'next-cycle',
      });
    });

    expect(mockCreateCheckoutMutateAsync).not.toHaveBeenCalled();
  });
});
