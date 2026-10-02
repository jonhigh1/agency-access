import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditAccessRequestPage from '../page';
import * as accessRequestsApi from '@/lib/api/access-requests';

const pushMock = vi.fn();
const getTokenMock = vi.fn().mockResolvedValue('token-123');
const routerMock = { push: pushMock };

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    getToken: getTokenMock,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}));

vi.mock('@/lib/api/access-requests', () => ({
  getAccessRequest: vi.fn(),
  updateAccessRequest: vi.fn(),
}));

vi.mock('@/components/access-request/MetaAssigneeSelector', () => ({
  MetaAssigneeSelector: ({ value, onChange }: { value: any; onChange: (value: any) => void }) => (
    <section aria-label="Meta access recipients">
      <button
        type="button"
        onClick={() => onChange({
          ...value,
          recipients: [{ type: 'human', id: 'person-1', name: 'Jon High' }],
        })}
      >
        Select Meta person
      </button>
    </section>
  ),
}));

describe('EditAccessRequestPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTokenMock.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ platform: 'google', status: 'active', agencyEmail: 'ops@agency.com' }],
        }),
      })
    );
  });

  it('renders request-configuration fields and client profile guidance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ platform: 'beehiiv', status: 'active', agencyEmail: 'ops@agency.com' }],
        }),
      })
    );

    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientId: 'client-1',
        clientName: 'Acme',
        clientEmail: 'owner@acme.com',
        status: 'pending',
        uniqueToken: 'token-1',
        expiresAt: '2026-03-14T00:00:00.000Z',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
        platforms: [],
        intakeFields: [{ id: '1', label: 'Website', type: 'url', required: true, order: 0 }],
        branding: { primaryColor: '#FF6B35' },
      } as any,
    });

    render(<EditAccessRequestPage params={Promise.resolve({ id: 'request-1' })} />);

    expect(await screen.findByText('Edit Access Request')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /show advanced settings/i }));
    expect(screen.getByText(/client name and email are managed in the client profile/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit client profile/i })).toBeInTheDocument();
    expect(await screen.findByText('Beehiiv')).toBeInTheDocument();
    expect(screen.queryByText('Meta')).not.toBeInTheDocument();
  });

  it('asks before discarding dirty edits from the Back control', async () => {
    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      data: {
        id: 'request-back', agencyId: 'agency-1', clientName: 'Acme', clientEmail: 'owner@acme.com',
        status: 'pending', uniqueToken: 'token', expiresAt: '2026-10-07T00:00:00Z',
        createdAt: '2026-09-30T00:00:00Z', updatedAt: '2026-09-30T00:00:00Z', platforms: [],
        intakeFields: [{ id: 'field-1', label: 'Website', type: 'url', required: true, order: 0 }],
        branding: { primaryColor: '#FF6B35' },
      } as any,
    });
    render(<EditAccessRequestPage params={Promise.resolve({ id: 'request-back' })} />);
    await screen.findByText('Edit Access Request');
    await userEvent.click(screen.getByRole('button', { name: /show advanced settings/i }));
    await userEvent.type(screen.getByLabelText('External Reference'), 'crm-1');
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('External Reference')).toHaveValue('crm-1');
    expect(pushMock).not.toHaveBeenCalledWith('/access-requests/request-back');
  });

  it('lets an agency repair an existing Meta request by selecting assignees', async () => {
    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      data: {
        id: 'legacy-meta-request',
        agencyId: 'agency-1',
        clientName: 'Acme',
        clientEmail: 'owner@acme.com',
        status: 'pending',
        uniqueToken: 'legacy-token',
        expiresAt: '2026-03-14T00:00:00.000Z',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
        platforms: [{
          platformGroup: 'meta',
          products: [{ product: 'meta_ads', accessLevel: 'manage', accounts: [] }],
        }],
      } as any,
    });
    vi.mocked(accessRequestsApi.updateAccessRequest).mockResolvedValue({
      data: { id: 'legacy-meta-request', authorizationLinkChanged: false } as any,
    });

    render(<EditAccessRequestPage params={Promise.resolve({ id: 'legacy-meta-request' })} />);

    await screen.findByRole('region', { name: 'Meta access recipients' });
    await userEvent.click(screen.getByRole('button', { name: 'Select Meta person' }));
    await userEvent.click(screen.getByTestId('edit-access-request-save'));

    await waitFor(() => expect(accessRequestsApi.updateAccessRequest).toHaveBeenCalledWith(
      'legacy-meta-request',
      expect.objectContaining({
        metaAccessConfig: expect.objectContaining({
          recipients: [{ type: 'human', id: 'person-1', name: 'Jon High' }],
        }),
      }),
      expect.any(Function)
    ));
  });

  it('redirects to detail page when request is non-editable', async () => {
    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      data: {
        id: 'request-2',
        agencyId: 'agency-1',
        clientName: 'Acme',
        clientEmail: 'owner@acme.com',
        status: 'completed',
        uniqueToken: 'token-2',
        expiresAt: '2026-03-14T00:00:00.000Z',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
        platforms: [],
        intakeFields: [],
        branding: { primaryColor: '#FF6B35' },
      } as any,
    });

    render(<EditAccessRequestPage params={Promise.resolve({ id: 'request-2' })} />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/access-requests/request-2');
    });
  });

  it('submits request configuration updates and shows success state', async () => {
    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      data: {
        id: 'request-3',
        agencyId: 'agency-1',
        clientName: 'Acme',
        clientEmail: 'owner@acme.com',
        externalReference: 'crm-initial',
        status: 'pending',
        uniqueToken: 'token-3',
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
    vi.mocked(accessRequestsApi.updateAccessRequest).mockResolvedValue({
      data: {
        id: 'request-3',
        agencyId: 'agency-1',
        clientName: 'Acme',
        clientEmail: 'owner@acme.com',
        externalReference: 'crm-updated',
        status: 'pending',
        uniqueToken: 'token-3',
        expiresAt: '2026-03-14T00:00:00.000Z',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-02T00:00:00.000Z',
        platforms: [
          {
            platformGroup: 'google',
            products: [{ product: 'google_ads', accessLevel: 'standard', accounts: [] }],
          },
        ],
        intakeFields: [{ id: '1', label: 'Business Website', type: 'url', required: true, order: 0 }],
        branding: { primaryColor: '#00AA55' },
        authorizationLinkChanged: false,
      } as any,
    });

    render(<EditAccessRequestPage params={Promise.resolve({ id: 'request-3' })} />);

    await screen.findByText('Edit Access Request');
    await userEvent.click(screen.getByRole('button', { name: /show advanced settings/i }));

    fireEvent.change(screen.getByLabelText('External Reference'), { target: { value: 'crm-updated' } });
    fireEvent.change(screen.getByDisplayValue('Website'), { target: { value: 'Business Website' } });
    fireEvent.change(screen.getByLabelText('Primary Color'), { target: { value: '#00AA55' } });
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(accessRequestsApi.updateAccessRequest).toHaveBeenCalledWith(
        'request-3',
        expect.objectContaining({
          externalReference: 'crm-updated',
          platforms: expect.any(Array),
          intakeFields: expect.arrayContaining([
            expect.objectContaining({ label: 'Business Website' }),
          ]),
          branding: expect.objectContaining({ primaryColor: '#00AA55' }),
        }),
        expect.any(Function)
      );
    });
    expect(screen.getByText(/request updated\./i)).toBeInTheDocument();
  });

  it('shows loading on Save immediately while update is pending', async () => {
    vi.mocked(accessRequestsApi.getAccessRequest).mockResolvedValue({
      data: {
        id: 'request-4',
        agencyId: 'agency-1',
        clientName: 'Acme',
        clientEmail: 'owner@acme.com',
        status: 'pending',
        uniqueToken: 'token-4',
        expiresAt: '2026-03-14T00:00:00.000Z',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
        platforms: [
          {
            platformGroup: 'google',
            products: [{ product: 'google_ads', accessLevel: 'admin', accounts: [] }],
          },
        ],
        intakeFields: [],
        branding: { primaryColor: '#FF6B35' },
      } as any,
    });

    let resolveSave!: (value: Awaited<ReturnType<typeof accessRequestsApi.updateAccessRequest>>) => void;
    vi.mocked(accessRequestsApi.updateAccessRequest).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        })
    );

    render(<EditAccessRequestPage params={Promise.resolve({ id: 'request-4' })} />);

    await screen.findByText('Edit Access Request');
    await userEvent.click(screen.getByTestId('edit-access-request-save'));

    const saveBtn = screen.getByTestId('edit-access-request-save');
    expect(saveBtn).toBeDisabled();
    expect(saveBtn).toHaveAttribute('aria-busy', 'true');

    resolveSave!({
      data: {
        id: 'request-4',
        agencyId: 'agency-1',
        clientName: 'Acme',
        clientEmail: 'owner@acme.com',
        status: 'pending',
        uniqueToken: 'token-4',
        expiresAt: '2026-03-14T00:00:00.000Z',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-02T00:00:00.000Z',
        platforms: [
          {
            platformGroup: 'google',
            products: [{ product: 'google_ads', accessLevel: 'admin', accounts: [] }],
          },
        ],
        intakeFields: [],
        branding: { primaryColor: '#FF6B35' },
        authorizationLinkChanged: false,
      } as any,
    });

    await waitFor(() => {
      expect(saveBtn).not.toBeDisabled();
    });
  });
});
