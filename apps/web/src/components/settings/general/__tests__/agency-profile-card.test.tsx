import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AgencyProfileCard />
    </QueryClientProvider>
  );
  return { ...utils, invalidateSpy };
}

describe('AgencyProfileCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue('token-123');
  });

  it('loads agency values and populates fields', async () => {
    mockAuthorizedApiFetch.mockResolvedValueOnce({
      data: [{
        id: 'agency-1',
        name: 'Pillar AI Agency',
        settings: {
          website: 'https://pillaraiagency.com',
          logoUrl: 'https://pillaraiagency.com/logo.png',
        },
      }],
      error: null,
    });

    renderCard();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Pillar AI Agency')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://pillaraiagency.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://pillaraiagency.com/logo.png')).toBeInTheDocument();
    });
  });

  it('resolves each field label to exactly one control', async () => {
    mockAuthorizedApiFetch.mockResolvedValueOnce({
      data: [{ id: 'agency-1', name: 'Acme', settings: {} }],
      error: null,
    });

    renderCard();
    await screen.findByDisplayValue('Acme');

    expect(screen.getByLabelText('Agency Name')).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByLabelText('Company Website')).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByLabelText('Logo URL')).toBeInstanceOf(HTMLInputElement);
  });

  it('saves agency name and website updates to api and invalidates the shared agency query', async () => {
    mockAuthorizedApiFetch
      .mockResolvedValueOnce({
        data: [{
          id: 'agency-1',
          name: 'Old Agency Name',
          settings: {
            website: 'https://old.example.com',
            logoUrl: '',
          },
        }],
        error: null,
      })
      .mockResolvedValueOnce({
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

    const { invalidateSpy } = renderCard();

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

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['user-agency'] }));
    });
    const success = await screen.findByText('Changes saved');
    expect(success.className).toContain('text-success-ink');
  });

  it('renders a failed save with the danger ink token', async () => {
    mockAuthorizedApiFetch
      .mockResolvedValueOnce({ data: [{ id: 'agency-1', name: 'Acme', settings: {} }], error: null })
      .mockRejectedValueOnce(new Error('Save failed'));

    renderCard();
    await screen.findByDisplayValue('Acme');
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    const failure = await screen.findByText('Save failed');
    expect(failure.className).toContain('text-danger-ink');
  });

  it('renders Save changes as the brutalist button', async () => {
    mockAuthorizedApiFetch.mockResolvedValueOnce({ data: [{ id: 'agency-1', name: 'Acme', settings: {} }], error: null });

    renderCard();
    await screen.findByDisplayValue('Acme');

    const button = screen.getByRole('button', { name: /save changes/i });
    expect(button.className).toContain('uppercase');
    expect(button.className).toContain('bg-coral');
  });
});
