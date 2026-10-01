import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CheckoutSuccessPage from '../page';

const { subscriptionQuery } = vi.hoisted(() => ({ subscriptionQuery: vi.fn() }));

vi.mock('@/lib/query/billing', () => ({ useSubscription: () => subscriptionQuery() }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('tier=SCALE'),
  useRouter: () => ({ push: vi.fn() }),
}));

describe('CheckoutSuccessPage', () => {
  it('does not claim activation before the server confirms subscription', () => {
    subscriptionQuery.mockReturnValue({ data: null, isLoading: false, isFetching: false, isError: false });

    render(<CheckoutSuccessPage />);

    expect(screen.getByRole('heading', { name: 'Payment processing' })).toBeInTheDocument();
    expect(screen.queryByText(/Scale subscription is active/i)).not.toBeInTheDocument();
  });

  it('shows the server-confirmed tier after subscription load completes', () => {
    subscriptionQuery.mockReturnValue({
      data: { tier: 'STARTER', status: 'active' },
      isLoading: false,
      isFetching: false,
      isError: false,
    });

    render(<CheckoutSuccessPage />);

    expect(screen.getByRole('heading', { name: 'Subscription confirmed' })).toBeInTheDocument();
    expect(screen.getByText('Your Starter subscription is active.')).toBeInTheDocument();
  });
});
