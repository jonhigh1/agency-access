import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { MetaAssetDecline, MetaFulfillmentResult } from '@agency-platform/shared';
import type { MetaSelectionBlob } from '../meta-selection-blob';
import { MetaGrantChecklist } from '../MetaGrantChecklist';

vi.mock('../MetaPageEngagementProof', () => ({
  MetaPageEngagementProof: () => <div>Page proof panel</div>,
}));

vi.mock('../AutomaticPagesGrant', () => ({
  AutomaticPagesGrant: ({ onGrantComplete }: any) => (
    <div>
      <button
        type="button"
        onClick={() => onGrantComplete([{ id: 'page_1', status: 'granted' }])}
      >
        Grant pages fully
      </button>
      <button
        type="button"
        onClick={() =>
          onGrantComplete([
            { id: 'page_1', status: 'granted' },
            { id: 'page_2', status: 'failed' },
          ])
        }
      >
        Grant pages partially
      </button>
    </div>
  ),
}));

vi.mock('../AdAccountSharingInstructions', () => ({
  AdAccountSharingInstructions: ({ autoStart, initialStatus, onComplete }: any) => (
    <div>
      {`Ad account panel autostart:${String(autoStart)} initialStatus:${initialStatus ?? 'none'}`}
      <button
        type="button"
        onClick={() => onComplete({ status: 'partial', verificationResults: [] })}
      >
        Report ad-account share
      </button>
      <button
        type="button"
        onClick={() => onComplete({ status: 'verified', verificationResults: [] })}
      >
        Report ad-account verified
      </button>
    </div>
  ),
}));

vi.mock('../CatalogAccessGrant', () => ({
  CatalogAccessGrant: ({ onComplete }: any) => (
    <button type="button" onClick={() => onComplete(true)}>
      Grant catalogs
    </button>
  ),
}));

vi.mock('../InstagramAccessGrant', () => ({
  InstagramAccessGrant: ({ onComplete }: any) => (
    <button type="button" onClick={() => onComplete(true)}>
      Verify instagram panel
    </button>
  ),
}));

const { trackClientGrantItemCompletedMock } = vi.hoisted(() => ({
  trackClientGrantItemCompletedMock: vi.fn(),
}));

vi.mock('@/lib/analytics/invite-events', () => ({
  trackClientGrantItemCompleted: trackClientGrantItemCompletedMock,
}));

let rowSeq = 0;

function row(overrides: Partial<MetaFulfillmentResult> = {}): MetaFulfillmentResult {
  rowSeq += 1;
  return {
    id: `row-${rowSeq}`,
    assetKind: 'ad_account',
    assetId: `asset-${rowSeq}`,
    assetName: `Asset ${rowSeq}`,
    recipientType: 'business',
    recipientId: `biz-${rowSeq}`,
    recipientName: `Recipient ${rowSeq}`,
    requestedTasks: ['ADVERTISE'],
    verifiedTasks: [],
    status: 'verified',
    updatedAt: '2026-10-03T00:00:00.000Z',
    ...overrides,
  };
}

function blob(overrides: Partial<MetaSelectionBlob> = {}): MetaSelectionBlob {
  return {
    adAccounts: [],
    pages: [],
    instagramAccounts: [],
    catalogs: [],
    datasets: [],
    selectedBusinessId: 'client-bm-1',
    selectedBusinessName: 'Client One',
    ...overrides,
  };
}

function decline(assetKind: MetaAssetDecline['assetKind']): MetaAssetDecline {
  return { assetKind, declinedAt: '2026-10-03T00:00:00.000Z' };
}

describe('MetaGrantChecklist', () => {
  const onError = vi.fn();
  const onItemSettled = vi.fn();

  const baseProps = {
    connectionId: 'conn-1',
    accessRequestToken: 'invite-1',
    businessId: 'agency-bm-1',
    businessName: 'Agency Access',
    onError,
    onItemSettled,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
  });

  it('shows Partner grant narrative with agency Business Portfolio id and automation labels', () => {
    render(
      <MetaGrantChecklist
        {...baseProps}
        selectedAssets={blob({
          adAccounts: ['act_1'],
          pages: ['page_1'],
        })}
      />
    );

    const narrative = screen.getByRole('region', { name: /partner access narrative/i });
    expect(narrative).toBeInTheDocument();
    expect(within(narrative).getByText(/agency-bm-1/)).toBeInTheDocument();
    expect(within(narrative).getByText('Automatic')).toBeInTheDocument();
    expect(within(narrative).getByText('Manual')).toBeInTheDocument();
  });

  it('shows the Leads Access Business Settings step inside the Pages item when the task is requested', () => {
    render(
      <MetaGrantChecklist
        {...baseProps}
        requestedPageTasks={['CREATE_CONTENT', 'MANAGE_LEADS']}
        selectedAssets={blob({ pages: ['page_1'] })}
      />
    );

    const pagesItem = screen
      .getByRole('heading', { name: 'Pages' })
      .closest('[data-checklist-kind="page"]') as HTMLElement;
    expect(pagesItem).not.toBeNull();
    expect(pagesItem).toHaveTextContent(/Leads Access/);
    expect(pagesItem).toHaveTextContent('leads_retrieval');
    expect(
      screen.getByRole('link', { name: 'Open Meta Business Settings for Leads Access' })
    ).toHaveAttribute('href', 'https://business.facebook.com/settings/client-bm-1');
  });

  it('omits Leads Access when the task is not requested', () => {
    render(
      <MetaGrantChecklist
        {...baseProps}
        requestedPageTasks={['CREATE_CONTENT']}
        selectedAssets={blob({ pages: ['page_1'] })}
      />
    );

    expect(screen.queryByText(/Leads Access/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Meta Business Settings/ })).not.toBeInTheDocument();
  });

  it('shows Manual on ad accounts and Automatic on Pages without cross-labeling', () => {
    render(
      <MetaGrantChecklist
        {...baseProps}
        selectedAssets={blob({
          adAccounts: ['act_1'],
          pages: ['page_1'],
        })}
      />
    );

    const adRow = screen
      .getByRole('heading', { name: 'Ad accounts' })
      .closest('[data-checklist-kind="ad_account"]') as HTMLElement;
    const pageRow = screen
      .getByRole('heading', { name: 'Pages' })
      .closest('[data-checklist-kind="page"]') as HTMLElement;
    expect(adRow.querySelector('[data-grant-method="manual"]')).toHaveTextContent('Manual');
    expect(pageRow.querySelector('[data-grant-method="automatic"]')).toHaveTextContent('Automatic');
    expect(adRow).not.toHaveTextContent('Automatic');
    expect(pageRow.querySelector('[data-grant-method="manual"]')).toBeNull();
  });

  it('renders one bordered row per machine item in stable kind order', () => {
    render(
      <MetaGrantChecklist
        {...baseProps}
        selectedAssets={blob({
          adAccounts: ['act_1'],
          pages: ['page_1'],
          datasets: ['ds_1'],
        })}
      />
    );

    expect(screen.getByRole('heading', { name: 'Ad accounts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pages' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pixels & datasets' })).toBeInTheDocument();
    expect(screen.queryByText('Instagram accounts')).not.toBeInTheDocument();
    expect(screen.queryByText('Catalogs')).not.toBeInTheDocument();
  });

  it('renders nothing when no kind is selected or declined', () => {
    const { container } = render(
      <MetaGrantChecklist {...baseProps} selectedAssets={blob()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders Done rows from server fulfillment rows without panel actions', () => {
    render(
      <MetaGrantChecklist
        {...baseProps}
        rows={[row({ assetKind: 'ad_account', status: 'verified' })]}
        selectedAssets={blob({ adAccounts: ['asset-1'] })}
      />
    );

    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.queryByText(/Ad account panel autostart/)).not.toBeInTheDocument();
  });

  it('mounts the ad-account panel with autoStart on a fresh selected row', () => {
    render(
      <MetaGrantChecklist {...baseProps} selectedAssets={blob({ adAccounts: ['act_1'] })} />
    );

    expect(screen.getByText(/autostart:true initialStatus:idle/)).toBeInTheDocument();
  });

  it('mounts the ad-account panel in verify mode when server rows show sharing already attempted', () => {
    render(
      <MetaGrantChecklist
        {...baseProps}
        rows={[row({ assetKind: 'ad_account', status: 'sharing_attempted' })]}
        selectedAssets={blob({ adAccounts: ['asset-1'] })}
      />
    );

    expect(screen.getByText(/autostart:false initialStatus:idle/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('mounts the dataset verify panel for a dataset item', () => {
    render(
      <MetaGrantChecklist {...baseProps} selectedAssets={blob({ datasets: ['ds_1'] })} />
    );

    expect(
      screen.getByRole('heading', { name: /manage pixels and datasets in meta/i })
    ).toBeInTheDocument();
  });

  it('settles the ad-account item from a panel callback', () => {
    render(
      <MetaGrantChecklist {...baseProps} selectedAssets={blob({ adAccounts: ['act_1'] })} />
    );

    fireEvent.click(screen.getByRole('button', { name: /report ad-account share/i }));

    expect(onItemSettled).toHaveBeenCalledWith('ad_account', 'action_required');
  });

  it('settles the page item done only when every page grant result is granted', () => {
    render(
      <MetaGrantChecklist
        {...baseProps}
        selectedAssets={blob({ pages: ['page_1', 'page_2'] })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /grant pages partially/i }));
    expect(onItemSettled).toHaveBeenCalledWith('page', 'action_required');

    fireEvent.click(screen.getByRole('button', { name: /grant pages fully/i }));
    expect(onItemSettled).toHaveBeenCalledWith('page', 'done');
  });

  it('fires client_grant_item_completed (panel) only when a panel settles an item done', () => {
    render(
      <MetaGrantChecklist {...baseProps} selectedAssets={blob({ pages: ['page_1'] })} />
    );

    // An action_required settle is a failure, not a completion.
    fireEvent.click(screen.getByRole('button', { name: /grant pages partially/i }));
    expect(trackClientGrantItemCompletedMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /grant pages fully/i }));
    expect(trackClientGrantItemCompletedMock).toHaveBeenCalledTimes(1);
    expect(trackClientGrantItemCompletedMock).toHaveBeenCalledWith({
      item_kind: 'page',
      source: 'panel',
    });
  });

  it('fires client_grant_item_completed (server) when refetched rows flip an item done — once', () => {
    const selectedRows = [row({ assetKind: 'page', assetId: 'page_1', status: 'selected' })];
    const { rerender } = render(
      <MetaGrantChecklist
        {...baseProps}
        rows={selectedRows}
        selectedAssets={blob({ pages: ['page_1'] })}
      />
    );
    expect(trackClientGrantItemCompletedMock).not.toHaveBeenCalled();

    const verifiedRows = [row({ assetKind: 'page', assetId: 'page_1', status: 'verified' })];
    rerender(
      <MetaGrantChecklist
        {...baseProps}
        rows={verifiedRows}
        selectedAssets={blob({ pages: ['page_1'] })}
      />
    );
    expect(trackClientGrantItemCompletedMock).toHaveBeenCalledTimes(1);
    expect(trackClientGrantItemCompletedMock).toHaveBeenCalledWith({
      item_kind: 'page',
      source: 'server',
    });

    // An unchanged refetch repeats the rows without a second completion event.
    rerender(
      <MetaGrantChecklist
        {...baseProps}
        rows={verifiedRows}
        selectedAssets={blob({ pages: ['page_1'] })}
      />
    );
    expect(trackClientGrantItemCompletedMock).toHaveBeenCalledTimes(1);
  });

  it('does not fire a server completion for an item the optimistic overlay already reported', () => {
    const selectedRows = [row({ assetKind: 'ad_account', assetId: 'act_1', status: 'selected' })];
    const { rerender } = render(
      <MetaGrantChecklist
        {...baseProps}
        rows={selectedRows}
        selectedAssets={blob({ adAccounts: ['act_1'] })}
      />
    );

    // The panel reports done: the panel source fires once, the overlay flips.
    fireEvent.click(screen.getByRole('button', { name: /report ad-account verified/i }));
    expect(trackClientGrantItemCompletedMock).toHaveBeenCalledWith({
      item_kind: 'ad_account',
      source: 'panel',
    });

    rerender(
      <MetaGrantChecklist
        {...baseProps}
        rows={selectedRows}
        selectedAssets={blob({ adAccounts: ['act_1'] })}
        overlay={{ ad_account: 'done' }}
      />
    );
    expect(trackClientGrantItemCompletedMock).toHaveBeenCalledTimes(1);
  });

  it('applies the overlay to flip a rendered state and drop the panel', () => {
    render(
      <MetaGrantChecklist
        {...baseProps}
        selectedAssets={blob({ adAccounts: ['act_1'] })}
        overlay={{ ad_account: 'done' }}
      />
    );

    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.queryByText(/Ad account panel autostart/)).not.toBeInTheDocument();
  });

  it('renders a declined kind without actions and keeps remaining counts on other kinds', () => {
    render(
      <MetaGrantChecklist
        {...baseProps}
        declines={[decline('catalog')]}
        selectedAssets={blob({ adAccounts: ['act_1'] })}
      />
    );

    expect(screen.getByText('Declined')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /grant catalogs/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Ad account panel autostart/)).toBeInTheDocument();
    expect(screen.getByText('1 left')).toBeInTheDocument();
  });

  describe('MetaDatasetVerifyPanel (mounted by the dataset row)', () => {
    it('verifies dataset access and settles the item done', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              success: true,
              partial: false,
              status: 'verified',
              results: [
                { assetId: 'ds_1', assetType: 'dataset', status: 'verified' },
                { assetId: 'ds_2', assetType: 'dataset', status: 'verified' },
              ],
            },
            error: null,
          }),
      } as Response);

      render(
        <MetaGrantChecklist
          {...baseProps}
          selectedAssets={blob({ datasets: ['ds_1', 'ds_2'] })}
        />
      );

      fireEvent.click(screen.getByLabelText('Verify access'));
      fireEvent.click(screen.getByRole('button', { name: 'Verify access' }));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          'https://api.example.com/api/client/invite-1/meta/datasets/verify',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ connectionId: 'conn-1', datasetIds: ['ds_1', 'ds_2'] }),
          })
        );
      });
      await waitFor(() => {
        expect(onItemSettled).toHaveBeenCalledWith('dataset', 'done');
      });
      expect(await screen.findByRole('status')).toHaveTextContent(/Meta confirmed access/i);
    });

    it('settles action_required on a partial response and lists the unresolved datasets', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              success: false,
              partial: true,
              status: 'partial',
              results: [
                { assetId: 'ds_1', assetType: 'dataset', status: 'verified' },
                {
                  assetId: 'ds_2',
                  assetType: 'dataset',
                  status: 'unresolved',
                  errorMessage: 'Meta has not confirmed the selected recipient',
                },
              ],
            },
            error: null,
          }),
      } as Response);

      render(
        <MetaGrantChecklist
          {...baseProps}
          selectedAssets={blob({
            datasets: ['ds_1', 'ds_2'],
            selectedDatasetsWithNames: [
              { id: 'ds_1', name: 'Events Pixel' },
              { id: 'ds_2', name: 'Retail Dataset' },
            ],
          })}
        />
      );

      fireEvent.click(screen.getByLabelText('Verify access'));
      fireEvent.click(screen.getByRole('button', { name: 'Verify access' }));

      await waitFor(() => {
        expect(onItemSettled).toHaveBeenCalledWith('dataset', 'action_required');
      });
      expect(await screen.findByRole('status')).toHaveTextContent(/Meta confirmed some access/i);
      expect(
        screen.getByText(/Retail Dataset: Meta has not confirmed the selected recipient/i)
      ).toBeInTheDocument();
    });
  });
});
