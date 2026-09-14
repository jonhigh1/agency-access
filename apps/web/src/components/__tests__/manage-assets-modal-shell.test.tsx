import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ManageAssetsModalShell } from '../manage-assets-modal-shell';
import { SingleSelect } from '../ui/single-select';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
  m: {
    div: ({ children, animate, initial, exit, transition, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
    button: ({ children, animate, initial, exit, transition, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
  },
}));

const baseProps = {
  title: 'Meta Assets',
  description: 'Manage the Meta assets connected to this client.',
};

function renderShell(overrides: Partial<Parameters<typeof ManageAssetsModalShell>[0]> = {}) {
  const onClose = vi.fn();
  const props: Parameters<typeof ManageAssetsModalShell>[0] = {
    ...baseProps,
    isOpen: true,
    onClose,
    children: <p>Shell content</p>,
    ...overrides,
  };
  const view = render(<ManageAssetsModalShell {...props} />);
  return { onClose, ...view };
}

describe('ManageAssetsModalShell behavior', () => {
  it('renders a modal dialog with the title when open', () => {
    renderShell();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Meta Assets')).toBeInTheDocument();
    expect(screen.getByText('Shell content')).toBeInTheDocument();
  });

  it('removes the dialog when closed', () => {
    const { rerender } = renderShell();

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    rerender(
      <ManageAssetsModalShell {...baseProps} isOpen={false} onClose={vi.fn()}>
        <p>Shell content</p>
      </ManageAssetsModalShell>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the modal on Escape', () => {
    const { onClose } = renderShell();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close the modal when Escape closes an open SingleSelect dropdown from the trigger', () => {
    const { onClose } = renderShell({
      children: (
        <SingleSelect
          options={[
            { value: 'campaign-a', label: 'Campaign A' },
            { value: 'campaign-b', label: 'Campaign B' },
          ]}
          value="campaign-a"
          onChange={vi.fn()}
          ariaLabel="Campaign"
        />
      ),
    });

    const trigger = screen.getByRole('combobox', { name: 'Campaign' });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close the modal when Escape closes the dropdown while option focus is inside the listbox', () => {
    const { onClose } = renderShell({
      children: (
        <SingleSelect
          options={[
            { value: 'campaign-a', label: 'Campaign A' },
            { value: 'campaign-b', label: 'Campaign B' },
          ]}
          value="campaign-a"
          onChange={vi.fn()}
          ariaLabel="Campaign"
        />
      ),
    });

    const trigger = screen.getByRole('combobox', { name: 'Campaign' });
    fireEvent.click(trigger);
    const option = screen.getByRole('option', { name: 'Campaign B' });

    fireEvent.keyDown(option, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
