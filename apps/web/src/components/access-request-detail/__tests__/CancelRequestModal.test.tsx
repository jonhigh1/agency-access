import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CancelRequestModal } from '../CancelRequestModal';

describe('CancelRequestModal', () => {
  it('renders an error alert when errorMessage is provided', () => {
    render(
      <CancelRequestModal
        requestName="Acme Client"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
        errorMessage="Your session has expired."
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Your session has expired.');
  });

  it('does not close and does not throw when onConfirm rejects', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockRejectedValue(new Error('boom'));

    render(
      <CancelRequestModal requestName="Acme Client" onConfirm={onConfirm} onClose={onClose} />
    );

    await user.click(screen.getByRole('button', { name: /^cancel request$/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
