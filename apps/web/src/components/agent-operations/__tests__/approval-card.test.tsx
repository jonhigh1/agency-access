import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalCard } from '../approval-card';

const operation = {
  id: 'op-1', actionType: 'access_request.dispatch', riskClass: 'consequential', status: 'pending_approval',
  approvalPreview: {
    agency: { id: 'agency-1', name: 'Northstar' }, client: { id: 'client-1', name: 'Acme' },
    platforms: ['google_ads'], permissions: ['manage'], externalEffect: 'Create one request and email one authorization link',
    requestingAgent: { grantId: 'grant-1', oauthClientId: 'oauth-1', displayName: 'Chief of Staff' },
    expiresAt: '2026-07-17T12:00:00.000Z', changes: [{ field: 'access', before: 'view', after: 'manage' }],
  },
};

describe('ApprovalCard', () => {
  it('explains the target, effect, agent, expiry, permissions, and changes before deciding', async () => {
    const onDecision = vi.fn();
    const user = userEvent.setup();
    render(<ApprovalCard operation={operation} onDecision={onDecision} />);
    expect(screen.getByText('Northstar')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Chief of Staff')).toBeInTheDocument();
    expect(screen.getByText('Google Ads')).toBeInTheDocument();
    expect(screen.getByText('Manage')).toBeInTheDocument();
    expect(screen.getByText('Create one request and email one authorization link')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Approve and allow execution' }));
    expect(onDecision).toHaveBeenCalledWith('approved');
  });

  it('renders expired and decided operations as non-actionable', () => {
    render(<ApprovalCard operation={{ ...operation, status: 'expired' }} onDecision={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Approve and allow execution' })).not.toBeInTheDocument();
    expect(screen.getByText('This operation is no longer awaiting a decision.')).toBeInTheDocument();
  });
});
