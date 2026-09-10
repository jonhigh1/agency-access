import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AssetGroup } from '../AssetGroup';

const assets = [
  { id: 'a1', name: 'Acme Ads' },
  { id: 'a2', name: 'Acme Pages' },
];

describe('AssetGroup', () => {
  it('renders the group title and selection count', () => {
    render(
      <AssetGroup title="Ad Accounts" assets={assets} selectedIds={new Set()} onSelectionChange={vi.fn()} />
    );

    expect(screen.getByText('Ad Accounts')).toBeInTheDocument();
    expect(screen.getByText(/0 of 2 selected/i)).toBeInTheDocument();
  });

  it('exposes checkbox state on select-all and expanded state on collapse', () => {
    function Harness() {
      const [selected, setSelected] = useState<Set<string>>(new Set());
      return (
        <AssetGroup
          title="Ad Accounts"
          assets={assets}
          selectedIds={selected}
          onSelectionChange={setSelected}
        />
      );
    }
    render(<Harness />);

    const selectAll = screen.getByRole('checkbox', { name: /select all ad accounts/i });
    expect(selectAll).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(selectAll);
    expect(selectAll).toHaveAttribute('aria-checked', 'true');

    const collapse = screen.getByRole('button', { name: /collapse ad accounts/i });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
  });
});
