/**
 * Onboarding Platforms Page Tests
 *
 * Tests for first-time platform connection flow.
 * Following TDD - tests written before implementation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlatformsPage from '../page';

const mockLaunchMetaBusinessLogin = vi.fn();
const mockFinalizeMetaBusinessLogin = vi.fn();

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
}));

// Mock Clerk auth
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    userId: 'user-123',
    orgId: 'agency-1',
    getToken: vi.fn(async () => 'mock-token'),
  }),
  useUser: () => ({
    user: {
      primaryEmailAddress: { emailAddress: 'owner@agency.com' },
      emailAddresses: [{ emailAddress: 'owner@agency.com' }],
    },
  }),
}));

// Mock React Query
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => mockUseQuery(options),
  useMutation: (options: any) => mockUseMutation(options),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock('@/lib/meta-business-login', () => ({
  launchMetaBusinessLogin: (...args: any[]) => mockLaunchMetaBusinessLogin(...args),
  finalizeMetaBusinessLogin: (...args: any[]) => mockFinalizeMetaBusinessLogin(...args),
}));

describe('Onboarding Platforms Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_META_APP_ID = 'meta-app-123';
    process.env.NEXT_PUBLIC_META_LOGIN_FOR_BUSINESS_CONFIG_ID = 'meta-config-123';

    // Default: No platforms connected yet
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    // Default: OAuth initiation mutation
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    mockLaunchMetaBusinessLogin.mockResolvedValue({
      accessToken: 'meta-token',
      userId: 'meta-user-1',
      expiresIn: 3600,
    });
    mockFinalizeMetaBusinessLogin.mockResolvedValue({
      id: 'conn-meta-1',
      platform: 'meta',
    });
  });

  describe('Page Content', () => {
    it('should display page title', () => {
      render(<PlatformsPage />);
      expect(screen.getByRole('heading', { name: /connect platforms/i })).toBeInTheDocument();
    });

    it('should explain delegated access model', () => {
      render(<PlatformsPage />);
      expect(screen.getByText(/delegated access/i)).toBeInTheDocument();
      expect(screen.getByText(/manage client accounts through your own platform/i)).toBeInTheDocument();
    });

    it('should explain client authorization model', () => {
      render(<PlatformsPage />);
      expect(screen.getByText(/client authorization/i)).toBeInTheDocument();
      expect(screen.getByText(/client authorizes access to their own platform accounts/i)).toBeInTheDocument();
    });

    it('should display grid of available platforms', () => {
      render(<PlatformsPage />);

      // Should show all supported platforms
      expect(screen.getByText('Meta')).toBeInTheDocument();
      expect(screen.getByText('Google')).toBeInTheDocument();
      expect(screen.getAllByText('LinkedIn Ads').length).toBeGreaterThan(0);
    });
  });

  describe('Platform Connection Actions', () => {
    it('should show "Connect" button for unconnected platforms', () => {
      render(<PlatformsPage />);

      const connectButtons = screen.getAllByRole('button', { name: /connect/i });
      expect(connectButtons.length).toBeGreaterThan(0);
    });

    it('should show "Connected" status for connected platforms', () => {
      // Mock Meta platform as connected
      mockUseQuery.mockReturnValue({
        data: [
          {
            platform: 'meta',
            name: 'Meta',
            connected: true,
            status: 'active',
            connectedAt: new Date().toISOString(),
          },
        ],
        isLoading: false,
        error: null,
      });

      render(<PlatformsPage />);

      expect(screen.getByText('Meta')).toBeInTheDocument();
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });

    it('should disable connect button while initiating OAuth', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();

      mockUseMutation.mockReturnValue({
        mutate: mutateFn,
        isPending: true,
      });

      render(<PlatformsPage />);

      const connectButton = screen.getAllByRole('button', { name: /connect/i })[0];
      expect(connectButton).toBeDisabled();
    });

    it('should call OAuth initiation on connect button click', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();

      mockUseMutation.mockReturnValue({
        mutate: mutateFn,
        isPending: false,
      });

      render(<PlatformsPage />);

      const metaConnectButton = screen.getAllByRole('button', { name: /connect/i })[0];
      await user.click(metaConnectButton);

      expect(mutateFn).toHaveBeenCalled();
    });

    it('uses Meta Business Login instead of the legacy OAuth initiation mutation for Meta', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();

      mockUseMutation.mockReturnValue({
        mutate: mutateFn,
        isPending: false,
      });

      render(<PlatformsPage />);

      const connectButton = screen.getAllByRole('button', { name: /connect/i })[1];
      await user.click(connectButton);

      expect(mutateFn).not.toHaveBeenCalled();
      expect(mockLaunchMetaBusinessLogin).toHaveBeenCalledWith({
        appId: 'meta-app-123',
        configId: 'meta-config-123',
      });
      expect(mockFinalizeMetaBusinessLogin).toHaveBeenCalledWith({
        agencyId: 'agency-1',
        userEmail: 'owner@agency.com',
        getToken: expect.any(Function),
        authPayload: expect.objectContaining({
          accessToken: 'meta-token',
          userId: 'meta-user-1',
        }),
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['agency-platforms', 'agency-1'],
      });
    });

    it('shows actionable Meta Business Login errors on the page', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();

      mockUseMutation.mockReturnValue({
        mutate: mutateFn,
        isPending: false,
      });
      mockLaunchMetaBusinessLogin.mockRejectedValueOnce(
        new Error('Failed to load Meta Business Login. Please try again.')
      );

      render(<PlatformsPage />);

      const connectButton = screen.getAllByRole('button', { name: /connect/i })[1];
      await user.click(connectButton);

      expect(mutateFn).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(
          screen.getByText('Failed to load Meta Business Login. Please try again.')
        ).toBeInTheDocument();
      });
    });

    it('shows actionable Meta finalize errors on the page', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();

      mockUseMutation.mockReturnValue({
        mutate: mutateFn,
        isPending: false,
      });
      mockFinalizeMetaBusinessLogin.mockRejectedValueOnce(
        new Error('Failed to finalize Meta Business Login')
      );

      render(<PlatformsPage />);

      const connectButton = screen.getAllByRole('button', { name: /connect/i })[1];
      await user.click(connectButton);

      expect(mutateFn).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(
          screen.getByText('Failed to finalize Meta Business Login')
        ).toBeInTheDocument();
      });
    });

    it('should initiate OAuth for Snapchat instead of opening the manual modal', async () => {
      const user = userEvent.setup();
      const mutateFn = vi.fn();

      mockUseMutation.mockReturnValue({
        mutate: mutateFn,
        isPending: false,
      });

      render(<PlatformsPage />);

      const snapchatHeading = screen.getByText('Snapchat');
      const connectButton = snapchatHeading
        .closest('div')
        ?.parentElement
        ?.querySelector('button');

      expect(connectButton).toBeTruthy();
      await user.click(connectButton as HTMLButtonElement);

      expect(mutateFn).toHaveBeenCalledWith('snapchat');
      expect(screen.queryByText(/snapchat business email/i)).not.toBeInTheDocument();
    });

    it('shows Google Ads account titles with formatted IDs in the account list', async () => {
      const user = userEvent.setup();

      mockUseQuery.mockImplementation((options: any) => {
        if (options.queryKey?.[0] === 'agency-platforms') {
          return {
            data: [
              {
                platform: 'google',
                name: 'Google',
                connected: true,
                status: 'active',
                connectedAt: new Date().toISOString(),
              },
            ],
            isLoading: false,
            error: null,
          };
        }

        if (options.queryKey?.[0] === 'google-accounts') {
          return {
            data: {
              adsAccounts: [
                {
                  id: '6449142979',
                  name: 'Pillar AI Agency MCC',
                  formattedId: '644-914-2979',
                  nameSource: 'hierarchy',
                  isManager: true,
                  type: 'google_ads',
                  status: 'active',
                },
                {
                  id: '5497559774',
                  name: 'Google Ads account • 549-755-9774',
                  formattedId: '549-755-9774',
                  nameSource: 'fallback',
                  isManager: false,
                  type: 'google_ads',
                  status: 'active',
                },
              ],
              analyticsProperties: [],
              businessAccounts: [],
              tagManagerContainers: [],
              searchConsoleSites: [],
              merchantCenterAccounts: [],
              hasAccess: true,
            },
            isLoading: false,
            refetch: vi.fn(),
          };
        }

        return {
          data: undefined,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        };
      });

      render(<PlatformsPage />);

      await user.click(screen.getByRole('button', { name: /view accounts/i }));

      await waitFor(() => {
        expect(screen.getByText('Pillar AI Agency MCC • 644-914-2979')).toBeInTheDocument();
        expect(screen.getByText('Google Ads account • 549-755-9774')).toBeInTheDocument();
      });
    });
  });

  describe('OAuth Flow Initiation', () => {
    it('should redirect to OAuth URL on successful initiation', async () => {
      const user = userEvent.setup();
      let capturedOnSuccess: any;

      // Mock useMutation to capture the onSuccess callback
      mockUseMutation.mockImplementation((options: any) => {
        capturedOnSuccess = options.onSuccess;
        return {
          mutate: (platform: string) => {
            // Simulate successful mutation
            capturedOnSuccess({
              authUrl: 'https://facebook.com/oauth/authorize?client_id=123&state=abc',
              state: 'abc123',
            });
          },
          isPending: false,
        };
      });

      // Mock window.location.href assignment
      delete (window as any).location;
      window.location = { href: '' } as any;

      render(<PlatformsPage />);

      const connectButton = screen.getAllByRole('button', { name: /connect/i })[0];
      await user.click(connectButton);

      await waitFor(() => {
        expect(window.location.href).toContain('https://facebook.com/oauth/authorize');
      });
    });

    it('should show error message if OAuth initiation fails', async () => {
      const user = userEvent.setup();
      let capturedOnError: any;

      // Mock useMutation to capture the onError callback
      mockUseMutation.mockImplementation((options: any) => {
        capturedOnError = options.onError;
        return {
          mutate: (platform: string) => {
            // Simulate failed mutation
            capturedOnError(new Error('Network error'));
          },
          isPending: false,
        };
      });

      render(<PlatformsPage />);

      const connectButton = screen.getAllByRole('button', { name: /connect/i })[0];
      await user.click(connectButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to connect/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should show "Skip for now" button', () => {
      render(<PlatformsPage />);
      expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument();
    });

    it('should navigate to dashboard on skip', async () => {
      const user = userEvent.setup();
      render(<PlatformsPage />);

      const skipButton = screen.getByRole('button', { name: /skip for now/i });
      await user.click(skipButton);

      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    it('should show "Continue" button when at least one platform is connected', () => {
      mockUseQuery.mockReturnValue({
        data: [
          {
            platform: 'meta',
            name: 'Meta',
            connected: true,
            status: 'active',
          },
        ],
        isLoading: false,
        error: null,
      });

      render(<PlatformsPage />);
      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading state while fetching platforms', () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<PlatformsPage />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message if fetching platforms fails', () => {
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to fetch platforms'),
      });

      render(<PlatformsPage />);
      expect(screen.getByText(/failed to load platforms/i)).toBeInTheDocument();
    });
  });
});
