import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ZeroPortfolioPageDiscovery } from '../ZeroPortfolioPageDiscovery';

vi.mock('@/components/ui/single-select', () => ({
  SingleSelect: ({
    options,
    value,
    onChange,
    ariaLabel,
  }: {
    options: Array<{ value: string; label: string }>;
    value: string;
    onChange: (value: string) => void;
    ariaLabel?: string;
  }) => (
    <div>
      <div data-testid={`select-${ariaLabel}`}>{value || 'empty'}</div>
      {options.map((option) => (
        <button key={option.value} type="button" onClick={() => onChange(option.value)}>
          pick-{option.value}
        </button>
      ))}
    </div>
  ),
}));

describe('ZeroPortfolioPageDiscovery', () => {
  it('lists each Page name and ID and gates business creator until primary is selected', () => {
    const onPrimaryPageChange = vi.fn();

    const { rerender } = render(
      <ZeroPortfolioPageDiscovery
        pages={[{ id: '123456789', name: 'Acme Main', category: 'Retail' }]}
        loading={false}
        error={null}
        primaryPageId=""
        onPrimaryPageChange={onPrimaryPageChange}
        businessCreator={<div data-testid="bm-creator">BM Creator</div>}
      />
    );

    expect(screen.getByText('Acme Main')).toBeInTheDocument();
    expect(screen.getByText('Page ID: 123456789')).toBeInTheDocument();
    expect(screen.queryByTestId('bm-creator')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'pick-123456789' }));
    expect(onPrimaryPageChange).toHaveBeenCalledWith('123456789');

    rerender(
      <ZeroPortfolioPageDiscovery
        pages={[{ id: '123456789', name: 'Acme Main', category: 'Retail' }]}
        loading={false}
        error={null}
        primaryPageId="123456789"
        onPrimaryPageChange={onPrimaryPageChange}
        businessCreator={<div data-testid="bm-creator">BM Creator</div>}
      />
    );

    expect(screen.getByTestId('bm-creator')).toBeInTheDocument();
  });
});
