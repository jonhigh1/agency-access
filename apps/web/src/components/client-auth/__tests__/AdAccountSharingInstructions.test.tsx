import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdAccountSharingInstructions } from '../AdAccountSharingInstructions';

vi.mock('../BusinessIdDisplay', () => ({
  BusinessIdDisplay: ({ businessId }: { businessId: string }) => <div>{businessId}</div>,
}));

describe('AdAccountSharingInstructions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';
  });

  it('shows the waiting verification state without completing when manual Meta share is still pending', async () => {
    const onComplete = vi.fn();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            success: true,
            status: 'waiting_for_manual_share',
            partnerBusinessId: 'partner-bm-1',
            partnerBusinessName: 'Outdoor DIY',
            verificationResults: [
              {
                assetId: 'act_1',
                assetName: 'DogTimez',
                status: 'waiting_for_manual_share',
                errorMessage: 'Still pending verification',
              },
            ],
          },
          error: null,
        }),
    } as Response);

    render(
      <AdAccountSharingInstructions
        businessId="partner-bm-1"
        businessName="Outdoor DIY"
        selectedAdAccounts={[{ id: 'act_1', name: 'DogTimez' }]}
        accessRequestToken="token-1"
        connectionId="conn-1"
        onComplete={onComplete}
      />
    );

    expect(await screen.findByText('Waiting for access to be granted... 0/1')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/if meta blocks the assignment and asks for two-factor authentication/i);
    expect(screen.getByText('DogTimez: Still pending verification')).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('starts manual share tracking and verifies access through the new Meta manual-share routes', async () => {
    const onComplete = vi.fn();

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              success: true,
              status: 'waiting_for_manual_share',
              partnerBusinessId: 'partner-bm-1',
              partnerBusinessName: 'Outdoor DIY',
              selectedAdAccounts: [{ id: 'act_1', name: 'DogTimez' }],
              startedAt: '2026-03-11T12:00:00.000Z',
            },
            error: null,
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              success: true,
              partial: false,
              status: 'verified',
              partnerBusinessId: 'partner-bm-1',
              partnerBusinessName: 'Outdoor DIY',
              verificationResults: [
                {
                  assetId: 'act_1',
                  assetName: 'DogTimez',
                  status: 'verified',
                  verifiedAt: '2026-03-11T12:02:00.000Z',
                },
              ],
            },
            error: null,
          }),
      } as Response);

    render(
      <AdAccountSharingInstructions
        businessId="partner-bm-1"
        businessName="Outdoor DIY"
        selectedAdAccounts={[{ id: 'act_1', name: 'DogTimez' }]}
        accessRequestToken="token-1"
        connectionId="conn-1"
        onComplete={onComplete}
      />
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/client/token-1/meta/manual-ad-account-share/start',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            connectionId: 'conn-1',
          }),
        })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /check access/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/client/token-1/meta/manual-ad-account-share/verify',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            connectionId: 'conn-1',
          }),
        })
      );
    });

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/ad-accounts-shared'),
      expect.anything()
    );
  });

  it('treats partial manual verification as a completable state', async () => {
    const onComplete = vi.fn();

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              success: true,
              status: 'waiting_for_manual_share',
              partnerBusinessId: 'partner-bm-1',
            },
            error: null,
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              success: false,
              partial: true,
              status: 'partial',
              partnerBusinessId: 'partner-bm-1',
              verificationResults: [
                {
                  assetId: 'act_1',
                  assetName: 'DogTimez',
                  status: 'verified',
                  verifiedAt: '2026-03-11T12:02:00.000Z',
                },
                {
                  assetId: 'act_2',
                  assetName: 'Still Pending',
                  status: 'unresolved',
                  errorMessage: 'Ad account has not been shared to the agency business portfolio yet',
                },
              ],
            },
            error: null,
          }),
      } as Response);

    render(
      <AdAccountSharingInstructions
        businessId="partner-bm-1"
        selectedAdAccounts={[
          { id: 'act_1', name: 'DogTimez' },
          { id: 'act_2', name: 'Still Pending' },
        ]}
        accessRequestToken="token-1"
        connectionId="conn-1"
        onComplete={onComplete}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /check access/i }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'partial',
        })
      );
    });
  });
});
