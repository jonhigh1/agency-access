/**
 * Token Health page — refresh gating and reconnect truth
 *
 * Refresh is a property of the authorization (row status), not of the token
 * countdown: an active row stays refreshable even when its stored expiry has
 * passed. Rows whose grant is dead get a reconnect affordance, not a silent
 * disabled icon.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TokenHealthPage from '../page';

const authState = { signedIn: true };

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

const NOW = Date.now();
const MINUTE_MS = 60_000;

function payloadForRow(row: Record<string, unknown>) {
  return JSON.stringify({ data: [row] });
}

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'auth-1',
    connectionId: 'conn-1',
    clientName: 'acme@example.com',
    platform: 'snapchat',
    status: 'active',
    health: 'expiring',
    expiresAt: new Date(NOW + 42 * MINUTE_MS).toISOString(),
    daysUntilExpiry: 1,
    lastRefreshedAt: null,
    canRefresh: true,
    ...overrides,
  };
}

async function renderWithRow(row: Record<string, unknown>) {
  global.fetch = vi.fn().mockImplementation(async () =>
    new Response(payloadForRow(row), { status: 200 })
  );
  render(<TokenHealthPage />);
  await waitFor(() => {
    expect(screen.getByText('acme@example.com')).toBeInTheDocument();
  });
}

describe('TokenHealthPage refresh gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.signedIn = true;
    global.fetch = vi.fn();
  });

  it('keeps refresh enabled for an active row whose stored expiry has passed', async () => {
    await renderWithRow(baseRow({ health: 'expired', daysUntilExpiry: -1 }));

    const refresh = screen.getByRole('button', { name: /refresh snapchat/i });
    expect(refresh).not.toBeDisabled();
  });

  it('keeps refresh disabled for rows without refresh capability', async () => {
    await renderWithRow(baseRow({ canRefresh: false }));

    expect(screen.getByRole('button', { name: /refresh snapchat/i })).toBeDisabled();
  });

  it('shows a reconnect affordance in place of refresh for a dead row', async () => {
    await renderWithRow(baseRow({ status: 'revoked', health: 'expired', daysUntilExpiry: -1 }));

    // A dead grant cannot be refreshed by retrying, so the action slot offers
    // the recourse instead of a dead icon.
    expect(screen.queryByRole('button', { name: /refresh snapchat/i })).not.toBeInTheDocument();
    expect(screen.getByText('Reconnect Required')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /re-request access/i })).toHaveAttribute(
      'href',
      '/clients'
    );
  });

  it('renders minute-level expiry copy for a token dying within the hour', async () => {
    await renderWithRow(baseRow({}));

    // One minute can tick between payload construction and render, so match
    // the minute format rather than an exact count.
    expect(screen.getByText(/Expires in \d+m/)).toBeInTheDocument();
  });

  it('reports Unknown, not a false countdown, for a token with no expiry date', async () => {
    await renderWithRow(baseRow({ expiresAt: null, daysUntilExpiry: 0 }));

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
