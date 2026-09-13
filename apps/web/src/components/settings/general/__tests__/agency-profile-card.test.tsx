import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AgencyProfileCard } from '../agency-profile-card';

const mockAuthorizedApiFetch = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue('token-123');

vi.mock('@/lib/api/authorized-api-fetch', () => ({
  authorizedApiFetch: (...args: any[]) => mockAuthorizedApiFetch(...args),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    userId: 'user_123',
    orgId: null,
    getToken: mockGetToken,
  }),
}));

function renderCard(agency: {
  id: string;
  name: string;
  settings?: Record<string, unknown> | null;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(['user-agency', 'user_123'], agency);
  return render(
    <QueryClientProvider client={queryClient}>
      <AgencyProfileCard />
    </QueryClientProvider>
  );
}

describe('AgencyProfileCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue('token-123');
  });

  it('loads agency values and populates fields', async () => {
    renderCard({
      id: 'agency-1',
      name: 'Pillar AI Agency',
      settings: {
        website: 'https://pillaraiagency.com',
        logoUrl: 'https://pillaraiagency.com/logo.png',
      },
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Pillar AI Agency')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://pillaraiagency.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://pillaraiagency.com/logo.png')).toBeInTheDocument();
    });
  });

  it('saves agency name and website updates to api', async () => {
    mockAuthorizedApiFetch.mockResolvedValueOnce({
      data: {
        id: 'agency-1',
        name: 'New Agency Name',
        settings: {
          website: 'https://new.example.com',
          logoUrl: '',
        },
      },
      error: null,
    });

    renderCard({
      id: 'agency-1',
      name: 'Old Agency Name',
      settings: {
        website: 'https://old.example.com',
        logoUrl: '',
      },
    });

    const agencyNameInput = await screen.findByDisplayValue('Old Agency Name');
    const websiteInput = screen.getByLabelText('Company Website') as HTMLInputElement;

    expect(websiteInput.value).toContain('old.example.com');

    fireEvent.change(agencyNameInput, { target: { value: 'New Agency Name' } });
    fireEvent.change(websiteInput, { target: { value: 'https://new.example.com' } });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockAuthorizedApiFetch).toHaveBeenCalledWith(
        '/api/agencies/agency-1',
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    const patchCall = mockAuthorizedApiFetch.mock.calls.find((call) => call[0] === '/api/agencies/agency-1');
    const patchBody = JSON.parse(patchCall?.[1]?.body as string);
    expect(patchBody.name).toBe('New Agency Name');
    expect(patchBody.settings.website).toBe('https://new.example.com');
  });
});
