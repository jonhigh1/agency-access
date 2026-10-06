import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RequestPlatformsCard } from '../request-platforms-card';

vi.mock('../shopify-submission-panel', () => ({
  ShopifySubmissionPanel: () => <div>Shopify Submission Panel</div>,
}));

describe('RequestPlatformsCard', () => {
  it('shows unresolved requested products when authorization progress includes follow-up items', () => {
    render(
      <RequestPlatformsCard
        request={{
          id: 'request-1',
          agencyId: 'agency-1',
          clientName: 'Client',
          clientEmail: 'client@example.com',
          platforms: [
            {
              platformGroup: 'google',
              products: [{ product: 'google_ads', accessLevel: 'admin', accounts: [] }],
            },
          ],
          status: 'partial',
          uniqueToken: 'token-123',
          expiresAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          authorizationProgress: {
            completedPlatforms: [],
            isComplete: false,
            fulfilledProducts: [],
            unresolvedProducts: [
              {
                product: 'google_ads',
                platformGroup: 'google',
                reason: 'no_assets',
              },
            ],
          },
        }}
      />
    );

    expect(screen.getByText(/still needs follow-up/i)).toBeInTheDocument();
    expect(screen.getByText(/google ads · no assets found/i)).toBeInTheDocument();
  });

  it('requires acknowledgment before confirming reported manual access and submits once', async () => {
    const user = userEvent.setup();
    let resolveConfirmation: ((value: string | null) => void) | undefined;
    const onConfirmManualAccess = vi.fn(
      () => new Promise<string | null>((resolve) => { resolveConfirmation = resolve; })
    );

    render(
      <RequestPlatformsCard
        request={{
          id: 'request-1',
          agencyId: 'agency-1',
          clientName: 'Client',
          clientEmail: 'client@example.com',
          platforms: [{
            platformGroup: 'shopify',
            products: [{ product: 'shopify', accessLevel: 'admin', accounts: [] }],
          }],
          status: 'partial',
          uniqueToken: 'token-123',
          expiresAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          manualConfirmations: [{ platform: 'shopify', verificationStatus: 'pending' }],
        }}
        onConfirmManualAccess={onConfirmManualAccess}
      />
    );

    const button = screen.getByRole('button', { name: 'Confirm access manually' });
    expect(button).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /checked shopify access in the native platform/i }));
    await user.click(button);
    await user.click(button);

    expect(onConfirmManualAccess).toHaveBeenCalledTimes(1);
    expect(onConfirmManualAccess).toHaveBeenCalledWith('shopify');
    expect(button).toHaveAttribute('aria-busy', 'true');

    resolveConfirmation?.(null);
    await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'));
  });

  it('shows an honest retry state when manual confirmation fails', async () => {
    const user = userEvent.setup();
    const onConfirmManualAccess = vi.fn().mockResolvedValue('Could not confirm access. Try again.');

    render(
      <RequestPlatformsCard
        request={{
          id: 'request-1',
          agencyId: 'agency-1',
          clientName: 'Client',
          clientEmail: 'client@example.com',
          platforms: [{
            platformGroup: 'beehiiv',
            products: [{ product: 'beehiiv', accessLevel: 'admin', accounts: [] }],
          }],
          status: 'partial',
          uniqueToken: 'token-123',
          expiresAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          manualConfirmations: [{ platform: 'beehiiv', verificationStatus: 'pending' }],
        }}
        onConfirmManualAccess={onConfirmManualAccess}
      />
    );

    await user.click(screen.getByRole('checkbox', { name: /checked beehiiv access in the native platform/i }));
    await user.click(screen.getByRole('button', { name: 'Confirm access manually' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm access. Try again.');
    expect(screen.getByRole('button', { name: 'Try confirmation again' })).toBeEnabled();
  });

  it('labels verified manual access without offering another confirmation', () => {
    render(
      <RequestPlatformsCard
        request={{
          id: 'request-1',
          agencyId: 'agency-1',
          clientName: 'Client',
          clientEmail: 'client@example.com',
          platforms: [{
            platformGroup: 'mailchimp',
            products: [{ product: 'mailchimp', accessLevel: 'admin', accounts: [] }],
          }],
          status: 'completed',
          uniqueToken: 'token-123',
          expiresAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          manualConfirmations: [{
            platform: 'mailchimp',
            verificationStatus: 'verified',
            verificationMethod: 'manual_review',
            verifiedAt: '2026-10-04T12:00:00.000Z',
          }],
        }}
        onConfirmManualAccess={vi.fn()}
      />
    );

    expect(screen.getByText('Confirmed by agency')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm access manually' })).not.toBeInTheDocument();
  });
});
