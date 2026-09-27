import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUserAgency } from '../use-user-agency';

const getTokenMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => useAuthMock(),
}));

function Probe({ options = {} }: { options?: Parameters<typeof useUserAgency>[0] }) {
  const { data, isLoading, error } = useUserAgency(options);
  return (
    <>
      <div data-testid="agency-id">{data?.id ?? 'none'}</div>
      {isLoading ? <div role="status">Loading agency</div> : null}
      {error ? <div role="alert">{error.message}</div> : null}
    </>
  );
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const utils = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { queryClient, ...utils };
}

describe('useUserAgency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTokenMock.mockResolvedValue('clerk-token');
    useAuthMock.mockReturnValue({
      getToken: getTokenMock,
      userId: 'user_1',
      orgId: 'org_1',
      isLoaded: true,
    });
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches the agency payload for the principal and caches under [user-agency, principal]', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'agency_1', name: 'Acme' }] }),
    });

    const { queryClient } = renderWithClient(<Probe />);

    await waitFor(() => {
      expect(document.querySelector('[data-testid="agency-id"]')?.textContent).toBe('agency_1');
    });

    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).toContain('/api/agencies?clerkUserId=org_1');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer clerk-token');
    // Cache-dedupe contract: the shared key holds the payload.
    expect(queryClient.getQueryData(['user-agency', 'org_1'])).toEqual({ id: 'agency_1', name: 'Acme' });
  });

  it('dedupes concurrent consumers onto one agencies request', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'agency_shared', name: 'Shared' }] }),
    });

    function DualProbe() {
      const first = useUserAgency();
      const second = useUserAgency();
      return (
        <div>
          <span data-testid="first">{first.data?.id ?? 'none'}</span>
          <span data-testid="second">{second.data?.id ?? 'none'}</span>
        </div>
      );
    }

    renderWithClient(<DualProbe />);

    await waitFor(() => {
      expect(document.querySelector('[data-testid="first"]')?.textContent).toBe('agency_shared');
      expect(document.querySelector('[data-testid="second"]')?.textContent).toBe('agency_shared');
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('waits for Clerk to finish loading before requesting the agency', async () => {
    useAuthMock.mockReturnValue({
      getToken: getTokenMock,
      userId: 'user_1',
      orgId: null,
      isLoaded: false,
    });
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'agency_1' }] }),
    });

    const { queryClient, rerender } = renderWithClient(<Probe />);
    expect(global.fetch).not.toHaveBeenCalled();

    useAuthMock.mockReturnValue({
      getToken: getTokenMock,
      userId: 'user_1',
      orgId: null,
      isLoaded: true,
    });
    rerender(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  });

  it('turns a hanging Clerk token lookup into a recoverable query error', async () => {
    getTokenMock.mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers();
    let rendered: ReturnType<typeof render> | undefined;

    try {
      rendered = renderWithClient(<Probe />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_250);
      });

      expect(screen.getByRole('alert')).toHaveTextContent('Request timed out. Please try again.');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      rendered?.unmount();
      vi.useRealTimers();
    }
  });

  it('prefers an explicit principal and token resolver', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'agency_2' }] }),
    });

    const { queryClient } = renderWithClient(
      <Probe
        options={{
          principalClerkId: 'user_42',
          getAuthToken: async () => 'explicit-token',
        }}
      />
    );

    await waitFor(() => {
      expect(document.querySelector('[data-testid="agency-id"]')?.textContent).toBe('agency_2');
    });

    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).toContain('/api/agencies?clerkUserId=user_42');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer explicit-token');
    expect(queryClient.getQueryData(['user-agency', 'user_42'])).toEqual({ id: 'agency_2' });
  });

  it('rejects a missing token before calling the agency endpoint', async () => {
    getTokenMock.mockResolvedValue(null);
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'agency_3' }] }),
    });

    renderWithClient(<Probe />);

    await waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Missing authentication token'));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(getTokenMock).toHaveBeenCalled();
  });

  it('does not fetch when there is no principal', async () => {
    useAuthMock.mockReturnValue({
      getToken: getTokenMock,
      userId: null,
      orgId: null,
      isLoaded: true,
    });

    renderWithClient(<Probe />);

    await waitFor(() => {
      expect(document.querySelector('[data-testid="agency-id"]')?.textContent).toBe('none');
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('resolves to null when the agency list is empty', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    renderWithClient(<Probe />);

    await waitFor(() => {
      expect(document.querySelector('[data-testid="agency-id"]')?.textContent).toBe('none');
    });
    expect(document.querySelector('[data-testid="agency-id"]')?.textContent).toBe('none');
  });
});
