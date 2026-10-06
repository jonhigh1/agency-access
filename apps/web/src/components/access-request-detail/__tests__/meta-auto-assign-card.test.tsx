import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetaAutoAssignCard } from '../meta-auto-assign-card';

describe('MetaAutoAssignCard', () => {
  it('separates partner success from team assignment results copy', () => {
    render(
      <MetaAutoAssignCard
        results={[]}
        partnerVerified
        autoAssignEnabled
        onRunAutoAssign={vi.fn(async () => null)}
      />,
    );

    expect(screen.getByText(/Partner share proves/i)).toBeInTheDocument();
    expect(screen.getByText(/never substitutes for Partner share/i)).toBeInTheDocument();
  });

  it('shows per-recipient assignment outcomes', () => {
    render(
      <MetaAutoAssignCard
        results={[
          {
            assetKind: 'page',
            assetId: 'page-1',
            assetName: 'Demo Page',
            recipientType: 'human',
            recipientId: '42',
            recipientName: 'Alex',
            requestedTasks: ['ADVERTISE'],
            verifiedTasks: ['ADVERTISE'],
            status: 'verified',
            attemptedAt: new Date().toISOString(),
          },
        ]}
        partnerVerified
        autoAssignEnabled
      />,
    );

    expect(screen.getByText('Team can work')).toBeInTheDocument();
    expect(screen.getByText(/Demo Page/)).toBeInTheDocument();
    expect(screen.getByText(/Alex/)).toBeInTheDocument();
  });

  it('invokes Auto-Assign when the agency runs it', async () => {
    const user = userEvent.setup();
    const onRun = vi.fn(async () => null);

    render(
      <MetaAutoAssignCard
        results={[]}
        partnerVerified
        autoAssignEnabled
        onRunAutoAssign={onRun}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Run Auto-Assign/i }));
    expect(onRun).toHaveBeenCalled();
  });
});
