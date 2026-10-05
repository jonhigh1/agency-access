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

/** The receipt renders "Sharing from {name}" across a text node and a span. */
const findSharingReceipt = (businessName: string) =>
  screen.findByText((_, element) =>
    element?.tagName === 'P' && element.textContent === `Sharing from ${businessName}`
  );
const querySharingReceipt = (businessName: string) =>
  screen.queryByText((_, element) =>
    element?.tagName === 'P' && element.textContent === `Sharing from ${businessName}`
  );

/** Escape the receipt, pick a business in the chooser, and confirm. */
async function chooseBusiness(user: ReturnType<typeof userEvent.setup>, businessName: RegExp) {
  await user.click(screen.getByRole('button', { name: /choose a different business/i }));
  await user.click(await screen.findByRole('combobox', { name: 'Business' }));
  await user.click(screen.getByRole('option', { name: businessName }));
  await user.click(screen.getByRole('button', { name: /confirm business/i }));
}

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

  it('reports selected Meta assets after a business is confirmed and an asset is clicked', async () => {
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

    await screen.findByText(/which business are we sharing from/i);

    await user.click(screen.getByRole('combobox', { name: 'Business' }));
    await user.click(screen.getByRole('option', { name: /DogTimez Retail/ }));
    await user.click(screen.getByRole('button', { name: /confirm business/i }));

    await findSharingReceipt('DogTimez Retail');
    await user.click(screen.getByText('Select pages...', { exact: false }));
    await user.click(await screen.findByText('DogTimez Facebook'));

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalledWith(
        expect.objectContaining({
          pages: ['page_1001'],
          selectedBusinessId: 'biz_client_2',
          selectedBusinessName: 'DogTimez Retail',
          selectedPagesWithNames: [{ id: 'page_1001', name: 'DogTimez Facebook' }],
          // Keys the grant step and server-side scope validation read back.
          businesses: [
            { id: 'biz_client_1', name: 'DogTimez Holdings' },
            { id: 'biz_client_2', name: 'DogTimez Retail' },
          ],
          selectionRequired: false,
          allPages: [{ id: 'page_1001', name: 'DogTimez Facebook', category: 'Brand' }],
        })
      );
    });

    // U11: load/shown funnel events may already have fired, but the
    // selection event must still wait for a real selection.
    expect(captureMock).not.toHaveBeenCalledWith(
      'meta_assets_selected',
      expect.anything()
    );
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

  it('selects Pixels and Datasets without showing manual Meta steps on the selection step', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: {
        businesses: [{ id: 'biz-1', name: 'Business' }],
        selectedBusinessId: 'biz-1', selectedBusinessName: 'Business', selectionRequired: false,
        adAccounts: [], pages: [], instagramAccounts: [], productCatalogs: [],
        pixels: [{ id: 'pixel-1', name: 'Website Pixel' }],
      }, error: null }),
    } as Response);
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();

    render(<MetaAssetSelector sessionId="conn-1" accessRequestToken="token-1" allowedAssetTypes={['dataset']} onSelectionChange={onSelectionChange} />);

    expect(await screen.findByRole('heading', { name: 'Pixels and Datasets' })).toBeInTheDocument();
    await user.click(screen.getByText('Select Pixels and Datasets...', { exact: false }));
    await user.click(await screen.findByText('Website Pixel'));
    await waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith(expect.objectContaining({
      datasets: ['pixel-1'],
      selectedDatasetsWithNames: [{ id: 'pixel-1', name: 'Website Pixel' }],
      selectedAssetNames: expect.arrayContaining(['Website Pixel']),
    })));

    // The Business Settings walkthrough and verify live in the step-3 checklist.
    expect(screen.queryByText('Manage Pixels and Datasets in Meta')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Meta Business Manager' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verify access' })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('shows no Leads Access section when Leads Access is not requested', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: {
        businesses: [{ id: 'biz-1', name: 'Business' }],
        selectedBusinessId: 'biz-1', selectedBusinessName: 'Business', selectionRequired: false,
        adAccounts: [], pages: [{ id: 'page-1', name: 'Client Page' }], instagramAccounts: [], productCatalogs: [],
      }, error: null }),
    } as Response);

    render(<MetaAssetSelector sessionId="conn-1" accessRequestToken="token-1" allowedAssetTypes={['page']} onSelectionChange={vi.fn()} />);

    await screen.findByText('Select pages...', { exact: false });
    expect(screen.queryByText(/Leads Access/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Meta Business Settings/ })).not.toBeInTheDocument();
  });

  it('tells the client requested Leads Access is confirmed after sharing, with no manual link here', async () => {
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

    expect(await screen.findByText(/Leads Access is part of this request/)).toBeInTheDocument();
    expect(screen.getByText(/after you share/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Meta Business Settings/ })).not.toBeInTheDocument();
  });

  it('confirms with the selection count before a confirmed business switch and declines without changing anything', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const onSelectionDerivedStateReset = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: {
        businesses: [
          { id: 'biz-1', name: 'Business One' },
          { id: 'biz-2', name: 'Business Two' },
        ],
        selectedBusinessId: 'biz-1', selectedBusinessName: 'Business One', selectionRequired: false,
        adAccounts: [], pages: [
          { id: 'page-1', name: 'Page One' },
          { id: 'page-2', name: 'Page Two' },
          { id: 'page-3', name: 'Page Three' },
        ], instagramAccounts: [], productCatalogs: [],
      }, error: null }),
    } as Response);

    render(<MetaAssetSelector
      sessionId="conn-1"
      accessRequestToken="token-1"
      allowedAssetTypes={['page']}
      onSelectionChange={onSelectionChange}
      onSelectionDerivedStateReset={onSelectionDerivedStateReset}
    />);

    await findSharingReceipt('Business One');
    await user.click(screen.getByText('Select pages...', { exact: false }));
    await user.click(await screen.findByText('Page One'));
    await user.click(await screen.findByText('Page Two'));
    await user.click(await screen.findByText('Page Three'));

    // Escaping to the chooser alone never destroys work.
    await user.click(screen.getByRole('button', { name: /choose a different business/i }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Business' })).toBeInTheDocument());
    expect(onSelectionDerivedStateReset).not.toHaveBeenCalled();

    await user.click(screen.getByRole('combobox', { name: 'Business' }));
    await user.click(screen.getByRole('option', { name: /Business Two/ }));
    await user.click(screen.getByRole('button', { name: /confirm business/i }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: 'Clear selection and switch' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onSelectionDerivedStateReset).not.toHaveBeenCalled();
    expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({
      pages: ['page-1', 'page-2', 'page-3'],
      selectedBusinessId: 'biz-1',
    }));
    // Declining closes the chooser and keeps the original receipt: nothing
    // was destroyed.
    await findSharingReceipt('Business One');
    expect(screen.queryByRole('combobox', { name: 'Business' })).not.toBeInTheDocument();
  });

  it('clears selection-derived state on a confirmed switch and reports the reset', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const onSelectionDerivedStateReset = vi.fn();
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ data: {
          businesses: [
            { id: 'biz-1', name: 'Business One' },
            { id: 'biz-2', name: 'Business Two' },
          ],
          selectedBusinessId: 'biz-1', selectedBusinessName: 'Business One', selectionRequired: false,
          adAccounts: [], pages: [{ id: 'page-1', name: 'Page One' }], instagramAccounts: [], productCatalogs: [],
        }, error: null }),
      } as Response)
      .mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: {
          businesses: [
            { id: 'biz-1', name: 'Business One' },
            { id: 'biz-2', name: 'Business Two' },
          ],
          selectedBusinessId: 'biz-2', selectedBusinessName: 'Business Two', selectionRequired: false,
          adAccounts: [], pages: [], instagramAccounts: [], productCatalogs: [],
        }, error: null }),
      } as Response);

    render(<MetaAssetSelector
      sessionId="conn-1"
      accessRequestToken="token-1"
      allowedAssetTypes={['page']}
      onSelectionChange={onSelectionChange}
      onSelectionDerivedStateReset={onSelectionDerivedStateReset}
    />);

    await findSharingReceipt('Business One');
    await user.click(screen.getByText('Select pages...', { exact: false }));
    await user.click(await screen.findByText('Page One'));
    await waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith(expect.objectContaining({ pages: ['page-1'] })));

    await chooseBusiness(user, /Business Two/);
    await user.click(await screen.findByRole('button', { name: 'Clear selection and switch' }));

    expect(onSelectionDerivedStateReset).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({
        pages: [],
        selectedBusinessId: 'biz-2',
        selectionRequired: false,
      }));
    });
    expect(querySharingReceipt('Business One')).not.toBeInTheDocument();
    await findSharingReceipt('Business Two');
  });

  it('switches with zero selections without a confirm and still resets', async () => {
    const user = userEvent.setup();
    const onSelectionDerivedStateReset = vi.fn();
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ data: {
          businesses: [
            { id: 'biz-1', name: 'Business One' },
            { id: 'biz-2', name: 'Business Two' },
          ],
          selectedBusinessId: 'biz-1', selectedBusinessName: 'Business One', selectionRequired: false,
          adAccounts: [], pages: [{ id: 'page-1', name: 'Page One' }], instagramAccounts: [], productCatalogs: [],
        }, error: null }),
      } as Response)
      .mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ data: {
          businesses: [
            { id: 'biz-1', name: 'Business One' },
            { id: 'biz-2', name: 'Business Two' },
          ],
          selectedBusinessId: 'biz-2', selectedBusinessName: 'Business Two', selectionRequired: false,
          adAccounts: [], pages: [], instagramAccounts: [], productCatalogs: [],
        }, error: null }),
      } as Response);

    render(<MetaAssetSelector
      sessionId="conn-1"
      accessRequestToken="token-1"
      allowedAssetTypes={['page']}
      onSelectionChange={vi.fn()}
      onSelectionDerivedStateReset={onSelectionDerivedStateReset}
    />);

    await findSharingReceipt('Business One');
    await chooseBusiness(user, /Business Two/);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onSelectionDerivedStateReset).toHaveBeenCalledTimes(1);
    await findSharingReceipt('Business Two');
  });

  it('clears Pixel verification results on a confirmed switch after partial verification', async () => {
    const user = userEvent.setup();
    const onSelectionDerivedStateReset = vi.fn();
    const assetsResponse = {
      ok: true,
      text: async () => JSON.stringify({ data: {
        businesses: [
          { id: 'biz-1', name: 'Business One' },
          { id: 'biz-2', name: 'Business Two' },
        ],
        selectedBusinessId: 'biz-1', selectedBusinessName: 'Business One', selectionRequired: false,
        adAccounts: [], pages: [], instagramAccounts: [], productCatalogs: [],
        pixels: [{ id: 'pixel-1', name: 'Website Pixel' }],
      }, error: null }),
    } as Response;
    const switchedResponse = {
      ok: true,
      text: async () => JSON.stringify({ data: {
        businesses: [
          { id: 'biz-1', name: 'Business One' },
          { id: 'biz-2', name: 'Business Two' },
        ],
        selectedBusinessId: 'biz-2', selectedBusinessName: 'Business Two', selectionRequired: false,
        adAccounts: [], pages: [], instagramAccounts: [], productCatalogs: [], pixels: [],
      }, error: null }),
    } as Response;
    vi.mocked(fetch)
      .mockResolvedValueOnce(assetsResponse)
      .mockResolvedValueOnce(switchedResponse);

    render(<MetaAssetSelector
      sessionId="conn-1"
      accessRequestToken="token-1"
      allowedAssetTypes={['dataset']}
      onSelectionChange={vi.fn()}
      onSelectionDerivedStateReset={onSelectionDerivedStateReset}
    />);

    await screen.findByRole('heading', { name: 'Pixels and Datasets' });
    await user.click(screen.getByText('Select Pixels and Datasets...', { exact: false }));
    await user.click(await screen.findByText('Website Pixel'));

    await chooseBusiness(user, /Business Two/);
    expect(screen.getByRole('alertdialog')).toHaveTextContent('1');
    await user.click(screen.getByRole('button', { name: 'Clear selection and switch' }));

    expect(onSelectionDerivedStateReset).toHaveBeenCalledTimes(1);
    await findSharingReceipt('Business Two');
  });

  it('reports the reset when a business is confirmed from the chooser', async () => {
    const user = userEvent.setup();
    const onSelectionDerivedStateReset = vi.fn();
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
      .mockResolvedValue({
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
              pages: [{ id: 'page_1001', name: 'DogTimez Facebook' }],
              instagramAccounts: [],
              productCatalogs: [],
            },
            error: null,
          }),
      } as Response);

    render(<MetaAssetSelector
      sessionId="conn-1"
      accessRequestToken="token-1"
      allowedAssetTypes={['page']}
      onSelectionChange={vi.fn()}
      onSelectionDerivedStateReset={onSelectionDerivedStateReset}
    />);

    await screen.findByText(/which business are we sharing from/i);
    await user.click(screen.getByRole('combobox', { name: 'Business' }));
    await user.click(screen.getByRole('option', { name: /DogTimez Retail/ }));
    await user.click(screen.getByRole('button', { name: /confirm business/i }));

    expect(onSelectionDerivedStateReset).toHaveBeenCalledTimes(1);
    await findSharingReceipt('DogTimez Retail');
  });
});
