import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CancelRequestModal } from '../CancelRequestModal';

describe('CancelRequestModal', () => {
  it('shows a visible error and stops pending state when cancellation fails', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Request timed out. Please try again.'));

    render(
      <CancelRequestModal
        requestName="Acme"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Request' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Request timed out. Please try again.');
    expect(screen.getByRole('button', { name: 'Cancel Request' })).toBeEnabled();
    expect(screen.queryByText('Cancelling...')).not.toBeInTheDocument();
  });
});
