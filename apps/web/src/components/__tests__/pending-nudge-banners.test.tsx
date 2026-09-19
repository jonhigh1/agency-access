import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PendingNudgeBanners } from '../pending-nudge-banners';

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('token-123'),
  }),
}));

vi.mock('@/lib/dev-auth', () => ({
  useAuthOrBypass: () => ({ isDevelopmentBypass: false }),
}));

vi.mock('@/lib/analytics/pending-nudge-events', () => ({
  trackPendingNudgeBannerShown: vi.fn(),
  trackPendingNudgeBannerCta: vi.fn(),
}));

vi.mock('@/lib/analytics/invite-events', () => ({
  trackInviteLinkCopyAndSent: vi.fn(),
  trackInviteReminderSent: vi.fn(),
}));

vi.mock('@/lib/invite-reminder', () => ({
  executeSendInviteReminder: vi.fn(),
}));

vi.mock('@/lib/app-url', () => ({
  buildInviteUrl: (token: string) => `https://app.authhub.co/invite/${token}`,
}));

import * as inviteReminder from '@/lib/invite-reminder';
import * as inviteEvents from '@/lib/analytics/invite-events';

const staleCreatedAt = '2026-03-01T00:00:00.000Z';

describe('PendingNudgeBanners reminder actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows reminder sent when API succeeds', async () => {
    const user = userEvent.setup();
    vi.mocked(inviteReminder.executeSendInviteReminder).mockResolvedValue({ outcome: 'sent' });

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

    await waitFor(() => {
      expect(screen.getByText(/reminder sent to client/i)).toBeInTheDocument();
    });
    expect(inviteReminder.executeSendInviteReminder).toHaveBeenCalled();
  });

  it('shows cooldown message without mailto fallback', async () => {
    const user = userEvent.setup();
    vi.mocked(inviteReminder.executeSendInviteReminder).mockResolvedValue({
      outcome: 'cooldown',
      message: 'Reminder already sent recently. Try again after 1:00 PM.',
    });

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

    await waitFor(() => {
      expect(screen.getByText(/try again after/i)).toBeInTheDocument();
    });
  });

  it('copies link with honest label and tracks copy channel when email is missing', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeText);
    vi.mocked(inviteReminder.executeSendInviteReminder).mockResolvedValue({ outcome: 'copy_only' });

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

    expect(inviteReminder.executeSendInviteReminder).toHaveBeenCalled();
    expect(inviteEvents.trackInviteReminderSent).not.toHaveBeenCalled();
  });
});
