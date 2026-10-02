import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AccessRequestDetailPage from '../page';
import * as accessRequestsApi from '@/lib/api/access-requests';

const getTokenMock = vi.hoisted(() => vi.fn().mockResolvedValue('token-123'));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    getToken: getTokenMock,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/lib/api/access-requests', () => ({
  getAccessRequest: vi.fn(),
  getAuthorizationUrl: vi.fn((request: any) => `https://app.authhub.co/invite/${request.uniqueToken}`),
  cancelAccessRequest: vi.fn().mockResolvedValue({ data: { success: true } }),
  excludeMetaGrant: vi.fn().mockResolvedValue({ data: { id: 'grant-1', status: 'excluded' } }),
  sendAccessRequestReminder: vi.fn(),
}));

vi.mock('@/lib/invite-reminder', () => ({
  executeSendInviteReminder: vi.fn(),
}));

vi.mock('@/lib/analytics/invite-events', () => ({
  trackInviteLinkCopied: vi.fn(),
  trackInviteLinkCopyAndSent: vi.fn(),
  trackInviteReminderSent: vi.fn(),
  trackInviteSent: vi.fn(),
  buildInviteReminderMailto: vi.fn(() => 'mailto:client@acme.com?subject=reminder'),
  buildInviteSentMailto: vi.fn(() => 'mailto:client@acme.com?subject=invite'),
}));

vi.mock('@/lib/analytics/pending-nudge-events', () => ({
  trackPendingNudgeBannerShown: vi.fn(),
  trackPendingNudgeBannerCta: vi.fn(),
}));

import * as inviteEvents from '@/lib/analytics/invite-events';
import * as inviteReminder from '@/lib/invite-reminder';

describe('AccessRequestDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders editable actions for pending requests', async () => {
    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientName: 'Acme Client',
        clientEmail: 'owner@acme.com',
        status: 'pending',
        uniqueToken: 'token-123',
        expiresAt: '2026-03-14T00:00:00.000Z',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: '2026-03-01T00:00:00.000Z',
        platforms: [
          {
            platformGroup: 'google',
            products: [{ product: 'google_ads', accessLevel: 'admin', accounts: [] }],
          },
        ],
        intakeFields: [{ id: '1', label: 'Website', type: 'url', required: true, order: 0 }],
        branding: { primaryColor: '#FF6B35' },
      } as any,
    });

    renderWithProviders(<AccessRequestDetailPage params={Promise.resolve({ id: 'request-1' })} />);

    expect(await screen.findByText('Access Request Details')).toBeInTheDocument();
    expect(screen.getByText('Acme Client')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /edit request/i })).toHaveAttribute('href', '/access-requests/request-1/edit');
    expect(screen.getByRole('button', { name: /cancel request/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reminder/i })).toBeInTheDocument();
    expect(screen.getByText(/waiting on client authorization/i)).toBeInTheDocument();
  });

  it('offers retry for a service failure and returns to dashboard for a missing request', async () => {
    vi.mocked(accessRequestsApi.getAccessRequest)
      .mockResolvedValueOnce({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Unavailable' } } as any)
      .mockResolvedValueOnce({ error: { code: 'REQUEST_NOT_FOUND', message: 'Not found' } } as any);

    renderWithProviders(<AccessRequestDetailPage params={Promise.resolve({ id: 'request-1' })} />);
    expect(await screen.findByRole('heading', { name: 'Could Not Load Request' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Request Not Found' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('shows pending cliff banner for stale pending requests', async () => {
    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      data: {
        id: 'request-stale',
        agencyId: 'agency-1',
        clientName: 'Stale Client',
        clientEmail: 'stale@acme.com',
        status: 'pending',
        uniqueToken: 'token-stale',
        expiresAt: '2026-03-14T00:00:00.000Z',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
        platforms: [],
      } as any,
    });

    renderWithProviders(<AccessRequestDetailPage params={Promise.resolve({ id: 'request-stale' })} />);

    expect(await screen.findByText(/still pending after/i)).toBeInTheDocument();
    expect(screen.queryByText(/waiting on client authorization/i)).not.toBeInTheDocument();
  });

  it('shows reminder sent when Send Reminder API succeeds', async () => {
    const user = userEvent.setup();
    vi.mocked(inviteReminder.executeSendInviteReminder).mockResolvedValue({ outcome: 'sent' });

    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientName: 'Acme Client',
        clientEmail: 'owner@acme.com',
        status: 'pending',
        uniqueToken: 'token-123',
        expiresAt: '2026-03-14T00:00:00.000Z',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: '2026-03-01T00:00:00.000Z',
        platforms: [],
      } as any,
    });

    renderWithProviders(<AccessRequestDetailPage params={Promise.resolve({ id: 'request-1' })} />);
    await screen.findByText('Access Request Details');

    await user.click(screen.getAllByRole('button', { name: /send reminder/i })[0]);

    await waitFor(() => {
      expect(screen.getByText(/reminder sent to client/i)).toBeInTheDocument();
    });
    expect(inviteReminder.executeSendInviteReminder).toHaveBeenCalled();
    expect(inviteEvents.trackInviteLinkCopyAndSent).not.toHaveBeenCalled();
  });

  it('shows cooldown message when Send Reminder is rate limited', async () => {
    const user = userEvent.setup();
    vi.mocked(inviteReminder.executeSendInviteReminder).mockResolvedValue({
      outcome: 'cooldown',
      message: 'Reminder already sent recently. Try again after 2:00 PM.',
    });

    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientName: 'Acme Client',
        clientEmail: 'owner@acme.com',
        status: 'pending',
        uniqueToken: 'token-123',
        expiresAt: '2026-03-14T00:00:00.000Z',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: '2026-03-01T00:00:00.000Z',
        platforms: [],
      } as any,
    });

    renderWithProviders(<AccessRequestDetailPage params={Promise.resolve({ id: 'request-1' })} />);
    await screen.findByText('Access Request Details');

    await user.click(screen.getAllByRole('button', { name: /send reminder/i })[0]);

    await waitFor(() => {
      expect(screen.getByText(/try again after/i)).toBeInTheDocument();
    });
  });

  it('copies reminder link with copy channel when client email is missing', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeText);
    vi.mocked(inviteReminder.executeSendInviteReminder).mockImplementation(async (input) => {
      await input.copyReminderLink(input.authorizationUrl);
      return { outcome: 'copy_only' };
    });

    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      data: {
        id: 'request-no-email',
        agencyId: 'agency-1',
        clientName: 'No Email Client',
        clientEmail: '',
        status: 'pending',
        uniqueToken: 'token-no-email',
        expiresAt: '2026-03-14T00:00:00.000Z',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: '2026-03-01T00:00:00.000Z',
        platforms: [],
      } as any,
    });

    renderWithProviders(
      <AccessRequestDetailPage params={Promise.resolve({ id: 'request-no-email' })} />
    );
    await screen.findByText('Access Request Details');

    await user.click(screen.getByRole('button', { name: /copy reminder link/i }));

    expect(writeText).toHaveBeenCalledWith('https://app.authhub.co/invite/token-no-email');
    expect(inviteReminder.executeSendInviteReminder).toHaveBeenCalled();
  });

  it('fires invite copy/send analytics when Copy Link is clicked', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeText);

    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientName: 'Acme Client',
        clientEmail: 'owner@acme.com',
        status: 'pending',
        uniqueToken: 'token-123',
        expiresAt: '2026-03-14T00:00:00.000Z',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: '2026-03-01T00:00:00.000Z',
        platforms: [],
      } as any,
    });

    renderWithProviders(<AccessRequestDetailPage params={Promise.resolve({ id: 'request-1' })} />);
    await screen.findByText('Access Request Details');

    await user.click(screen.getByRole('button', { name: /^copy link$/i }));

    expect(writeText).toHaveBeenCalledWith('https://app.authhub.co/invite/token-123');
    expect(inviteEvents.trackInviteLinkCopyAndSent).toHaveBeenCalledWith({
      access_request_id: 'request-1',
      access_request_token: 'token-123',
      status: 'pending',
      surface: 'detail',
    });
    expect(inviteEvents.trackInviteReminderSent).not.toHaveBeenCalled();
  });

  it('does not show Send Reminder for completed requests', async () => {
    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      data: {
        id: 'request-2',
        agencyId: 'agency-1',
        clientName: 'Completed Client',
        clientEmail: 'done@acme.com',
        status: 'completed',
        uniqueToken: 'token-456',
        expiresAt: '2026-03-14T00:00:00.000Z',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: '2026-03-01T00:00:00.000Z',
        platforms: [],
        intakeFields: [],
        branding: { primaryColor: '#FF6B35' },
      } as any,
    });

    renderWithProviders(<AccessRequestDetailPage params={Promise.resolve({ id: 'request-2' })} />);

    await screen.findByText('Access Request Details');
    expect(screen.queryByRole('link', { name: /edit request/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel request/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create new request from this/i })).toBeInTheDocument();
  });

  it('shows per-recipient Meta results and lets the agency owner exclude one requirement', async () => {
    const user = userEvent.setup();
    const baseRequest = {
      id: 'request-meta',
      agencyId: 'agency-1',
      clientName: 'Meta Client',
      clientEmail: 'meta@client.com',
      status: 'partial' as const,
      uniqueToken: 'token-meta',
      expiresAt: '2026-10-01T00:00:00.000Z',
      createdAt: '2026-09-22T00:00:00.000Z',
      updatedAt: '2026-09-22T00:00:00.000Z',
      platforms: [{
        platformGroup: 'meta',
        products: [{ product: 'meta_pages', accessLevel: 'admin' as const, accounts: [] }],
      }],
    };
    vi.mocked(accessRequestsApi.getAccessRequest)
      .mockResolvedValueOnce({
        data: {
          ...baseRequest,
          metaFulfillment: [{
            id: 'grant-1',
            assetKind: 'page',
            assetId: 'page-1',
            assetName: 'Client Page',
            recipientType: 'human',
            recipientId: 'person-1',
            recipientName: 'Jon High',
            requestedTasks: ['MANAGE'],
            verifiedTasks: [],
            status: 'manual_action_required',
            nextActor: 'client_admin',
            nextAction: 'Share this Page in Meta Business Settings.',
            updatedAt: '2026-09-22T12:00:00.000Z',
          }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          ...baseRequest,
          status: 'completed',
          metaFulfillment: [{
            id: 'grant-1',
            assetKind: 'page',
            assetId: 'page-1',
            assetName: 'Client Page',
            recipientType: 'human',
            recipientId: 'person-1',
            recipientName: 'Jon High',
            requestedTasks: ['MANAGE'],
            verifiedTasks: [],
            status: 'excluded',
            updatedAt: '2026-09-22T12:01:00.000Z',
            exclusion: {
              reason: 'Client does not need this assignee.',
              actor: 'Agency owner',
              excludedAt: '2026-09-22T12:01:00.000Z',
            },
          }],
        },
      });

    renderWithProviders(<AccessRequestDetailPage params={Promise.resolve({ id: 'request-meta' })} />);

    expect(await screen.findByText('Meta Access Results')).toBeInTheDocument();
    expect(screen.getByText(/Human: Jon High/)).toBeInTheDocument();
    expect(screen.getByText(/Next: Share this Page/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Exclude requirement' }));
    await user.type(screen.getByLabelText('Reason'), 'Client does not need this assignee.');
    await user.click(screen.getByLabelText(/I confirm this requirement/));
    await user.click(screen.getByRole('button', { name: 'Confirm exclusion' }));

    await waitFor(() => expect(accessRequestsApi.excludeMetaGrant).toHaveBeenCalledWith(
      'request-meta',
      'grant-1',
      'Client does not need this assignee.',
      expect.any(Function)
    ));
    expect(await screen.findByText('Excluded')).toBeInTheDocument();
    expect(screen.getByText(/Agency owner: Client does not need this assignee/)).toBeInTheDocument();
  });

  it('renders recovery state when request load fails', async () => {
    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      error: {
        code: 'NOT_FOUND',
        message: 'Access request not found',
      },
    } as any);

    renderWithProviders(<AccessRequestDetailPage params={Promise.resolve({ id: 'missing' })} />);

    expect(await screen.findByRole('heading', { name: 'Request Not Found' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('renders Shopify submission details when client has submitted store info', async () => {
    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      data: {
        id: 'request-3',
        agencyId: 'agency-1',
        clientName: 'Shopify Client',
        clientEmail: 'ops@shopclient.com',
        status: 'partial',
        uniqueToken: 'token-789',
        expiresAt: '2026-03-14T00:00:00.000Z',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: '2026-03-01T00:00:00.000Z',
        platforms: [
          {
            platformGroup: 'shopify',
            products: [{ product: 'shopify', accessLevel: 'admin', accounts: [] }],
          },
        ],
        shopifySubmission: {
          status: 'submitted',
          shopDomain: 'littlestore.myshopify.com',
          collaboratorCode: '1234',
          submittedAt: '2026-03-03T00:00:00.000Z',
        },
      } as any,
    });

    renderWithProviders(<AccessRequestDetailPage params={Promise.resolve({ id: 'request-3' })} />);

    expect(await screen.findByText('Shopify Submission')).toBeInTheDocument();
    expect(screen.getByText('littlestore.myshopify.com')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
  });

  it('renders Shopify re-confirmation guidance for legacy unreadable submissions', async () => {
    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      data: {
        id: 'request-4',
        agencyId: 'agency-1',
        clientName: 'Legacy Shopify Client',
        clientEmail: 'owner@legacy.com',
        status: 'partial',
        uniqueToken: 'token-999',
        expiresAt: '2026-03-14T00:00:00.000Z',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: '2026-03-01T00:00:00.000Z',
        platforms: [
          {
            platformGroup: 'shopify',
            products: [{ product: 'shopify', accessLevel: 'admin', accounts: [] }],
          },
        ],
        shopifySubmission: {
          status: 'legacy_unreadable',
          shopDomain: 'legacy-store.myshopify.com',
        },
      } as any,
    });

    renderWithProviders(<AccessRequestDetailPage params={Promise.resolve({ id: 'request-4' })} />);

    expect(await screen.findByText('Client Re-confirmation Needed')).toBeInTheDocument();
    expect(screen.getByText('legacy-store.myshopify.com')).toBeInTheDocument();
  });

  it('renders pending Shopify submission state when client has not submitted details', async () => {
    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      data: {
        id: 'request-5',
        agencyId: 'agency-1',
        clientName: 'Pending Shopify Client',
        clientEmail: 'owner@pending.com',
        status: 'pending',
        uniqueToken: 'token-555',
        expiresAt: '2026-03-14T00:00:00.000Z',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: '2026-03-01T00:00:00.000Z',
        platforms: [
          {
            platformGroup: 'shopify',
            products: [{ product: 'shopify', accessLevel: 'admin', accounts: [] }],
          },
        ],
        shopifySubmission: {
          status: 'pending_client',
        },
      } as any,
    });

    renderWithProviders(<AccessRequestDetailPage params={Promise.resolve({ id: 'request-5' })} />);

    expect(await screen.findByText('Shopify Submission Pending')).toBeInTheDocument();
  });
});
