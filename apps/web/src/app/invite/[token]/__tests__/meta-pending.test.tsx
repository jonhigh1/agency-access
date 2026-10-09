import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const { useUserAgencyMock } = vi.hoisted(() => ({
  useUserAgencyMock: vi.fn(() => ({ data: undefined, isFetched: true })),
}));

vi.mock('@/hooks/use-user-agency', () => ({
  useUserAgency: () => useUserAgencyMock(),
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
      initialMetaBusinessId,
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
          {initialMetaBusinessId ? <p>{`Meta business: ${initialMetaBusinessId}`}</p> : null}
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


const FLAG = 'NEXT_PUBLIC_META_PENDING_APPROVAL';
const originalFlag = process.env[FLAG];

function stubRequest(platforms: Array<{ platformGroup: string; products: Array<{ product: string; accessLevel: string }> }>) {
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
          platforms,
          manualInviteTargets: { google: {}, meta: {} },
          authorizationProgress: { completedPlatforms: [], isComplete: false },
        },
        error: null,
      }),
    }))
  );
}

const META_FIRST = [
  { platformGroup: 'meta', products: [{ product: 'meta_ads', accessLevel: 'admin' }] },
  { platformGroup: 'google', products: [{ product: 'google_ads', accessLevel: 'admin' }] },
];

describe('Invite page: Meta pending approval flag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserAgencyMock.mockReturnValue({ data: undefined, isFetched: true });
    searchParamGetMock.mockImplementation(() => null);
    sessionStorage.clear();
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

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[FLAG];
    else process.env[FLAG] = originalFlag;
  });

  it('flag on: other platforms run first, then Meta shows "Meta access coming soon" instead of the connect step', async () => {
    process.env[FLAG] = 'true';
    stubRequest(META_FIRST);

    render(<InvitePage />);
    await userEvent.click(await screen.findByRole('button', { name: /continue to connect/i }));

    await waitFor(() => {
      expect(screen.getByText('Active platform: Google')).toBeInTheDocument();
      expect(screen.getByText('Completion action: Continue to Meta')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('meta-coming-soon')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /complete platform/i }));

    await waitFor(() => {
      expect(screen.getByTestId('meta-coming-soon')).toHaveTextContent('Meta access coming soon');
    });
    // The Meta platform wizard (which starts Meta OAuth) never mounts.
    expect(screen.queryByText('Active platform: Meta')).not.toBeInTheDocument();
  });

  it('flag on: a Meta-only request shows the note and never mounts the Meta wizard', async () => {
    process.env[FLAG] = 'true';
    stubRequest([META_FIRST[0]]);

    render(<InvitePage />);
    await userEvent.click(await screen.findByRole('button', { name: /continue to connect/i }));

    await waitFor(() => {
      expect(screen.getByTestId('meta-coming-soon')).toHaveTextContent('Meta access coming soon');
    });
    expect(screen.queryByText('Active platform: Meta')).not.toBeInTheDocument();
  });

  it('flag off: Meta keeps its place and its connect step as today', async () => {
    delete process.env[FLAG];
    stubRequest(META_FIRST);

    render(<InvitePage />);
    await userEvent.click(await screen.findByRole('button', { name: /continue to connect/i }));

    await waitFor(() => {
      expect(screen.getByText('Active platform: Meta')).toBeInTheDocument();
      expect(screen.getByText('Completion action: Continue to Google')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('meta-coming-soon')).not.toBeInTheDocument();
    expect(screen.queryByText('Meta access coming soon')).not.toBeInTheDocument();
  });
});
