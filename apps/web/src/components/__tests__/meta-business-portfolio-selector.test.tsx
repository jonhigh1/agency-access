import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MetaBusinessPortfolioSelector } from '../meta-business-portfolio-selector';

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

describe('MetaBusinessPortfolioSelector', () => {
  const previousApiUrl = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
    mockStartAgencyMetaOAuth.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = previousApiUrl;
    vi.restoreAllMocks();
  });

  it('requests a fresh Meta business list for the portfolio dropdown', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          businesses: [{ id: 'biz_1', name: 'Business One' }],
        },
      }),
    }) as Response);

    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient(
      <MetaBusinessPortfolioSelector
        agencyId="agency-1"
        onSelect={() => {}}
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const calls = fetchMock.mock.calls as Array<[RequestInfo | URL, RequestInit | undefined]>;
    expect(String(calls[0]?.[0])).toContain('/agency-platforms/meta/business-accounts?agencyId=agency-1&refresh=true');
  });

  it('starts server-side Meta OAuth when no portfolios are found', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            businesses: [],
          },
        }),
      } as Response);

    vi.stubGlobal('fetch', fetchMock);

    renderWithQueryClient(
      <MetaBusinessPortfolioSelector
        agencyId="agency-1"
        onSelect={() => {}}
      />
    );

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
