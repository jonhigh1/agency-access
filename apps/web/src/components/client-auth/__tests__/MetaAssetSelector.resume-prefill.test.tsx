import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  }: {
    placeholder: string;
    selectedIds?: Set<string>;
  }) => (
    <div data-testid={placeholder} data-selected={[...(selectedIds || [])].join(',')}>
      {placeholder}
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
  MetaAssetCreator: () => <div>Meta Asset Creator</div>,
}));

vi.mock('../GuidedRedirectModal', () => ({
  GuidedRedirectCard: () => <div>Guided Redirect</div>,
}));

vi.mock('../PortfolioSelector', () => ({
  PortfolioSelector: ({ selectedBusiness }: { selectedBusiness?: { name: string } | null }) => (
    <div>{selectedBusiness ? `Sharing from ${selectedBusiness.name}` : 'Portfolio chooser'}</div>
  ),
}));

vi.mock('@/lib/analytics/invite-events', () => ({
  trackInviteAssetsLoaded: vi.fn(),
  trackInviteSelectionSaved: vi.fn(),
  trackInviteCtaBlocked: vi.fn(),
  trackInviteReceiptShown: vi.fn(),
  trackInviteQuestionShown: vi.fn(),
  trackInviteBusinessChosen: vi.fn(),
  trackInviteGrantChecklistToggled: vi.fn(),
  trackInviteVerifyResult: vi.fn(),
  trackInviteProgressCheckRequested: vi.fn(),
}));

/**
 * U7 resume prefill (#19): the saved selection is seeded at mount, then
 * pruned against the fresh fetch. When EVERY saved id was pruned (revoked or
 * excluded by the agency), the intersection returns null — and that null must
 * CLEAR the selection, not silently keep the stale mount-seeded one.
 */
describe('MetaAssetSelector resume prefill pruning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';
  });

  function mockFetch(returnedAccounts: Array<{ id: string; name: string }>) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              businesses: [{ id: 'biz_1', name: 'Client One' }],
              selectionRequired: false,
              selectedBusinessId: 'biz_1',
              selectedBusinessName: 'Client One',
              adAccounts: returnedAccounts,
              pages: [],
              instagramAccounts: [],
            },
            error: null,
          }),
      } as Response)
    );
  }

  it('keeps the saved ids the fresh fetch still shows', async () => {
    mockFetch([{ id: 'act_keep', name: 'Kept account' }]);

    const onSelectionChange = vi.fn();
    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        initialSelection={{ adAccounts: ['act_keep', 'act_gone'], pages: [], instagramAccounts: [], catalogs: [], datasets: [] }}
        onSelectionChange={onSelectionChange}
      />
    );

    await screen.findByText('Sharing from Client One');
    await waitFor(() => {
      const emissions = onSelectionChange.mock.calls.map(([blob]) => blob);
      const last = emissions[emissions.length - 1];
      expect(last.allAdAccounts).toBeDefined();
      expect([...last.adAccounts]).toEqual(['act_keep']);
    });
  });

  it('clears the selection when every saved id was pruned by the fresh fetch', async () => {
    mockFetch([{ id: 'act_fresh', name: 'Unrelated account' }]);

    const onSelectionChange = vi.fn();
    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        initialSelection={{ adAccounts: ['act_stale1', 'act_stale2'], pages: [], instagramAccounts: [], catalogs: [], datasets: [] }}
        onSelectionChange={onSelectionChange}
      />

    );

    await screen.findByText('Sharing from Client One');
    await waitFor(() => {
      const emissions = onSelectionChange.mock.calls.map(([blob]) => blob);
      const last = emissions[emissions.length - 1];
      expect(last.allAdAccounts).toBeDefined();
      expect([...last.adAccounts]).toEqual([]);
    });
  });
});
