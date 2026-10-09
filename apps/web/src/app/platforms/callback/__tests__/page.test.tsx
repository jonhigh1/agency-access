/**
 * OAuth Callback Page Tests
 *
 * Focus: non-Meta success should redirect back to /connections with query params
 * so the Connections page can invalidate queries and show updated connection state.
 * Meta success routes through the consolidated PortfolioSelector: receipt,
 * escape, question list, and pick-and-save against the Clerk fetcher
 * (agency onboarding and connections both return here — U5).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CallbackPage from '../page';

const mockPush = vi.fn();
const mockGet = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue('clerk-token');

const { captureMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: {
    capture: captureMock,
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    orgId: 'org-1',
    getToken: mockGetToken,
  }),
  useUser: () => ({
    user: {
      primaryEmailAddress: { emailAddress: 'agency@example.com' },
      emailAddresses: [{ emailAddress: 'agency@example.com' }],
    },
  }),
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

function mockMetaCallbackParams() {
  mockGet.mockImplementation((param: string) => {
    if (param === 'success') return 'true';
    if (param === 'platform') return 'meta';
    if (param === 'error') return null;
    if (param === 'agencyId') return 'agency-1';
    if (param === 'connectionId') return 'conn-1';
    if (param === 'requireBusinessSelection') return null;
    return null;
  });
}

function businessAccountsResponse(businesses: Array<{ id: string; name: string; verticalName?: string; verificationStatus?: string }>) {
  return {
    ok: true,
    json: async () => ({ data: { businesses, hasAccess: true } }),
  } as Response;
}

function completeOauthResponse() {
  return {
    ok: true,
    json: async () => ({ data: { success: true }, error: null }),
  } as Response;
}

describe('OAuth Callback Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue('clerk-token');
    global.fetch = vi.fn();
    window.sessionStorage.clear();
  });

  it('shows loading state when params are missing', () => {
    mockGet.mockImplementation(() => null);
    renderWithQueryClient(<CallbackPage />);
    expect(screen.getByText(/processing your connection/i)).toBeInTheDocument();
  });

  it('shows success state for Google and auto-redirects to /connections with query params', async () => {
    mockGet.mockImplementation((param: string) => {
      if (param === 'success') return 'true';
      if (param === 'platform') return 'google';
      if (param === 'error') return null;
      if (param === 'agencyId') return 'agency-1';
      if (param === 'connectionId') return 'conn-1';
      return null;
    });

    vi.useFakeTimers();
    renderWithQueryClient(<CallbackPage />);

    expect(screen.getByRole('heading', { name: /successfully connected/i })).toBeInTheDocument();
    expect(screen.getByText(/google/i)).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(5000);
    expect(mockPush).toHaveBeenCalledWith('/connections?success=true&platform=google');
    vi.useRealTimers();
  });

  it('shows error state and does not auto-redirect', () => {
    mockGet.mockImplementation((param: string) => {
      if (param === 'error') return 'INVALID_STATE';
      if (param === 'success') return null;
      if (param === 'platform') return 'google';
      return null;
    });

    vi.useFakeTimers();
    renderWithQueryClient(<CallbackPage />);

    expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
    expect(screen.getByTestId('error-icon')).toBeInTheDocument();
    expect(screen.getByText(/invalid_state/i)).toBeInTheDocument();

    vi.advanceTimersByTime(10000);
    expect(mockPush).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('asks the multi-business agency one plain question and saves the picked portfolio', async () => {
    const user = userEvent.setup();
    mockMetaCallbackParams();
    vi.mocked(fetch)
      .mockResolvedValueOnce(businessAccountsResponse([
        { id: 'biz-a', name: 'Acme Studio', verificationStatus: 'verified' },
        { id: 'biz-b', name: 'Bloom Media', verticalName: 'RETAIL' },
      ]) as Response)
      .mockResolvedValueOnce(completeOauthResponse() as Response);

    renderWithQueryClient(<CallbackPage />);

    // Question-first: several businesses means one plain-language question,
    // options show names only (no raw IDs).
    expect(await screen.findByText(/which business are we sharing from/i)).toBeInTheDocument();
    expect(screen.queryByText('biz-a')).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Business' }));
    await user.click(screen.getByRole('option', { name: /Bloom Media/ }));
    await user.click(screen.getByRole('button', { name: /confirm business/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/agency-platforms/meta/complete-oauth'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            agencyId: 'agency-1',
            connectionId: 'conn-1',
            businessId: 'biz-b',
            businessName: 'Bloom Media',
          }),
        })
      );
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/connections?success=true&platform=meta');
    });
  });

  it('receipts the single-business agency and saves after an escape-and-pick', async () => {
    const user = userEvent.setup();
    mockMetaCallbackParams();
    vi.mocked(fetch)
      .mockResolvedValueOnce(businessAccountsResponse([
        { id: 'biz-solo', name: 'Solo Studio' },
      ]) as Response)
      .mockResolvedValueOnce(completeOauthResponse() as Response);

    renderWithQueryClient(<CallbackPage />);

    // Receipt-first: one owner business means a receipt, never a chooser.
    expect(
      await screen.findByText((_, element) =>
        element?.tagName === 'P' && element.textContent === 'Sharing from Solo Studio'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    // Escape renders the question list without a second business fetch
    // (PortfolioSelector caches; the endpoint was called exactly once).
    await user.click(screen.getByRole('button', { name: /choose a different business/i }));
    expect(await screen.findByRole('combobox', { name: 'Business' })).toBeInTheDocument();
    expect(
      vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('business-accounts'))
    ).toHaveLength(1);

    await user.click(screen.getByRole('combobox', { name: 'Business' }));
    await user.click(screen.getByRole('option', { name: /Solo Studio/ }));
    await user.click(screen.getByRole('button', { name: /confirm business/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/agency-platforms/meta/complete-oauth'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            agencyId: 'agency-1',
            connectionId: 'conn-1',
            businessId: 'biz-solo',
            businessName: 'Solo Studio',
          }),
        })
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/connections?success=true&platform=meta');
    });
  });

  it('auto-confirms and saves the single-owner receipt without any interaction', async () => {
    mockMetaCallbackParams();
    vi.mocked(fetch)
      .mockResolvedValueOnce(businessAccountsResponse([
        { id: 'biz-solo', name: 'Solo Studio' },
      ]) as Response)
      .mockResolvedValueOnce(completeOauthResponse() as Response);

    renderWithQueryClient(<CallbackPage />);

    // Receipt-first: the single owner business saves itself — the receipt has
    // no confirm button, so waiting for the client to click one would hang.
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/agency-platforms/meta/complete-oauth'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            agencyId: 'agency-1',
            connectionId: 'conn-1',
            businessId: 'biz-solo',
            businessName: 'Solo Studio',
          }),
        })
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/connections?success=true&platform=meta');
    });
    // Exactly once — re-renders must not double-fire the save.
    expect(
      vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('complete-oauth'))
    ).toHaveLength(1);
  });

  it('offers the log-in-again recovery when the agency has zero business portfolios', async () => {
    mockMetaCallbackParams();
    vi.mocked(fetch).mockResolvedValueOnce(businessAccountsResponse([]) as Response);

    renderWithQueryClient(<CallbackPage />);

    expect(await screen.findByText(/no meta business portfolios found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in again/i })).toBeEnabled();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/agency-platforms/meta/complete-oauth'),
      expect.anything()
    );
  });

  it('links zero-portfolio agencies to create a Business Portfolio in a new tab', async () => {
    mockMetaCallbackParams();
    vi.mocked(fetch).mockResolvedValueOnce(businessAccountsResponse([]) as Response);

    renderWithQueryClient(<CallbackPage />);

    const link = await screen.findByRole('link', { name: /create a business portfolio/i });
    expect(link).toHaveAttribute('href', 'https://business.facebook.com/overview');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByText(/needs a business portfolio to receive client access/i)).toBeInTheDocument();
  });

  it('re-checks the portfolio list after the agency creates one in another tab', async () => {
    const user = userEvent.setup();
    mockMetaCallbackParams();
    vi.mocked(fetch)
      .mockResolvedValueOnce(businessAccountsResponse([]) as Response)
      .mockResolvedValueOnce(
        businessAccountsResponse([
          { id: 'biz-new', name: 'Example New Portfolio' },
          { id: 'biz-other', name: 'Example Other Portfolio' },
        ]) as Response
      );

    renderWithQueryClient(<CallbackPage />);

    await user.click(await screen.findByRole('button', { name: /check again/i }));

    await waitFor(() => {
      expect(screen.queryByText(/no meta business portfolios found/i)).not.toBeInTheDocument();
    });
    const businessCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => String(url).includes('/agency-platforms/meta/business-accounts'));
    expect(businessCalls).toHaveLength(2);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('routes the connections return path through orgId when no agencyId param is present', async () => {
    const user = userEvent.setup();
    mockMetaCallbackParams();
    mockGet.mockImplementation((param: string) => {
      if (param === 'agencyId') return null; // connections return: no agencyId param
      if (param === 'success') return 'true';
      if (param === 'platform') return 'meta';
      if (param === 'connectionId') return 'conn-1';
      return null;
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(businessAccountsResponse([
        { id: 'biz-a', name: 'Acme Studio' },
        { id: 'biz-b', name: 'Bloom Media' },
      ]) as Response)
      .mockResolvedValueOnce(completeOauthResponse() as Response);

    renderWithQueryClient(<CallbackPage />);

    expect(await screen.findByText(/which business are we sharing from/i)).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Business' }));
    await user.click(screen.getByRole('option', { name: /Acme Studio/ }));
    await user.click(screen.getByRole('button', { name: /confirm business/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/agency-platforms/meta/business-accounts?agencyId=org-1&refresh=true'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer clerk-token' }) })
      );
    });
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/agency-platforms/meta/complete-oauth'),
        expect.objectContaining({
          body: JSON.stringify({
            agencyId: 'org-1',
            connectionId: 'conn-1',
            businessId: 'biz-a',
            businessName: 'Acme Studio',
          }),
        })
      );
    });
  });

  it('surfaces a save failure instead of redirecting away', async () => {
    const user = userEvent.setup();
    mockMetaCallbackParams();
    vi.mocked(fetch)
      .mockResolvedValueOnce(businessAccountsResponse([
        { id: 'biz-a', name: 'Acme Studio' },
        { id: 'biz-b', name: 'Bloom Media' },
      ]) as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { code: 'SAVE_FAILED', message: 'Meta rejected the connection' } }),
      } as unknown as Response);

    renderWithQueryClient(<CallbackPage />);

    expect(await screen.findByText(/which business are we sharing from/i)).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Business' }));
    await user.click(screen.getByRole('option', { name: /Acme Studio/ }));
    await user.click(screen.getByRole('button', { name: /confirm business/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Meta rejected the connection/i);
    expect(mockPush).not.toHaveBeenCalled();
  });

  describe('when the Meta connection was started from onboarding', () => {
    function seedOnboardingIntent() {
      window.sessionStorage.setItem(
        'authhub:onboarding-return:v1',
        JSON.stringify({ v: 1, path: '/onboarding/unified', step: 3, platform: 'meta', createdAt: Date.now() })
      );
    }

    it('returns to the onboarding platform step after saving the portfolio', async () => {
      seedOnboardingIntent();
      mockMetaCallbackParams();
      vi.mocked(fetch)
        .mockResolvedValueOnce(businessAccountsResponse([{ id: 'biz-solo', name: 'Example Portfolio' }]) as Response)
        .mockResolvedValueOnce(completeOauthResponse() as Response);

      renderWithQueryClient(<CallbackPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/onboarding/unified?meta=connected');
      });
      expect(mockPush).not.toHaveBeenCalledWith('/connections?success=true&platform=meta');
      // One-shot: a later connect from /connections goes back to /connections.
      expect(window.sessionStorage.getItem('authhub:onboarding-return:v1')).toBeNull();
    });

    it('offers a way back to onboarding when the connection fails', () => {
      seedOnboardingIntent();
      mockGet.mockImplementation((param: string) => {
        if (param === 'error') return 'INVALID_STATE';
        if (param === 'platform') return 'meta';
        return null;
      });

      renderWithQueryClient(<CallbackPage />);

      expect(screen.getByRole('link', { name: /back to onboarding/i })).toHaveAttribute(
        'href',
        '/onboarding/unified?meta=error'
      );
      expect(screen.queryByRole('link', { name: /try again/i })).not.toBeInTheDocument();
    });

    it('lets the agency leave the portfolio picker and continue onboarding without Meta', async () => {
      seedOnboardingIntent();
      mockMetaCallbackParams();
      vi.mocked(fetch).mockResolvedValueOnce(businessAccountsResponse([]) as Response);

      renderWithQueryClient(<CallbackPage />);

      expect(await screen.findByRole('link', { name: /back to onboarding without meta/i })).toHaveAttribute(
        'href',
        '/onboarding/unified?meta=cancelled'
      );
    });
  });
});
