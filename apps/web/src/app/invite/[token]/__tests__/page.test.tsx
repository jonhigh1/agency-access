import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvitePage from '../client-invite-page';

const { searchParamGetMock } = vi.hoisted(() => ({
  searchParamGetMock: vi.fn(() => null),
}));

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ token: 'token-123' })),
  useSearchParams: vi.fn(() => ({
    get: searchParamGetMock,
    toString: () => '',
  })),
  useRouter: vi.fn(() => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() })),
  usePathname: vi.fn(() => '/invite/token-123'),
}));

vi.mock('@/lib/analytics/capture-posthog', () => ({
  capturePosthogEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/analytics/invite-events', () => ({
  trackInviteOpenedOncePerSession: vi.fn(),
  // U11: the flow shell raises this on "Check again"; stubbed here so the
  // click handler reaches the page's refetch.
  trackInviteProgressCheckRequested: vi.fn(),
  trackClientChecklistResumed: vi.fn(),
}));

import * as inviteEvents from '@/lib/analytics/invite-events';
import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';

vi.mock('@/components/client-auth/PlatformAuthWizard', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    PlatformAuthWizard: ({
      onComplete,
      platformName,
      completionActionLabel,
      initialConnectionId,
      initialStep,
      initialMetaSelections,
      requestAvailability,
    }: any) => {
      const [mountedPlatformName] = React.useState(platformName);

      return (
        <div>
          <p>{`Active platform: ${mountedPlatformName}`}</p>
          {completionActionLabel ? <p>{`Completion action: ${completionActionLabel}`}</p> : null}
          {initialConnectionId ? <p>{`Initial connection: ${initialConnectionId}`}</p> : null}
          {initialStep ? <p>{`Initial step: ${initialStep}`}</p> : null}
          {initialMetaSelections?.adAccounts?.length ? (
            <p>{`Meta prefill: ${initialMetaSelections.adAccounts.join(', ')}`}</p>
          ) : null}
          {requestAvailability && requestAvailability !== 'available' ? (
            <p>{`Request availability: ${requestAvailability}`}</p>
          ) : null}
          <button type="button" onClick={onComplete}>
            Complete Platform
          </button>
        </div>
      );
    },
  };
});

// Fetch stubs in this file are object literals with `json`; the page parses
// via parseJsonResponse, which reads `text` like a real Response. Derive
// `text` from the stubbed body so stubs stay Response-shaped.
// Note: this bypasses non-JSON responses — tests for those stub fetch directly.
const stubFetch = (
  impl: (url: string, init?: unknown) => Promise<Record<string, unknown>>
) => {
  vi.stubGlobal('fetch', async (url: string, init?: unknown) => {
    const response = await impl(url, init);
    return {
      ...response,
      text: async () => JSON.stringify(await (response.json as () => Promise<unknown>)()),
    };
  });
};

describe('Invite Flow Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamGetMock.mockImplementation(() => null);
    vi.useRealTimers();
    sessionStorage.clear();
    // Tailwind `sm:` uses matchMedia; `hidden sm:grid` only shows at min-width — treat as matched in tests.
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: typeof query === 'string' && query.includes('min-width'),
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders explicit error state for invalid token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: { message: 'Access request expired' } }),
      }))
    );

    render(<InvitePage />);

    await waitFor(() => {
      expect(screen.getByText(/this link is not working/i)).toBeInTheDocument();
      expect(screen.getByText(/access request expired/i)).toBeInTheDocument();
    });
  });

  it('shows delayed then timeout state and can recover with retry', async () => {
    vi.useFakeTimers();

    const validPayload = {
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        agencyName: 'Demo Agency',
        clientName: 'Client',
        clientEmail: 'client@test.com',
        status: 'pending',
        uniqueToken: 'token-123',
        expiresAt: new Date().toISOString(),
        intakeFields: [],
        branding: {},
        platforms: [
          {
            platformGroup: 'google',
            products: [{ product: 'google_ads', accessLevel: 'admin' }],
          },
        ],
        manualInviteTargets: { google: {} },
        authorizationProgress: { completedPlatforms: [], isComplete: false },
      },
      error: null,
    };

    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Promise(() => {});
      }

      return {
        ok: true,
        json: async () => validPayload,
      } as Response;
    });

    stubFetch( fetchMock);

    render(<InvitePage />);

    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.getByText(/still loading/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(screen.getByText(/still working on it/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText(/confirm which accounts to share below/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue to connect/i })).toBeInTheDocument();

    vi.useRealTimers();
  }, 10000);

  it('treats null intake fields as an empty review step instead of crashing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: null,
            branding: {},
            platforms: [
              {
                platformGroup: 'google',
                products: [{ product: 'google_ads', accessLevel: 'admin' }],
              },
            ],
            manualInviteTargets: { google: {} },
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      }))
    );

    render(<InvitePage />);

    await waitFor(() => {
      expect(screen.getByText(/confirm which accounts to share below/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue to connect/i })).toBeInTheDocument();
      expect(screen.getByText(/you explicitly approve in the next step/i)).toBeInTheDocument();
    });

    expect(inviteEvents.trackInviteOpenedOncePerSession).toHaveBeenCalledWith(
      expect.objectContaining({
        access_request_token: 'token-123',
        surface: 'invite_page',
      })
    );
    expect(capturePosthogEvent).toHaveBeenCalledWith(
      'client_authorization_started',
      expect.objectContaining({
        access_request_token: 'token-123',
      })
    );
  });

  it('shows the security badge only once in the setup hero', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [],
            branding: {},
            platforms: [
              {
                platformGroup: 'google',
                products: [{ product: 'google_ads', accessLevel: 'admin' }],
              },
            ],
            manualInviteTargets: { google: {} },
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      }))
    );

    render(<InvitePage />);

    // Visual QA found the security label echoing the hero sentence on the
    // same screen ("Secure — passwords never requested" right after
    // "Passwords are never requested."). The badge is gone; the promise
    // itself stays — the hero sentence, plus the footer reassurance at the
    // point of action.
    await waitFor(() => {
      expect(screen.getAllByText(/passwords are never requested/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/secure — passwords never requested/i)).not.toBeInTheDocument();
  });

  it('calls completion endpoint when all platforms are complete', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/client/token-123/complete')) {
        return {
          ok: true,
          json: async () => ({ data: { success: true }, error: null }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [],
            branding: {},
            platforms: [
              {
                platformGroup: 'google',
                products: [{ product: 'google_ads', accessLevel: 'admin' }],
              },
            ],
            manualInviteTargets: { google: {} },
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      } as Response;
    });

    stubFetch( fetchMock);

    render(<InvitePage />);

    const continueButton = await screen.findByRole('button', { name: /continue to connect/i });
    await userEvent.click(continueButton);

    const completeButton = await screen.findByRole('button', { name: /complete platform/i });
    await userEvent.click(completeButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/client/token-123/complete'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('shows a definitive done state without sending the user back to connect', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/client/token-123/complete')) {
        return {
          ok: true,
          json: async () => ({ data: { success: true }, error: null }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [],
            branding: {},
            platforms: [
              {
                platformGroup: 'google',
                products: [{ product: 'google_ads', accessLevel: 'admin' }],
              },
            ],
            manualInviteTargets: { google: {} },
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      } as Response;
    });

    stubFetch( fetchMock);

    render(<InvitePage />);

    await userEvent.click(await screen.findByRole('button', { name: /continue to connect/i }));
    await userEvent.click(await screen.findByRole('button', { name: /complete platform/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /all set — you're done/i })).toBeInTheDocument();
      expect(screen.getByText(/nothing else is needed from you/i)).toBeInTheDocument();
      expect(screen.getByText(/you can safely close this window/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /back to connect/i })).not.toBeInTheDocument();
  });

  it('does not show success until delayed finalization confirms it', async () => {
    let resolveCompletion: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/api/client/token-123/complete')) {
        return new Promise<Response>((resolve) => {
          resolveCompletion = resolve;
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1', agencyId: 'agency-1', agencyName: 'Demo Agency', clientName: 'Client',
            clientEmail: 'client@test.com', status: 'pending', uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(), intakeFields: [], branding: {},
            platforms: [{ platformGroup: 'google', products: [{ product: 'google_ads', accessLevel: 'admin' }] }],
            manualInviteTargets: { google: {} }, authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      } as Response);
    });
    stubFetch( fetchMock);

    render(<InvitePage />);
    await userEvent.click(await screen.findByRole('button', { name: /continue to connect/i }));
    await userEvent.click(await screen.findByRole('button', { name: /complete platform/i }));

    await waitFor(() => expect(screen.getByRole('heading', { name: /confirming access/i })).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: /all set/i })).not.toBeInTheDocument();

    resolveCompletion?.({ ok: true, json: async () => ({ data: { success: true }, error: null }) } as Response);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /all set — you're done/i })).toBeInTheDocument();
    });
  });

  it('submits finalization once when the platform completion callback fires twice', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/client/token-123/complete')) {
        return { ok: true, json: async () => ({ data: { success: true }, error: null }) } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1', agencyId: 'agency-1', agencyName: 'Demo Agency', clientName: 'Client',
            clientEmail: 'client@test.com', status: 'pending', uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(), intakeFields: [], branding: {},
            platforms: [{ platformGroup: 'google', products: [{ product: 'google_ads', accessLevel: 'admin' }] }],
            manualInviteTargets: { google: {} }, authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      } as Response;
    });
    stubFetch( fetchMock);

    render(<InvitePage />);
    await userEvent.click(await screen.findByRole('button', { name: /continue to connect/i }));
    const completeButton = await screen.findByRole('button', { name: /complete platform/i });
    fireEvent.click(completeButton);
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/complete'))).toHaveLength(1);
    });
  });

  it('keeps intake answers on save failure and continues only after saved readback', async () => {
    let intakeAttempts = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/client/token-123/intake')) {
        intakeAttempts += 1;
        if (intakeAttempts === 1) {
          return { ok: false, json: async () => ({ error: { message: 'Save failed' } }) } as Response;
        }
        return {
          ok: true,
          json: async () => ({ data: { intakeResponses: { company: 'Acme' } }, error: null }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1', agencyId: 'agency-1', agencyName: 'Demo Agency', clientName: 'Client',
            clientEmail: 'client@test.com', status: 'pending', uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [{ id: 'company', label: 'Company name', type: 'text', required: true }],
            branding: {},
            platforms: [{ platformGroup: 'google', products: [{ product: 'google_ads', accessLevel: 'admin' }] }],
            manualInviteTargets: { google: {} }, authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      } as Response;
    });
    stubFetch( fetchMock);

    render(<InvitePage />);
    const company = await screen.findByRole('textbox', { name: /company name/i });
    await userEvent.type(company, 'Acme');
    await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Save failed'));
    expect(company).toHaveValue('Acme');

    await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    await waitFor(() => expect(screen.getByText('Active platform: Google')).toBeInTheDocument());
    expect(intakeAttempts).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/client/token-123/intake'),
      expect.objectContaining({ body: JSON.stringify({ intakeResponses: { company: 'Acme' } }) })
    );
  });

  it('labels text and long-answer intake controls', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1', agencyId: 'agency-1', agencyName: 'Demo Agency', clientName: 'Client',
            clientEmail: 'client@test.com', status: 'pending', uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [
              { id: 'company', label: 'Company name', type: 'text', required: true },
              { id: 'notes', label: 'Notes for agency', type: 'textarea', required: false },
            ],
            branding: {},
            platforms: [{ platformGroup: 'google', products: [{ product: 'google_ads', accessLevel: 'admin' }] }],
            manualInviteTargets: { google: {} }, authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      }))
    );

    render(<InvitePage />);

    const company = await screen.findByRole('textbox', { name: /company name/i });
    expect(screen.getByRole('textbox', { name: 'Notes for agency' })).toBeInTheDocument();

    await userEvent.type(company, '   ');
    await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Complete Company name before continuing.');
    expect(company).toHaveFocus();
  });

  it('advances without an intake POST when no intake fields are configured', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/client/token-123/intake')) {
        throw new Error('intake POST must not fire without configured fields');
      }
      return {
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1', agencyId: 'agency-1', agencyName: 'Demo Agency', clientName: 'Client',
            clientEmail: 'client@test.com', status: 'pending', uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(), intakeFields: [], branding: {},
            platforms: [{ platformGroup: 'google', products: [{ product: 'google_ads', accessLevel: 'admin' }] }],
            manualInviteTargets: { google: {} }, authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      } as Response;
    });
    stubFetch(fetchMock);

    render(<InvitePage />);
    await userEvent.click(await screen.findByRole('button', { name: /continue to connect/i }));

    await waitFor(() => {
      expect(screen.getByText('Active platform: Google')).toBeInTheDocument();
    });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/intake'))).toHaveLength(0);
  });

  it('applies saved primary color and records color-only branding', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1', agencyId: 'agency-1', agencyName: 'Demo Agency', clientName: 'Client',
            clientEmail: 'client@test.com', status: 'pending', uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(), intakeFields: [], branding: { primaryColor: '#0A7CFF' },
            platforms: [{ platformGroup: 'google', products: [{ product: 'google_ads', accessLevel: 'admin' }] }],
            manualInviteTargets: { google: {} }, authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      }))
    );

    render(<InvitePage />);

    await screen.findByRole('button', { name: /continue to connect/i });
    expect(screen.getByTestId('invite-brand-accent')).toHaveStyle({ borderTopColor: '#0A7CFF' });
    expect(capturePosthogEvent).toHaveBeenCalledWith(
      'client_authorization_started',
      expect.objectContaining({ has_custom_branding: true })
    );
  });

  it('skips intake for a returning visitor who already completed a platform', async () => {
    sessionStorage.setItem('invite-progress:token-123', JSON.stringify(['google']));

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [{ id: 'field-1', label: 'Company name', type: 'text', required: true }],
            branding: {},
            platforms: [
              {
                platformGroup: 'google',
                products: [{ product: 'google_ads', accessLevel: 'admin' }],
              },
              {
                platformGroup: 'meta',
                products: [{ product: 'meta_ads', accessLevel: 'admin' }],
              },
            ],
            manualInviteTargets: { google: {}, meta: {} },
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      }))
    );

    render(<InvitePage />);

    await waitFor(() => {
      expect(screen.getByText('Active platform: Meta')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /continue to connect/i })).not.toBeInTheDocument();
  });

  it('shows completion failure instead of success and retries directly', async () => {
    let completionAttempts = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/client/token-123/complete')) {
        completionAttempts += 1;
        if (completionAttempts === 1) {
          return {
            ok: false,
            json: async () => ({ error: { message: 'Finalization service unavailable' } }),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({ data: { success: true }, error: null }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [],
            branding: {},
            platforms: [
              {
                platformGroup: 'google',
                products: [{ product: 'google_ads', accessLevel: 'admin' }],
              },
            ],
            manualInviteTargets: { google: {} },
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      } as Response;
    });

    stubFetch( fetchMock);

    render(<InvitePage />);

    await userEvent.click(await screen.findByRole('button', { name: /continue to connect/i }));
    await userEvent.click(await screen.findByRole('button', { name: /complete platform/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /access needs follow-up/i })).toBeInTheDocument();
      expect(screen.getByText(/finalization service unavailable/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: /all set/i })).not.toBeInTheDocument();
    expect(screen.getByText('Your progress')).toBeInTheDocument();
    expect(screen.getByText('Access confirmed.')).toBeInTheDocument();
    expect(screen.queryByText(/step 2 of 3/i)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveFocus();

    expect(screen.queryByText(/you can safely close this window/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /check again/i }));

    await waitFor(() => {
      expect(completionAttempts).toBe(2);
      expect(screen.getByRole('heading', { name: /all set — you're done/i })).toBeInTheDocument();
    });
  });

  it('does not show verified access while completion is still pending', async () => {
    let resolveCompletion!: (response: Response) => void;
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/api/client/token-123/complete')) {
        return new Promise<Response>((resolve) => { resolveCompletion = resolve; });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: {
          id: 'request-1', agencyId: 'agency-1', agencyName: 'Demo Agency', clientName: 'Client',
          clientEmail: 'client@test.com', status: 'pending', uniqueToken: 'token-123',
          expiresAt: new Date().toISOString(), intakeFields: [], branding: {},
          platforms: [{ platformGroup: 'google', products: [{ product: 'google_ads', accessLevel: 'admin' }] }],
          manualInviteTargets: { google: {} }, authorizationProgress: { completedPlatforms: [], isComplete: false },
        }, error: null }),
      } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<InvitePage />);
    await userEvent.click(await screen.findByRole('button', { name: /continue to connect/i }));
    await userEvent.click(await screen.findByRole('button', { name: /complete platform/i }));

    expect(await screen.findByRole('heading', { name: /confirming your authorization/i })).toBeInTheDocument();
    expect(screen.queryByText(/you can safely close this window/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /all set — you're done/i })).not.toBeInTheDocument();

    resolveCompletion({ ok: true, text: async () => JSON.stringify({ data: { success: true }, error: null }) } as Response);
    expect(await screen.findByRole('heading', { name: /all set — you're done/i })).toBeInTheDocument();
  });

  it('renders the finalize fallback error when the completion body is not JSON', async () => {
    // Direct vi.stubGlobal (not stubFetch): the non-JSON finalize response must
    // keep its real `text` and have no `json` so parseJsonResponse's non-JSON
    // branch is exercised.
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/client/token-123/complete')) {
        return {
          ok: false,
          text: async () => 'gateway timeout',
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [],
            branding: {},
            platforms: [
              {
                platformGroup: 'google',
                products: [{ product: 'google_ads', accessLevel: 'admin' }],
              },
            ],
            manualInviteTargets: { google: {} },
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      } as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<InvitePage />);

    await userEvent.click(await screen.findByRole('button', { name: /continue to connect/i }));
    await userEvent.click(await screen.findByRole('button', { name: /complete platform/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /access needs follow-up/i })).toBeInTheDocument();
      expect(screen.getByText('Failed to finalize authorization')).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: /all set/i })).not.toBeInTheDocument();
  });

  it('keeps the connect step visible until a platform is completed', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/client/token-123/complete')) {
        return {
          ok: true,
          json: async () => ({ data: { success: true }, error: null }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [],
            branding: {},
            platforms: [
              {
                platformGroup: 'google',
                products: [{ product: 'google_ads', accessLevel: 'admin' }],
              },
            ],
            manualInviteTargets: { google: {} },
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      } as Response;
    });

    stubFetch( fetchMock);

    render(<InvitePage />);

    const continueButton = await screen.findByRole('button', { name: /continue to connect/i });
    await userEvent.click(continueButton);

    await waitFor(() => {
      expect(screen.getByText('Your progress')).toBeInTheDocument();
      expect(screen.getByText('Connect Google to continue.')).toBeInTheDocument();
    });

    expect(screen.queryByText(/step \d+ of \d+/i)).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('/api/client/token-123/complete'))
    ).toBe(false);
  });

  it('shows only one active platform at a time and collapses the rest of the request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [],
            branding: {},
            platforms: [
              {
                platformGroup: 'google',
                products: [{ product: 'google_ads', accessLevel: 'admin' }],
              },
              {
                platformGroup: 'meta',
                products: [{ product: 'meta_ads', accessLevel: 'admin' }],
              },
            ],
            manualInviteTargets: { google: {}, meta: {} },
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      }))
    );

    render(<InvitePage />);

    const continueButton = await screen.findByRole('button', { name: /continue to connect/i });
    await userEvent.click(continueButton);

    await waitFor(() => {
      expect(screen.getByText('Active platform: Google')).toBeInTheDocument();
      expect(screen.queryAllByRole('button', { name: /complete platform/i })).toHaveLength(1);
    });

    expect(screen.queryByText('Active platform: Meta')).not.toBeInTheDocument();
  });

  it('passes an explicit next-platform handoff label to the active platform', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [],
            branding: {},
            platforms: [
              {
                platformGroup: 'google',
                products: [{ product: 'google_ads', accessLevel: 'admin' }],
              },
              {
                platformGroup: 'meta',
                products: [{ product: 'meta_ads', accessLevel: 'admin' }],
              },
            ],
            manualInviteTargets: { google: {}, meta: {} },
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      }))
    );

    render(<InvitePage />);

    const continueButton = await screen.findByRole('button', { name: /continue to connect/i });
    await userEvent.click(continueButton);

    await waitFor(() => {
      expect(screen.getByText('Completion action: Continue to Meta')).toBeInTheDocument();
    });
  });

  it('remounts the platform wizard when advancing to the next queued platform', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [],
            branding: {},
            platforms: [
              {
                platformGroup: 'google',
                products: [{ product: 'google_ads', accessLevel: 'admin' }],
              },
              {
                platformGroup: 'meta',
                products: [{ product: 'meta_ads', accessLevel: 'admin' }],
              },
            ],
            manualInviteTargets: { google: {}, meta: {} },
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      }))
    );

    render(<InvitePage />);

    await userEvent.click(await screen.findByRole('button', { name: /continue to connect/i }));

    await waitFor(() => {
      expect(screen.getByText('Active platform: Google')).toBeInTheDocument();
      expect(screen.getByText('Completion action: Continue to Meta')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /complete platform/i }));

    await waitFor(() => {
      expect(screen.getByText('Active platform: Meta')).toBeInTheDocument();
      expect(screen.getByText('Completion action: Finish')).toBeInTheDocument();
    });

    expect(screen.queryByText('Active platform: Google')).not.toBeInTheDocument();
  });

  it('supports a direct return to the connect step and focuses the requested platform', async () => {
    searchParamGetMock.mockImplementation((param: string) => {
      if (param === 'view') return 'connect';
      if (param === 'platform') return 'mailchimp';
      return null;
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [],
            branding: {},
            platforms: [
              {
                platformGroup: 'google',
                products: [{ product: 'google_ads', accessLevel: 'admin' }],
              },
              {
                platformGroup: 'mailchimp',
                products: [{ product: 'mailchimp', accessLevel: 'admin' }],
              },
            ],
            manualInviteTargets: { google: {}, mailchimp: { agencyEmail: 'ops@demoagency.com' } },
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      }))
    );

    render(<InvitePage />);

    await waitFor(() => {
      expect(screen.getByText('Active platform: Mailchimp')).toBeInTheDocument();
      expect(screen.getByText('Completion action: Continue to Google')).toBeInTheDocument();
    });
  });

  it('restores the returning oauth platform as the active stage', async () => {
    searchParamGetMock.mockImplementation((key: string) => {
      if (key === 'step') return '2';
      if (key === 'platform') return 'meta';
      if (key === 'connectionId') return 'conn-meta-1';
      return null;
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [],
            branding: {},
            platforms: [
              {
                platformGroup: 'google',
                products: [{ product: 'google_ads', accessLevel: 'admin' }],
              },
              {
                platformGroup: 'meta',
                products: [{ product: 'meta_ads', accessLevel: 'admin' }],
              },
            ],
            manualInviteTargets: { google: {}, meta: {} },
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      }))
    );

    render(<InvitePage />);

    await waitFor(() => {
      expect(screen.getByText('Active platform: Meta')).toBeInTheDocument();
      expect(screen.getByText('Initial connection: conn-meta-1')).toBeInTheDocument();
      expect(screen.getByText('Initial step: 2')).toBeInTheDocument();
      expect(screen.queryAllByRole('button', { name: /complete platform/i })).toHaveLength(1);
    });

    expect(screen.queryByText('Active platform: Google')).not.toBeInTheDocument();
  });

  it('submits completion without JSON content-type header', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/client/token-123/complete')) {
        return {
          ok: true,
          json: async () => ({ data: { success: true }, error: null }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [],
            branding: {},
            platforms: [
              {
                platformGroup: 'google',
                products: [{ product: 'google_ads', accessLevel: 'admin' }],
              },
            ],
            manualInviteTargets: { google: {} },
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      } as Response;
    });

    stubFetch( fetchMock);

    render(<InvitePage />);

    const continueButton = await screen.findByRole('button', { name: /continue to connect/i });
    await userEvent.click(continueButton);

    const completeButton = await screen.findByRole('button', { name: /complete platform/i });
    await userEvent.click(completeButton);

    await waitFor(() => {
      const completionCall = fetchMock.mock.calls.find(([url]) =>
        String(url).includes('/api/client/token-123/complete')
      );
      expect(completionCall?.[1]).toEqual({
        method: 'POST',
        signal: expect.any(AbortSignal),
      });
    });
  });

  it('keeps a manual Beehiiv report pending until the agency verifies it', async () => {
    searchParamGetMock.mockImplementation((key: string) => {
      if (key === 'step') return '2';
      if (key === 'platform') return 'beehiiv';
      if (key === 'connectionId') return 'conn-beehiiv-1';
      return null;
    });

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/client/token-123/complete')) {
        return {
          ok: true,
          json: async () => ({ data: { success: true }, error: null }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [],
            branding: {},
            platforms: [
              {
                platformGroup: 'beehiiv',
                products: [{ product: 'beehiiv', accessLevel: 'admin' }],
              },
            ],
            manualInviteTargets: { beehiiv: { agencyEmail: 'ops@demoagency.com' } },
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      } as Response;
    });

    stubFetch( fetchMock);

    render(<InvitePage />);

    await screen.findByText('Active platform: Beehiiv');
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/complete'))).toHaveLength(0);
    expect(screen.getByRole('button', { name: /complete platform/i })).toBeInTheDocument();
  });

  it('keeps a manual Shopify report pending until the agency verifies it', async () => {
    searchParamGetMock.mockImplementation((key: string) => {
      if (key === 'step') return '2';
      if (key === 'platform') return 'shopify';
      if (key === 'connectionId') return 'conn-shopify-1';
      return null;
    });

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/client/token-123/complete')) {
        return {
          ok: true,
          json: async () => ({ data: { success: true }, error: null }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [],
            branding: {},
            platforms: [
              {
                platformGroup: 'shopify',
                products: [{ product: 'shopify', accessLevel: 'admin' }],
              },
            ],
            manualInviteTargets: {
              shopify: { shopDomain: 'store-demo.myshopify.com', collaboratorCode: '1234' },
            },
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      } as Response;
    });

    stubFetch( fetchMock);

    render(<InvitePage />);

    await screen.findByText('Active platform: Shopify');
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/complete'))).toHaveLength(0);
    expect(screen.getByRole('button', { name: /complete platform/i })).toBeInTheDocument();
  });

  it('keeps a manual Mailchimp report pending until the agency verifies it', async () => {
    searchParamGetMock.mockImplementation((key: string) => {
      if (key === 'step') return '2';
      if (key === 'platform') return 'mailchimp';
      if (key === 'connectionId') return 'conn-mailchimp-1';
      return null;
    });

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/client/token-123/complete')) {
        return {
          ok: true,
          json: async () => ({ data: { success: true }, error: null }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [],
            branding: {},
            platforms: [
              {
                platformGroup: 'mailchimp',
                products: [{ product: 'mailchimp', accessLevel: 'admin' }],
              },
            ],
            manualInviteTargets: {
              mailchimp: { agencyEmail: 'ops@demoagency.com' },
            },
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      } as Response;
    });

    stubFetch( fetchMock);

    render(<InvitePage />);

    await screen.findByText('Active platform: Mailchimp');
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/complete'))).toHaveLength(0);
    expect(screen.getByRole('button', { name: /complete platform/i })).toBeInTheDocument();
  });

  it('does not skip a manually reported platform in the queue', async () => {
    searchParamGetMock.mockImplementation((key: string) => {
      if (key === 'step') return '2';
      if (key === 'platform') return 'mailchimp';
      if (key === 'connectionId') return 'conn-mailchimp-1';
      return null;
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          id: 'request-1',
          agencyId: 'agency-1',
          agencyName: 'Demo Agency',
          clientName: 'Client',
          clientEmail: 'client@test.com',
          status: 'pending',
          uniqueToken: 'token-123',
          expiresAt: new Date().toISOString(),
          intakeFields: [],
          branding: {},
          platforms: [
            { platformGroup: 'google', products: [{ product: 'google_ads', accessLevel: 'admin' }] },
            { platformGroup: 'mailchimp', products: [{ product: 'mailchimp', accessLevel: 'admin' }] },
          ],
          manualInviteTargets: { google: {}, mailchimp: { agencyEmail: 'ops@demoagency.com' } },
          authorizationProgress: { completedPlatforms: [], isComplete: false },
        },
        error: null,
      }),
    }));

    vi.stubGlobal(
      'fetch',
      fetchMock
    );

    render(<InvitePage />);

    await waitFor(() => {
      expect(screen.getByText('Active platform: Mailchimp')).toBeInTheDocument();
      expect(screen.getByText('Completion action: Continue to Google')).toBeInTheDocument();
      expect(screen.queryAllByRole('button', { name: /complete platform/i })).toHaveLength(1);
    });

    expect(screen.queryByText('Active platform: Google')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/complete'))).toHaveLength(0);
  });

  it('advances to Zapier while a reported Beehiiv invite awaits agency verification', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1', agencyId: 'agency-1', agencyName: 'Demo Agency', clientName: 'Client',
            clientEmail: 'client@test.com', status: 'pending', uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(), intakeFields: [], branding: {},
            platforms: [
              { platformGroup: 'beehiiv', products: [{ product: 'beehiiv', accessLevel: 'admin' }] },
              { platformGroup: 'zapier', products: [{ product: 'zapier', accessLevel: 'admin' }] },
            ],
            manualInviteTargets: { beehiiv: { agencyEmail: 'ops@demoagency.com' }, zapier: {} },
            authorizationProgress: {
              completedPlatforms: [],
              isComplete: false,
              unresolvedProducts: [{ product: 'beehiiv', platformGroup: 'beehiiv', reason: 'pending' }],
            },
          },
          error: null,
        }),
      }))
    );

    render(<InvitePage />);

    await screen.findByText('Active platform: Zapier');
    expect(screen.getByText(/Beehiiv access request was recorded/i)).toBeInTheDocument();
    expect(screen.queryByText('Active platform: Beehiiv')).not.toBeInTheDocument();
  });

  it('shows a verification state when every remaining platform is waiting', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1', agencyId: 'agency-1', agencyName: 'Demo Agency', clientName: 'Client',
            clientEmail: 'client@test.com', status: 'pending', uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(), intakeFields: [], branding: {},
            platforms: [{ platformGroup: 'beehiiv', products: [{ product: 'beehiiv', accessLevel: 'admin' }] }],
            manualInviteTargets: { beehiiv: { agencyEmail: 'ops@demoagency.com' } },
            authorizationProgress: {
              completedPlatforms: [],
              isComplete: false,
              unresolvedProducts: [{ product: 'beehiiv', platformGroup: 'beehiiv', reason: 'pending' }],
            },
          },
          error: null,
        }),
      }))
    );

    render(<InvitePage />);

    expect(await screen.findByRole('heading', { name: 'Access verification is in progress' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Awaiting agency verification', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/agency is verifying the reported access/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /complete platform/i })).not.toBeInTheDocument();
  });

  describe('Named-platform progress checklist', () => {
    it('shows the truthful checklist as the only progress surface for a fresh request', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [],
            branding: {},
            platforms: [
              {
                platformGroup: 'google',
                products: [{ product: 'google_ads', accessLevel: 'admin' }],
              },
            ],
            manualInviteTargets: {},
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      }));

      stubFetch( fetchMock);

      render(<InvitePage />);

      await waitFor(() => {
        expect(screen.getByText('Your progress')).toBeInTheDocument();
        expect(screen.getByText('Connect Google to continue.')).toBeInTheDocument();
        expect(screen.queryByText(/step \d+ of \d+/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/%/)).not.toBeInTheDocument();
      });
    });

    it('lists the requested platform on the checklist and in the request summary', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            id: 'request-1',
            agencyId: 'agency-1',
            agencyName: 'Demo Agency',
            clientName: 'Client',
            clientEmail: 'client@test.com',
            status: 'pending',
            uniqueToken: 'token-123',
            expiresAt: new Date().toISOString(),
            intakeFields: [],
            branding: {
              logoUrl: 'https://cdn.example.com/demo-agency.svg',
            },
            platforms: [{ platformGroup: 'google', products: [{ product: 'google_ads', accessLevel: 'admin' }] }],
            manualInviteTargets: {},
            authorizationProgress: { completedPlatforms: [], isComplete: false },
          },
          error: null,
        }),
      }));

      stubFetch( fetchMock);

      render(<InvitePage />);

      await waitFor(() => {
        expect(screen.getByText('Your progress')).toBeInTheDocument();
        expect(screen.getByText('Connect Google to continue.')).toBeInTheDocument();
        expect(screen.queryByText(/step \d+ of \d+/i)).not.toBeInTheDocument();
        expect(screen.getByText(/confirm which accounts to share below/i)).toBeInTheDocument();
        expect(screen.getByText(/needs access to finish setup/i)).toBeInTheDocument();
        expect(screen.getAllByText('Google').length).toBeGreaterThan(0);
        expect(screen.getByText('Google Ads · Admin Access')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /demo agency logo/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /continue to connect/i })).toBeInTheDocument();
      });
    });
  });

  describe('Mid-flow resume and terminal landing (U7)', () => {
    const metaFulfillmentRows = [
      {
        id: 'row-1',
        assetKind: 'ad_account',
        assetId: 'act_111',
        assetName: 'Acme Ads',
        recipientType: 'system_user',
        recipientId: 'recipient-1',
        recipientName: 'Agency System User',
        requestedTasks: [],
        verifiedTasks: [],
        status: 'selected',
        updatedAt: '2026-09-26T00:00:00.000Z',
      },
      {
        id: 'row-2',
        assetKind: 'page',
        assetId: 'pg_1',
        assetName: 'Acme Page',
        recipientType: 'system_user',
        recipientId: 'recipient-1',
        recipientName: 'Agency System User',
        requestedTasks: [],
        verifiedTasks: [],
        status: 'sharing_attempted',
        updatedAt: '2026-09-26T00:00:00.000Z',
      },
      {
        id: 'row-3',
        assetKind: 'ad_account',
        assetId: 'act_222',
        assetName: 'Excluded Ads',
        recipientType: 'system_user',
        recipientId: 'recipient-1',
        recipientName: 'Agency System User',
        requestedTasks: [],
        verifiedTasks: [],
        status: 'excluded',
        updatedAt: '2026-09-26T00:00:00.000Z',
      },
    ];

    const okPayload = (overrides: Record<string, unknown> = {}) => ({
      ok: true,
      json: async () => ({
        data: {
          id: 'request-1',
          agencyId: 'agency-1',
          agencyName: 'Demo Agency',
          clientName: 'Client',
          clientEmail: 'client@test.com',
          status: 'pending',
          uniqueToken: 'token-123',
          expiresAt: new Date().toISOString(),
          intakeFields: [],
          branding: {},
          platforms: [{ platformGroup: 'meta', products: [{ product: 'meta_ads', accessLevel: 'admin' }] }],
          manualInviteTargets: {},
          authorizationProgress: { completedPlatforms: [], isComplete: false },
          ...overrides,
        },
        error: null,
      }),
    });

    const setOauthReturnParams = (platform = 'meta', connectionId = 'conn-meta-1') => {
      searchParamGetMock.mockImplementation((key: string) => {
        if (key === 'step') return '2';
        if (key === 'platform') return platform;
        if (key === 'connectionId') return connectionId;
        return null;
      });
    };

    it('refreshes post-OAuth pre-save into the share step with the prior connection intact', async () => {
      setOauthReturnParams();

      vi.stubGlobal('fetch', vi.fn(async () => okPayload({
        authorizationProgress: {
          completedPlatforms: [],
          isComplete: false,
          unresolvedProducts: [
            { product: 'meta_ads', platformGroup: 'meta', reason: 'selection_required' },
          ],
        },
      }) as unknown));

      render(<InvitePage />);

      await waitFor(() => {
        expect(screen.getByText('Active platform: Meta')).toBeInTheDocument();
        expect(screen.getByText('Initial connection: conn-meta-1')).toBeInTheDocument();
        expect(screen.getByText('Initial step: 2')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /continue to connect/i })).not.toBeInTheDocument();
    });

    it('refreshes post-save mid-sharing with Meta selections prefilled from server fulfillment', async () => {
      setOauthReturnParams();

      vi.stubGlobal('fetch', vi.fn(async () => okPayload({
        metaFulfillment: metaFulfillmentRows,
        authorizationProgress: {
          completedPlatforms: [],
          isComplete: false,
          unresolvedProducts: [
            { product: 'meta_ads', platformGroup: 'meta', reason: 'sharing_required' },
          ],
        },
      }) as unknown));

      render(<InvitePage />);

      await waitFor(() => {
        expect(screen.getByText('Active platform: Meta')).toBeInTheDocument();
        expect(screen.getByText('Initial connection: conn-meta-1')).toBeInTheDocument();
        // The saved selection is confirmed, so the return lands on the
        // step-3 grant checklist instead of asset selection.
        expect(screen.getByText('Initial step: 3')).toBeInTheDocument();
        expect(screen.getByText('Meta prefill: act_111')).toBeInTheDocument();
      });

      expect(screen.queryByText(/act_222/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /continue to connect/i })).not.toBeInTheDocument();
    });

    it('lands a fresh visit with nothing done on the intake phase', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => okPayload() as unknown));

      render(<InvitePage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue to connect/i })).toBeInTheDocument();
      });

      expect(screen.queryByText(/Active platform:/)).not.toBeInTheDocument();
    });

    it('lands a revisited completed request on the done screen', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => okPayload({ status: 'completed' }) as unknown));

      render(<InvitePage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /all set — you're done/i })).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /continue to connect/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });

    it('resumes a non-Meta asset selection without prefill', async () => {
      setOauthReturnParams('google', 'conn-google-1');

      vi.stubGlobal('fetch', vi.fn(async () => okPayload({
        platforms: [{ platformGroup: 'google', products: [{ product: 'google_ads', accessLevel: 'admin' }] }],
        metaFulfillment: metaFulfillmentRows,
        authorizationProgress: {
          completedPlatforms: [],
          isComplete: false,
          unresolvedProducts: [
            { product: 'google_ads', platformGroup: 'google', reason: 'selection_required' },
          ],
        },
      }) as unknown));

      render(<InvitePage />);

      await waitFor(() => {
        expect(screen.getByText('Active platform: Google')).toBeInTheDocument();
        expect(screen.getByText('Initial connection: conn-google-1')).toBeInTheDocument();
        expect(screen.getByText('Initial step: 2')).toBeInTheDocument();
      });

      expect(screen.queryByText(/Meta prefill:/)).not.toBeInTheDocument();
    });

    it('renders the terminal card for an expired request with no retry affordance', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: false,
          json: async () => ({ data: null, error: { code: 'REQUEST_EXPIRED', message: 'Access request has expired' } }),
        }))
      );

      render(<InvitePage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /this link has expired/i })).toBeInTheDocument();
        expect(screen.getAllByText(/contact your agency/i).length).toBeGreaterThan(0);
      });

      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /check again/i })).not.toBeInTheDocument();
    });

    it('renders the terminal card for a revoked request with no retry affordance', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: false,
          json: async () => ({ data: null, error: { code: 'REQUEST_REVOKED', message: 'Access request has been revoked' } }),
        }))
      );

      render(<InvitePage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /this request was revoked/i })).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /check again/i })).not.toBeInTheDocument();
    });

    it('surfaces the terminal card when a mid-flow intake save hits an expired request', async () => {
      const intakeExpiredMock = vi.fn(async (url: string) => {
        if (url.includes('/api/client/token-123/intake')) {
          return {
            ok: false,
            json: async () => ({
              data: null,
              error: { code: 'REQUEST_EXPIRED', message: 'Access request has expired' },
            }),
          } as Response;
        }
        return okPayload({
          intakeFields: [{ id: 'company', label: 'Company name', type: 'text', required: true }],
        }) as unknown as Response;
      });
      stubFetch(intakeExpiredMock);

      render(<InvitePage />);

      const company = await screen.findByRole('textbox');
      await userEvent.type(company, 'Acme');
      await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /this link has expired/i })).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^continue$/i })).not.toBeInTheDocument();
    });

    it('surfaces the terminal card when finalization hits an expired request', async () => {
      const fetchMock = vi.fn(async (url: string) => {
        if (url.includes('/api/client/token-123/complete')) {
          return {
            ok: false,
            json: async () => ({
              data: null,
              error: { code: 'REQUEST_EXPIRED', message: 'Access request has expired' },
            }),
          } as Response;
        }
        return okPayload() as unknown as Response;
      });
      stubFetch(fetchMock);

      render(<InvitePage />);

      await userEvent.click(await screen.findByRole('button', { name: /continue to connect/i }));
      await userEvent.click(await screen.findByRole('button', { name: /complete platform/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /this link has expired/i })).toBeInTheDocument();
      });

      expect(screen.queryByRole('heading', { name: /access needs follow-up/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /check again/i })).not.toBeInTheDocument();
    });

    it('surfaces the terminal card when check-again reports the request expired', async () => {
      let callCount = 0;
      const fetchMock = vi.fn(async (url: string) => {
        callCount += 1;
        if (callCount > 1) {
          return {
            ok: false,
            json: async () => ({
              data: null,
              error: { code: 'REQUEST_EXPIRED', message: 'Access request has expired' },
            }),
          } as Response;
        }
        return okPayload() as unknown as Response;
      });
      stubFetch(fetchMock);

      render(<InvitePage />);

      await screen.findByRole('button', { name: /continue to connect/i });
      fireEvent.click(screen.getByRole('button', { name: /check again/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /this link has expired/i })).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /check again/i })).not.toBeInTheDocument();
      expect(screen.queryByText("We couldn't check just now. Try again.")).not.toBeInTheDocument();
    });
  });

  describe('Meta grant checklist resume (Phase 3)', () => {
    const metaResumeRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'row-1',
      assetKind: 'ad_account',
      assetId: 'act_111',
      assetName: 'Acme Ads',
      recipientType: 'system_user',
      recipientId: 'recipient-1',
      recipientName: 'Agency System User',
      requestedTasks: [],
      verifiedTasks: [],
      status: 'selected',
      updatedAt: '2026-09-26T00:00:00.000Z',
      ...overrides,
    });

    // Server truth for a confirmed selection with pending grants: reason
    // `selected` reads as action-needed, so the queue keeps Meta active.
    const metaResumePayload = (overrides: Record<string, unknown> = {}) => ({
      ok: true,
      json: async () => ({
        data: {
          id: 'request-1',
          agencyId: 'agency-1',
          agencyName: 'Demo Agency',
          clientName: 'Client',
          clientEmail: 'client@test.com',
          status: 'pending',
          uniqueToken: 'token-123',
          expiresAt: new Date().toISOString(),
          intakeFields: [],
          branding: {},
          platforms: [
            { platformGroup: 'meta', products: [{ product: 'meta_ads', accessLevel: 'admin' }] },
          ],
          manualInviteTargets: {},
          connections: [{ id: 'conn-meta-1', platformGroup: 'meta' }],
          metaFulfillment: [metaResumeRow()],
          authorizationProgress: {
            completedPlatforms: [],
            isComplete: false,
            unresolvedProducts: [
              { product: 'meta_ads', platformGroup: 'meta', reason: 'selected' },
            ],
          },
          ...overrides,
        },
        error: null,
      }),
    });

    const fulfillmentIncomplete = () => ({
      ok: false,
      json: async () => ({
        error: {
          code: 'FULFILLMENT_INCOMPLETE',
          message: 'Some Meta grants are still pending',
        },
      }),
    });

    // Rows in the payload mean a prior confirmed selection, so the revisit
    // lands straight on the step-3 checklist — no intake, no share step.
    const renderThroughCompletionError = async (
      loadPayload: ReturnType<typeof metaResumePayload>
    ) => {
      const fetchMock = vi.fn(async (url: string) => {
        if (String(url).includes('/api/client/token-123/complete')) {
          return fulfillmentIncomplete() as unknown as Response;
        }
        return loadPayload as unknown as Response;
      });
      stubFetch(fetchMock);

      render(<InvitePage />);

      await waitFor(() => {
        expect(screen.getByText('Active platform: Meta')).toBeInTheDocument();
        expect(screen.getByText('Initial step: 3')).toBeInTheDocument();
      });

      await userEvent.click(await screen.findByRole('button', { name: /complete platform/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /access needs follow-up/i })).toBeInTheDocument();
      });
      return fetchMock;
    };

    it('offers a way back to the checklist from the completion follow-up card', async () => {
      let completeCalls = 0;
      const fetchMock = vi.fn(async (url: string) => {
        if (String(url).includes('/api/client/token-123/complete')) {
          completeCalls += 1;
          return fulfillmentIncomplete() as unknown as Response;
        }
        return metaResumePayload() as unknown as Response;
      });
      stubFetch(fetchMock);

      render(<InvitePage />);

      // A revisit with a confirmed selection resumes at the checklist itself.
      await waitFor(() => {
        expect(screen.getByText('Active platform: Meta')).toBeInTheDocument();
        expect(screen.getByText('Initial step: 3')).toBeInTheDocument();
      });

      await userEvent.click(await screen.findByRole('button', { name: /complete platform/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /access needs follow-up/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /resume meta checklist/i })).toBeInTheDocument();
      });
      expect(completeCalls).toBe(1);

      expect(inviteEvents.trackClientChecklistResumed).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: /resume meta checklist/i }));

      await waitFor(() => {
        expect(screen.getByText('Active platform: Meta')).toBeInTheDocument();
        expect(screen.getByText('Initial step: 3')).toBeInTheDocument();
      });
      expect(inviteEvents.trackClientChecklistResumed).toHaveBeenCalledTimes(1);

      // The auto-finalize effect must not re-fire from the resumed phase.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(completeCalls).toBe(1);
      expect(screen.queryByRole('heading', { name: /access needs follow-up/i })).not.toBeInTheDocument();
    });

    it('hides the resume button once every fulfillment row is verified', async () => {
      await renderThroughCompletionError(
        metaResumePayload({ metaFulfillment: [metaResumeRow({ status: 'verified' })] })
      );

      expect(screen.queryByRole('button', { name: /resume meta checklist/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /check again/i })).toBeInTheDocument();
    });

    it('hides the resume button when the request carries no Meta connection', async () => {
      await renderThroughCompletionError(metaResumePayload({ connections: undefined }));

      expect(screen.queryByRole('button', { name: /resume meta checklist/i })).not.toBeInTheDocument();
    });

    it('refreshes progress before re-posting completion from the follow-up card', async () => {
      const calls: string[] = [];
      let completeCalls = 0;
      const fetchMock = vi.fn(async (url: string) => {
        if (String(url).includes('/api/client/token-123/complete')) {
          completeCalls += 1;
          calls.push(`complete-${completeCalls}`);
          if (completeCalls === 1) {
            return fulfillmentIncomplete() as unknown as Response;
          }
          return {
            ok: true,
            json: async () => ({ data: { success: true }, error: null }),
          } as Response;
        }
        calls.push('refresh');
        return metaResumePayload() as unknown as Response;
      });
      stubFetch(fetchMock);

      render(<InvitePage />);

      await waitFor(() => {
        expect(screen.getByText('Active platform: Meta')).toBeInTheDocument();
        expect(screen.getByText('Initial step: 3')).toBeInTheDocument();
      });

      await userEvent.click(await screen.findByRole('button', { name: /complete platform/i }));

      await screen.findByRole('button', { name: /check again/i });

      await userEvent.click(screen.getByRole('button', { name: /check again/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /all set — you're done/i })).toBeInTheDocument();
      });

      // The follow-up card's check-again must refetch server truth BEFORE the
      // re-POST so the fulfillment card renders fresh rows.
      expect(calls).toEqual(['refresh', 'complete-1', 'refresh', 'complete-2']);
    });
  });
});
