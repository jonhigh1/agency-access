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
  });
});
