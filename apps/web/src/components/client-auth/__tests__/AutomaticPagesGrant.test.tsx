import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AutomaticPagesGrant } from '../AutomaticPagesGrant';

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
});
