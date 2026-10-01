import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { GoogleUnifiedSettings } from '../google-unified-settings';

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
  const headers = init?.headers as any;
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get('Authorization') ?? undefined;
  return headers.Authorization ?? headers.authorization;
}

describe('GoogleUnifiedSettings', () => {
  const prevEnv = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = prevEnv;
    vi.restoreAllMocks();
  });

  it('includes Authorization header when fetching accounts and asset settings', async () => {
    const fetchMock = vi.fn(async (input: any, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/agency-platforms/google/accounts')) {
        expect(url).toContain('refresh=true');
        return {
          ok: true,
          json: async () => ({
            data: {
              adsAccounts: [],
              analyticsProperties: [],
              businessAccounts: [],
              tagManagerContainers: [],
              searchConsoleSites: [],
              merchantCenterAccounts: [],
              hasAccess: true,
            },
          }),
        } as any;
      }

      if (url.includes('/agency-platforms/google/asset-settings')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              googleAds: { enabled: true, requestManageUsers: false },
              googleAnalytics: { enabled: true, requestManageUsers: false },
              googleBusinessProfile: { enabled: true, requestManageUsers: false },
              googleTagManager: { enabled: true, requestManageUsers: false },
              googleSearchConsole: { enabled: true, requestManageUsers: false },
              googleMerchantCenter: { enabled: true, requestManageUsers: false },
            },
          }),
        } as any;
      }

      return {
        ok: true,
        json: async () => ({ data: null }),
      } as any;
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient(<GoogleUnifiedSettings agencyId="agency-1" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    // Assert both GETs include the Clerk token
    await waitFor(() => {
      const calls = fetchMock.mock.calls as Array<[any, RequestInit | undefined]>;
      const accountsCall = calls.find(([input]) =>
        String(input).includes('/agency-platforms/google/accounts')
      );
      const settingsCall = calls.find(([input]) =>
        String(input).includes('/agency-platforms/google/asset-settings?')
      );

      expect(accountsCall).toBeTruthy();
      expect(settingsCall).toBeTruthy();

      expect(getAuthHeader(accountsCall?.[1])).toBe('Bearer mock-token');
      expect(getAuthHeader(settingsCall?.[1])).toBe('Bearer mock-token');
    });
  });

  it('prefers GA4 displayName over resource name in dropdown labels', async () => {
    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);

      if (url.includes('/agency-platforms/google/accounts')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              adsAccounts: [],
              analyticsProperties: [
                {
                  id: '524870148',
                  name: 'properties/524870148',
                  displayName: 'Pillar AI Agency',
                  type: 'ga4',
                  accountName: 'Main Account',
                },
              ],
              businessAccounts: [],
              tagManagerContainers: [],
              searchConsoleSites: [],
              merchantCenterAccounts: [],
              hasAccess: true,
            },
          }),
        } as any;
      }

      if (url.includes('/agency-platforms/google/asset-settings')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              googleAds: { enabled: false, requestManageUsers: false },
              googleAnalytics: { enabled: true, requestManageUsers: false },
              googleBusinessProfile: { enabled: false, requestManageUsers: false },
              googleTagManager: { enabled: false, requestManageUsers: false },
              googleSearchConsole: { enabled: false, requestManageUsers: false },
              googleMerchantCenter: { enabled: false, requestManageUsers: false },
            },
          }),
        } as any;
      }

      return { ok: true, json: async () => ({ data: null }) } as any;
    });

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderWithQueryClient(<GoogleUnifiedSettings agencyId="agency-1" />);

    // Open the GA4 selector dropdown (options render in portal)
    const ga4Combobox = await screen.findByRole('combobox', { name: /Select GA4 Property/i });
    await user.click(ga4Combobox);

    // Ensure the option uses displayName (not "properties/...")
    const option = await screen.findByRole('option', { name: /Pillar AI Agency/i });
    expect(option).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /properties\/524870148/i })).not.toBeInTheDocument();
  });

  it('can select all and deselect all Google products', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);

      if (url.includes('/agency-platforms/google/accounts')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              adsAccounts: [],
              analyticsProperties: [],
              businessAccounts: [],
              tagManagerContainers: [],
              searchConsoleSites: [],
              merchantCenterAccounts: [],
              hasAccess: true,
            },
          }),
        } as any;
      }

      if (url.includes('/agency-platforms/google/asset-settings?')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              googleAds: { enabled: false, requestManageUsers: false },
              googleAnalytics: { enabled: false, requestManageUsers: false },
              googleBusinessProfile: { enabled: false, requestManageUsers: false },
              googleTagManager: { enabled: false, requestManageUsers: false },
              googleSearchConsole: { enabled: false, requestManageUsers: false },
              googleMerchantCenter: { enabled: false, requestManageUsers: false },
            },
          }),
        } as any;
      }

      if (url.includes('/agency-platforms/google/asset-settings') && !url.includes('?')) {
        return { ok: true, json: async () => ({ data: true }) } as any;
      }

      return { ok: true, json: async () => ({ data: null }) } as any;
    });

    vi.stubGlobal('fetch', fetchMock);

    const { getByRole, getByText } = renderWithQueryClient(<GoogleUnifiedSettings agencyId="agency-1" />);

    // Wait until the UI is hydrated (Google Ads label is "Google Ads", not "Google Ads Account")
    await waitFor(() => {
      expect(getByRole('checkbox', { name: /^enable google ads$/i })).toBeInTheDocument();
    });

    await user.click(getByRole('button', { name: /^select all$/i }));

    const productLabels = [
      'Google Ads',
      'Google Analytics Account',
      'Google Business Profile Location',
      'Google Tag Manager',
      'Google Search Console',
      'Google Merchant Center',
    ] as const;

    for (const label of productLabels) {
      const checkbox = getByRole('checkbox', { name: new RegExp(`^enable ${label}$`, 'i') });
      expect(checkbox).toBeChecked();
    }

    await user.click(getByRole('button', { name: /^deselect all$/i }));

    for (const label of productLabels) {
      const checkbox = getByRole('checkbox', { name: new RegExp(`^enable ${label}$`, 'i') });
      expect(checkbox).not.toBeChecked();
    }
  });

  it('does not render the removed configuration overview block', async () => {
    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);

      if (url.includes('/agency-platforms/google/accounts')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              adsAccounts: [],
              analyticsProperties: [],
              businessAccounts: [],
              tagManagerContainers: [],
              searchConsoleSites: [],
              merchantCenterAccounts: [],
              hasAccess: true,
            },
          }),
        } as any;
      }

      if (url.includes('/agency-platforms/google/asset-settings?')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              googleAds: { enabled: true, requestManageUsers: false },
              googleAnalytics: { enabled: true, requestManageUsers: false },
              googleBusinessProfile: { enabled: false, requestManageUsers: false },
              googleTagManager: { enabled: false, requestManageUsers: false },
              googleSearchConsole: { enabled: false, requestManageUsers: false },
              googleMerchantCenter: { enabled: false, requestManageUsers: false },
            },
          }),
        } as any;
      }

      return { ok: true, json: async () => ({ data: null }) } as any;
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient(<GoogleUnifiedSettings agencyId="agency-1" />);

    expect(await screen.findByText(/google products/i)).toBeInTheDocument();
    expect(screen.queryByText(/configuration overview/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/current google setup/i)).not.toBeInTheDocument();
  });

  it('renders Google Ads Manager Account dropdown labels when MCC is selected', async () => {
    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);

      if (url.includes('/agency-platforms/google/accounts')) {
        return {
          ok: true,
          json: async () => ({
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
          }),
        } as any;
      }

      if (url.includes('/agency-platforms/google/asset-settings')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              googleAdsManagement: {
                preferredGrantMode: 'manager_link',
                managerCustomerId: '',
                inviteEmail: '',
              },
              googleAds: { enabled: true, requestManageUsers: false },
              googleAnalytics: { enabled: false, requestManageUsers: false },
              googleBusinessProfile: { enabled: false, requestManageUsers: false },
              googleTagManager: { enabled: false, requestManageUsers: false },
              googleSearchConsole: { enabled: false, requestManageUsers: false },
              googleMerchantCenter: { enabled: false, requestManageUsers: false },
            },
          }),
        } as any;
      }

      return { ok: true, json: async () => ({ data: null }) } as any;
    });

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderWithQueryClient(<GoogleUnifiedSettings agencyId="agency-1" />);

    // Manager Account selector appears when MCC is selected
    const managerCombobox = await screen.findByRole('combobox', { name: /Select Manager Account/i });
    await user.click(managerCombobox);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Pillar AI Agency MCC.*644-914-2979/i })).toBeInTheDocument();
    });
    // Non-manager accounts should not appear
    expect(screen.queryByRole('option', { name: /Google Ads account.*549-755-9774/i })).not.toBeInTheDocument();
  });

  it('renders Google Ads access method when Google Ads is enabled', async () => {
    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);

      if (url.includes('/agency-platforms/google/accounts')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              adsAccounts: [],
              analyticsProperties: [],
              businessAccounts: [],
              tagManagerContainers: [],
              searchConsoleSites: [],
              merchantCenterAccounts: [],
              hasAccess: true,
            },
          }),
        } as any;
      }

      if (url.includes('/agency-platforms/google/asset-settings')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              googleAds: { enabled: true, requestManageUsers: false },
              googleAnalytics: { enabled: false, requestManageUsers: false },
              googleBusinessProfile: { enabled: false, requestManageUsers: false },
              googleTagManager: { enabled: false, requestManageUsers: false },
              googleSearchConsole: { enabled: false, requestManageUsers: false },
              googleMerchantCenter: { enabled: false, requestManageUsers: false },
            },
          }),
        } as any;
      }

      return { ok: true, json: async () => ({ data: null }) } as any;
    });

    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient(<GoogleUnifiedSettings agencyId="agency-1" />);

    // Access method (MCC vs invite) is inline in the Google Ads row
    expect(await screen.findByRole('radiogroup', { name: /Google Ads access method/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Manager account \(MCC\)/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Client email invite/i })).toBeInTheDocument();
  });

  it('renders Google Ads MCC defaults and limits manager selection to manager accounts', async () => {
    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);

      if (url.includes('/agency-platforms/google/accounts')) {
        return {
          ok: true,
          json: async () => ({
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
                  name: 'Client Ads Account',
                  formattedId: '549-755-9774',
                  nameSource: 'direct',
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
          }),
        } as any;
      }

      if (url.includes('/agency-platforms/google/asset-settings')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              googleAdsManagement: {
                preferredGrantMode: 'manager_link',
                managerCustomerId: '6449142979',
                managerAccountLabel: 'Pillar AI Agency MCC',
                inviteEmail: 'jon.highmu@gmail.com',
              },
              googleAds: { enabled: true, requestManageUsers: false },
              googleAnalytics: { enabled: false, requestManageUsers: false },
              googleBusinessProfile: { enabled: false, requestManageUsers: false },
              googleTagManager: { enabled: false, requestManageUsers: false },
              googleSearchConsole: { enabled: false, requestManageUsers: false },
              googleMerchantCenter: { enabled: false, requestManageUsers: false },
            },
          }),
        } as any;
      }

      return { ok: true, json: async () => ({ data: null }) } as any;
    });

    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderWithQueryClient(<GoogleUnifiedSettings agencyId="agency-1" />);

    expect(await screen.findByRole('radiogroup', { name: /Google Ads access method/i })).toBeInTheDocument();

    const managerCombobox = screen.getByRole('combobox', { name: /Select Manager Account/i });
    await user.click(managerCombobox);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Pillar AI Agency MCC.*644-914-2979/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('option', { name: /Client Ads Account.*549-755-9774/i })).not.toBeInTheDocument();
  });

  it('gives connected empty Business Profile state a refresh action', async () => {
    const fetchMock = vi.fn(async (input: any) => {
      if (String(input).includes('/accounts')) {
        return { ok: true, json: async () => ({ data: {
          adsAccounts: [], analyticsProperties: [], businessAccounts: [], tagManagerContainers: [],
          searchConsoleSites: [], merchantCenterAccounts: [], hasAccess: true,
        } }) } as any;
      }
      return { ok: true, json: async () => ({ data: {
        googleAds: { enabled: false }, googleAnalytics: { enabled: false },
        googleBusinessProfile: { enabled: true }, googleTagManager: { enabled: false },
        googleSearchConsole: { enabled: false }, googleMerchantCenter: { enabled: false },
      } }) } as any;
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient(<GoogleUnifiedSettings agencyId="agency-1" />);

    expect(await screen.findByText(/No Google Business Profile Location assets were found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh Google accounts' })).toBeInTheDocument();
  });
});
