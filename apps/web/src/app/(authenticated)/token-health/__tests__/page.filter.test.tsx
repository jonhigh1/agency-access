/**
 * Token Health page — health filter menu stays closed until opened
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function getFilterControl() {
  return screen.getByRole('button', { name: /filter tokens/i });
}

describe('TokenHealthPage health filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.signedIn = false;
    global.fetch = vi.fn();
  });

  it('keeps the health filter menu closed on first render', () => {
    render(<TokenHealthPage />);

    expect(screen.queryByRole('option', { name: 'Healthy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Expiring Soon' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Expired' })).not.toBeInTheDocument();
    expect(getFilterControl()).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the health filter menu when the user clicks the filter control', async () => {
    const user = userEvent.setup();
    render(<TokenHealthPage />);

    expect(screen.queryByRole('option', { name: 'Healthy' })).not.toBeInTheDocument();

    await user.click(getFilterControl());

    expect(getFilterControl()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('option', { name: 'Healthy' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Expiring Soon' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Expired' })).toBeInTheDocument();
  });

  it('applies a selected filter and closes the menu', async () => {
    const user = userEvent.setup();
    render(<TokenHealthPage />);

    await user.click(getFilterControl());
    await user.click(screen.getByRole('option', { name: 'Expired' }));

    expect(screen.queryByRole('option', { name: 'Healthy' })).not.toBeInTheDocument();
    expect(getFilterControl()).toHaveAttribute('aria-expanded', 'false');
    expect(getFilterControl()).toHaveAccessibleName(/expired/i);
  });
});
