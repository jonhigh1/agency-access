import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanStrip } from '../plan-strip';

const mockUseSubscription = vi.fn();
const mockUseTierDetails = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('@/lib/query/billing', () => ({
  useSubscription: () => mockUseSubscription(),
  useTierDetails: () => mockUseTierDetails(),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => mockUseAuth(),
}));

const limits = {
  clients: { limit: 10, used: 2, remaining: 8 },
  members: { limit: 5, used: 1, remaining: 4 },
  accessRequests: { limit: 20, used: 3, remaining: 17 },
  templates: { limit: 'unlimited' as const, used: 1, remaining: 0 },
};

describe('PlanStrip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ orgId: 'org_1', userId: 'user_1' });
  });

  it('renders plan, status, and limits inside the ink panel when loaded', () => {
    mockUseSubscription.mockReturnValue({
      data: { id: 's', tier: 'GROWTH', status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: '2026-10-01T00:00:00.000Z' },
      isLoading: false,
    });
    mockUseTierDetails.mockReturnValue({ data: { tier: 'GROWTH', status: 'active', limits, features: [] }, isLoading: false });

    const { container } = render(<PlanStrip />);

    const panel = container.querySelector('.ink-panel');
    expect(panel).not.toBeNull();
    expect(screen.getByTestId('plan-strip-plan')).toHaveTextContent('Growth');
    expect(screen.getByTestId('plan-strip-status')).toHaveTextContent(/active/i);
    expect(screen.getByTestId('plan-strip-limits')).toHaveTextContent('10 clients');
    expect(screen.getByTestId('plan-strip-limits')).toHaveTextContent('20 requests');
    expect(screen.getByTestId('plan-strip-limits')).toHaveTextContent('5 members');
    expect(container.querySelector('.ink-panel button')).toBeNull();
  });

  it('renders dashes for every value while loading and keeps the same panel', () => {
    mockUseSubscription.mockReturnValue({ data: undefined, isLoading: true });
    mockUseTierDetails.mockReturnValue({ data: undefined, isLoading: true });

    const { container } = render(<PlanStrip />);

    expect(container.querySelectorAll('.ink-panel')).toHaveLength(1);
    expect(screen.getByTestId('plan-strip-plan')).toHaveTextContent('—');
    expect(screen.getByTestId('plan-strip-status')).toHaveTextContent('—');
    expect(screen.getByTestId('plan-strip-limits')).toHaveTextContent('—');
  });

  it('reads Free for an expired subscription even when a tier is set', () => {
    mockUseSubscription.mockReturnValue({ data: { id: 's', tier: 'GROWTH', status: 'expired', cancelAtPeriodEnd: false }, isLoading: false });
    mockUseTierDetails.mockReturnValue({ data: { tier: null, status: 'expired', limits, features: [] }, isLoading: false });

    render(<PlanStrip />);

    expect(screen.getByTestId('plan-strip-plan')).toHaveTextContent('Free');
  });

  it('renders for a personal principal with no orgId', () => {
    mockUseAuth.mockReturnValue({ orgId: null, userId: 'user_1' });
    mockUseSubscription.mockReturnValue({ data: null, isLoading: false });
    mockUseTierDetails.mockReturnValue({ data: { tier: null, status: 'free', limits, features: [] }, isLoading: false });

    const { container } = render(<PlanStrip />);

    expect(container.querySelectorAll('.ink-panel')).toHaveLength(1);
    expect(screen.getByTestId('plan-strip-plan')).toHaveTextContent('Free');
  });

  it('says "Ends" instead of "Renews" when the subscription is cancelling', () => {
    mockUseSubscription.mockReturnValue({
      data: { id: 's', tier: 'GROWTH', status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: '2026-10-01T12:00:00.000Z' },
      isLoading: false,
    });
    mockUseTierDetails.mockReturnValue({ data: { tier: 'GROWTH', status: 'active', limits, features: [] }, isLoading: false });

    render(<PlanStrip />);

    expect(screen.getByTestId('plan-strip-status')).toHaveTextContent(/Ends /);
    expect(screen.getByTestId('plan-strip-status')).not.toHaveTextContent(/Renews /);
  });

  it('renders dashes, not Free, when the subscription query errors', () => {
    mockUseSubscription.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    mockUseTierDetails.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    render(<PlanStrip />);

    expect(screen.getByTestId('plan-strip-plan')).toHaveTextContent('—');
    expect(screen.getByTestId('plan-strip-status')).toHaveTextContent('—');
  });
});
