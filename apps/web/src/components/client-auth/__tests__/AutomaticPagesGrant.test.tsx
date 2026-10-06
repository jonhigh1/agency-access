import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AutomaticPagesGrant } from '../AutomaticPagesGrant';

const { captureMock } = vi.hoisted(() => ({ captureMock: vi.fn() }));

vi.mock('@/lib/analytics/capture-posthog', () => ({
  capturePosthogEvent: captureMock,
}));

describe('AutomaticPagesGrant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';
  });

  it('uses the verified Meta grant route in page-only mode', async () => {
    const onGrantComplete = vi.fn();

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            success: true,
            assetGrantResults: [
              {
                assetId: 'page_1',
                assetType: 'page',
                status: 'verified',
              },
            ],
          },
          error: null,
        }),
    } as Response);

    render(
      <AutomaticPagesGrant
        selectedPages={[{ id: 'page_1', name: 'Main Page' }]}
        connectionId="conn-1"
        accessRequestToken="token-1"
        onGrantComplete={onGrantComplete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /grant access/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/client/token-1/grant-meta-access',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            connectionId: 'conn-1',
            assetTypes: ['page'],
          }),
        })
      );
    });

    await waitFor(() => {
      expect(onGrantComplete).toHaveBeenCalledWith([
        {
          id: 'page_1',
          status: 'granted',
        },
      ]);
    });

    expect(captureMock).toHaveBeenCalledWith('client_meta_grant_started', {
      connection_id: 'conn-1',
      selected_page_count: 1,
    });
    expect(captureMock).toHaveBeenCalledWith('client_meta_grant_completed', {
      connection_id: 'conn-1',
      selected_page_count: 1,
      result_count: 1,
      verified_page_count: 1,
      failed_page_count: 0,
    });
  });

  it('requires every recipient grant for a Page before reporting success', async () => {
    const onGrantComplete = vi.fn();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        data: { assetGrantResults: [
          { assetId: 'page_1', assetType: 'page', status: 'verified' },
          { assetId: 'page_1', assetType: 'page', status: 'unresolved', errorMessage: 'Recipient is not assigned' },
        ] },
        error: null,
      }),
    } as Response);

    render(
      <AutomaticPagesGrant
        selectedPages={[{ id: 'page_1', name: 'Main Page' }]}
        connectionId="conn-1"
        accessRequestToken="token-1"
        onGrantComplete={onGrantComplete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /grant access/i }));

    await waitFor(() => {
      expect(onGrantComplete).toHaveBeenCalledWith([{
        id: 'page_1',
        status: 'failed',
        error: 'Recipient is not assigned',
      }]);
    });
    expect(screen.getByRole('button', { name: /grant access/i })).toBeEnabled();
  });

  it('fails every selected Page missing a verified result', async () => {
    const onGrantComplete = vi.fn();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ data: { assetGrantResults: [] }, error: null }),
    } as Response);

    render(
      <AutomaticPagesGrant
        selectedPages={[{ id: 'page_1', name: 'Main Page' }]}
        connectionId="conn-1"
        accessRequestToken="token-1"
        onGrantComplete={onGrantComplete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /grant access/i }));

    await waitFor(() => {
      expect(onGrantComplete).toHaveBeenCalledWith([{
        id: 'page_1',
        status: 'failed',
        error: 'No verified grant result returned',
      }]);
    });
    expect(captureMock).toHaveBeenCalledWith('client_meta_grant_failed', {
      connection_id: 'conn-1',
      selected_page_count: 1,
      result_count: 0,
      verified_page_count: 0,
      failed_page_count: 1,
      error_code: 'INCOMPLETE_RESULTS',
      failure_reason: 'missing_verified_result',
    });
    expect(captureMock).not.toHaveBeenCalledWith('client_meta_grant_completed', expect.anything());
  });

  it('shows Manual fallback copy when read-back fails for a Page', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            assetGrantResults: [
              {
                assetId: 'page_1',
                assetType: 'page',
                status: 'failed',
                errorMessage: 'Meta returned fewer tasks than this request requires',
              },
            ],
          },
          error: null,
        }),
    } as Response);

    render(
      <AutomaticPagesGrant
        selectedPages={[{ id: 'page_1', name: 'Main Page' }]}
        connectionId="conn-1"
        accessRequestToken="token-1"
        onGrantComplete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /grant access/i }));

    await waitFor(() => {
      expect(screen.getByText(/Add the agency as a Partner on these Pages/i)).toBeInTheDocument();
    });
  });

  it('fails an unreported selected Page when another Page verifies', async () => {
    const onGrantComplete = vi.fn();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        data: { assetGrantResults: [{ assetId: 'page_1', assetType: 'page', status: 'verified' }] },
        error: null,
      }),
    } as Response);

    render(
      <AutomaticPagesGrant
        selectedPages={[
          { id: 'page_1', name: 'Main Page' },
          { id: 'page_2', name: 'Second Page' },
        ]}
        connectionId="conn-1"
        accessRequestToken="token-1"
        onGrantComplete={onGrantComplete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /grant access/i }));

    await waitFor(() => {
      expect(onGrantComplete).toHaveBeenCalledWith([
        { id: 'page_1', status: 'granted' },
        { id: 'page_2', status: 'failed', error: 'No verified grant result returned' },
      ]);
    });
    expect(captureMock).toHaveBeenCalledWith('client_meta_grant_failed', {
      connection_id: 'conn-1',
      selected_page_count: 2,
      result_count: 1,
      verified_page_count: 1,
      failed_page_count: 1,
      error_code: 'INCOMPLETE_RESULTS',
      failure_reason: 'missing_verified_result',
    });
  });

  it('reports a stable API code when the grant endpoint rejects the request', async () => {
    const onGrantComplete = vi.fn();
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      statusText: 'Forbidden',
      text: async () => JSON.stringify({
        data: null,
        error: { code: 'REAUTHORIZATION_REQUIRED', message: 'Reconnect Meta with token-1' },
      }),
    } as Response);

    render(
      <AutomaticPagesGrant
        selectedPages={[{ id: 'page_1', name: 'Main Page' }]}
        connectionId="conn-1"
        accessRequestToken="token-1"
        onGrantComplete={onGrantComplete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /grant access/i }));

    await waitFor(() => {
      expect(captureMock).toHaveBeenCalledWith('client_meta_grant_failed', {
        connection_id: 'conn-1',
        selected_page_count: 1,
        result_count: 0,
        verified_page_count: 0,
        failed_page_count: 1,
        error_code: 'REAUTHORIZATION_REQUIRED',
        failure_reason: 'api_response',
      });
    });
    expect(onGrantComplete).not.toHaveBeenCalled();
    expect(JSON.stringify(captureMock.mock.calls)).not.toContain('token-1');
  });
});
