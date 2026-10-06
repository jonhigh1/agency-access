import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MetaAssetSelector } from '../MetaAssetSelector';
import { fetchCallUrl, stubFetchWithCreationLinks } from './meta-selector-fetch-test-utils';

const { captureAdAccountSuccess } = vi.hoisted(() => ({ captureAdAccountSuccess: vi.fn() }));

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  },
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

vi.mock('../MetaAssetCreator', () => ({
  MetaAssetCreator: ({ onSuccess, onReconcile }: {
    onSuccess: (asset: { id: string; name: string }) => void;
    onReconcile: () => Promise<boolean>;
  }) => {
    captureAdAccountSuccess(onSuccess);
    return (
      <>
        <button type="button" onClick={() => onSuccess({ id: 'act_new', name: 'New Account' })}>Meta Asset Creator</button>
        <button type="button" onClick={() => void onReconcile()}>Refresh asset list</button>
      </>
    );
  },
}));

vi.mock('../MetaBusinessCreator', () => ({
  MetaBusinessCreator: ({
    onSuccess,
    onReconcile,
  }: {
    onSuccess: (business: { id: string; name: string }) => void;
    onReconcile: () => Promise<boolean>;
  }) => (
    <>
      <button type="button" onClick={() => onSuccess({ id: 'biz_new', name: 'New Business' })}>Meta Business Creator</button>
      <button type="button" onClick={() => void onReconcile()}>Refresh Business Portfolios</button>
    </>
  ),
}));

vi.mock('../MetaBusinessSetupChecklist', () => ({
  MetaBusinessSetupChecklist: ({ businessId }: { businessId: string }) => (
    <div>Setup Checklist for {businessId}</div>
  ),
}));

vi.mock('../GuidedRedirectModal', () => ({
  GuidedRedirectCard: ({ onRefresh }: { onRefresh: () => void }) => (
    <div>
      Guided Redirect
      <button type="button" onClick={onRefresh}>
        Refresh Page List
      </button>
    </div>
  ),
}));

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    text: async () => JSON.stringify(body),
  } as Response;
}

/**
 * The receipt renders "Sharing from {name}" across a text node and a span,
 * so match on the composed paragraph text.
 */
const findSharingReceipt = (businessName: string) =>
  screen.findByText((_, element) =>
    element?.tagName === 'P' && element.textContent === `Sharing from ${businessName}`
  );

function assetsResponse(overrides: Record<string, unknown> = {}): Response {
  return jsonResponse({
    data: {
      businesses: [],
      selectionRequired: false,
      selectedBusinessId: null,
      selectedBusinessName: null,
      adAccounts: [],
      pages: [],
      instagramAccounts: [],
      ...overrides,
    },
    error: null,
  });
}

function userPagesResponse(pages: Array<{ id: string; name: string }>): Response {
  return jsonResponse({ data: { pages }, error: null });
}

describe('MetaAssetSelector - zero Business Portfolio branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';
  });

  it('guides the client to create a Facebook Page when they have none, then swaps to the creator', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(assetsResponse()) // assets: zero businesses
      .mockResolvedValueOnce(userPagesResponse([])) // user pages: none yet
      .mockResolvedValueOnce(userPagesResponse([{ id: 'page-1', name: 'Acme Main' }])); // after refresh

    stubFetchWithCreationLinks(fetchMock);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        onSelectionChange={() => {}}
      />
    );

    expect(await screen.findByText(/no business portfolio found/i)).toBeInTheDocument();

    expect(await screen.findByText(/Guided Redirect/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchCallUrl(fetchMock, 1)).toBe(
        'https://api.example.com/api/client/token-1/create/meta/user-pages?connectionId=conn-1'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /refresh page list/i }));

    expect(await screen.findByText(/Page ID: page-1/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: 'Primary Facebook Page' }));
    fireEvent.click(screen.getByRole('option', { name: /Acme Main/ }));
    expect(await screen.findByText(/Meta Business Creator/i)).toBeInTheDocument();
  });

  it('renders the business creator inline when the client already has a Page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(assetsResponse())
      .mockResolvedValueOnce(userPagesResponse([{ id: 'page-1', name: 'Acme Main' }]));

    stubFetchWithCreationLinks(fetchMock);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        onSelectionChange={() => {}}
      />
    );

    expect(await screen.findByText(/Page ID: page-1/i)).toBeInTheDocument();
    expect(screen.queryByText(/Meta Business Creator/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox', { name: 'Primary Facebook Page' }));
    fireEvent.click(screen.getByRole('option', { name: /Acme Main/ }));

    expect(await screen.findByText(/Meta Business Creator/i)).toBeInTheDocument();
  });

  it('does not open the ad-account creator when the request does not need ad accounts', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(assetsResponse())
      .mockResolvedValueOnce(userPagesResponse([{ id: 'page-1', name: 'Acme Main' }]))
      .mockResolvedValueOnce(
        assetsResponse({
          businesses: [{ id: 'biz_new', name: 'New Business', verificationStatus: 'unverified' }],
          selectionRequired: false,
          selectedBusinessId: 'biz_new',
          selectedBusinessName: 'New Business',
        })
      );

    stubFetchWithCreationLinks(fetchMock);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        allowedAssetTypes={['page']}
        onSelectionChange={() => {}}
      />
    );

    fireEvent.click(await screen.findByRole('combobox', { name: 'Primary Facebook Page' }));
    fireEvent.click(await screen.findByRole('option', { name: /Acme Main/ }));
    fireEvent.click(await screen.findByText(/Meta Business Creator/i));

    await waitFor(() => {
      expect(fetchCallUrl(fetchMock, fetchMock.mock.calls.length - 1)).toBe(
        'https://api.example.com/api/client/token-1/assets/meta_ads?connectionId=conn-1&businessId=biz_new'
      );
    });

    expect(screen.queryByText(/Meta Asset Creator/i)).not.toBeInTheDocument();
  });

  it('flows straight from business creation into the ad-account creator without a reselect journey', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(assetsResponse())
      .mockResolvedValueOnce(userPagesResponse([{ id: 'page-1', name: 'Acme Main' }]))
      .mockResolvedValueOnce(
        assetsResponse({
          businesses: [{ id: 'biz_new', name: 'New Business', verificationStatus: 'unverified' }],
          selectionRequired: false,
          selectedBusinessId: 'biz_new',
          selectedBusinessName: 'New Business',
        })
      );

    stubFetchWithCreationLinks(fetchMock);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        onSelectionChange={() => {}}
      />
    );

    fireEvent.click(await screen.findByRole('combobox', { name: 'Primary Facebook Page' }));
    fireEvent.click(await screen.findByRole('option', { name: /Acme Main/ }));
    fireEvent.click(await screen.findByText(/Meta Business Creator/i));

    await waitFor(() => {
      expect(fetchCallUrl(fetchMock, fetchMock.mock.calls.length - 1)).toBe(
        'https://api.example.com/api/client/token-1/assets/meta_ads?connectionId=conn-1&businessId=biz_new'
      );
    });

    await findSharingReceipt('New Business');
    // One pass: the ad-account creator opens immediately in the new portfolio
    expect(await screen.findByText(/Meta Asset Creator/i)).toBeInTheDocument();
    // The just-created business is unverified: the setup checklist renders
    expect(screen.getByText(/setup checklist for biz_new/i)).toBeInTheDocument();
  });

  it('does not open the ad-account creator when the new portfolio cannot be rediscovered', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(assetsResponse())
      .mockResolvedValueOnce(userPagesResponse([{ id: 'page-1', name: 'Acme Main' }]))
      .mockResolvedValueOnce(jsonResponse({ data: null, error: { message: 'Meta asset discovery failed' } }));
    stubFetchWithCreationLinks(fetchMock);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        onSelectionChange={() => {}}
      />
    );

    fireEvent.click(await screen.findByRole('combobox', { name: 'Primary Facebook Page' }));
    fireEvent.click(await screen.findByRole('option', { name: /Acme Main/ }));
    fireEvent.click(await screen.findByText(/Meta Business Creator/i));

    await waitFor(() => {
      expect(fetchCallUrl(fetchMock, fetchMock.mock.calls.length - 1)).toBe(
        'https://api.example.com/api/client/token-1/assets/meta_ads?connectionId=conn-1&businessId=biz_new'
      );
    });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('META_CONNECTION_UNKNOWN')).toBeInTheDocument();
    expect(screen.queryByText(/Meta Asset Creator/i)).not.toBeInTheDocument();
  });

  it('rediscovers Business Portfolios after an unknown create result', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(assetsResponse())
      .mockResolvedValueOnce(userPagesResponse([{ id: 'page-1', name: 'Acme Page' }]))
      .mockResolvedValueOnce(assetsResponse({
        businesses: [{ id: 'biz-recovered', name: 'Recovered Business' }],
        selectionRequired: true,
      }));
    stubFetchWithCreationLinks(fetchMock);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        onSelectionChange={() => {}}
      />
    );

    fireEvent.click(await screen.findByRole('combobox', { name: 'Primary Facebook Page' }));
    fireEvent.click(await screen.findByRole('option', { name: /Acme Page/ }));
    fireEvent.click(await screen.findByRole('button', { name: /refresh business portfolios/i }));

    expect(await screen.findByText(/which business are we sharing from/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/creation is unconfirmed/i);
    expect(fetchCallUrl(fetchMock, 2)).toBe(
      'https://api.example.com/api/client/token-1/assets/meta_ads?connectionId=conn-1'
    );
  });

  it('refreshes ad-account discovery and blocks another creation after unknown result', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(assetsResponse({
        businesses: [{ id: 'biz-1', name: 'Client' }],
        selectedBusinessId: 'biz-1',
        selectedBusinessName: 'Client',
      }))
      .mockResolvedValueOnce(assetsResponse({
        businesses: [{ id: 'biz-1', name: 'Client' }],
        selectedBusinessId: 'biz-1',
        selectedBusinessName: 'Client',
        adAccounts: [],
      }));
    stubFetchWithCreationLinks(fetchMock);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        onSelectionChange={() => {}}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /create ad account/i }));
    fireEvent.click(await screen.findByRole('button', { name: /refresh asset list/i }));

    expect(await screen.findByText(/creation is unconfirmed/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create ad account/i })).not.toBeInTheDocument();
    expect(fetchCallUrl(fetchMock, 1)).toBe(
      'https://api.example.com/api/client/token-1/assets/meta_ads?connectionId=conn-1&businessId=biz-1'
    );
  });

  it('does not select an account created for a business that is no longer active', async () => {
    const onSelectionChange = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(assetsResponse({
        businesses: [{ id: 'biz-a', name: 'Business A' }, { id: 'biz-b', name: 'Business B' }],
        selectedBusinessId: 'biz-a',
        selectedBusinessName: 'Business A',
      }))
      .mockResolvedValueOnce(assetsResponse({
        businesses: [{ id: 'biz-a', name: 'Business A' }, { id: 'biz-b', name: 'Business B' }],
        selectedBusinessId: 'biz-b',
        selectedBusinessName: 'Business B',
      }));
    stubFetchWithCreationLinks(fetchMock);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        businessId="biz-a"
        onSelectionChange={onSelectionChange}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /create ad account/i }));
    const staleSuccess = vi.mocked(captureAdAccountSuccess).mock.lastCall?.[0] as
      ((account: { id: string; name: string }) => void) | undefined;
    expect(staleSuccess).toBeTypeOf('function');
    fireEvent.click(await screen.findByRole('button', { name: /choose a different business/i }));
    fireEvent.click(await screen.findByRole('combobox', { name: 'Business' }));
    fireEvent.click(await screen.findByRole('option', { name: /Business B/ }));
    fireEvent.click(screen.getByRole('button', { name: /confirm business/i }));
    await findSharingReceipt('Business B');

    staleSuccess!({ id: 'act_new', name: 'New Account' });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText((_, element) =>
        element?.tagName === 'P' && element.textContent === 'Sharing from Business B')).toBeInTheDocument();
    });
    expect(onSelectionChange).not.toHaveBeenCalledWith(expect.objectContaining({ adAccounts: ['act_new'] }));
  });

  it('shows the setup checklist for an unverified existing business', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      assetsResponse({
        businesses: [{ id: 'biz_1', name: 'Client One', verificationStatus: 'unverified' }],
        selectionRequired: false,
        selectedBusinessId: 'biz_1',
        selectedBusinessName: 'Client One',
        adAccounts: [{ id: 'act_1', name: 'DogTimez' }],
      })
    );

    stubFetchWithCreationLinks(fetchMock);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        onSelectionChange={() => {}}
      />
    );

    expect(await screen.findByText(/setup checklist for biz_1/i)).toBeInTheDocument();
  });

  it('does not call user-pages when the client already has a Business Portfolio', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      assetsResponse({
        businesses: [{ id: 'biz_1', name: 'Client One', verificationStatus: 'verified' }],
        selectedBusinessId: 'biz_1',
        selectedBusinessName: 'Client One',
        adAccounts: [{ id: 'act_1', name: 'Account' }],
        pages: [{ id: 'page-biz', name: 'Portfolio Page' }],
      })
    );
    stubFetchWithCreationLinks(fetchMock);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        businessId="biz_1"
        onSelectionChange={() => {}}
      />
    );

    await findSharingReceipt('Client One');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('/user-pages');
  });

  it('renders none of the creation UI when businesses exist (regression guard)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      assetsResponse({
        businesses: [{ id: 'biz_1', name: 'Client One', verificationStatus: 'verified' }],
        selectionRequired: false,
        selectedBusinessId: 'biz_1',
        selectedBusinessName: 'Client One',
        adAccounts: [{ id: 'act_1', name: 'DogTimez' }],
        pages: [{ id: 'page_1', name: 'Main Page' }],
      })
    );

    stubFetchWithCreationLinks(fetchMock);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        onSelectionChange={() => {}}
      />
    );

    await findSharingReceipt('Client One');
    expect(screen.queryByText(/no business portfolio found/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Meta Business Creator/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/setup checklist/i)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('MetaAssetSelector - catalog creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';
  });

  it('creates, rediscovers, and leaves the catalog unselected until client selects it', async () => {
    const onSelectionChange = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(assetsResponse({
        businesses: [{ id: 'biz-1', name: 'Client' }],
        selectedBusinessId: 'biz-1',
        selectedBusinessName: 'Client',
      }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'catalog-new', name: 'Spring Catalog' }, error: null }))
      .mockResolvedValueOnce(assetsResponse({
        businesses: [{ id: 'biz-1', name: 'Client' }],
        selectedBusinessId: 'biz-1',
        selectedBusinessName: 'Client',
        productCatalogs: [{ id: 'catalog-new', name: 'Spring Catalog', catalogType: 'commerce' }],
      }));
    stubFetchWithCreationLinks(fetchMock);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        allowedAssetTypes={['catalog']}
        onSelectionChange={onSelectionChange}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /create catalog/i }));
    fireEvent.change(screen.getByLabelText(/product catalog name/i), { target: { value: 'Spring Catalog' } });
    fireEvent.click(screen.getByRole('button', { name: /^create catalog$/i }));

    expect(await screen.findByText(/was created and rediscovered\. select it below/i)).toBeInTheDocument();
    expect(fetchCallUrl(fetchMock, 1)).toBe(
      'https://api.example.com/api/client/token-1/create/meta/product-catalog'
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ connectionId: 'conn-1', businessId: 'biz-1', name: 'Spring Catalog' }),
    }));
    expect(fetchCallUrl(fetchMock, 2)).toBe(
      'https://api.example.com/api/client/token-1/assets/meta_ads?connectionId=conn-1&businessId=biz-1'
    );
    expect(onSelectionChange.mock.calls.at(-1)?.[0].catalogs).toEqual([]);
  });

  it('refreshes discovery after an unknown result and blocks another catalog create', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(assetsResponse({
        businesses: [{ id: 'biz-1', name: 'Client' }],
        selectedBusinessId: 'biz-1',
        selectedBusinessName: 'Client',
      }))
      .mockResolvedValueOnce(jsonResponse({
        data: null,
        error: { code: 'CREATION_OUTCOME_UNKNOWN', message: 'Meta may have created this catalog. Refresh asset discovery and select it before starting another creation.' },
      }))
      .mockResolvedValueOnce(assetsResponse({
        businesses: [{ id: 'biz-1', name: 'Client' }],
        selectedBusinessId: 'biz-1',
        selectedBusinessName: 'Client',
        productCatalogs: [{ id: 'catalog-new', name: 'Spring Catalog', catalogType: 'commerce' }],
      }));
    stubFetchWithCreationLinks(fetchMock);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        allowedAssetTypes={['catalog']}
        onSelectionChange={() => {}}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /create catalog/i }));
    fireEvent.change(screen.getByLabelText(/product catalog name/i), { target: { value: 'Spring Catalog' } });
    fireEvent.click(screen.getByRole('button', { name: /^create catalog$/i }));

    const refreshButton = await screen.findByRole('button', { name: /refresh catalog list/i });
    expect(screen.queryByRole('button', { name: /^create catalog$/i })).not.toBeInTheDocument();
    fireEvent.click(refreshButton);

    expect(await screen.findByText('0 of 1 selected')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe(
      'https://api.example.com/api/client/token-1/assets/meta_ads?connectionId=conn-1&businessId=biz-1'
    );
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/create/meta/product-catalog'))).toHaveLength(1);
  });

  it('requires catalog review when creation succeeds but discovery cannot confirm the new catalog', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(assetsResponse({
        businesses: [{ id: 'biz-1', name: 'Client' }],
        selectedBusinessId: 'biz-1',
        selectedBusinessName: 'Client',
      }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'catalog-new', name: 'Spring Catalog' }, error: null }))
      .mockResolvedValueOnce(assetsResponse({
        businesses: [{ id: 'biz-1', name: 'Client' }],
        selectedBusinessId: 'biz-1',
        selectedBusinessName: 'Client',
        productCatalogs: [],
      }));
    stubFetchWithCreationLinks(fetchMock);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        allowedAssetTypes={['catalog']}
        onSelectionChange={() => {}}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /create catalog/i }));
    fireEvent.change(screen.getByLabelText(/product catalog name/i), { target: { value: 'Spring Catalog' } });
    fireEvent.click(screen.getByRole('button', { name: /^create catalog$/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/creation is not fully verified/i);
    expect(screen.queryByRole('button', { name: /^create catalog$/i })).not.toBeInTheDocument();
  });

  it('keeps a pending catalog result with its source portfolio after switching businesses', async () => {
    let resolveCreate!: (response: Response) => void;
    const pendingCreate = new Promise<Response>((resolve) => { resolveCreate = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(assetsResponse({
        businesses: [{ id: 'biz-a', name: 'Business A' }, { id: 'biz-b', name: 'Business B' }],
        selectedBusinessId: 'biz-a',
        selectedBusinessName: 'Business A',
      }))
      .mockReturnValueOnce(pendingCreate)
      .mockResolvedValueOnce(assetsResponse({
        businesses: [{ id: 'biz-a', name: 'Business A' }, { id: 'biz-b', name: 'Business B' }],
        selectedBusinessId: 'biz-b',
        selectedBusinessName: 'Business B',
      }))
      .mockResolvedValueOnce(assetsResponse({
        businesses: [{ id: 'biz-a', name: 'Business A' }, { id: 'biz-b', name: 'Business B' }],
        selectedBusinessId: 'biz-a',
        selectedBusinessName: 'Business A',
        productCatalogs: [{ id: 'catalog-new', name: 'Spring Catalog', catalogType: 'commerce' }],
      }));
    stubFetchWithCreationLinks(fetchMock);

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        allowedAssetTypes={['catalog']}
        onSelectionChange={() => {}}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /create catalog/i }));
    fireEvent.change(screen.getByLabelText(/product catalog name/i), { target: { value: 'Spring Catalog' } });
    fireEvent.click(screen.getByRole('button', { name: /^create catalog$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /choose a different business/i }));
    fireEvent.click(await screen.findByRole('combobox', { name: 'Business' }));
    fireEvent.click(await screen.findByRole('option', { name: /Business B/ }));
    fireEvent.click(screen.getByRole('button', { name: /confirm business/i }));
    await findSharingReceipt('Business B');

    resolveCreate(jsonResponse({ data: { id: 'catalog-new', name: 'Spring Catalog' }, error: null }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(screen.queryByText(/creation is not fully verified/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /choose a different business/i }));
    fireEvent.click(await screen.findByRole('combobox', { name: 'Business' }));
    fireEvent.click(await screen.findByRole('option', { name: /Business A/ }));
    fireEvent.click(screen.getByRole('button', { name: /confirm business/i }));

    expect(await screen.findByText(/creation is not fully verified/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh catalog list/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^create catalog$/i })).not.toBeInTheDocument();
  });
});
