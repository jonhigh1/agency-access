import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import AccessRequestPage from '../page';
import * as accessRequestsApi from '@/lib/api/access-requests';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@clerk/nextjs', () => ({
  useUser: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api/access-requests', () => ({
  createAccessRequest: vi.fn(),
}));

vi.mock('@/components/template-selector', () => ({
  TemplateSelector: () => <div data-testid="template-selector" />,
}));

vi.mock('@/components/client-selector', () => ({
  ClientSelector: ({ onSelect }: any) => (
    <button
      type="button"
      onClick={() =>
        onSelect({
          id: 'client-123',
          name: 'Test Client',
          email: 'client@test.com',
          agencyId: 'agency-123',
        })
      }
    >
      Pick Client
    </button>
  ),
}));


vi.mock('@/components/access-level-selector', () => ({
  AccessLevelSelector: () => <div data-testid="access-level">Standard</div>,
}));

vi.mock('@/components/hierarchical-platform-selector', () => ({
  HierarchicalPlatformSelector: ({ onSelectionChange }: any) => (
    <button
      type="button"
      onClick={() =>
        onSelectionChange({
          google: ['google_ads'],
        })
      }
    >
      Pick Platforms
    </button>
  ),
}));

vi.mock('@/components/save-as-template-modal', () => ({
  SaveAsTemplateModal: () => null,
}));

function renderWithProviders(component: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
}

describe('Access Request Wizard', () => {
  const mockRouter = {
    push: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    forward: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    vi.mocked(useRouter).mockReturnValue(mockRouter as any);
    vi.mocked(useUser).mockReturnValue({ user: { id: 'user-123' } } as any);
    vi.mocked(useAuth).mockReturnValue({
      userId: 'user-123',
      orgId: null,
      getToken: vi.fn().mockResolvedValue('token-123'),
    } as any);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/agencies')) {
          return {
            ok: true,
            json: async () => ({ data: [{ id: 'agency-123' }] }),
          } as Response;
        }

        if (url.includes('/agency-platforms?')) {
          return {
            ok: true,
            json: async () => ({ data: [{ platform: 'google', status: 'active', agencyEmail: 'ops@agency.com' }] }),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({ data: {} }),
        } as Response;
      })
    );
  });

  it('blocks continue on step 1 until a client is selected', async () => {
    renderWithProviders(<AccessRequestPage />);

    expect(screen.queryByTestId('template-selector')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/external reference/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /advanced settings/i })).toBeInTheDocument();

    const continueButton = await screen.findByRole('button', { name: /continue to platforms/i });
    expect(continueButton).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /pick client/i }));

    await waitFor(() => {
      expect(continueButton).not.toBeDisabled();
    });
  });

  it('blocks continue on step 2 until at least one platform is selected', async () => {
    renderWithProviders(<AccessRequestPage />);

    await userEvent.click(await screen.findByRole('button', { name: /pick client/i }));
    await userEvent.click(screen.getByRole('button', { name: /continue to platforms/i }));

    const continueButton = await screen.findByRole('button', { name: /continue to customize/i });
    expect(continueButton).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /pick platforms/i }));

    await waitFor(() => {
      expect(continueButton).not.toBeDisabled();
    });
  });

  it('keeps focus on an invalid custom field instead of advancing to review', async () => {
    renderWithProviders(<AccessRequestPage />);

    await userEvent.click(await screen.findByRole('button', { name: /pick client/i }));
    await userEvent.click(screen.getByRole('button', { name: /continue to platforms/i }));
    await userEvent.click(await screen.findByRole('button', { name: /pick platforms/i }));
    await userEvent.click(screen.getByRole('button', { name: /continue to customize/i }));

    const field = await screen.findByPlaceholderText(/field label/i);
    await userEvent.clear(field);
    await userEvent.click(screen.getByRole('button', { name: /review & create/i }));

    expect(screen.getByRole('heading', { name: 'Customize' })).toBeInTheDocument();
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Enter a label for this field.');
  });

  it('opens branding and focuses an invalid subdomain', async () => {
    renderWithProviders(<AccessRequestPage />);

    await userEvent.click(await screen.findByRole('button', { name: /pick client/i }));
    await userEvent.click(screen.getByRole('button', { name: /continue to platforms/i }));
    await userEvent.click(await screen.findByRole('button', { name: /pick platforms/i }));
    await userEvent.click(screen.getByRole('button', { name: /continue to customize/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Branding' }));

    const subdomain = screen.getByLabelText('Subdomain');
    await userEvent.type(subdomain, 'ab');
    await userEvent.click(screen.getByRole('button', { name: /review & create/i }));

    expect(screen.getByRole('heading', { name: 'Customize' })).toBeInTheDocument();
    expect(subdomain).toHaveFocus();
    expect(subdomain).toHaveAttribute('aria-invalid', 'true');
    expect(subdomain).toHaveAccessibleDescription(/3–63 lowercase letters/i);
  });

  it('submits successfully and routes to success page', async () => {
    vi.mocked(accessRequestsApi.createAccessRequest).mockResolvedValue({
      data: {
        id: 'request-123',
      },
    } as any);

    renderWithProviders(<AccessRequestPage />);

    await userEvent.click(await screen.findByRole('button', { name: /pick client/i }));
    await userEvent.click(screen.getByRole('button', { name: /advanced settings/i }));
    await userEvent.type(screen.getByLabelText(/external reference/i), 'crm-123');
    await userEvent.click(screen.getByRole('button', { name: /continue to platforms/i }));
    await userEvent.click(await screen.findByRole('button', { name: /pick platforms/i }));
    await userEvent.click(screen.getByRole('button', { name: /continue to customize/i }));
    await userEvent.click(await screen.findByRole('button', { name: /review & create/i }));
    await userEvent.click(await screen.findByRole('button', { name: /create access request/i }));

    await waitFor(() => {
      expect(accessRequestsApi.createAccessRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          externalReference: 'crm-123',
        }),
        expect.any(Function)
      );
      expect(mockRouter.push).toHaveBeenCalledWith('/access-requests/request-123/success');
    });
  });

  it('reveals external reference only after expanding advanced settings', async () => {
    renderWithProviders(<AccessRequestPage />);

    expect(screen.queryByLabelText(/external reference/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /advanced settings/i }));

    expect(await screen.findByLabelText(/external reference/i)).toBeInTheDocument();
    expect(screen.getByText(/downstream matching/i)).toBeInTheDocument();
  });

  it('shows API error message when creation fails', async () => {
    vi.mocked(accessRequestsApi.createAccessRequest).mockResolvedValue({
      error: {
        code: 'NETWORK_ERROR',
        message: 'Failed to create access request',
      },
    } as any);

    renderWithProviders(<AccessRequestPage />);

    await userEvent.click(await screen.findByRole('button', { name: /pick client/i }));
    await userEvent.click(screen.getByRole('button', { name: /continue to platforms/i }));
    await userEvent.click(await screen.findByRole('button', { name: /pick platforms/i }));
    await userEvent.click(screen.getByRole('button', { name: /continue to customize/i }));
    await userEvent.click(await screen.findByRole('button', { name: /review & create/i }));
    await userEvent.click(await screen.findByRole('button', { name: /create access request/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to create access request/i)).toBeInTheDocument();
    });
  });

  it('routes to connections page when clicking manage platform connections', async () => {
    renderWithProviders(<AccessRequestPage />);

    const managePlatformsButton = await screen.findByRole('button', {
      name: /manage platform connections/i,
    });

    await userEvent.click(managePlatformsButton);

    expect(mockRouter.push).toHaveBeenCalledWith('/connections');
  });

  it('fetches active platform connections from uncached endpoint for auth model status', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/agencies')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 'agency-123' }] }),
        } as Response;
      }

      if (url.includes('/agency-platforms?')) {
        return {
          ok: true,
          json: async () => ({ data: [{ platform: 'beehiiv', status: 'active', agencyEmail: 'ops@agency.com' }] }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ data: {} }),
      } as Response;
    });

    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<AccessRequestPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/agency-platforms?agencyId=agency-123&status=active'),
        expect.any(Object)
      );
    });
  });
});
