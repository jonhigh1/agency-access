import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClientsPage from '../page';

const { authorizedApiFetchMock } = vi.hoisted(() => ({ authorizedApiFetchMock: vi.fn() }));

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: vi.fn() }) }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/lib/api/authorized-api-fetch', () => ({ authorizedApiFetch: authorizedApiFetchMock }));
vi.mock('@/lib/query/quota', () => ({
  useQuotaCheck: () => ({ mutateAsync: vi.fn().mockResolvedValue({ allowed: true }) }),
  QuotaExceededError: class extends Error {},
}));

function pageResponse(offset: number) {
  return {
    data: {
      data: [{
        id: `client-${offset}`, name: `Client ${offset}`, email: `client${offset}@example.com`,
        company: 'Acme', platforms: [], status: 'none', connectionCount: 0, requestCount: 12,
        lastActivityAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z',
      }],
      pagination: { total: 51, limit: 50, offset },
    },
  };
}

describe('Clients page behavior', () => {
  beforeEach(() => {
    authorizedApiFetchMock.mockReset();
    authorizedApiFetchMock.mockImplementation((url: string) => {
      const offset = Number(new URL(url).searchParams.get('offset') || 0);
      return Promise.resolve(pageResponse(offset));
    });
  });

  it('omits unsupported filters and exposes every API page', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><ClientsPage /></QueryClientProvider>);

    expect(await screen.findByText('Client 0')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /filters/i })).not.toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(await screen.findByText('Client 50')).toBeInTheDocument();
    await waitFor(() => expect(authorizedApiFetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('offset=50'), expect.anything(),
    ));
  });

  it('clears a search when it produces no clients', async () => {
    authorizedApiFetchMock.mockImplementation((url: string) => {
      const params = new URL(url).searchParams;
      return Promise.resolve(params.has('search')
        ? { data: { data: [], pagination: { total: 0, limit: 50, offset: 0 } } }
        : pageResponse(0));
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><ClientsPage /></QueryClientProvider>);

    const search = await screen.findByRole('textbox', { name: 'Search clients' });
    fireEvent.change(search, { target: { value: 'missing' } });
    expect(await screen.findByText('No clients found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.queryByText('No clients yet')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Updating client search');
    expect(await screen.findByText('Client 0')).toBeInTheDocument();
  });
});
