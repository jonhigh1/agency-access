import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PendingNudgeBanner } from '../pending-nudge-banner';

vi.mock('@/lib/analytics/pending-nudge-events', () => ({
  trackPendingNudgeBannerShown: vi.fn(),
  trackPendingNudgeBannerCta: vi.fn(),
}));

import {
  trackPendingNudgeBannerShown,
  trackPendingNudgeBannerCta,
} from '@/lib/analytics/pending-nudge-events';

const baseProps = {
  accessRequestId: 'req-1',
  accessRequestToken: 'token-1',
  clientName: 'Acme Client',
  cliff: '24h' as const,
  surface: 'dashboard' as const,
  onCopyLink: vi.fn(),
  onSendReminder: vi.fn(),
  onDismiss: vi.fn(),
};

describe('PendingNudgeBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 24h cliff copy and tracks impression once', () => {
    render(<PendingNudgeBanner {...baseProps} />);

    expect(screen.getByText(/still pending after 24 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/Acme Client/)).toBeInTheDocument();
    expect(trackPendingNudgeBannerShown).toHaveBeenCalledWith({
      access_request_id: 'req-1',
      access_request_token: 'token-1',
      cliff: '24h',
      surface: 'dashboard',
    });
    expect(trackPendingNudgeBannerShown).toHaveBeenCalledTimes(1);
  });

  it('renders 72h cliff copy', () => {
    render(<PendingNudgeBanner {...baseProps} cliff="72h" surface="detail" />);

    expect(screen.getByText(/still pending after 3 days/i)).toBeInTheDocument();
    expect(trackPendingNudgeBannerShown).toHaveBeenCalledWith(
      expect.objectContaining({ cliff: '72h', surface: 'detail' })
    );
  });

  it('fires CTA analytics and handlers for copy link and send reminder', async () => {
    const user = userEvent.setup();
    const onCopyLink = vi.fn();
    const onSendReminder = vi.fn();

    render(
      <PendingNudgeBanner
        {...baseProps}
        onCopyLink={onCopyLink}
        onSendReminder={onSendReminder}
      />
    );

    await user.click(screen.getByRole('button', { name: /copy link/i }));
    expect(onCopyLink).toHaveBeenCalledTimes(1);
    expect(trackPendingNudgeBannerCta).toHaveBeenCalledWith(
      expect.objectContaining({ cta: 'copy_link' })
    );

    await user.click(screen.getByRole('button', { name: /send reminder/i }));
    expect(onSendReminder).toHaveBeenCalledTimes(1);
    expect(trackPendingNudgeBannerCta).toHaveBeenCalledWith(
      expect.objectContaining({ cta: 'send_reminder' })
    );
  });

  it('tracks dismiss CTA and calls onDismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(<PendingNudgeBanner {...baseProps} onDismiss={onDismiss} />);

    await user.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(trackPendingNudgeBannerCta).toHaveBeenCalledWith(
      expect.objectContaining({ cta: 'dismiss' })
    );
  });
});
