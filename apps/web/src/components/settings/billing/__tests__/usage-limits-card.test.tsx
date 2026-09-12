import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UsageLimitsCard } from '../usage-limits-card';

const mockUseTierDetails = vi.fn();
const mockCreateCheckoutMutateAsync = vi.fn();

vi.mock('@/lib/query/billing', () => ({
  useTierDetails: () => mockUseTierDetails(),
  useCreateCheckout: () => ({
    mutateAsync: mockCreateCheckoutMutateAsync,
    isPending: false,
  }),
}));

describe('UsageLimitsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateCheckoutMutateAsync.mockResolvedValue({
      checkoutUrl: 'https://checkout.example.com/session_123',
    });

    vi.stubGlobal('location', {
      origin: 'http://localhost',
      href: 'http://localhost/settings?tab=billing',
    });
  });

  it('upgrades STARTER users to SCALE', async () => {
    mockUseTierDetails.mockReturnValue({
      data: {
        tier: 'STARTER',
        status: 'active',
        limits: {
          accessRequests: { used: 9, limit: 10, remaining: 1 },
          clients: { used: 4, limit: 5, remaining: 1 },
          members: { used: 1, limit: 2, remaining: 1 },
          templates: { used: 2, limit: 3, remaining: 1 },
        },
      },
      isLoading: false,
    });

    render(<UsageLimitsCard />);

    fireEvent.click(screen.getByRole('button', { name: /upgrade/i }));

    await waitFor(() => {
      expect(mockCreateCheckoutMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'GROWTH',
        })
      );
    });
  });

  it('shows contact sales for SCALE users near limits', () => {
    mockUseTierDetails.mockReturnValue({
      data: {
        tier: 'SCALE',
        status: 'active',
        limits: {
          accessRequests: { used: 45, limit: 50, remaining: 5 },
          clients: { used: 20, limit: 25, remaining: 5 },
          members: { used: 4, limit: 5, remaining: 1 },
          templates: { used: 9, limit: 10, remaining: 1 },
        },
      },
      isLoading: false,
    });

    render(<UsageLimitsCard />);

    expect(screen.getByRole('button', { name: /contact sales/i })).toBeInTheDocument();
    expect(mockCreateCheckoutMutateAsync).not.toHaveBeenCalled();
  });
});
