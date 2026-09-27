import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdAccountSharingInstructions } from '../AdAccountSharingInstructions';

const { trackInviteGrantChecklistToggledMock, trackInviteVerifyResultMock } = vi.hoisted(() => ({
  trackInviteGrantChecklistToggledMock: vi.fn(),
  trackInviteVerifyResultMock: vi.fn(),
}));

vi.mock('@/lib/analytics/invite-events', () => ({
  trackInviteGrantChecklistToggled: trackInviteGrantChecklistToggledMock,
  trackInviteVerifyResult: trackInviteVerifyResultMock,
}));

describe('AdAccountSharingInstructions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    sessionStorage.clear();
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

describe('AdAccountSharingInstructions - stateful manual-grant checklist (U9)', () => {
  const baseProps = {
    businessId: 'partner-bm-1',
    businessName: 'Outdoor DIY',
    selectedAdAccounts: [{ id: 'act_1', name: 'DogTimez' }],
    accessRequestToken: 'token-1',
    connectionId: 'conn-1',
  };

  const renderInstructions = (overrides: Record<string, unknown> = {}) => {
    // Every mount POSTs the start endpoint; keep it on the waiting state so
    // the checklist is what the test drives.
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: { success: true, status: 'waiting_for_manual_share' },
          error: null,
        }),
    } as Response);

    return render(
      <AdAccountSharingInstructions
        {...baseProps}
        {...(overrides as typeof baseProps)}
      />
    );
  };

  const stepCheckbox = (name: RegExp) => screen.getByRole('checkbox', { name });

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    sessionStorage.clear();
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/';
  });

  it('renders the numbered steps and sub-steps as unchecked checklist rows', async () => {
    renderInstructions();

    const checkboxes = await screen.findAllByRole('checkbox');
    expect(checkboxes).toHaveLength(7);
    checkboxes.forEach((checkbox) => {
      expect(checkbox).not.toBeChecked();
    });

    // Numbered rendering: two steps, five numbered sub-steps.
    ['1', '2', '2.1', '2.2', '2.3', '2.4', '2.5'].forEach((number) => {
      expect(screen.getByText(number)).toBeInTheDocument();
    });

    // Row copy renders (title case for the two steps, instruction text for
    // the sub-steps).
    expect(screen.getByText('Select Assets')).toBeInTheDocument();
    expect(screen.getByText('Share Asset')).toBeInTheDocument();
    expect(screen.getByText(/Assign Partner/)).toBeInTheDocument();
    expect(screen.getByText(/Wait for the indicator/)).toBeInTheDocument();
  });

  it('toggles a row on click and restores the check state on remount in the same session', async () => {
    const first = renderInstructions();

    const row = await screen.findByRole('checkbox', { name: /assign partner/i });
    expect(row).not.toBeChecked();
    fireEvent.click(row);
    expect(row).toBeChecked();

    first.unmount();
    renderInstructions();

    expect(await screen.findByRole('checkbox', { name: /assign partner/i })).toBeChecked();
    // Sibling rows stay unchecked: state is per row.
    expect(stepCheckbox(/select assets/i)).not.toBeChecked();
  });

  it('scopes the check state to the request token and business, so another business starts unchecked', async () => {
    const first = renderInstructions();

    const row = await screen.findByRole('checkbox', { name: /manage ad accounts/i });
    fireEvent.click(row);
    expect(row).toBeChecked();

    first.unmount();
    renderInstructions({ businessId: 'partner-bm-99' });

    expect(await screen.findByRole('checkbox', { name: /manage ad accounts/i })).not.toBeChecked();
  });

  it('copies the agency business ID with one tap and confirms accessibly via role="status"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    renderInstructions();

    fireEvent.click(await screen.findByRole('button', { name: /^copy$/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('partner-bm-1');
    });
    expect(screen.getByRole('status')).toHaveTextContent('Copied');
  });

  it('frames the task in plain language and reassures about revocation exactly once', async () => {
    renderInstructions();

    await screen.findByRole('checkbox', { name: /select assets/i });

    // One-sentence intro: what the client is doing and why.
    expect(screen.getByText(/this gives outdoor diy access to the 1 ad account/i)).toHaveTextContent(
      /run ads for you/i
    );
    // Scope note: "Manage ad accounts" means running ads — nothing else.
    expect(
      screen.getByText(/create and run ads in your accounts/i)
    ).toHaveTextContent(/nothing else/i);

    // Revocation reassurance, rendered once near the steps.
    expect(
      screen.getAllByText(/remove this access anytime in meta business settings/i)
    ).toHaveLength(1);
  });

  it('reports invite_grant_checklist_toggled once per row check and uncheck (U11)', async () => {
    renderInstructions();

    const row = await screen.findByRole('checkbox', { name: /select assets/i });
    fireEvent.click(row);
    fireEvent.click(row);

    expect(trackInviteGrantChecklistToggledMock).toHaveBeenCalledTimes(2);
    expect(trackInviteGrantChecklistToggledMock).toHaveBeenNthCalledWith(1, {
      row_id: 'step-1',
      checked: true,
    });
    expect(trackInviteGrantChecklistToggledMock).toHaveBeenNthCalledWith(2, {
      row_id: 'step-1',
      checked: false,
    });
  });

  it('reports invite_verify_result with the server-truth kind and counts (U11)', async () => {
    const onComplete = vi.fn();

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: { success: true, status: 'waiting_for_manual_share' },
            error: null,
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              success: true,
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
                  assetName: 'CatTimez',
                  status: 'unresolved',
                  errorMessage: 'Still pending',
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
        selectedAdAccounts={[
          { id: 'act_1', name: 'DogTimez' },
          { id: 'act_2', name: 'CatTimez' },
        ]}
        accessRequestToken="token-1"
        connectionId="conn-1"
        onComplete={onComplete}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: /check access/i }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
    expect(trackInviteVerifyResultMock).toHaveBeenCalledTimes(1);
    expect(trackInviteVerifyResultMock).toHaveBeenCalledWith({
      result_kind: 'partial',
      verified_count: 1,
      unresolved_count: 1,
    });
  });
});
