import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InviteLoadStateCard } from '../invite-load-state-card';

describe('InviteLoadStateCard', () => {
  it('renders timeout recovery actions with the public support destination', async () => {
    const onRetry = vi.fn();

    render(
      <InviteLoadStateCard
        phase="timeout"
        message="This is taking longer than expected."
        onRetry={onRetry}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: /still working on it/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /contact support/i })).toHaveAttribute('href', '/contact');
    expect(screen.queryByText(/nothing has been shared/i)).not.toBeInTheDocument();
  });

  it('does not call the link broken when the load failed without a terminal code', () => {
    render(
      <InviteLoadStateCard
        phase="error"
        message="Failed to load authorization request."
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /couldn't load this request/i })).toBeInTheDocument();
    expect(screen.queryByText(/not working|invalid or expired/i)).not.toBeInTheDocument();
  });
});
