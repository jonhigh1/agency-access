import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardPage from '../page';

const useQueryMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('test-token'),
    userId: 'user_123',
    orgId: null,
    isLoaded: true,
  }),
}));

vi.mock('@/lib/dev-auth', () => ({
  DEV_USER_ID: 'dev_user_test_123456789',
  useAuthOrBypass: () => ({
    userId: 'user_123',
    orgId: null,
    isLoaded: true,
    isDevelopmentBypass: false,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => useQueryMock(options),
}));

vi.mock('@/lib/query/onboarding', () => ({
  useUpdateAgencyOnboardingProgress: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/lib/query/quota', () => ({
  usePrefetchQuota: () => vi.fn(),
  useQuotaCheck: () => ({ mutateAsync: vi.fn().mockResolvedValue({ allowed: true }) }),
}));

vi.mock('@/lib/perf-harness', () => ({
  readPerfHarnessContext: vi.fn(() => null),
  startPerfTimer: vi.fn(() => null),
}));

vi.mock('@/components/upgrade-modal', () => ({
  UpgradeModal: () => null,
}));

vi.mock('@/components/trial-banner', () => ({
  TrialBanner: () => null,
}));

vi.mock('@/components/ui', () => ({
  StatCard: ({ label, value }: { label: string; value: number }) => <div>{label}: {value}</div>,
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
  PlatformIcon: () => null,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/analytics/pending-nudge-events', () => ({
  trackPendingNudgeBannerShown: vi.fn(),
  trackPendingNudgeBannerCta: vi.fn(),
}));

vi.mock('@/lib/analytics/invite-events', () => ({
  trackInviteLinkCopyAndSent: vi.fn(),
  trackInviteReminderSent: vi.fn(),
}));

describe('Dashboard pending nudge banners', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useQueryMock.mockReturnValue({
      data: {
        data: {
          agency: {
            id: 'agency_1',
            name: 'Agency One',
            email: 'owner@agency.test',
          },
          stats: {
            totalRequests: 1,
            pendingRequests: 1,
            activeConnections: 0,
            totalPlatforms: 1,
          },
          requests: [
            {
              id: 'request-stale',
              clientName: 'Stale Client',
              clientEmail: 'stale@example.com',
              status: 'pending',
              createdAt: '2026-03-01T00:00:00.000Z',
              uniqueToken: 'token-stale',
              platforms: ['google'],
            },
          ],
          connections: [],
          meta: {
            requests: { limit: 10, returned: 1, total: 1, hasMore: false },
            connections: { limit: 10, returned: 0, total: 0, hasMore: false },
          },
        },
        error: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('shows a pending cliff banner for stale pending requests', async () => {
    render(<DashboardPage />);

    expect(await screen.findByTestId('pending-nudge-banners')).toBeInTheDocument();
    expect(screen.getByTestId('pending-nudge-banner-72h')).toBeInTheDocument();
    expect(screen.getByText(/still pending after 3 days/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reminder/i })).toBeInTheDocument();
  });
});
