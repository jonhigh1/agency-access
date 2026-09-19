import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PendingNudgeBanners } from '../pending-nudge-banners';

vi.mock('@/lib/analytics/pending-nudge-events', () => ({
  trackPendingNudgeBannerShown: vi.fn(),
  trackPendingNudgeBannerCta: vi.fn(),
}));

vi.mock('@/lib/analytics/invite-events', () => ({
  buildInviteReminderMailto: vi.fn(() => 'mailto:client@example.com?subject=reminder'),
  trackInviteLinkCopyAndSent: vi.fn(),
  trackInviteReminderSent: vi.fn(),
}));

vi.mock('@/lib/app-url', () => ({
  buildInviteUrl: (token: string) => `https://app.authhub.co/invite/${token}`,
}));

import * as inviteEvents from '@/lib/analytics/invite-events';

const staleCreatedAt = '2026-03-01T00:00:00.000Z';

describe('PendingNudgeBanners reminder actions', () => {
  const locationAssign = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    locationAssign.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign: locationAssign },
    });
  });

  it('opens reminder mailto and tracks email channel when client email is present', async () => {
    const user = userEvent.setup();

    render(
      <PendingNudgeBanners
        surface="dashboard"
        requests={[
          {
            id: 'req-1',
            clientName: 'Acme Client',
            clientEmail: 'owner@acme.com',
            status: 'pending',
            createdAt: staleCreatedAt,
            uniqueToken: 'token-1',
          },
        ]}
      />
    );

    await user.click(screen.getByRole('button', { name: /send reminder/i }));

    expect(inviteEvents.buildInviteReminderMailto).toHaveBeenCalledWith(
      expect.objectContaining({
        clientEmail: 'owner@acme.com',
        clientName: 'Acme Client',
        authorizationUrl: 'https://app.authhub.co/invite/token-1',
      })
    );
    expect(locationAssign).toHaveBeenCalledWith('mailto:client@example.com?subject=reminder');
    expect(inviteEvents.trackInviteReminderSent).toHaveBeenCalledWith({
      access_request_id: 'req-1',
      access_request_token: 'token-1',
      status: 'pending',
      channel: 'email',
      surface: 'dashboard',
    });
  });

  it('copies link with honest label and tracks copy channel when email is missing', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeText);

    render(
      <PendingNudgeBanners
        surface="detail"
        requests={[
          {
            id: 'req-2',
            clientName: 'No Email Client',
            clientEmail: '',
            status: 'pending',
            createdAt: staleCreatedAt,
            uniqueToken: 'token-2',
          },
        ]}
      />
    );

    expect(screen.getByRole('button', { name: /copy reminder link/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /copy reminder link/i }));

    expect(writeText).toHaveBeenCalledWith('https://app.authhub.co/invite/token-2');
    expect(inviteEvents.trackInviteReminderSent).toHaveBeenCalledWith({
      access_request_id: 'req-2',
      access_request_token: 'token-2',
      status: 'pending',
      channel: 'copy',
      surface: 'detail',
    });
    expect(locationAssign).not.toHaveBeenCalled();
  });
});
