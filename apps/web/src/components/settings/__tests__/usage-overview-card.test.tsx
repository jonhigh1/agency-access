import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsageOverviewCard } from '../usage-overview-card';

const mockUseTierDetails = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('@/lib/query/billing', () => ({
  useTierDetails: () => mockUseTierDetails(),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => mockUseAuth(),
}));

const limits = {
  clients: { limit: 10, used: 2, remaining: 8 },
  members: { limit: 5, used: 1, remaining: 4 },
  accessRequests: { limit: 20, used: 3, remaining: 17 },
  templates: { limit: 'unlimited', used: 1, remaining: 0 },
};

describe('UsageOverviewCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ orgId: 'org_1', userId: 'user_1' });
  });

  it('renders one row per metric and hides templates when unlimited', () => {
    mockUseTierDetails.mockReturnValue({ data: { tier: 'GROWTH', status: 'active', limits, features: [] }, isLoading: false, isError: false });

    render(<UsageOverviewCard />);

    expect(screen.getByRole('heading', { level: 2, name: /usage/i })).toBeInTheDocument();
    const rows = screen.getAllByTestId('settings-row');
    expect(rows).toHaveLength(3);
    expect(screen.getByText('Clients')).toBeInTheDocument();
    expect(screen.getByText('2 of 10')).toBeInTheDocument();
    expect(screen.getByText('Requests')).toBeInTheDocument();
    expect(screen.getByText('3 of 20')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.queryByText('Templates')).toBeNull();
  });

  it('renders a templates row when the limit is a number', () => {
    mockUseTierDetails.mockReturnValue({
      data: { tier: 'GROWTH', status: 'active', limits: { ...limits, templates: { limit: 5, used: 4, remaining: 1 } }, features: [] },
      isLoading: false,
      isError: false,
    });

    render(<UsageOverviewCard />);

    expect(screen.getByText('Templates')).toBeInTheDocument();
    expect(screen.getByText('4 of 5')).toBeInTheDocument();
  });

  it('links to the billing tab', () => {
    mockUseTierDetails.mockReturnValue({ data: { tier: 'GROWTH', status: 'active', limits, features: [] }, isLoading: false, isError: false });

    render(<UsageOverviewCard />);

    expect(screen.getByRole('link', { name: /billing/i })).toHaveAttribute('href', '/settings?tab=billing');
  });

  it('renders usage for a personal principal with no orgId (same source as Billing)', () => {
    mockUseAuth.mockReturnValue({ orgId: null, userId: 'user_1' });
    mockUseTierDetails.mockReturnValue({ data: { tier: null, status: 'free', limits, features: [] }, isLoading: false, isError: false });

    render(<UsageOverviewCard />);

    expect(screen.getByText('2 of 10')).toBeInTheDocument();
    expect(screen.queryByText(/requires an active organization context/i)).toBeNull();
  });

  it('renders the error copy with the danger ink token', () => {
    mockUseTierDetails.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    render(<UsageOverviewCard />);

    const error = screen.getByText(/failed to load usage data/i);
    expect(error.className).toContain('text-danger-ink');
  });

  it('renders square skeleton rows while loading', () => {
    mockUseTierDetails.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    const { container } = render(<UsageOverviewCard />);

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(container.innerHTML).not.toMatch(/rounded(?!-none|-full)/);
  });
});
