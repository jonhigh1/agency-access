import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';

export type InviteSurface = 'invite_page' | 'detail' | 'success' | 'modal' | 'onboarding';
export type InviteChannel = 'copy' | 'email' | 'sms';

type InviteOpenedProps = {
  access_request_token: string;
  access_request_id?: string | null;
  status?: string | null;
  surface: InviteSurface;
  agency_name?: string | null;
  client_name?: string | null;
  platform_count?: number;
};

type InviteLinkCopiedProps = {
  access_request_id: string;
  access_request_token: string;
  status?: string | null;
  surface: InviteSurface;
};

type InviteSentProps = {
  access_request_id: string;
  access_request_token: string;
  channel: InviteChannel;
  surface: InviteSurface;
  status?: string | null;
};

type InviteReminderSentProps = {
  access_request_id: string;
  access_request_token: string;
  status: string;
  channel: InviteChannel;
  surface: InviteSurface;
};

function captureInviteEvent(eventName: string, properties: Record<string, unknown>): void {
  void capturePosthogEvent(eventName, properties);
}

export function trackInviteOpened(properties: InviteOpenedProps): void {
  captureInviteEvent('invite_opened', properties);
}

export function trackInviteLinkCopied(properties: InviteLinkCopiedProps): void {
  captureInviteEvent('invite_link_copied', properties);
}

export function trackInviteSent(properties: InviteSentProps): void {
  captureInviteEvent('invite_sent', properties);
}

export function trackInviteReminderSent(properties: InviteReminderSentProps): void {
  captureInviteEvent('invite_reminder_sent', properties);
}

const INVITE_OPENED_SESSION_PREFIX = 'invite-opened:';

export function trackInviteOpenedOncePerSession(properties: InviteOpenedProps): void {
  if (typeof window === 'undefined') {
    trackInviteOpened(properties);
    return;
  }

  const sessionKey = `${INVITE_OPENED_SESSION_PREFIX}${properties.access_request_token}`;
  try {
    if (sessionStorage.getItem(sessionKey)) {
      return;
    }
    sessionStorage.setItem(sessionKey, '1');
  } catch {
    // sessionStorage unavailable — still track once this page load.
  }

  trackInviteOpened(properties);
}

export function buildInviteReminderMailto(input: {
  clientEmail: string;
  clientName: string;
  authorizationUrl: string;
  expirationText?: string | null;
}): string {
  const expirationLine = input.expirationText
    ? `\n\nThis link expires on ${input.expirationText}.`
    : '';

  const subject = encodeURIComponent('Reminder: authorize platform access when ready');
  const body = encodeURIComponent(
    `Hi ${input.clientName},\n\nThis is a friendly reminder to authorize platform access when you're ready. Open the secure link below and complete authorization on your schedule — we only receive access tokens after you finish.${expirationLine}\n\n${input.authorizationUrl}\n\nIf you were not expecting this request, contact us before continuing.`
  );

  return `mailto:${encodeURIComponent(input.clientEmail)}?subject=${subject}&body=${body}`;
}

export function buildInviteSentMailto(input: {
  clientEmail: string;
  clientName: string;
  authorizationUrl: string;
  expirationText?: string | null;
}): string {
  const expirationLine = input.expirationText
    ? `\n\nThis link expires on ${input.expirationText}.`
    : '';

  const subject = encodeURIComponent(`Authorize platform access for ${input.clientName}`);
  const body = encodeURIComponent(
    `Hi ${input.clientName},\n\nWhen you're ready, use this secure link to authorize platform access. Tokens are issued only after you complete authorization.${expirationLine}\n\n${input.authorizationUrl}\n\nIf you were not expecting this request, contact us before continuing.`
  );

  return `mailto:${encodeURIComponent(input.clientEmail)}?subject=${subject}&body=${body}`;
}
