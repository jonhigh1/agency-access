import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsageOverviewCard } from '../usage-overview-card';

const mockUseQuota = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('@/lib/query/quota', () => ({
  useQuota: () => mockUseQuota(),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => mockUseAuth(),
}));

const quota = {
  currentTier: 'GROWTH',
  updatedAt: new Date(),
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
    mockUseQuota.mockReturnValue({ data: quota, isLoading: false, isError: false });

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
    mockUseQuota.mockReturnValue({
      data: { ...quota, templates: { limit: 5, used: 4, remaining: 1 } },
      isLoading: false,
      isError: false,
    });

    render(<UsageOverviewCard />);

    expect(screen.getByText('Templates')).toBeInTheDocument();
    expect(screen.getByText('4 of 5')).toBeInTheDocument();
  });

  it('links to the billing tab', () => {
    mockUseQuota.mockReturnValue({ data: quota, isLoading: false, isError: false });

    render(<UsageOverviewCard />);

    expect(screen.getByRole('link', { name: /billing/i })).toHaveAttribute('href', '/settings?tab=billing');
  });

  it('renders the organization-context row when orgId is null', () => {
    mockUseAuth.mockReturnValue({ orgId: null, userId: 'user_1' });
    mockUseQuota.mockReturnValue({ data: undefined, isLoading: false, isError: false });

    render(<UsageOverviewCard />);

    expect(screen.getByText(/requires an active organization context/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('settings-row')).toHaveLength(1);
  });

  it('renders the error copy with the danger ink token', () => {
    mockUseQuota.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    render(<UsageOverviewCard />);

    const error = screen.getByText(/failed to load usage data/i);
    expect(error.className).toContain('text-danger-ink');
  });

  it('renders square skeleton rows while loading', () => {
    mockUseQuota.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    const { container } = render(<UsageOverviewCard />);

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(container.innerHTML).not.toMatch(/rounded(?!-none|-full)/);
  });
});
