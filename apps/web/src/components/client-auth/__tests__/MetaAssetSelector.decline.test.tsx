import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MetaAssetSelector } from '../MetaAssetSelector';

const { trackClientAssetsDeclineToggledMock } = vi.hoisted(() => ({
  trackClientAssetsDeclineToggledMock: vi.fn(),
}));

vi.mock('@/lib/analytics/invite-events', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/analytics/invite-events')>()),
  trackClientAssetsDeclineToggled: trackClientAssetsDeclineToggledMock,
}));

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
  }) => {
    const firstIdByPlaceholder: Record<string, string> = {
      'Select ad accounts...': 'act_1',
      'Select pages...': 'page_1',
      'Select product catalogs...': 'catalog_1',
      'Select Pixels and Datasets...': 'pixel_1',
    };
    return (
      <div data-testid={placeholder} data-selected={[...(selectedIds || [])].join(',')}>
        {placeholder}
        <button
          type="button"
          onClick={() => onSelectionChange?.(new Set([firstIdByPlaceholder[placeholder] || 'any_1']))}
        >
          Choose first {placeholder}
        </button>
        <button type="button" onClick={() => onSelectionChange?.(new Set())}>
          Clear {placeholder}
        </button>
      </div>
    );
  },
}));

vi.mock('../AssetGroup', () => ({
  AssetGroup: ({
    title,
    onSelectionChange,
  }: {
    title: string;
    onSelectionChange?: (ids: Set<string>) => void;
  }) => (
    <div>
      {title}
      {title === 'Instagram Accounts' ? (
        <button type="button" onClick={() => onSelectionChange?.(new Set(['ig_1']))}>
          Choose instagram account
        </button>
      ) : null}
    </div>
  ),
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
  MetaAssetCreator: () => <div>Meta Asset Creator</div>,
}));

vi.mock('../GuidedRedirectModal', () => ({
  GuidedRedirectCard: ({ onRefresh }: { onRefresh?: () => void }) => (
    <div>
      <div>Guided Redirect</div>
      {onRefresh ? (
        <button type="button" onClick={onRefresh}>
          Refresh list
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock('../PortfolioSelector', () => ({
  PortfolioSelector: ({ selectedBusiness }: { selectedBusiness?: { name: string } | null }) => (
    <div>{selectedBusiness ? `Sharing from ${selectedBusiness.name}` : 'Portfolio chooser'}</div>
  ),
}));

const makeResponse = (data: unknown) =>
  ({
    ok: true,
    text: async () => JSON.stringify({ data, error: null }),
  }) as Response;

const baseAssets = (overrides: Record<string, unknown> = {}) => ({
  businesses: [{ id: 'biz_1', name: 'Client One' }],
  selectionRequired: false,
  selectedBusinessId: 'biz_1',
  selectedBusinessName: 'Client One',
  adAccounts: [],
  pages: [],
  instagramAccounts: [],
  productCatalogs: [],
  ...overrides,
});

function renderSelector(props: Partial<React.ComponentProps<typeof MetaAssetSelector>> = {}) {
  const onSelectionChange = vi.fn();
  render(
    <MetaAssetSelector
      sessionId="conn-1"
      accessRequestToken="token-1"
      businessId="biz_1"
      onSelectionChange={onSelectionChange}
      {...props}
    />
  );
  return { onSelectionChange };
}

describe('MetaAssetSelector declines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';
  });

  it('renders the decline toggle for an allowed kind with zero selections and toggles aria-pressed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(baseAssets())));
    const { onSelectionChange } = renderSelector({ allowedAssetTypes: ['catalog'] });

    await screen.findByText('Sharing from Client One');
    const toggle = screen.getByRole('button', { name: 'No catalogs to share' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'No catalogs to share' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await waitFor(() =>
      expect(onSelectionChange.mock.lastCall?.[0].declinedAssetKinds).toEqual(['catalog'])
    );
  });

  it('emits client_assets_decline_toggled on each toggle with the new state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(baseAssets())));
    renderSelector({ allowedAssetTypes: ['catalog'] });

    await screen.findByText('Sharing from Client One');
    const toggle = () => screen.getByRole('button', { name: 'No catalogs to share' });

    fireEvent.click(toggle());
    expect(trackClientAssetsDeclineToggledMock).toHaveBeenCalledTimes(1);
    expect(trackClientAssetsDeclineToggledMock).toHaveBeenCalledWith({
      asset_kind: 'catalog',
      checked: true,
    });

    fireEvent.click(toggle());
    expect(trackClientAssetsDeclineToggledMock).toHaveBeenCalledTimes(2);
    expect(trackClientAssetsDeclineToggledMock).toHaveBeenLastCalledWith({
      asset_kind: 'catalog',
      checked: false,
    });
  });

  it('toggling on emits declinedAssetKinds and clears that kind of selection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse(baseAssets({ pixels: [{ id: 'pixel_1', name: 'Website Pixel' }] })))
    );
    const { onSelectionChange } = renderSelector({ allowedAssetTypes: ['dataset'] });

    await screen.findByText('Sharing from Client One');

    // A kind with a selection has no decision to record - no toggle.
    fireEvent.click(screen.getByRole('button', { name: 'Choose first Select Pixels and Datasets...' }));
    expect(screen.queryByRole('button', { name: 'No pixels or datasets to share' })).not.toBeInTheDocument();

    // Back to zero selections: the toggle returns, and declining clears the kind's selection.
    fireEvent.click(screen.getByRole('button', { name: 'Clear Select Pixels and Datasets...' }));
    expect(screen.getByRole('button', { name: 'No pixels or datasets to share' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No pixels or datasets to share' }));

    await waitFor(() => {
      const blob = onSelectionChange.mock.lastCall?.[0];
      expect(blob.declinedAssetKinds).toEqual(['dataset']);
      expect(blob.datasets).toEqual([]);
      expect(blob.selectedDatasetsWithNames).toEqual([]);
    });
  });

  it('removes the decline when the client selects an asset of the declined kind', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse(baseAssets({ pixels: [{ id: 'pixel_1', name: 'Website Pixel' }] })))
    );
    const { onSelectionChange } = renderSelector({ allowedAssetTypes: ['dataset'] });

    await screen.findByText('Sharing from Client One');
    fireEvent.click(screen.getByRole('button', { name: 'No pixels or datasets to share' }));
    await waitFor(() =>
      expect(onSelectionChange.mock.lastCall?.[0].declinedAssetKinds).toEqual(['dataset'])
    );

    fireEvent.click(screen.getByRole('button', { name: 'Choose first Select Pixels and Datasets...' }));

    await waitFor(() => {
      const blob = onSelectionChange.mock.lastCall?.[0];
      expect(blob.declinedAssetKinds).toEqual([]);
      expect(blob.datasets).toEqual(['pixel_1']);
    });
  });

  it('keeps the decline across a refetch of assets', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(baseAssets()))
      .mockResolvedValueOnce(makeResponse(baseAssets({ pages: [{ id: 'page_1', name: 'Client Page' }] })));
    vi.stubGlobal('fetch', fetchMock);
    const { onSelectionChange } = renderSelector({ allowedAssetTypes: ['page'] });

    await screen.findByText('Sharing from Client One');
    fireEvent.click(screen.getByRole('button', { name: 'No Pages to share' }));

    // Drive a real asset refetch through the guided Page creation refresh path.
    fireEvent.click(screen.getByRole('button', { name: /create page/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Refresh list' }));

    await screen.findByTestId('Select pages...');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      const blob = onSelectionChange.mock.lastCall?.[0];
      expect(blob.declinedAssetKinds).toEqual(['page']);
      expect(blob.pages).toEqual([]);
    });
    expect(screen.getByRole('button', { name: 'No Pages to share' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('renders no decline toggle for kinds not in allowedAssetTypes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(baseAssets())));
    renderSelector({ allowedAssetTypes: ['catalog'] });

    await screen.findByText('Sharing from Client One');
    expect(screen.queryByRole('button', { name: 'No ad accounts to share' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'No Pages to share' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'No Instagram accounts to share' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'No pixels or datasets to share' })).not.toBeInTheDocument();
  });

  it('renders the decline toggle as the primary affordance when a kind has zero options', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(baseAssets())));
    const { onSelectionChange } = renderSelector({ allowedAssetTypes: ['dataset'] });

    await screen.findByText('Sharing from Client One');

    // Today this section dead-ends on "No Pixels were returned..." with no way forward.
    const section = screen.getByRole('region', { name: 'Pixels and Datasets' });
    const toggle = within(section).getByRole('button', { name: 'No pixels or datasets to share' });
    fireEvent.click(toggle);

    await waitFor(() =>
      expect(onSelectionChange.mock.lastCall?.[0].declinedAssetKinds).toEqual(['dataset'])
    );
  });

  it('declines and un-declines Instagram accounts under its shared kind', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeResponse(baseAssets({ instagramAccounts: [{ id: 'ig_1', username: 'client' }] }))
      )
    );
    const { onSelectionChange } = renderSelector({ allowedAssetTypes: ['instagram'] });

    await screen.findByText('Sharing from Client One');
    fireEvent.click(screen.getByRole('button', { name: 'No Instagram accounts to share' }));
    await waitFor(() =>
      expect(onSelectionChange.mock.lastCall?.[0].declinedAssetKinds).toEqual(['instagram_account'])
    );

    fireEvent.click(screen.getByRole('button', { name: 'Choose instagram account' }));
    await waitFor(() => {
      const blob = onSelectionChange.mock.lastCall?.[0];
      expect(blob.declinedAssetKinds).toEqual([]);
      expect(blob.instagramAccounts).toEqual(['ig_1']);
    });
  });
});
