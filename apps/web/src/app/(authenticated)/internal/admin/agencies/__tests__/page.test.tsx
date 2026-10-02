import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import InternalAdminAgenciesPage from '../page';

const useInternalAdminAgenciesMock = vi.fn();
const useInternalAdminAgencyDetailMock = vi.fn();

vi.mock('@/lib/query/internal-admin', () => ({
  useInternalAdminAgencies: () => useInternalAdminAgenciesMock(),
  useInternalAdminAgencyDetail: () => useInternalAdminAgencyDetailMock(),
}));

describe('Internal admin agencies page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useInternalAdminAgenciesMock.mockReturnValue({
      data: {
        items: [
          {
            id: 'agency_1',
            name: 'Mindbent Media',
            email: 'user_1@clerk.temp',
            createdAt: '2026-08-11T00:00:00.000Z',
            memberCount: 1,
            subscriptionTier: null,
            subscriptionStatus: null,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      },
      isLoading: false,
      error: null,
    });
    useInternalAdminAgencyDetailMock.mockReturnValue({
      data: {
        agency: {
          id: 'agency_1',
          name: 'Mindbent Media',
          email: 'user_1@clerk.temp',
          createdAt: '2026-08-11T00:00:00.000Z',
          updatedAt: '2026-08-11T00:00:00.000Z',
        },
        subscription: null,
        members: [],
        usage: { clientOnboards: 0, platformAudits: 0, teamSeats: 0 },
      },
      isLoading: false,
      error: null,
    });
  });

  it('shows placeholder-email agencies', () => {
    render(<InternalAdminAgenciesPage />);

    expect(screen.getByText('Mindbent Media')).toBeInTheDocument();
    expect(screen.getByText('user_1@clerk.temp')).toBeInTheDocument();
  });

  it('labels a missing subscription consistently', () => {
    render(<InternalAdminAgenciesPage />);

    fireEvent.click(screen.getByRole('button', { name: 'View' }));

    expect(screen.getAllByText('No subscription').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Status: none/i)).not.toBeInTheDocument();
  });

  it('keeps an accessible name on the agency search field', () => {
    render(<InternalAdminAgenciesPage />);

    expect(screen.getByRole('searchbox', { name: 'Search agencies by name or email' })).toBeInTheDocument();
  });
});
