import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardPage from '../page';

const routerPush = vi.fn();
const quotaMutateAsync = vi.fn();
const getTokenMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock('@/lib/query/quota', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/query/quota')>();
  return {
    ...actual,
    usePrefetchQuota: () => vi.fn().mockResolvedValue(undefined),
    useQuotaCheck: () => ({ mutateAsync: quotaMutateAsync }),
  };
});

vi.mock('@/components/upgrade-modal', () => ({
  UpgradeModal: () => null,
}));

const useQueryMock = vi.fn();
const useAgencyOnboardingStatusMock = vi.fn();
const useUpdateOnboardingProgressMock = vi.fn();

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: vi.fn(() => ({
    getToken: getTokenMock,
    userId: 'user_123',
    orgId: null,
    isLoaded: true,
  })),
}));

vi.mock('@/lib/dev-auth', () => ({
  DEV_USER_ID: 'dev_user_test_123456789',
  useAuthOrBypass: vi.fn(() => ({
    userId: 'user_123',
    orgId: null,
    isLoaded: true,
    isDevelopmentBypass: false,
  })),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => useQueryMock(options),
}));

vi.mock('@/lib/query/onboarding', () => ({
  useAgencyOnboardingStatus: (agencyId: string | undefined) => useAgencyOnboardingStatusMock(agencyId),
  useUpdateAgencyOnboardingProgress: () => useUpdateOnboardingProgressMock(),
}));

vi.mock('@/lib/perf-harness', () => ({
  readPerfHarnessContext: vi.fn(() => null),
  startPerfTimer: vi.fn(() => null),
}));

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  },
}));

vi.mock('@/components/ui', () => ({
  StatCard: ({ label, value }: any) => (
    <div>
      {label}: {String(value)}
    </div>
  ),
  StatusBadge: ({ status }: any) => <span>{status}</span>,
  EmptyState: ({ title, description }: any) => (
    <div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
  PlatformIcon: ({ platform }: { platform: string }) => (
    <span data-testid={`platform-icon-${platform}`}>{platform}</span>
  ),
}));

vi.mock('@/components/trial-banner', () => ({
  TrialBanner: ({ trialEnd, tierName }: { trialEnd: string; tierName: string }) => (
    <div>{`Trial banner: ${tierName} ends ${trialEnd}`}</div>
  ),
}));

describe('DashboardPage behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerPush.mockClear();
    quotaMutateAsync.mockReset();
    quotaMutateAsync.mockResolvedValue({
      allowed: true,
      limit: 100,
      used: 0,
      remaining: 100,
      currentTier: 'STARTER',
    });
    getTokenMock.mockResolvedValue('test-token');
    useAgencyOnboardingStatusMock.mockReturnValue({
      data: null,
      isLoading: false,
    });
    useUpdateOnboardingProgressMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it('shows latest-10 summary messaging when API reports more results exist', async () => {
    useQueryMock.mockReturnValue({
      data: {
        data: {
          agency: {
            id: 'agency_1',
            name: 'Agency One',
            email: 'owner@agency.test',
          },
          stats: {
            totalRequests: 25,
            pendingRequests: 3,
            activeConnections: 42,
            totalPlatforms: 5,
          },
          requests: Array.from({ length: 10 }, (_, i) => ({
            id: `request-${i + 1}`,
            clientName: `Client ${i + 1}`,
            clientEmail: `client${i + 1}@example.com`,
            status: 'pending',
            createdAt: '2026-09-07T08:00:00.000Z',
            uniqueToken: `token-${i + 1}`,
            platforms: ['google'],
          })),
          connections: Array.from({ length: 10 }, (_, i) => ({
            id: `connection-${i + 1}`,
            clientEmail: `connected${i + 1}@example.com`,
            status: 'active',
            createdAt: '2026-01-01T00:00:00.000Z',
            platforms: ['google'],
          })),
          meta: {
            requests: {
              limit: 10,
              returned: 10,
              total: 25,
              hasMore: true,
            },
            connections: {
              limit: 10,
              returned: 10,
              total: 42,
              hasMore: true,
            },
          },
        },
        error: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<DashboardPage />);

    expect(await screen.findByText('Showing latest 10 of 25 requests')).toBeInTheDocument();
    expect(await screen.findByText('Showing latest 10 of 42 connections')).toBeInTheDocument();
  });

  it('links each recent request row to request details', async () => {
    useQueryMock.mockReturnValue({
      data: {
        data: {
          agency: {
            id: 'agency_1',
            name: 'Agency One',
            email: 'owner@agency.test',
          },
          stats: {
            totalRequests: 2,
            pendingRequests: 1,
            activeConnections: 0,
            totalPlatforms: 1,
          },
          requests: [
            {
              id: 'request-1',
              clientId: 'client-123',
              clientName: 'Client One',
              clientEmail: 'client.one@example.com',
              status: 'pending',
              createdAt: '2026-09-07T08:00:00.000Z',
              uniqueToken: 'token-1',
              platforms: ['google'],
            },
            {
              id: 'request-2',
              clientName: 'Client Two',
              clientEmail: 'client.two+east@example.com',
              status: 'partial',
              createdAt: '2026-09-07T09:00:00.000Z',
              uniqueToken: 'token-2',
              platforms: ['meta'],
            },
          ],
          connections: [],
          meta: {
            requests: {
              limit: 10,
              returned: 2,
              total: 2,
              hasMore: false,
            },
            connections: {
              limit: 10,
              returned: 0,
              total: 0,
              hasMore: false,
            },
          },
        },
        error: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<DashboardPage />);

    expect(await screen.findByText('Client One')).toBeInTheDocument();
    expect(document.querySelector('a[href=\"/access-requests/request-1\"]')).toBeInTheDocument();
    expect(document.querySelector('a[href=\"/access-requests/request-2\"]')).toBeInTheDocument();
  });

  it('shows onboarding checklist when lifecycle status is in_progress', async () => {
    useQueryMock.mockReturnValue({
      data: {
        data: {
          agency: {
            id: 'agency_1',
            name: 'Agency One',
            email: 'owner@agency.test',
          },
          stats: {
            totalRequests: 0,
            pendingRequests: 0,
            activeConnections: 0,
            totalPlatforms: 0,
          },
          requests: [],
          connections: [],
          onboardingStatus: {
            status: 'in_progress',
            completed: false,
            lifecycle: {
              status: 'in_progress',
              lastVisitedStep: 3,
            },
            step: {
              profile: true,
              members: false,
              firstRequest: false,
            },
          },
        },
        error: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<DashboardPage />);

    expect(await screen.findByText('Finish your onboarding setup')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Resume onboarding' })).toHaveAttribute('href', '/onboarding/unified');
    expect(useAgencyOnboardingStatusMock).not.toHaveBeenCalled();
  });

  it('shows only resume and finish actions when lifecycle status is activated', async () => {
    useQueryMock.mockReturnValue({
      data: {
        data: {
          agency: {
            id: 'agency_1',
            name: 'Agency One',
            email: 'owner@agency.test',
          },
          stats: {
            totalRequests: 0,
            pendingRequests: 0,
            activeConnections: 0,
            totalPlatforms: 0,
          },
          requests: [],
          connections: [],
          onboardingStatus: {
            status: 'activated',
            completed: false,
            lifecycle: {
              status: 'activated',
              lastVisitedStep: 5,
              activatedAt: '2026-03-01T00:00:00.000Z',
            },
            step: {
              profile: true,
              members: true,
              firstRequest: true,
            },
          },
        },
        error: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<DashboardPage />);

    expect(await screen.findByText('Finish your onboarding setup')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Resume onboarding' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish setup' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip optional setup' })).not.toBeInTheDocument();
  });

  it('hides onboarding checklist when onboarding is completed', async () => {
    useQueryMock.mockReturnValue({
      data: {
        data: {
          agency: {
            id: 'agency_1',
            name: 'Agency One',
            email: 'owner@agency.test',
          },
          stats: {
            totalRequests: 0,
            pendingRequests: 0,
            activeConnections: 0,
            totalPlatforms: 0,
          },
          requests: [],
          connections: [],
          onboardingStatus: {
            status: 'completed',
            completed: true,
            step: {
              profile: true,
              members: true,
              firstRequest: true,
            },
          },
        },
        error: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<DashboardPage />);

    expect(screen.queryByText('Finish your onboarding setup')).not.toBeInTheDocument();
  });

  it('renders the trial banner from dashboard bootstrap data', async () => {
    useQueryMock.mockReturnValue({
      data: {
        data: {
          agency: {
            id: 'agency_1',
            name: 'Agency One',
            email: 'owner@agency.test',
          },
          stats: {
            totalRequests: 0,
            pendingRequests: 0,
            activeConnections: 0,
            totalPlatforms: 0,
          },
          requests: [],
          connections: [],
          trialBanner: {
            tier: 'SCALE',
            trialEnd: '2026-03-20T00:00:00.000Z',
          },
        },
        error: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<DashboardPage />);

    expect(await screen.findByText('Trial banner: Scale ends 2026-03-20T00:00:00.000Z')).toBeInTheDocument();
  });

  it('preserves loading state while initial data request is pending', () => {
    useQueryMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<DashboardPage />);

    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });

  it('fetches dashboard data through the normalized API base URL', async () => {
    const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        data: {
          agency: {
            id: 'agency_1',
            name: 'Agency One',
            email: 'owner@agency.test',
          },
          stats: {
            totalRequests: 0,
            pendingRequests: 0,
            activeConnections: 0,
            totalPlatforms: 0,
          },
          requests: [],
          connections: [],
        },
        error: null,
      }),
    });
    const originalFetch = global.fetch;
    global.fetch = fetchMock as typeof fetch;

    try {
      useQueryMock.mockImplementation((options) => ({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        options,
      }));

      render(<DashboardPage />);

      const queryOptions = useQueryMock.mock.calls[0]?.[0];
      await queryOptions.queryFn();

      expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/api/dashboard', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      });
    } finally {
      process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
      global.fetch = originalFetch;
    }
  });

  it('disables Create Request and shows Checking immediately while quota check is pending', async () => {
    let resolveQuota!: (value: unknown) => void;
    quotaMutateAsync.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveQuota = resolve;
        })
    );

    useQueryMock.mockReturnValue({
      data: {
        data: {
          agency: {
            id: 'agency_1',
            name: 'Agency One',
            email: 'owner@agency.test',
          },
          stats: {
            totalRequests: 0,
            pendingRequests: 0,
            activeConnections: 0,
            totalPlatforms: 0,
          },
          requests: [],
          connections: [],
        },
        error: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const user = userEvent.setup();
    render(<DashboardPage />);

    await screen.findByRole('heading', { name: 'Dashboard' });
    const buttons = screen.getAllByTestId('dashboard-create-request');
    await user.click(buttons[0]!);

    expect(buttons[0]).toBeDisabled();
    expect(buttons[0]).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByText('Checking…').length).toBeGreaterThanOrEqual(1);

    resolveQuota!({
      allowed: true,
      limit: 100,
      used: 0,
      remaining: 100,
      currentTier: 'STARTER',
    });

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith('/access-requests/new');
    });
  });
});
