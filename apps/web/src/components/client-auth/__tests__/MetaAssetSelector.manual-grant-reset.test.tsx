import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MetaAssetSelector } from '../MetaAssetSelector';
import { manualGrantChecklistStorageKey } from '@/lib/invite/manual-grant-checklist-storage';

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  },
}));

vi.mock('@/lib/analytics/capture-posthog', () => ({
  capturePosthogEvent: vi.fn(),
}));

// The registration under test lives in the selector's reset path, not in the
// portfolio UI. Drive onBusinessConfirmed directly and keep the child out of
// the test's blast radius.
vi.mock('../PortfolioSelector', () => ({
  PortfolioSelector: ({ onBusinessConfirmed, selectedBusiness }: any) => (
    <div>
      <div>{selectedBusiness ? `Sharing from ${selectedBusiness.name}` : 'No business yet'}</div>
      <button
        type="button"
        onClick={() => onBusinessConfirmed({ id: 'biz-2', name: 'Client Two' })}
      >
        Confirm Second Business
      </button>
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
}));

vi.mock('../MetaBusinessSetupChecklist', () => ({
  MetaBusinessSetupChecklist: () => <div>Setup Checklist</div>,
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
      businesses: [
        { id: 'biz-1', name: 'Client One' },
        { id: 'biz-2', name: 'Client Two' },
      ],
      selectionRequired: false,
      selectedBusinessId: 'biz-1',
      selectedBusinessName: 'Client One',
      adAccounts: [],
      pages: [],
      instagramAccounts: [],
      ...overrides,
    },
    error: null,
  });
}

describe('MetaAssetSelector - manual-grant checklist storage reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    sessionStorage.clear();
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';
  });

  it('clears the checklist sessionStorage keys when the client switches business (U2 registration point)', async () => {
    // Simulate a client who checked manual-grant rows for the first business.
    sessionStorage.setItem(
      manualGrantChecklistStorageKey('token-1', 'partner-bm-1', 'step-1'),
      '1'
    );
    sessionStorage.setItem(
      manualGrantChecklistStorageKey('token-1', 'partner-bm-1', 'step-2-3'),
      '1'
    );
    // Storage owned by another surface must survive the reset.
    sessionStorage.setItem('unrelated-key', 'keep-me');

    vi.mocked(fetch)
      .mockResolvedValueOnce(assetsResponse())
      .mockResolvedValue(
        assetsResponse({ selectedBusinessId: 'biz-2', selectedBusinessName: 'Client Two' })
      );

    render(
      <MetaAssetSelector
        sessionId="conn-1"
        accessRequestToken="token-1"
        businessId="partner-bm-1"
        onSelectionChange={vi.fn()}
      />
    );

    await screen.findByText('Sharing from Client One');
    expect(
      sessionStorage.getItem(manualGrantChecklistStorageKey('token-1', 'partner-bm-1', 'step-1'))
    ).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: /confirm second business/i }));

    await waitFor(() => {
      expect(screen.getByText('Sharing from Client Two')).toBeInTheDocument();
    });

    expect(
      sessionStorage.getItem(manualGrantChecklistStorageKey('token-1', 'partner-bm-1', 'step-1'))
    ).toBeNull();
    expect(
      sessionStorage.getItem(manualGrantChecklistStorageKey('token-1', 'partner-bm-1', 'step-2-3'))
    ).toBeNull();
    // Only checklist keys for this request are cleared.
    expect(sessionStorage.getItem('unrelated-key')).toBe('keep-me');
  });
});
