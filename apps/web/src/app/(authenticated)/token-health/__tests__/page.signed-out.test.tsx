import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TokenHealthPage from '../page';

const authState = { signedIn: false };

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue(authState.signedIn ? 'jwt' : null),
    isLoaded: true,
    isSignedIn: authState.signedIn,
  }),
}));

vi.mock('@/components/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/ui')>()),
  StatCard: ({ label }: { label: string }) => <div>{label}</div>,
}));

describe('TokenHealthPage signed-out degradation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.signedIn = false;
    global.fetch = vi.fn();
  });

  it('renders without fetching and without an error boundary when signed out', async () => {
    render(<TokenHealthPage />);

    expect(screen.getByText('Token health')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Loading token health...')).toBeInTheDocument();
    });

    // Missing-token degradation: the signed-out page must not hit the API.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('renders API date strings without crashing when signed in', async () => {
    authState.signedIn = true;
    const payload = JSON.stringify({
      data: [
        {
          id: 'auth-1',
          connectionId: 'conn-1',
          clientName: 'acme@example.com',
          platform: 'meta',
          health: 'healthy',
          expiresAt: '2026-09-20T00:00:00.000Z',
          daysUntilExpiry: 17,
          lastRefreshedAt: '2026-09-02T12:00:00.000Z',
          canRefresh: true,
        },
      ],
    });
    global.fetch = vi.fn().mockImplementation(async () =>
      new Response(
        payload,
        { status: 200 }
      )
    );

    render(<TokenHealthPage />);

    await waitFor(() => {
      expect(screen.getByText('acme@example.com')).toBeInTheDocument();
    });
    expect(screen.queryByText('Loading token health...')).not.toBeInTheDocument();
  });
});
