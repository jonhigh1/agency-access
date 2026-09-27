import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MetaAssetSelector } from '../MetaAssetSelector';

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  },
}));

vi.mock('@/components/ui/multi-select-combobox', () => ({
  MultiSelectCombobox: ({
    placeholder,
    selectedIds,
    onSelectionChange,
  }: {
    placeholder: string;
    selectedIds?: Set<string>;
    onSelectionChange?: (ids: Set<string>) => void;
  }) => (
    <div data-testid={placeholder} data-selected={[...(selectedIds || [])].join(',')}>
      {placeholder}
      {placeholder.includes('Pixels') ? (
        <>
          <button type="button" onClick={() => onSelectionChange?.(new Set(['pixel_old']))}>Select pixel</button>
          <button type="button" onClick={() => onSelectionChange?.(new Set())}>Clear pixels</button>
        </>
      ) : null}
    </div>
  ),
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
  AssetSelectorEmpty: () => <div>Empty</div>,
}));

vi.mock('../MetaAssetCreator', () => ({
  MetaAssetCreator: ({ onSuccess }: { onSuccess: (asset: { id: string; name: string }) => void }) => (
    <button type="button" onClick={() => onSuccess({ id: 'act_new', name: 'New Account' })}>
      Meta Asset Creator
    </button>
  ),
}));

vi.mock('../GuidedRedirectModal', () => ({
  GuidedRedirectCard: ({ onRefresh }: { onRefresh?: () => void }) => (
    <div>
      <div>Guided Redirect</div>
      {onRefresh ? <button type="button" onClick={onRefresh}>Verify access</button> : null}
    </div>
  ),
}));

describe('MetaAssetSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';
  });

  it('requires a business portfolio selection before loading Meta assets', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              businesses: [
                { id: 'biz_1', name: 'Client One' },
                { id: 'biz_2', name: 'Client Two' },
              ],
              selectionRequired: true,
              selectedBusinessId: null,
              selectedBusinessName: null,
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
                { id: 'biz_1', name: 'Client One' },
                { id: 'biz_2', name: 'Client Two' },
              ],
              selectionRequired: false,
              selectedBusinessId: 'biz_2',
              selectedBusinessName: 'Client Two',
              adAccounts: [{ id: 'act_1', name: 'DogTimez' }],
              pages: [{ id: 'page_1', name: 'Main Page' }],
              instagramAccounts: [],
            },
            error: null,
          }),
      } as Response);

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        onSelectionChange={() => {}}
      />
    );

    expect(await screen.findByText(/select business portfolio/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox', { name: /business portfolio/i }));
    fireEvent.click(screen.getByRole('option', { name: /Client Two/ }));
    fireEvent.click(screen.getByRole('button', { name: /load accounts/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'https://api.example.com/api/client/token-1/assets/meta_ads?connectionId=conn-1&businessId=biz_2'
      );
    });

    expect(await screen.findByText(/sharing from client two/i)).toBeInTheDocument();
    expect(screen.getByText('Select ad accounts...')).toBeInTheDocument();
  });

  it('preserves the selected business scope when refreshing assets and exposes a switch-business control', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              businesses: [
                { id: 'biz_1', name: 'Client One' },
                { id: 'biz_2', name: 'Client Two' },
              ],
              selectionRequired: false,
              selectedBusinessId: 'biz_2',
              selectedBusinessName: 'Client Two',
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
                { id: 'biz_1', name: 'Client One' },
                { id: 'biz_2', name: 'Client Two' },
              ],
              selectionRequired: false,
              selectedBusinessId: 'biz_2',
              selectedBusinessName: 'Client Two',
              adAccounts: [{ id: 'act_new', name: 'New Account' }],
              pages: [],
              instagramAccounts: [],
            },
            error: null,
          }),
      } as Response);

    vi.stubGlobal('fetch', fetchMock);
    const onSelectionChange = vi.fn();

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        businessId="biz_2"
        onSelectionChange={onSelectionChange}
      />
    );

    expect(await screen.findByText(/sharing from client two/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch business/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /create ad account/i }));
    fireEvent.click(screen.getByRole('button', { name: /meta asset creator/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'https://api.example.com/api/client/token-1/assets/meta_ads?connectionId=conn-1&businessId=biz_2'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /switch business/i }));
    expect(await screen.findByText(/select business portfolio/i)).toBeInTheDocument();
  });

  it('does not refresh or restore a catalog business after the user switches portfolios', async () => {
    const makeResponse = (data: unknown) => ({
      ok: true,
      text: async () => JSON.stringify({ data, error: null }),
    } as Response);
    let resolveCatalogCreation!: (response: Response) => void;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeResponse({
        businesses: [{ id: 'biz_1', name: 'Client One' }, { id: 'biz_2', name: 'Client Two' }],
        selectionRequired: false,
        selectedBusinessId: 'biz_2',
        selectedBusinessName: 'Client Two',
        adAccounts: [], pages: [], instagramAccounts: [], productCatalogs: [], pixels: [{ id: 'pixel_old', name: 'Old Pixel' }],
      }))
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveCatalogCreation = resolve; }))
      .mockResolvedValueOnce(makeResponse({
        businesses: [{ id: 'biz_1', name: 'Client One' }, { id: 'biz_2', name: 'Client Two' }],
        selectionRequired: false,
        selectedBusinessId: 'biz_1',
        selectedBusinessName: 'Client One',
        adAccounts: [], pages: [], instagramAccounts: [], productCatalogs: [], pixels: [],
      }));
    vi.stubGlobal('fetch', fetchMock);
    const onSelectionChange = vi.fn();

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        allowedAssetTypes={['catalog', 'dataset']}
        onSelectionChange={onSelectionChange}
      />
    );

    await screen.findByText(/sharing from client two/i);
    fireEvent.click(screen.getByRole('button', { name: 'Select pixel' }));
    expect(screen.getByTestId('Select Pixels and Datasets...')).toHaveAttribute('data-selected', 'pixel_old');
    fireEvent.click(screen.getByRole('button', { name: /^create catalog$/i }));
    fireEvent.change(screen.getByLabelText(/product catalog name/i), { target: { value: 'Client Catalog' } });
    fireEvent.click(screen.getByRole('button', { name: /^create catalog$/i }));
    fireEvent.click(screen.getByRole('button', { name: /switch business/i }));
    fireEvent.click(screen.getByRole('combobox', { name: /business portfolio/i }));
    fireEvent.click(screen.getByRole('option', { name: /client one/i }));
    fireEvent.click(screen.getByRole('button', { name: /load accounts/i }));
    await screen.findByText(/sharing from client one/i);
    expect(onSelectionChange.mock.lastCall?.[0].datasets).toEqual([]);

    resolveCatalogCreation(makeResponse({ id: 'catalog_new', name: 'Client Catalog' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(screen.getByText(/sharing from client one/i)).toBeInTheDocument();
  });

  it('ignores dataset verification that returns after the selection changes', async () => {
    const makeResponse = (data: unknown) => ({
      ok: true,
      text: async () => JSON.stringify({ data, error: null }),
    } as Response);
    let resolveVerification!: (response: Response) => void;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeResponse({
        businesses: [{ id: 'biz_1', name: 'Client One' }],
        selectionRequired: false,
        selectedBusinessId: 'biz_1',
        selectedBusinessName: 'Client One',
        adAccounts: [], pages: [], instagramAccounts: [], productCatalogs: [],
        pixels: [{ id: 'pixel_old', name: 'Old Pixel' }],
      }))
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveVerification = resolve; }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        allowedAssetTypes={['dataset']}
        onSelectionChange={vi.fn()}
      />
    );

    await screen.findByText(/sharing from client one/i);
    fireEvent.click(screen.getByRole('button', { name: 'Select pixel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Verify access' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'Clear pixels' }));
    await act(async () => resolveVerification(makeResponse({ status: 'verified' })));

    expect(screen.queryByText(/Meta confirmed access for every selected recipient/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
