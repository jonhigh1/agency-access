import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SendInviteEmailForm } from '../send-invite-email-form';
import { sendAccessRequestInviteEmail } from '@/lib/api/access-requests';
import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';

vi.mock('@/lib/api/access-requests', () => ({
  sendAccessRequestInviteEmail: vi.fn(),
}));

vi.mock('@/lib/analytics/capture-posthog', () => ({
  capturePosthogEvent: vi.fn(),
  capturePosthogEvents: vi.fn(),
}));

const getToken = vi.fn(async () => 'token-123');

function renderForm(defaultEmail = 'client@example.com') {
  return render(
    <SendInviteEmailForm
      accessRequestId="request-123"
      surface="onboarding"
      status="pending"
      defaultEmail={defaultEmail}
      getToken={getToken}
    />
  );
}

describe('SendInviteEmailForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefills the client email and sends the invite through the API', async () => {
    vi.mocked(sendAccessRequestInviteEmail).mockResolvedValue({
      data: { accessRequestId: 'request-123', sentAt: '2026-10-08T12:00:00.000Z' },
    });
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByLabelText('Client email')).toHaveValue('client@example.com');
    await user.click(screen.getByRole('button', { name: /send invite/i }));

    expect(sendAccessRequestInviteEmail).toHaveBeenCalledWith('request-123', 'client@example.com', getToken);
    expect(await screen.findByRole('status')).toHaveTextContent('Invite sent to client@example.com');
    expect(screen.getByRole('button', { name: /sent/i })).toBeInTheDocument();
  });

  it('fires invite_sent with channel=email and access_request_id, never the client email', async () => {
    vi.mocked(sendAccessRequestInviteEmail).mockResolvedValue({
      data: { accessRequestId: 'request-123', sentAt: '2026-10-08T12:00:00.000Z' },
    });
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /send invite/i }));
    await screen.findByRole('status');

    expect(capturePosthogEvent).toHaveBeenCalledTimes(1);
    const [eventName, properties] = vi.mocked(capturePosthogEvent).mock.calls[0];
    expect(eventName).toBe('invite_sent');
    expect(properties).toEqual(
      expect.objectContaining({
        access_request_id: 'request-123',
        channel: 'email',
        delivery: 'authhub',
        surface: 'onboarding',
      })
    );
    expect(JSON.stringify(properties)).not.toContain('@');
  });

  it('shows an inline error and does not track when the send fails', async () => {
    vi.mocked(sendAccessRequestInviteEmail).mockResolvedValue({
      error: { code: 'INVITE_EMAIL_DELIVERY_FAILED', message: 'We could not send the invite email. Try again or copy the link.' },
    });
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /send invite/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not send the invite email');
    expect(capturePosthogEvent).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /send invite/i })).toBeEnabled();
  });

  it('validates the email before calling the API', async () => {
    const user = userEvent.setup();
    renderForm('');

    await user.type(screen.getByLabelText('Client email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /send invite/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid client email address.');
    expect(sendAccessRequestInviteEmail).not.toHaveBeenCalled();
  });
});
