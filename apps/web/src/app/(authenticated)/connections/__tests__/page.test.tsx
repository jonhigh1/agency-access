/**
 * Connections Page Integration Tests
 *
 * Tests for the redesigned connections page with
 * platform categorization and OAuth flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ConnectionsPage from '../page';

const mockLaunchMetaBusinessLogin = vi.fn();
const mockFinalizeMetaBusinessLogin = vi.fn();
const { clerkState, devAuthState } = vi.hoisted(() => ({
  clerkState: {
    userId: 'user_123',
    orgId: null as string | null,
    getToken: vi.fn(),
  },
  devAuthState: {
    userId: 'user_123',
    orgId: null as string | null,
    isLoaded: true,
    isDevelopmentBypass: false,
  },
}));

// Mock next/navigation
const mockReplace = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('next/dynamic', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    default: (
      loader: () => Promise<{ default: React.ComponentType }>,
      options?: { loading?: React.ComponentType }
    ) => {
      const LazyComponent = React.lazy(loader);
      return function DynamicComponent(props: Record<string, unknown>) {
        return React.createElement(
          React.Suspense,
          { fallback: options?.loading ? React.createElement(options.loading) : null },
          React.createElement(LazyComponent, props)
        );
      };
    },
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('next/image', () => ({
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={props.alt || ''} {...props} />;
  },
}));

// Mock Clerk
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    userId: clerkState.userId,
    orgId: clerkState.orgId,
    getToken: clerkState.getToken,
  }),
  useUser: () => ({
    user: {
      primaryEmailAddress: {
        emailAddress: 'admin@test.com',
      },
    },
  }),
}));

vi.mock('@/lib/dev-auth', () => ({
  DEV_BYPASS_TOKEN: 'dev-bypass-token',
  useAuthOrBypass: () => devAuthState,
}));

vi.mock('@/lib/meta-business-login', () => ({
  launchMetaBusinessLogin: (...args: any[]) => mockLaunchMetaBusinessLogin(...args),
  finalizeMetaBusinessLogin: (...args: any[]) => mockFinalizeMetaBusinessLogin(...args),
}));

// Mock fetch
global.fetch = vi.fn();

// Helper to create fetch response with headers (page uses response.headers.get for ETag)
function mockJsonResponse(data: unknown, options?: { etag?: string; status?: number }) {
  const status = options?.status ?? 200;
  const headers = new Headers();
  if (options?.etag) headers.set('ETag', `"${options.etag}"`);
  return new Response(JSON.stringify(data), { status, headers });
}

// Mock localStorage (page uses it for platform ETag caching)
const localStorageStore = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => localStorageStore.get(key) ?? null,
  setItem: (key: string, value: string) => {
    localStorageStore.set(key, value);
  },
  removeItem: (key: string) => localStorageStore.delete(key),
  clear: () => localStorageStore.clear(),
  key: (index: number) => Array.from(localStorageStore.keys())[index] ?? null,
  get length() {
    return localStorageStore.size;
  },
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

describe('ConnectionsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    clerkState.userId = 'user_123';
    clerkState.orgId = null;
    clerkState.getToken.mockResolvedValue('test-token');
    devAuthState.userId = 'user_123';
    devAuthState.orgId = null;
    devAuthState.isLoaded = true;
    devAuthState.isDevelopmentBypass = false;
    (global.fetch as any).mockReset();
    localStorageStore.clear();
    mockSearchParams.delete('success');
    mockSearchParams.delete('error');
    mockSearchParams.delete('platform');
    // Ensure env for API URLs
    process.env.NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    process.env.NEXT_PUBLIC_META_APP_ID = 'meta-app-123';
    process.env.NEXT_PUBLIC_META_LOGIN_FOR_BUSINESS_CONFIG_ID = 'meta-config-123';
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

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ConnectionsPage />
      </QueryClientProvider>
    );
  };

  it('should categorize platforms correctly', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(mockJsonResponse({ data: [{ id: 'test-agency-id' }] }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          data: [
            { platform: 'meta_ads', name: 'Meta Ads', category: 'recommended', connected: false },
            { platform: 'google_ads', name: 'Google Ads', category: 'recommended', connected: false },
            { platform: 'ga4', name: 'Google Analytics', category: 'recommended', connected: false },
            { platform: 'linkedin', name: 'LinkedIn Ads', category: 'recommended', connected: false },
            { platform: 'tiktok', name: 'TikTok Ads', category: 'other', connected: false },
            { platform: 'snapchat', name: 'Snapchat Ads', category: 'other', connected: false },
            { platform: 'instagram', name: 'Instagram', category: 'other', connected: false },
          ],
        })
      );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Recommended')).toBeInTheDocument();
      expect(screen.getByText('Other')).toBeInTheDocument();
    });

    // Check recommended platforms
    expect(screen.getByText('Meta Ads')).toBeInTheDocument();
    expect(screen.getByText('Google Ads')).toBeInTheDocument();
    expect(screen.getByText('Google Analytics')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();

    // Check other platforms
    expect(screen.getByText('TikTok Ads')).toBeInTheDocument();
    expect(screen.getByText('Snapchat Ads')).toBeInTheDocument();
    expect(screen.getByText('Instagram')).toBeInTheDocument();
  });

  it('resolves agency using clerkUserId endpoint', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(mockJsonResponse({ data: [{ id: 'test-agency-id' }] }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          data: [
            { platform: 'meta_ads', name: 'Meta Ads', category: 'recommended', connected: false },
          ],
        })
      );

    renderPage();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/agencies?clerkUserId=user_123'),
        expect.anything()
      );
    });
  });

  it('sends the development bypass token for agency bootstrap in bypass mode', async () => {
    clerkState.userId = null;
    clerkState.orgId = null;
    clerkState.getToken.mockResolvedValue(null);
    devAuthState.userId = 'dev_user_test_123456789';
    devAuthState.orgId = 'dev_org_test_987654321';
    devAuthState.isDevelopmentBypass = true;

    (global.fetch as any)
      .mockResolvedValueOnce(mockJsonResponse({ data: [{ id: 'test-agency-id' }] }))
      .mockResolvedValueOnce(mockJsonResponse({ data: [] }));

    renderPage();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/agencies?clerkUserId=dev_org_test_987654321'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer dev-bypass-token',
          }),
        })
      );
    });
  });

  it('should display connected email for connected platforms', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(mockJsonResponse({ data: [{ id: 'test-agency-id' }] }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          data: [
            {
              platform: 'meta_ads',
              name: 'Meta Ads',
              category: 'recommended',
              connected: true,
              connectedEmail: 'user@example.com',
              status: 'active',
            },
            { platform: 'google_ads', name: 'Google Ads', category: 'recommended', connected: false },
            { platform: 'ga4', name: 'Google Analytics', category: 'recommended', connected: false },
            { platform: 'linkedin', name: 'LinkedIn Ads', category: 'recommended', connected: false },
            { platform: 'tiktok', name: 'TikTok Ads', category: 'other', connected: false },
            { platform: 'snapchat', name: 'Snapchat Ads', category: 'other', connected: false },
            { platform: 'instagram', name: 'Instagram', category: 'other', connected: false },
          ],
        })
      );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('user@example.com')).toBeInTheDocument();
    });
  });

  it('should show Connect button for unconnected platforms', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(mockJsonResponse({ data: [{ id: 'test-agency-id' }] }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          data: [
            { platform: 'meta_ads', name: 'Meta Ads', category: 'recommended', connected: false },
            { platform: 'google_ads', name: 'Google Ads', category: 'recommended', connected: false },
            { platform: 'ga4', name: 'Google Analytics', category: 'recommended', connected: false },
            { platform: 'linkedin', name: 'LinkedIn Ads', category: 'recommended', connected: false },
            { platform: 'tiktok', name: 'TikTok Ads', category: 'other', connected: false },
            { platform: 'snapchat', name: 'Snapchat Ads', category: 'other', connected: false },
            { platform: 'instagram', name: 'Instagram', category: 'other', connected: false },
          ],
        })
      );

    renderPage();

    await waitFor(() => {
      const connectButtons = screen.getAllByRole('button', { name: /connect/i });
      expect(connectButtons).toHaveLength(7); // All 7 platforms should have Connect buttons
    });
  });

  it('should handle OAuth callback success', async () => {
    mockSearchParams.set('success', 'true');
    mockSearchParams.set('platform', 'meta_ads');

    (global.fetch as any)
      .mockResolvedValueOnce(mockJsonResponse({ data: [{ id: 'test-agency-id' }] }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          data: [
            { platform: 'meta_ads', name: 'Meta Ads', category: 'recommended', connected: false },
            { platform: 'google_ads', name: 'Google Ads', category: 'recommended', connected: false },
            { platform: 'ga4', name: 'Google Analytics', category: 'recommended', connected: false },
            { platform: 'linkedin', name: 'LinkedIn Ads', category: 'recommended', connected: false },
            { platform: 'tiktok', name: 'TikTok Ads', category: 'other', connected: false },
            { platform: 'snapchat', name: 'Snapchat Ads', category: 'other', connected: false },
            { platform: 'instagram', name: 'Instagram', category: 'other', connected: false },
          ],
        })
      );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/successfully connected meta_ads/i)).toBeInTheDocument();
    });

    // Should clear URL params
    expect(mockReplace).toHaveBeenCalledWith('/connections');
  });

  it('should handle OAuth callback error', async () => {
    mockSearchParams.set('error', 'TOKEN_EXCHANGE_FAILED');

    (global.fetch as any)
      .mockResolvedValueOnce(mockJsonResponse({ data: [{ id: 'test-agency-id' }] }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          data: [
            { platform: 'meta_ads', name: 'Meta Ads', category: 'recommended', connected: false },
            { platform: 'google_ads', name: 'Google Ads', category: 'recommended', connected: false },
            { platform: 'ga4', name: 'Google Analytics', category: 'recommended', connected: false },
            { platform: 'linkedin', name: 'LinkedIn Ads', category: 'recommended', connected: false },
            { platform: 'tiktok', name: 'TikTok Ads', category: 'other', connected: false },
            { platform: 'snapchat', name: 'Snapchat Ads', category: 'other', connected: false },
            { platform: 'instagram', name: 'Instagram', category: 'other', connected: false },
          ],
        })
      );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/failed to connect platform: TOKEN_EXCHANGE_FAILED/i)).toBeInTheDocument();
    });
  });

  it('should initiate OAuth flow on Connect click', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(mockJsonResponse({ data: [{ id: 'test-agency-id' }] }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          data: [
            { platform: 'meta_ads', name: 'Meta Ads', category: 'recommended', connected: false },
            { platform: 'google_ads', name: 'Google Ads', category: 'recommended', connected: false },
            { platform: 'ga4', name: 'Google Analytics', category: 'recommended', connected: false },
            { platform: 'linkedin', name: 'LinkedIn Ads', category: 'recommended', connected: false },
            { platform: 'tiktok', name: 'TikTok Ads', category: 'other', connected: false },
            { platform: 'snapchat', name: 'Snapchat Ads', category: 'other', connected: false },
            { platform: 'instagram', name: 'Instagram', category: 'other', connected: false },
          ],
        })
      )
      .mockResolvedValueOnce(mockJsonResponse({ data: { authUrl: 'https://oauth.example.com' } }));

    delete (window as any).location;
    (window as any).location = { href: '' };

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Meta Ads')).toBeInTheDocument();
    });

    const connectButtons = screen.getAllByRole('button', { name: /connect/i });
    fireEvent.click(connectButtons[0]); // Click first Connect button (Meta Ads)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/agency-platforms/meta_ads/initiate'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: expect.stringContaining('test-agency-id'),
        })
      );
    });
  });

  it('uses Meta Business Login instead of the legacy initiate endpoint for Meta', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(mockJsonResponse({ data: [{ id: 'test-agency-id' }] }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          data: [
            { platform: 'meta', name: 'Meta', category: 'recommended', connected: false },
            { platform: 'google', name: 'Google', category: 'recommended', connected: false },
          ],
        })
      );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Meta')).toBeInTheDocument();
    });

    const connectButtons = screen.getAllByRole('button', { name: /connect/i });
    fireEvent.click(connectButtons[0]);

    await waitFor(() => {
      expect(mockLaunchMetaBusinessLogin).toHaveBeenCalledWith({
        appId: 'meta-app-123',
        configId: 'meta-config-123',
      });
      expect(mockFinalizeMetaBusinessLogin).toHaveBeenCalledWith({
        agencyId: 'test-agency-id',
        userEmail: 'admin@test.com',
        getToken: expect.any(Function),
        authPayload: expect.objectContaining({
          accessToken: 'meta-token',
          userId: 'meta-user-1',
        }),
      });
    });

    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/agency-platforms/meta/initiate'),
      expect.anything()
    );
  });

  it('shows actionable Meta Business Login errors when the SDK launch fails', async () => {
    mockLaunchMetaBusinessLogin.mockRejectedValueOnce(
      new Error('Failed to load Meta Business Login. Please try again.')
    );

    (global.fetch as any)
      .mockResolvedValueOnce(mockJsonResponse({ data: [{ id: 'test-agency-id' }] }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          data: [
            { platform: 'meta', name: 'Meta', category: 'recommended', connected: false },
            { platform: 'google', name: 'Google', category: 'recommended', connected: false },
          ],
        })
      );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Meta')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /connect/i })[0]);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load Meta Business Login. Please try again.')
      ).toBeInTheDocument();
    });
  });

  it('uses a shared header close contract for Manage Assets dialogs', async () => {
    (global.fetch as any).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/agencies?clerkUserId=')) {
        return mockJsonResponse({ data: [{ id: 'test-agency-id' }] });
      }

      if (url.includes('/agency-platforms/available?agencyId=test-agency-id')) {
        return mockJsonResponse({
          data: [
            {
              platform: 'meta',
              name: 'Meta',
              category: 'recommended',
              connected: true,
              connectedEmail: 'meta@example.com',
              status: 'active',
              metadata: {
                selectedBusinessId: 'biz_1',
                selectedBusinessName: 'Business One',
                metaBusinessAccounts: {
                  businesses: [{ id: 'biz_1', name: 'Business One' }],
                },
              },
            },
            {
              platform: 'google',
              name: 'Google',
              category: 'recommended',
              connected: true,
              connectedEmail: 'google@example.com',
              status: 'active',
            },
          ],
        });
      }

      if (url.includes('/agency-platforms/meta/business-accounts')) {
        return mockJsonResponse({
          data: {
            businesses: [{ id: 'biz_1', name: 'Business One' }],
          },
        });
      }

      if (url.includes('/agency-platforms/meta/asset-settings')) {
        return mockJsonResponse({
          data: {
            adAccount: { enabled: true, permissionLevel: 'analyze' },
            page: { enabled: true, permissionLevel: 'analyze', limitPermissions: false },
            catalog: { enabled: false, permissionLevel: 'analyze' },
            dataset: { enabled: false, requestFullAccess: false },
            instagramAccount: { enabled: false, requestFullAccess: false },
          },
        });
      }

      if (url.includes('/agency-platforms/google/accounts')) {
        return mockJsonResponse({
          data: {
            adsAccounts: [],
            analyticsProperties: [],
            businessAccounts: [],
            tagManagerContainers: [],
            searchConsoleSites: [],
            merchantCenterAccounts: [],
            hasAccess: true,
          },
        });
      }

      if (url.includes('/agency-platforms/google/asset-settings')) {
        return mockJsonResponse({
          data: {
            googleAds: { enabled: true, requestManageUsers: false },
            googleAnalytics: { enabled: false, requestManageUsers: false },
            googleBusinessProfile: { enabled: false, requestManageUsers: false },
            googleTagManager: { enabled: false, requestManageUsers: false },
            googleSearchConsole: { enabled: false, requestManageUsers: false },
            googleMerchantCenter: { enabled: false, requestManageUsers: false },
          },
        });
      }

      return mockJsonResponse({ data: null });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Meta')).toBeInTheDocument();
      expect(screen.getByText('Google')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /manage assets/i })[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^done$/i })).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog', { name: /meta connection settings/i });
    expect(within(dialog).getByRole('button', { name: /^done$/i })).toBeInTheDocument();
    expect(within(dialog).queryByText(/changes save automatically/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^disconnect$/i })).not.toBeInTheDocument();
  });

  it('loads Google connection settings when Manage Assets is opened', async () => {
    (global.fetch as any).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/agencies?clerkUserId=')) {
        return mockJsonResponse({ data: [{ id: 'test-agency-id' }] });
      }

      if (url.includes('/agency-platforms/available?agencyId=test-agency-id')) {
        return mockJsonResponse({
          data: [
            {
              platform: 'meta',
              name: 'Meta',
              category: 'recommended',
              connected: true,
              connectedEmail: 'meta@example.com',
              status: 'active',
            },
            {
              platform: 'google',
              name: 'Google',
              category: 'recommended',
              connected: true,
              connectedEmail: 'google@example.com',
              status: 'active',
            },
          ],
        });
      }

      if (url.includes('/agency-platforms/google/accounts')) {
        return mockJsonResponse({
          data: {
            adsAccounts: [],
            analyticsProperties: [],
            businessAccounts: [],
            tagManagerContainers: [],
            searchConsoleSites: [],
            merchantCenterAccounts: [],
            hasAccess: true,
          },
        });
      }

      if (url.includes('/agency-platforms/google/asset-settings')) {
        return mockJsonResponse({
          data: {
            googleAds: { enabled: true, requestManageUsers: false },
            googleAnalytics: { enabled: false, requestManageUsers: false },
            googleBusinessProfile: { enabled: false, requestManageUsers: false },
            googleTagManager: { enabled: false, requestManageUsers: false },
            googleSearchConsole: { enabled: false, requestManageUsers: false },
            googleMerchantCenter: { enabled: false, requestManageUsers: false },
          },
        });
      }

      return mockJsonResponse({ data: null });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Google')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /manage assets/i })[1]);

    expect(
      await screen.findByRole('dialog', { name: /google connection settings/i })
    ).toBeInTheDocument();
    expect(await screen.findByText('Google products')).toBeInTheDocument();
  });

  it('loads the manual invitation modal when connecting a manual-invite platform', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(mockJsonResponse({ data: [{ id: 'test-agency-id' }] }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          data: [
            { platform: 'kit', name: 'Kit', category: 'other', connected: false },
          ],
        })
      );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Kit')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /connect/i }));

    expect(await screen.findByText('Connect Kit')).toBeInTheDocument();
    expect(screen.getByText('Team invitation setup')).toBeInTheDocument();
  });

  // TODO: Loading state depends on agencyId + platforms query timing; mock chain can be flaky
  it.skip('should show loading indicator while platforms are fetching', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('by-email')) {
        return Promise.resolve(mockJsonResponse({ data: [{ id: 'test-agency-id' }] }));
      }
      if (url.includes('available')) {
        return new Promise(() => {}); // Never resolves
      }
      return Promise.resolve(mockJsonResponse({}));
    });

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText(/loading platforms/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  // TODO: Platform grid may not render in test env when using mockImplementation; investigate
  it.skip('should display status badge for non-active connections', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('by-email')) {
        return Promise.resolve(mockJsonResponse({ data: [{ id: 'test-agency-id' }] }));
      }
      if (url.includes('available')) {
        return Promise.resolve(
          mockJsonResponse({
            data: [
              {
                platform: 'linkedin',
                name: 'LinkedIn Ads',
                category: 'recommended',
                connected: true,
                connectedEmail: 'expired@example.com',
                status: 'expired',
              },
              { platform: 'meta_ads', name: 'Meta Ads', category: 'recommended', connected: false },
              { platform: 'google_ads', name: 'Google Ads', category: 'recommended', connected: false },
              { platform: 'ga4', name: 'Google Analytics', category: 'recommended', connected: false },
              { platform: 'tiktok', name: 'TikTok Ads', category: 'other', connected: false },
              { platform: 'snapchat', name: 'Snapchat Ads', category: 'other', connected: false },
              { platform: 'instagram', name: 'Instagram', category: 'other', connected: false },
            ],
          })
        );
      }
      return Promise.resolve(mockJsonResponse({}));
    });

    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('Expired')).toBeInTheDocument();
        expect(screen.getByText('expired@example.com')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});
