import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetaAssetSelector } from '../MetaAssetSelector';

const { captureMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
}));

vi.mock('@/lib/analytics/capture-posthog', () => ({
  capturePosthogEvent: captureMock,
}));

describe('MetaAssetSelector interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';
  });

  it('reports selected Meta assets after a business is loaded and an asset is clicked', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              businesses: [
                { id: 'biz_client_1', name: 'DogTimez Holdings' },
                { id: 'biz_client_2', name: 'DogTimez Retail' },
              ],
              selectedBusinessId: null,
              selectedBusinessName: null,
              selectionRequired: true,
              adAccounts: [],
              pages: [],
              instagramAccounts: [],
            },
            error: null,
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              businesses: [
                { id: 'biz_client_1', name: 'DogTimez Holdings' },
                { id: 'biz_client_2', name: 'DogTimez Retail' },
              ],
              selectedBusinessId: 'biz_client_2',
              selectedBusinessName: 'DogTimez Retail',
              selectionRequired: false,
              adAccounts: [],
              pages: [
                {
                  id: 'page_1001',
                  name: 'DogTimez Facebook',
                  category: 'Brand',
                },
              ],
              instagramAccounts: [],
            },
            error: null,
          }),
      } as Response);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        onSelectionChange={onSelectionChange}
      />
    );

    await screen.findByText('Select Business Portfolio');

    await user.click(screen.getByRole('combobox', { name: 'Business Portfolio' }));
    await user.click(screen.getByRole('option', { name: /DogTimez Retail/ }));
    await user.click(screen.getByRole('button', { name: 'Load accounts' }));

    await screen.findByText('Sharing from DogTimez Retail');
    await user.click(screen.getByText('Select pages...', { exact: false }));
    await user.click(await screen.findByText('DogTimez Facebook'));

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalledWith(
        expect.objectContaining({
          pages: ['page_1001'],
          selectedBusinessId: 'biz_client_2',
          selectedBusinessName: 'DogTimez Retail',
          selectedPagesWithNames: [{ id: 'page_1001', name: 'DogTimez Facebook' }],
        })
      );
    });

    expect(captureMock).not.toHaveBeenCalled();
  });
});
