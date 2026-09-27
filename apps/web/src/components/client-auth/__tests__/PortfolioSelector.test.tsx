import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PortfolioSelector, type PortfolioBusiness } from '../PortfolioSelector';

const {
  trackInviteReceiptShownMock,
  trackInviteQuestionShownMock,
  trackInviteBusinessChosenMock,
} = vi.hoisted(() => ({
  trackInviteReceiptShownMock: vi.fn(),
  trackInviteQuestionShownMock: vi.fn(),
  trackInviteBusinessChosenMock: vi.fn(),
}));

vi.mock('@/lib/analytics/invite-events', () => ({
  trackInviteReceiptShown: trackInviteReceiptShownMock,
  trackInviteQuestionShown: trackInviteQuestionShownMock,
  trackInviteBusinessChosen: trackInviteBusinessChosenMock,
}));

const ACME_ID = '1029384756102938';
const BLOOM_ID = '5647382910475638';
const NORTH_ID = '9081726354938271';

const acme: PortfolioBusiness = { id: ACME_ID, name: 'Acme Studio', verificationStatus: 'verified' };
const bloom: PortfolioBusiness = { id: BLOOM_ID, name: 'Bloom Media', verificationStatus: 'pending' };
const northstar: PortfolioBusiness = { id: NORTH_ID, name: 'Northstar Group', vertical: 'RETAIL' };

const renderSelector = (overrides: Partial<Parameters<typeof PortfolioSelector>[0]> = {}) => {
  const props: Parameters<typeof PortfolioSelector>[0] = {
    businesses: [acme],
    selectedBusiness: acme,
    selectionRequired: false,
    fetchBusinesses: vi.fn().mockResolvedValue([acme, bloom]),
    onBusinessConfirmed: vi.fn(),
    ...overrides,
  };
  const view = render(<PortfolioSelector {...props} />);
  return { ...view, props };
};

describe('PortfolioSelector — single-owner receipt', () => {
  it('renders the receipt with the business name, no listbox, and an escape affordance', () => {
    const { props } = renderSelector();

    expect(screen.getByText(/Sharing from/)).toBeInTheDocument();
    expect(screen.getByText('Acme Studio')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose a different business/i })).toBeInTheDocument();
    expect(props.onBusinessConfirmed).not.toHaveBeenCalled();
  });

  it('escape fetches the business list once and renders the question list', async () => {
    const user = userEvent.setup();
    const fetchBusinesses = vi.fn().mockResolvedValue([acme, bloom]);
    renderSelector({ fetchBusinesses });

    await user.click(screen.getByRole('button', { name: /choose a different business/i }));

    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    expect(fetchBusinesses).toHaveBeenCalledTimes(1);
  });

  it('reuses the already-loaded list when escaping again after returning to the original', async () => {
    const user = userEvent.setup();
    const fetchBusinesses = vi.fn().mockResolvedValue([acme, bloom]);
    const onBusinessConfirmed = vi.fn();
    const { rerender } = render(
      <PortfolioSelector
        businesses={[acme]}
        selectedBusiness={acme}
        fetchBusinesses={fetchBusinesses}
        onBusinessConfirmed={onBusinessConfirmed}
      />
    );

    // Escape to the question list.
    await user.click(screen.getByRole('button', { name: /choose a different business/i }));
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());

    // Choose the original business and confirm; the parent re-renders with it selected.
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /Acme Studio/ }));
    await user.click(screen.getByRole('button', { name: /confirm business/i }));
    expect(onBusinessConfirmed).toHaveBeenCalledWith(acme);

    rerender(
      <PortfolioSelector
        businesses={[acme]}
        selectedBusiness={acme}
        fetchBusinesses={fetchBusinesses}
        onBusinessConfirmed={onBusinessConfirmed}
      />
    );
    expect(screen.getByText(/Sharing from/)).toBeInTheDocument();

    // Escape again — the loaded list must be reused without a second fetch.
    await user.click(screen.getByRole('button', { name: /choose a different business/i }));
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(fetchBusinesses).toHaveBeenCalledTimes(1);
  });
});

describe('PortfolioSelector — several businesses', () => {
  it('renders the plain question with name-only options and no raw IDs', () => {
    const { container } = renderSelector({
      businesses: [acme, bloom, northstar],
      selectedBusiness: null,
      selectionRequired: true,
    });

    expect(screen.getByText(/which business/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(container.textContent).not.toContain(ACME_ID);
    expect(container.textContent).not.toContain(BLOOM_ID);
    expect(container.textContent).not.toContain(NORTH_ID);
  });

  it('confirms the chosen alternate business', async () => {
    const user = userEvent.setup();
    const onBusinessConfirmed = vi.fn();
    renderSelector({
      businesses: [acme, bloom],
      selectedBusiness: null,
      selectionRequired: true,
      onBusinessConfirmed,
    });

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /Bloom Media/ }));
    await user.click(screen.getByRole('button', { name: /confirm business/i }));

    expect(onBusinessConfirmed).toHaveBeenCalledTimes(1);
    expect(onBusinessConfirmed).toHaveBeenCalledWith(bloom);
  });

  it('keeps the confirm action disabled until a business is chosen', () => {
    renderSelector({
      businesses: [acme, bloom],
      selectedBusiness: null,
      selectionRequired: true,
    });

    expect(screen.getByRole('button', { name: /confirm business/i })).toBeDisabled();
  });
});

describe('PortfolioSelector — duplicate names (collision tiebreaker)', () => {
  const duplicateA: PortfolioBusiness = { id: ACME_ID, name: 'Acme Studio', vertical: 'RETAIL' };
  const duplicateB: PortfolioBusiness = { id: BLOOM_ID, name: 'Acme Studio', verificationStatus: 'pending' };

  it('shows the secondary attribute on the colliding pair only', async () => {
    const user = userEvent.setup();
    renderSelector({
      businesses: [duplicateA, duplicateB, northstar],
      selectedBusiness: null,
      selectionRequired: true,
    });

    await user.click(screen.getByRole('combobox'));
    const options = screen.getAllByRole('option');

    expect(options).toHaveLength(3);
    expect(options[0].textContent).toContain('Retail');
    expect(options[1].textContent).toContain('Verification pending');
    expect(options[2].textContent).not.toContain('Retail');
    expect(options[2].textContent).toBe('Northstar Group');
  });
});

describe('PortfolioSelector — fetch failure after auto-select', () => {
  it('renders an error state with retry instead of a blank receipt', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderSelector({ error: 'We could not load your Meta businesses.', onRetry });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('We could not load your Meta businesses.')).toBeInTheDocument();
    expect(screen.queryByText(/Sharing from/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('offers retry when the escape fetch fails, then recovers', async () => {
    const user = userEvent.setup();
    const fetchBusinesses = vi
      .fn()
      .mockRejectedValueOnce(new Error('Meta is unavailable'))
      .mockResolvedValueOnce([acme, bloom]);
    renderSelector({ fetchBusinesses });

    await user.click(screen.getByRole('button', { name: /choose a different business/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    expect(fetchBusinesses).toHaveBeenCalledTimes(2);
  });
});

describe('PortfolioSelector — zero businesses', () => {
  it('routes to the creation path through onCreateBusiness', async () => {
    const user = userEvent.setup();
    const onCreateBusiness = vi.fn();
    renderSelector({
      businesses: [],
      selectedBusiness: null,
      selectionRequired: false,
      onCreateBusiness,
    });

    expect(screen.getByText(/no business/i)).toBeInTheDocument();

    const createButton = screen.getByRole('button', { name: /create a business portfolio/i });
    await user.click(createButton);
    expect(onCreateBusiness).toHaveBeenCalledTimes(1);
  });
});

describe('PortfolioSelector — question keyboard path', () => {
  beforeEach(() => {});
  it('confirms the active option with keyboard only', async () => {
    const user = userEvent.setup();
    const onBusinessConfirmed = vi.fn();
    renderSelector({
      businesses: [acme, bloom],
      selectedBusiness: null,
      selectionRequired: true,
      onBusinessConfirmed,
    });

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    // Typeahead to Bloom Media, then select with Enter.
    await user.keyboard('b');
    await waitFor(() => {
      const listbox = screen.getByRole('listbox');
      const activeId = listbox.getAttribute('aria-activedescendant');
      const active = screen.getAllByRole('option').find((option) => option.id === activeId);
      expect(active?.textContent).toContain('Bloom Media');
    });
    await user.keyboard('{Enter}');

    await user.click(screen.getByRole('button', { name: /confirm business/i }));
    expect(onBusinessConfirmed).toHaveBeenCalledWith(bloom);
  });
});

/**
 * U11 funnel events: shown events fire once per view-mode occurrence from the
 * state transition, never per render; the confirm handler reports the choice.
 * Payloads carry counts only — never business names or ids.
 */
describe('PortfolioSelector — funnel events (U11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fires invite_receipt_shown once and never again on rerender', () => {
    const { rerender } = renderSelector();

    expect(trackInviteReceiptShownMock).toHaveBeenCalledTimes(1);
    expect(trackInviteReceiptShownMock).toHaveBeenCalledWith({ business_count: 1 });
    expect(trackInviteQuestionShownMock).not.toHaveBeenCalled();

    rerender(
      <PortfolioSelector
        businesses={[acme]}
        selectedBusiness={acme}
        fetchBusinesses={vi.fn().mockResolvedValue([acme, bloom])}
        onBusinessConfirmed={vi.fn()}
      />
    );

    expect(trackInviteReceiptShownMock).toHaveBeenCalledTimes(1);
  });

  it('fires invite_question_shown once after the escape fetch and reports the choice on confirm', async () => {
    const user = userEvent.setup();
    const onBusinessConfirmed = vi.fn();
    renderSelector({
      businesses: [acme, bloom],
      selectedBusiness: null,
      selectionRequired: true,
      onBusinessConfirmed,
    });

    expect(trackInviteQuestionShownMock).toHaveBeenCalledTimes(1);
    expect(trackInviteQuestionShownMock).toHaveBeenCalledWith({ business_count: 2 });

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /Bloom Media/ }));
    await user.click(screen.getByRole('button', { name: /confirm business/i }));

    expect(trackInviteBusinessChosenMock).toHaveBeenCalledTimes(1);
    expect(trackInviteBusinessChosenMock).toHaveBeenCalledWith({ business_count: 2 });
    expect(onBusinessConfirmed).toHaveBeenCalledTimes(1);
  });

  it('re-arms the shown events when the view mode changes again', async () => {
    const user = userEvent.setup();
    const fetchBusinesses = vi.fn().mockResolvedValue([acme, bloom]);
    renderSelector({ fetchBusinesses });

    expect(trackInviteReceiptShownMock).toHaveBeenCalledTimes(1);

    // Receipt → question.
    await user.click(screen.getByRole('button', { name: /choose a different business/i }));
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    expect(trackInviteQuestionShownMock).toHaveBeenCalledTimes(1);
    expect(trackInviteQuestionShownMock).toHaveBeenCalledWith({ business_count: 2 });

    // Question → receipt (original business confirmed).
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /Acme Studio/ }));
    await user.click(screen.getByRole('button', { name: /confirm business/i }));
    expect(await screen.findByText(/sharing from/i)).toBeInTheDocument();
    expect(trackInviteReceiptShownMock).toHaveBeenCalledTimes(2);

    // Receipt → question again: a new occurrence fires once more.
    await user.click(screen.getByRole('button', { name: /choose a different business/i }));
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(trackInviteQuestionShownMock).toHaveBeenCalledTimes(2);
  });

  it('never puts business names or ids in a shown or chosen payload', async () => {
    const user = userEvent.setup();
    renderSelector({
      businesses: [acme, bloom],
      selectedBusiness: null,
      selectionRequired: true,
    });

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /Bloom Media/ }));
    await user.click(screen.getByRole('button', { name: /confirm business/i }));

    for (const mock of [
      trackInviteReceiptShownMock,
      trackInviteQuestionShownMock,
      trackInviteBusinessChosenMock,
    ]) {
      for (const [properties] of mock.mock.calls) {
        expect(JSON.stringify(properties)).not.toContain('Acme Studio');
        expect(JSON.stringify(properties)).not.toContain('Bloom Media');
        expect(JSON.stringify(properties)).not.toContain(ACME_ID);
        expect(JSON.stringify(properties)).not.toContain(BLOOM_ID);
      }
    }
  });
});
