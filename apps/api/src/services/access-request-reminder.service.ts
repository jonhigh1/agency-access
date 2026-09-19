import { prisma } from '@/lib/prisma';
import { env, frontendBaseUrl } from '@/lib/env.js';
import {
  isEmailDeliveryConfigured,
  sendClientInviteReminderEmail,
} from '@/services/email.service.js';

const REMINDER_COOLDOWN_MS = 60 * 60 * 1000;

const AWAITING_CLIENT_STATUSES = new Set(['pending', 'partial']);

function formatExpirationText(expiresAt: Date): string {
  return expiresAt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function reminderIdempotencyKey(accessRequestId: string, now: Date): string {
  const dayBucket = now.toISOString().slice(0, 10);
  return `invite-reminder-${accessRequestId}-${dayBucket}`;
}

function resolveAgencyReplyTo(agency: {
  notificationEmail: string | null;
  email: string;
}): string | undefined {
  const candidate = agency.notificationEmail?.trim() || agency.email?.trim();
  return candidate || env.RESEND_REPLY_TO_EMAIL;
}

export const accessRequestReminderService = {
  async sendInviteReminder(accessRequestId: string) {
    if (!isEmailDeliveryConfigured()) {
      return {
        data: null,
        error: {
          code: 'EMAIL_NOT_CONFIGURED',
          message: 'Email delivery is not configured on this server',
        },
      };
    }

    const accessRequest = await prisma.accessRequest.findUnique({
      where: { id: accessRequestId },
      include: {
        agency: {
          select: {
            id: true,
            name: true,
            email: true,
            notificationEmail: true,
          },
        },
      },
    });

    if (!accessRequest) {
      return {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Access request not found',
        },
      };
    }

    if (!AWAITING_CLIENT_STATUSES.has(accessRequest.status)) {
      return {
        data: null,
        error: {
          code: 'INVALID_STATUS',
          message: 'Reminders can only be sent for pending access requests',
        },
      };
    }

    const clientEmail = accessRequest.clientEmail?.trim();
    if (!clientEmail) {
      return {
        data: null,
        error: {
          code: 'MISSING_CLIENT_EMAIL',
          message: 'This access request does not have a client email address',
        },
      };
    }

    const now = new Date();
    if (accessRequest.lastReminderSentAt) {
      const elapsedMs = now.getTime() - accessRequest.lastReminderSentAt.getTime();
      if (elapsedMs < REMINDER_COOLDOWN_MS) {
        const retryAfterMs = REMINDER_COOLDOWN_MS - elapsedMs;
        const retryAfter = new Date(now.getTime() + retryAfterMs).toISOString();
        return {
          data: null,
          error: {
            code: 'REMINDER_COOLDOWN',
            message: 'A reminder was sent recently. Try again later.',
            details: {
              retryAfter,
              retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
            },
          },
        };
      }
    }

    const baseUrl = frontendBaseUrl();
    const authorizationUrl = `${baseUrl}/invite/${encodeURIComponent(accessRequest.uniqueToken)}`;
    const expirationText = formatExpirationText(accessRequest.expiresAt);

    const emailResult = await sendClientInviteReminderEmail({
      to: clientEmail,
      clientName: accessRequest.clientName,
      agencyName: accessRequest.agency.name,
      authorizationUrl,
      expirationText,
      replyTo: resolveAgencyReplyTo(accessRequest.agency),
      idempotencyKey: reminderIdempotencyKey(accessRequestId, now),
    });

    if (emailResult.error) {
      const providerCode = emailResult.error.code;
      if (providerCode === 'RESEND_NOT_CONFIGURED') {
        return {
          data: null,
          error: {
            code: 'EMAIL_NOT_CONFIGURED',
            message: 'Email delivery is not configured on this server',
          },
        };
      }

      return {
        data: null,
        error: {
          code: 'REMINDER_DELIVERY_FAILED',
          message: 'The reminder email could not be delivered',
        },
      };
    }

    await prisma.accessRequest.update({
      where: { id: accessRequestId },
      data: { lastReminderSentAt: now },
    });

    return {
      data: {
        accessRequestId,
        sentAt: now.toISOString(),
        recipientEmail: clientEmail,
      },
      error: null,
    };
  },
};
