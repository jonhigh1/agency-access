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

  it.each([
    { type: 'page', label: 'Select pages...', name: 'Client Page', field: 'pages', id: 'page-1' },
    { type: 'ad_account', label: 'Select ad accounts...', name: 'Client Ads', field: 'adAccounts', id: 'act-1' },
    { type: 'catalog', label: 'Select product catalogs...', name: 'Product Catalog', field: 'catalogs', id: 'catalog-1' },
    { type: 'dataset', label: 'Select Pixels and Datasets...', name: 'Website Pixel', field: 'datasets', id: 'pixel-1' },
  ])('lets keyboard users select a $type asset with a named combobox', async ({ type, label, name, field, id }) => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: {
        businesses: [{ id: 'biz-1', name: 'Business' }],
        selectedBusinessId: 'biz-1', selectedBusinessName: 'Business', selectionRequired: false,
        adAccounts: [{ id: 'act-1', name: 'Client Ads' }],
        pages: [{ id: 'page-1', name: 'Client Page' }],
        instagramAccounts: [],
        productCatalogs: [{ id: 'catalog-1', name: 'Product Catalog' }],
        pixels: [{ id: 'pixel-1', name: 'Website Pixel' }],
      }, error: null }),
    } as Response);

    render(<MetaAssetSelector sessionId="conn-1" accessRequestToken="token-1" allowedAssetTypes={[type as any]} onSelectionChange={onSelectionChange} />);

    const combobox = await screen.findByRole('combobox', { name: label });
    for (let step = 0; step < 20 && document.activeElement !== combobox; step += 1) await user.tab();
    expect(combobox).toHaveFocus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');

    await waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith(expect.objectContaining({ [field]: [id] })));
  });

  it('lets keyboard and screen-reader users select Instagram and gives its controls 44px targets', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: {
        businesses: [{ id: 'biz-1', name: 'Business' }],
        selectedBusinessId: 'biz-1', selectedBusinessName: 'Business', selectionRequired: false,
        adAccounts: [], pages: [], instagramAccounts: [{ id: 'ig-1', username: 'client' }], productCatalogs: [],
      }, error: null }),
    } as Response);

    render(<MetaAssetSelector sessionId="conn-1" accessRequestToken="token-1" allowedAssetTypes={['instagram']} onSelectionChange={onSelectionChange} />);

    const checkbox = await screen.findByRole('checkbox', { name: 'client' });
    expect(checkbox).toHaveAccessibleName('client');
    expect(checkbox.parentElement?.parentElement).toHaveClass('min-h-[44px]');
    const selectAll = screen.getByRole('checkbox', { name: 'Select all Instagram Accounts' });
    const collapse = screen.getByRole('button', { name: 'Collapse Instagram Accounts' });
    expect(selectAll).toHaveClass('min-h-[44px]');
    expect(collapse).toHaveClass('min-h-[44px]');

    for (let step = 0; step < 20 && document.activeElement !== checkbox; step += 1) await user.tab();
    expect(checkbox).toHaveFocus();
    await user.keyboard(' ');
    await waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith(expect.objectContaining({ instagramAccounts: ['ig-1'] })));

    const assetGrid = checkbox.closest('[class*="grid-cols-1"]');
    expect(assetGrid).toHaveClass('md:grid-cols-2');
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
              productCatalogs: [],
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
              productCatalogs: [{ id: 'catalog_1', name: 'DogTimez Shop', catalogType: 'commerce' }],
            },
            error: null,
          }),
      } as Response);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        allowedAssetTypes={['page', 'catalog']}
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

  it('returns selected product catalogs with their names', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: {
        businesses: [{ id: 'biz-1', name: 'Business' }],
        selectedBusinessId: 'biz-1', selectedBusinessName: 'Business', selectionRequired: false,
        adAccounts: [], pages: [], instagramAccounts: [],
        productCatalogs: [{ id: 'catalog-1', name: 'Store Catalog', catalogType: 'commerce' }],
      }, error: null }),
    } as Response);

    render(<MetaAssetSelector sessionId="conn-1" accessRequestToken="token-1" allowedAssetTypes={['catalog']} onSelectionChange={onSelectionChange} />);
    await user.click(await screen.findByText('Select product catalogs...'));
    await user.click(await screen.findByText('Store Catalog'));
    await waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith(expect.objectContaining({
      catalogs: ['catalog-1'],
      selectedCatalogsWithNames: [{ id: 'catalog-1', name: 'Store Catalog' }],
    })));
  });

  it('shows a warning when Instagram assets could not be discovered', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: {
        businesses: [{ id: 'biz-1', name: 'Business' }],
        selectedBusinessId: 'biz-1', selectedBusinessName: 'Business', selectionRequired: false,
        adAccounts: [], pages: [], instagramAccounts: [],
        assetLoadWarnings: ['Could not load connected Instagram accounts. Check Instagram permissions and try again.'],
      }, error: null }),
    } as Response);

    render(<MetaAssetSelector sessionId="conn-1" accessRequestToken="token-1" allowedAssetTypes={['instagram']} onSelectionChange={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load connected Instagram accounts. Check Instagram permissions and try again.'
    );
  });

  it('verifies manually assigned Pixel access and reports Meta read-back', async () => {
    const assetsResponse = {
      ok: true,
      text: async () => JSON.stringify({ data: {
        businesses: [{ id: 'biz-1', name: 'Business' }],
        selectedBusinessId: 'biz-1', selectedBusinessName: 'Business', selectionRequired: false,
        adAccounts: [], pages: [], instagramAccounts: [], productCatalogs: [],
        pixels: [{ id: 'pixel-1', name: 'Website Pixel' }],
      }, error: null }),
    } as Response;
    vi.mocked(fetch).mockResolvedValueOnce(assetsResponse).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: { status: 'verified' }, error: null }),
    } as Response);
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();

    render(<MetaAssetSelector sessionId="conn-1" accessRequestToken="token-1" allowedAssetTypes={['dataset']} onSelectionChange={onSelectionChange} />);

    expect(await screen.findByRole('heading', { name: 'Pixels and Datasets' })).toBeInTheDocument();
    expect(screen.getByText(/selection alone does not prove access/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Meta Business Manager' })).toBeEnabled();
    await user.click(screen.getByText('Select Pixels and Datasets...', { exact: false }));
    await user.click(await screen.findByText('Website Pixel'));
    await waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith(expect.objectContaining({
      datasets: ['pixel-1'],
      selectedDatasetsWithNames: [{ id: 'pixel-1', name: 'Website Pixel' }],
      selectedAssetNames: expect.arrayContaining(['Website Pixel']),
    })));
    await user.click(screen.getByLabelText('Verify access'));
    await user.click(screen.getByRole('button', { name: 'Verify access' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/Meta confirmed access for every selected recipient/);
    expect(fetch).toHaveBeenLastCalledWith('https://api.example.com/api/client/token-1/meta/datasets/verify', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ connectionId: 'conn-1', datasetIds: ['pixel-1'] }),
    }));
  });

  it('keeps optional Leads Access separate from Page tasks and lead-data permission', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: {
        businesses: [{ id: 'biz-1', name: 'Business' }],
        selectedBusinessId: 'biz-1', selectedBusinessName: 'Business', selectionRequired: false,
        adAccounts: [], pages: [{ id: 'page-1', name: 'Client Page' }], instagramAccounts: [], productCatalogs: [],
      }, error: null }),
    } as Response);

    render(<MetaAssetSelector sessionId="conn-1" accessRequestToken="token-1" allowedAssetTypes={['page']} onSelectionChange={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Optional: Meta Leads Access' })).toBeInTheDocument();
    expect(screen.getByText(/Leads Access is not included in this request/)).toBeInTheDocument();
    expect(screen.getByText('leads_retrieval')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review Leads Access in Meta Business Settings' })).toHaveAttribute(
      'href', 'https://business.facebook.com/settings/biz-1'
    );
  });

  it('shows task-based Leads Access as attempted and read-back gated', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: {
        businesses: [{ id: 'biz-1', name: 'Business' }],
        selectedBusinessId: 'biz-1', selectedBusinessName: 'Business', selectionRequired: false,
        adAccounts: [], pages: [{ id: 'page-1', name: 'Client Page' }], instagramAccounts: [], productCatalogs: [],
      }, error: null }),
    } as Response);

    render(<MetaAssetSelector
      sessionId="conn-1"
      accessRequestToken="token-1"
      allowedAssetTypes={['page']}
      requestedPageTasks={['CREATE_CONTENT', 'MANAGE_LEADS']}
      onSelectionChange={vi.fn()}
    />);

    expect(await screen.findByText(/This request includes the Manage Leads Access Page task/)).toBeInTheDocument();
    expect(screen.getByText(/AuthHub will attempt assignment and report Meta read-back/)).toBeInTheDocument();
    expect(screen.getByText('leads_retrieval')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Meta Business Settings for Leads Access' })).toBeInTheDocument();
  });
});
