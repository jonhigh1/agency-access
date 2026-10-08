/**
 * Access request invite email: the agency asks AuthHub to email the invite
 * link to its client. Sent through the existing Resend integration from
 * "<Agency name> via AuthHub" with reply-to set to the agency user.
 *
 * Abuse guards (no schema change; counts come from audit_logs):
 * - caller must own the access request (checked by agency id)
 * - request must be pending/partial and not expired
 * - per request: 1 send per 60s, 5 sends per 24h
 * - per agency: 20 sends per hour
 */

import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { env, frontendBaseUrl } from '@/lib/env.js';
import { buildClientInviteEmailContent, buildInviteFromHeader } from '@/lib/client-invite-email.js';
import { isEmailDeliveryConfigured, sendEmail } from '@/services/email.service.js';
import { auditService } from '@/services/audit.service.js';

export const INVITE_EMAIL_AUDIT_ACTION = 'ACCESS_REQUEST_INVITE_EMAIL_SENT';

export const INVITE_EMAIL_LIMITS = {
  perRequestCooldownMs: 60 * 1000,
  perRequestWindowMs: 24 * 60 * 60 * 1000,
  perRequestMax: 5,
  perAgencyWindowMs: 60 * 60 * 1000,
  perAgencyMax: 20,
} as const;

const AWAITING_CLIENT_STATUSES = new Set(['pending', 'partial']);
const EMAIL_PATTERN = /^[^\s@<>"(),;:\\[\]]+@[^\s@<>"(),;:\\[\]]+\.[^\s@<>"(),;:\\[\]]{2,}$/;

export type InviteEmailErrorCode =
  | 'INVALID_EMAIL'
  | 'EMAIL_NOT_CONFIGURED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INVALID_STATUS'
  | 'REQUEST_EXPIRED'
  | 'INVITE_EMAIL_COOLDOWN'
  | 'INVITE_EMAIL_LIMIT'
  | 'INVITE_EMAIL_DELIVERY_FAILED';

type ServiceError = {
  code: InviteEmailErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

type ServiceResult =
  | { data: { accessRequestId: string; sentAt: string }; error: null }
  | { data: null; error: ServiceError };

export function normalizeInviteRecipientEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254) return null;
  if (!EMAIL_PATTERN.test(email)) return null;
  return email;
}

function fail(code: InviteEmailErrorCode, message: string, details?: Record<string, unknown>): ServiceResult {
  return { data: null, error: details ? { code, message, details } : { code, message } };
}

function idempotencyKey(accessRequestId: string, recipient: string, now: Date): string {
  const recipientHash = createHash('sha256').update(recipient).digest('hex').slice(0, 16);
  const minuteBucket = Math.floor(now.getTime() / 60_000);
  return `invite-email-${accessRequestId}-${recipientHash}-${minuteBucket}`;
}

function resolveReplyTo(
  senderEmail: string | null | undefined,
  agency: { email: string | null; notificationEmail: string | null }
): string | undefined {
  return (
    senderEmail?.trim() ||
    agency.notificationEmail?.trim() ||
    agency.email?.trim() ||
    env.RESEND_REPLY_TO_EMAIL ||
    undefined
  );
}

export const accessRequestInviteEmailService = {
  async sendInviteEmail(input: {
    accessRequestId: string;
    principalAgencyId: string;
    recipientEmail: unknown;
    /** Verified email of the signed-in agency user (reply-to). */
    senderEmail?: string | null;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ServiceResult> {
    const recipient = normalizeInviteRecipientEmail(input.recipientEmail);
    if (!recipient) {
      return fail('INVALID_EMAIL', 'Enter a valid client email address');
    }

    if (!isEmailDeliveryConfigured()) {
      return fail('EMAIL_NOT_CONFIGURED', 'Email delivery is not configured on this server');
    }

    const accessRequest = await prisma.accessRequest.findUnique({
      where: { id: input.accessRequestId },
      select: {
        id: true,
        agencyId: true,
        status: true,
        uniqueToken: true,
        expiresAt: true,
        platforms: true,
        agency: { select: { name: true, email: true, notificationEmail: true } },
      },
    });

    if (!accessRequest) {
      return fail('NOT_FOUND', 'Access request not found');
    }

    if (accessRequest.agencyId !== input.principalAgencyId) {
      return fail('FORBIDDEN', 'You do not have access to this agency resource');
    }

    if (!AWAITING_CLIENT_STATUSES.has(accessRequest.status)) {
      return fail('INVALID_STATUS', 'Invites can only be sent for open access requests');
    }

    const now = new Date();
    if (accessRequest.expiresAt.getTime() <= now.getTime()) {
      return fail('REQUEST_EXPIRED', 'This access link has expired. Create a new request to continue.');
    }

    const [lastSend, requestCount, agencyCount] = await Promise.all([
      prisma.auditLog.findFirst({
        where: {
          action: INVITE_EMAIL_AUDIT_ACTION,
          resourceId: accessRequest.id,
          createdAt: { gte: new Date(now.getTime() - INVITE_EMAIL_LIMITS.perRequestCooldownMs) },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      prisma.auditLog.count({
        where: {
          action: INVITE_EMAIL_AUDIT_ACTION,
          resourceId: accessRequest.id,
          createdAt: { gte: new Date(now.getTime() - INVITE_EMAIL_LIMITS.perRequestWindowMs) },
        },
      }),
      prisma.auditLog.count({
        where: {
          agencyId: accessRequest.agencyId,
          action: INVITE_EMAIL_AUDIT_ACTION,
          createdAt: { gte: new Date(now.getTime() - INVITE_EMAIL_LIMITS.perAgencyWindowMs) },
        },
      }),
    ]);

    if (lastSend) {
      const retryAfterMs =
        INVITE_EMAIL_LIMITS.perRequestCooldownMs - (now.getTime() - lastSend.createdAt.getTime());
      return fail('INVITE_EMAIL_COOLDOWN', 'An invite was just sent. Wait a minute before sending another.', {
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      });
    }

    if (requestCount >= INVITE_EMAIL_LIMITS.perRequestMax) {
      return fail('INVITE_EMAIL_LIMIT', 'This request has reached its daily invite email limit. Copy the link instead.');
    }

    if (agencyCount >= INVITE_EMAIL_LIMITS.perAgencyMax) {
      return fail('INVITE_EMAIL_LIMIT', 'Your agency has sent too many invite emails this hour. Try again later or copy the link.');
    }

    const authorizationUrl = `${frontendBaseUrl()}/invite/${encodeURIComponent(accessRequest.uniqueToken)}`;
    const content = buildClientInviteEmailContent({
      agencyName: accessRequest.agency.name,
      platforms: accessRequest.platforms,
      authorizationUrl,
    });

    const result = await sendEmail({
      to: recipient,
      from: buildInviteFromHeader(accessRequest.agency.name, env.RESEND_FROM_EMAIL),
      replyTo: resolveReplyTo(input.senderEmail, accessRequest.agency),
      subject: content.subject,
      html: content.html,
      text: content.text,
      idempotencyKey: idempotencyKey(accessRequest.id, recipient, now),
    });

    if (result.error) {
      const providerCode =
        'code' in result.error && typeof result.error.code === 'string' ? result.error.code : undefined;
      if (providerCode === 'RESEND_NOT_CONFIGURED') {
        return fail('EMAIL_NOT_CONFIGURED', 'Email delivery is not configured on this server');
      }
      return fail('INVITE_EMAIL_DELIVERY_FAILED', 'We could not send the invite email. Try again or copy the link.');
    }

    // The audit row is also the rate-limit ledger. A failed write only weakens
    // the limiter for this one send; it must not report a delivered email as failed.
    await auditService.createAuditLog({
      agencyId: accessRequest.agencyId,
      userEmail: input.senderEmail ?? undefined,
      action: INVITE_EMAIL_AUDIT_ACTION,
      resourceType: 'access_request',
      resourceId: accessRequest.id,
      metadata: { recipientEmail: recipient, providerMessageId: result.data?.id ?? null },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return { data: { accessRequestId: accessRequest.id, sentAt: now.toISOString() }, error: null };
  },
};
