import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MetaUnifiedSettings } from '../meta-unified-settings';

const mockStartAgencyMetaOAuth = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    getToken: vi.fn(async () => 'mock-token'),
  }),
  useUser: () => ({
    user: {
      primaryEmailAddress: { emailAddress: 'owner@agency.com' },
      emailAddresses: [{ emailAddress: 'owner@agency.com' }],
    },
  }),
}));

vi.mock('@/lib/agency-meta-oauth', () => ({
  startAgencyMetaOAuth: (...args: any[]) => mockStartAgencyMetaOAuth(...args),
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function getAuthHeader(init: RequestInit | undefined): string | undefined {
  const headers = init?.headers as Record<string, string> | Headers | undefined;
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get('Authorization') ?? undefined;
  return headers.Authorization ?? headers.authorization;
}

function buildSettingsResponse(): Response {
  return {
    ok: true,
    json: async () => ({
      data: {
        adAccount: { enabled: true, permissionLevel: 'analyze' },
        page: { enabled: true, permissionLevel: 'analyze', limitPermissions: false },
        catalog: { enabled: true, permissionLevel: 'analyze' },
        dataset: { enabled: true, requestFullAccess: false },
        instagramAccount: { enabled: true, requestFullAccess: false },
      },
    }),
  } as Response;
}

function buildConnectionResponse(): Response {
  return {
    ok: true,
    json: async () => ({
      data: [
        {
          platform: 'meta',
          connected: true,
          metadata: {
            selectedBusinessId: 'biz_1',
            selectedBusinessName: 'Business One',
            metaBusinessAccounts: {
              businesses: [{ id: 'biz_1', name: 'Business One' }],
              hasAccess: true,
            },
          },
        },
      ],
    }),
  } as Response;
}

describe('MetaUnifiedSettings', () => {
  const previousApiUrl = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
    mockStartAgencyMetaOAuth.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = previousApiUrl;
    vi.restoreAllMocks();
  });

  it('refreshes business portfolios from Meta when Manage Assets opens', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/agency-platforms/meta/business-accounts')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              businesses: [{ id: 'biz_1', name: 'Business One' }],
            },
          }),
        } as Response;
      }

      if (url.includes('/agency-platforms/meta/asset-settings')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              adAccount: { enabled: true, permissionLevel: 'analyze' },
              page: { enabled: true, permissionLevel: 'analyze', limitPermissions: false },
              catalog: { enabled: true, permissionLevel: 'analyze' },
              dataset: { enabled: true, requestFullAccess: false },
              instagramAccount: { enabled: true, requestFullAccess: false },
            },
          }),
        } as Response;
      }

      if (url.includes('/agency-platforms/available')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                platform: 'meta',
                connected: true,
                metadata: {
                  selectedBusinessId: 'biz_1',
                  selectedBusinessName: 'Business One',
                },
              },
            ],
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ data: null }),
      } as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient(<MetaUnifiedSettings agencyId="agency-1" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      const calls = fetchMock.mock.calls as Array<[RequestInfo | URL, RequestInit | undefined]>;
      const businessesCall = calls.find(([input]) =>
        String(input).includes('/agency-platforms/meta/business-accounts')
      );
      const settingsCall = calls.find(([input]) =>
        String(input).includes('/agency-platforms/meta/asset-settings?')
      );

      expect(businessesCall).toBeTruthy();
      expect(settingsCall).toBeTruthy();
      expect(String(businessesCall?.[0])).toContain('refresh=true');
      expect(getAuthHeader(businessesCall?.[1])).toBe('Bearer mock-token');
      expect(getAuthHeader(settingsCall?.[1])).toBe('Bearer mock-token');
      expect(settingsCall?.[1]?.signal).toBeDefined();
    });
  });

  it('renders the stored portfolio immediately while refresh is still pending', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/agency-platforms/meta/business-accounts')) {
        return new Promise<Response>(() => {});
      }

      if (url.includes('/agency-platforms/meta/asset-settings')) {
        return buildSettingsResponse();
      }

      if (url.includes('/agency-platforms/available')) {
        return buildConnectionResponse();
      }

      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient(<MetaUnifiedSettings agencyId="agency-1" />);

    await waitFor(() => {
      expect(screen.getByText('Meta Business Portfolio')).toBeInTheDocument();
    });

    expect(screen.getByRole('combobox')).toHaveTextContent('Business One (biz_1)');
  });

  it('keeps the stored portfolio visible and shows a warning when refresh fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/agency-platforms/meta/business-accounts')) {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({
            error: {
              code: 'FETCH_FAILED',
              message: 'Failed to fetch Meta business accounts',
            },
          }),
        } as Response;
      }

      if (url.includes('/agency-platforms/meta/asset-settings')) {
        return buildSettingsResponse();
      }

      if (url.includes('/agency-platforms/available')) {
        return buildConnectionResponse();
      }

      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient(<MetaUnifiedSettings agencyId="agency-1" />);

    await waitFor(() => {
      expect(screen.getByText(/failed to fetch meta business accounts/i)).toBeInTheDocument();
    });

    expect(await screen.findByText(/showing the last synced portfolios/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveTextContent('Business One (biz_1)');
  });

  it('does not render the removed configuration overview block', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/agency-platforms/meta/business-accounts')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              businesses: [{ id: 'biz_1', name: 'Business One' }],
            },
          }),
        } as Response;
      }

      if (url.includes('/agency-platforms/meta/asset-settings')) {
        return buildSettingsResponse();
      }

      if (url.includes('/agency-platforms/available')) {
        return buildConnectionResponse();
      }

      return { ok: true, json: async () => ({ data: null }) } as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient(<MetaUnifiedSettings agencyId="agency-1" />);

    expect(await screen.findByRole('heading', { name: /^business portfolio$/i })).toBeInTheDocument();
    expect(screen.queryByText(/configuration overview/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/current meta setup/i)).not.toBeInTheDocument();
  });

  it('gives every Meta asset toggle its visible asset type name', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/agency-platforms/meta/business-accounts')) {
        return { ok: true, json: async () => ({ data: { businesses: [{ id: 'biz_1', name: 'Business One' }] } }) } as Response;
      }
      if (url.includes('/agency-platforms/meta/asset-settings')) return buildSettingsResponse();
      if (url.includes('/agency-platforms/available')) return buildConnectionResponse();
      return { ok: true, json: async () => ({ data: null }) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient(<MetaUnifiedSettings agencyId="agency-1" />);

    for (const name of ['Ad Account', 'Page', 'Catalog', 'Dataset', 'Instagram Account']) {
      expect(await screen.findByRole('checkbox', { name })).toBeInTheDocument();
    }
  });

  it('lets the user log in again to refresh the portfolio snapshot from Meta', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes('/agency-platforms/meta/business-accounts')) {
          return {
            ok: true,
            json: async () => ({
              data: {
                businesses: [{ id: 'biz_1', name: 'Business One' }],
              },
            }),
          } as Response;
        }

        if (url.includes('/agency-platforms/meta/asset-settings')) {
          return buildSettingsResponse();
        }

        if (url.includes('/agency-platforms/available')) {
          return buildConnectionResponse();
        }

        return { ok: true, json: async () => ({ data: null }) } as Response;
      });

    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient(<MetaUnifiedSettings agencyId="agency-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /log in again/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /log in again/i }));

    await waitFor(() => {
      expect(mockStartAgencyMetaOAuth).toHaveBeenCalledWith({
        agencyId: 'agency-1',
        userEmail: 'owner@agency.com',
        getToken: expect.any(Function),
      });
    });
  });
});
