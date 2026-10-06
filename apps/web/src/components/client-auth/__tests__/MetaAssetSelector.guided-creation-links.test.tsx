import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MetaAssetSelector } from '../MetaAssetSelector';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn() },
}));

vi.mock('@/components/ui/multi-select-combobox', () => ({
  MultiSelectCombobox: ({ placeholder }: { placeholder: string }) => <div>{placeholder}</div>,
}));

vi.mock('../AssetGroup', () => ({
  AssetGroup: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('../AssetSelectorStates', () => ({
  AssetSelectorLoading: ({ message }: { message: string }) => <div>{message}</div>,
  AssetSelectorError: ({ title, message }: { title: string; message: string }) => (
    <div>
      <div>{title}</div>
      <div>{message}</div>
    </div>
  ),
}));

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    text: async () => JSON.stringify(body),
  } as Response;
}

function assetsResponse(overrides: Record<string, unknown> = {}): Response {
  return jsonResponse({
    data: {
      businesses: [{ id: 'biz-1', name: 'Client', verificationStatus: 'verified' }],
      selectionRequired: false,
      selectedBusinessId: 'biz-1',
      selectedBusinessName: 'Client',
      adAccounts: [],
      pages: [],
      instagramAccounts: [],
      pixels: [],
      ...overrides,
    },
    error: null,
  });
}

describe('MetaAssetSelector - guided Page and Pixel creation links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';
  });

  it('loads creation links and shows pixel deep-link guidance with check-back refresh', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(assetsResponse())
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            pageCreationUrl: 'https://business.facebook.com/pages/creation/?business_id=biz-1',
            pixelCreationUrl: 'https://business.facebook.com/events_manager2/pixel/new/?business_id=biz-1',
            adAccountCreationUrl: 'https://business.facebook.com/settings/biz-1/ad_accounts',
          },
          error: null,
        })
      )
      .mockResolvedValueOnce(
        assetsResponse({
          pixels: [{ id: 'pixel-1', name: 'Web Pixel' }],
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        allowedAssetTypes={['dataset']}
        onSelectionChange={() => {}}
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/api/client/token-1/create/meta/links?businessId=biz-1'
      );
    });

    fireEvent.click(await screen.findByRole('button', { name: /create pixel/i }));
    expect(await screen.findByText(/create a meta pixel/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open meta business manager/i }));

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /refresh list/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        'https://api.example.com/api/client/token-1/assets/meta_ads?connectionId=conn-1&businessId=biz-1'
      );
    });
  });
});
