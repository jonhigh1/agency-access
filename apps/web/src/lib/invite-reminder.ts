import {
  buildInviteReminderMailto,
  trackInviteReminderSent,
  type InviteSurface,
} from '@/lib/analytics/invite-events';
import { sendAccessRequestReminder, type ApiError } from '@/lib/api/access-requests';

export type SendInviteReminderResult =
  | { outcome: 'sent' }
  | { outcome: 'cooldown'; message: string; retryAfter?: string }
  | { outcome: 'fallback_mailto' }
  | { outcome: 'copy_only' }
  | { outcome: 'error'; message: string };

export async function executeSendInviteReminder(input: {
  accessRequestId: string;
  accessRequestToken: string;
  status: string;
  surface: InviteSurface;
  clientEmail?: string | null;
  clientName: string;
  authorizationUrl: string;
  expirationText?: string | null;
  getToken: () => Promise<string | null>;
  copyReminderLink: (url: string) => Promise<void>;
}): Promise<SendInviteReminderResult> {
  const clientEmail = input.clientEmail?.trim();

  if (!clientEmail) {
    await input.copyReminderLink(input.authorizationUrl);
    trackInviteReminderSent({
      access_request_id: input.accessRequestId,
      access_request_token: input.accessRequestToken,
      status: input.status,
      channel: 'copy',
      surface: input.surface,
    });
    return { outcome: 'copy_only' };
  }

  const apiResult = await sendAccessRequestReminder(input.accessRequestId, input.getToken);

  if (apiResult.data) {
    trackInviteReminderSent({
      access_request_id: input.accessRequestId,
      access_request_token: input.accessRequestToken,
      status: input.status,
      channel: 'email',
      surface: input.surface,
    });
    return { outcome: 'sent' };
  }

  const error = apiResult.error as ApiError | undefined;
  if (error?.code === 'REMINDER_COOLDOWN') {
    const retryAfter = error.details?.retryAfter as string | undefined;
    const retryLabel = retryAfter
      ? new Date(retryAfter).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : 'later';
    return {
      outcome: 'cooldown',
      message: `Reminder already sent recently. Try again after ${retryLabel}.`,
      retryAfter,
    };
  }

  if (
    error?.code === 'EMAIL_NOT_CONFIGURED' ||
    error?.code === 'NETWORK_ERROR' ||
    error?.code === 'REMINDER_DELIVERY_FAILED'
  ) {
    const mailtoHref = buildInviteReminderMailto({
      clientEmail,
      clientName: input.clientName,
      authorizationUrl: input.authorizationUrl,
      expirationText: input.expirationText,
    });
    window.location.assign(mailtoHref);
    return { outcome: 'fallback_mailto' };
  }

  return {
    outcome: 'error',
    message: error?.message ?? 'Could not send reminder.',
  };
}
