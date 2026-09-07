import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AccessRequestDetailPage from '../page';
import * as accessRequestsApi from '@/lib/api/access-requests';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('token-123'),
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
}));

vi.mock('@/lib/analytics/invite-events', () => ({
  trackInviteLinkCopyAndSent: vi.fn(),
  trackInviteReminderSent: vi.fn(),
  buildInviteReminderMailto: vi.fn(() => 'mailto:client@acme.com'),
}));

import * as inviteEvents from '@/lib/analytics/invite-events';

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
        createdAt: '2026-03-01T00:00:00.000Z',
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

  it('fires invite reminder analytics when Send Reminder is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientName: 'Acme Client',
        clientEmail: 'owner@acme.com',
        status: 'pending',
        uniqueToken: 'token-123',
        expiresAt: '2026-03-14T00:00:00.000Z',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
        platforms: [],
      } as any,
    });

    renderWithProviders(<AccessRequestDetailPage params={Promise.resolve({ id: 'request-1' })} />);
    await screen.findByText('Access Request Details');

    await user.click(screen.getByRole('button', { name: /send reminder/i }));

    expect(inviteEvents.trackInviteReminderSent).toHaveBeenCalledWith({
      access_request_id: 'request-1',
      access_request_token: 'token-123',
      status: 'pending',
      channel: 'copy',
      surface: 'detail',
    });
    expect(inviteEvents.trackInviteLinkCopyAndSent).not.toHaveBeenCalled();
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
        createdAt: '2026-03-01T00:00:00.000Z',
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
        createdAt: '2026-03-01T00:00:00.000Z',
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

  it('renders recovery state when request load fails', async () => {
    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      error: {
        code: 'NOT_FOUND',
        message: 'Access request not found',
      },
    } as any);

    renderWithProviders(<AccessRequestDetailPage params={Promise.resolve({ id: 'missing' })} />);

    await waitFor(() => {
      expect(screen.getByText('Request Not Found')).toBeInTheDocument();
    });
    expect(screen.getByText('Access request not found')).toBeInTheDocument();
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
        createdAt: '2026-03-01T00:00:00.000Z',
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
        createdAt: '2026-03-01T00:00:00.000Z',
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
        createdAt: '2026-03-01T00:00:00.000Z',
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
