import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CurrentPlanCard } from '../current-plan-card';

const mockUseSubscription = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock('@/lib/query/billing', () => ({
  useSubscription: () => mockUseSubscription(),
  useOpenPortal: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

describe('CurrentPlanCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps STARTER tier to Starter plan display', () => {
    mockUseSubscription.mockReturnValue({
      data: {
        id: 'sub_123',
        tier: 'STARTER',
        status: 'active',
        cancelAtPeriodEnd: false,
      },
      isLoading: false,
    });

    render(<CurrentPlanCard />);

    expect(screen.getByRole('heading', { name: 'Starter Plan' })).toBeInTheDocument();
  });

  it('maps SCALE tier to Scale plan display', () => {
    mockUseSubscription.mockReturnValue({
      data: {
        id: 'sub_456',
        tier: 'SCALE',
        status: 'active',
        cancelAtPeriodEnd: false,
      },
      isLoading: false,
    });

    render(<CurrentPlanCard />);

    expect(screen.getByRole('heading', { name: 'Scale Plan' })).toBeInTheDocument();
  });

  it('shows Free plan when no active subscription exists', () => {
    mockUseSubscription.mockReturnValue({
      data: null,
      isLoading: false,
    });

    render(<CurrentPlanCard />);

    expect(screen.getByRole('heading', { name: 'Free Plan' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Starter Plan' })).not.toBeInTheDocument();
  });
});
