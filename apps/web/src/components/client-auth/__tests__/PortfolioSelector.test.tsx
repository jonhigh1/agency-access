import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PortfolioSelector, type PortfolioBusiness } from '../PortfolioSelector';

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
