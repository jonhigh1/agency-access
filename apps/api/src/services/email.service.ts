/**
 * Email Service
 *
 * Handles sending transactional emails using Resend.
 */

import { Resend } from 'resend';
import { env } from '../lib/env.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string | string[];
  idempotencyKey?: string;
}

/**
 * Send a generic email
 */
export async function sendEmail(options: SendEmailOptions) {
  if (!resend) {
    console.warn('Resend API key missing. Email not sent:', options.subject);
    return { data: null, error: { code: 'RESEND_NOT_CONFIGURED', message: 'Resend API key is not configured' } };
  }

  try {
    const {
      to,
      subject,
      html,
      text,
      from = env.RESEND_FROM_EMAIL || 'AuthHub <notifications@notifications.authhub.co>',
      replyTo = env.RESEND_REPLY_TO_EMAIL,
      idempotencyKey,
    } = options;
    
    // In development/test, we might want to log instead of sending if a real key isn't provided
    if (env.NODE_ENV !== 'production' && env.RESEND_API_KEY === 're_123456789') {
      console.log('Email sent (mock):', { to, subject });
      return { data: { id: 'mock-id' }, error: null };
    }

    const result = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
      replyTo,
    }, idempotencyKey ? { idempotencyKey } : undefined);

    if (result.error) {
      console.error('Resend error:', result.error);
      return { data: null, error: result.error };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Failed to send email:', error);
    return {
      data: null,
      error: {
        code: 'EMAIL_SEND_FAILED',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Send notification to agency when client completes authorization
 */
export async function sendClientAuthorizationEmail(options: {
  to: string;
  clientName: string;
  clientEmail: string;
  platforms: string[];
  dashboardUrl: string;
}) {
  const { to, clientName, clientEmail, platforms, dashboardUrl } = options;
  
  const platformsList = platforms
    .map((p) => `<li>${p.replace('_', ' ').toUpperCase()}</li>`)
    .join('');

  const html = `
    <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4f46e5;">Client Authorization Complete</h2>
      <p>Good news! <strong>${clientName}</strong> (${clientEmail}) has completed their authorization request.</p>
      
      <p>They have granted access to the following platforms:</p>
      <ul style="background-color: #f8fafc; padding: 20px 40px; border-radius: 8px; list-style-type: disc;">
        ${platformsList}
      </ul>
      
      <p style="margin-top: 24px;">
        <a href="${dashboardUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
          View Connection in Dashboard
        </a>
      </p>
      
      <hr style="margin: 32px 0; border: 0; border-top: 1px solid #e2e8f0;" />
      <p style="font-size: 12px; color: #64748b;">
        This is an automated notification from AuthHub.
      </p>
    </div>
  `;

  return sendEmail({
    to,
    subject: `Access Granted: ${clientName} authorized ${platforms.length} platform(s)`,
    html,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/**
 * Send a client invite reminder (agency-initiated follow-up).
 */
export async function sendClientInviteReminderEmail(options: {
  to: string;
  clientName: string;
  agencyName: string;
  authorizationUrl: string;
  expirationText?: string | null;
  replyTo?: string;
  idempotencyKey: string;
}) {
  const {
    to,
    clientName,
    agencyName,
    authorizationUrl,
    expirationText,
    replyTo,
    idempotencyKey,
  } = options;

  const expirationLine = expirationText
    ? `<p style="margin: 16px 0 0;">This link expires on ${escapeHtml(expirationText)}.</p>`
    : '';
  const expirationTextPlain = expirationText ? `\n\nThis link expires on ${expirationText}.` : '';

  const html = `
    <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #09090B;">Reminder: authorize platform access</h2>
      <p>Hi ${escapeHtml(clientName)},</p>
      <p>
        This is a friendly reminder from <strong>${escapeHtml(agencyName)}</strong> to authorize platform access when you are ready.
        Open the secure link below and complete authorization on your schedule — tokens are issued only after you finish.
      </p>
      ${expirationLine}
      <p style="margin-top: 24px;">
        <a href="${authorizationUrl}" style="background-color: #FF6B35; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
          Authorize access
        </a>
      </p>
      <p style="margin-top: 16px; font-size: 14px; word-break: break-all;">
        <a href="${authorizationUrl}">${authorizationUrl}</a>
      </p>
      <p style="margin-top: 24px; font-size: 14px; color: #64748b;">
        If you were not expecting this request, contact ${escapeHtml(agencyName)} before continuing.
      </p>
      <hr style="margin: 32px 0; border: 0; border-top: 1px solid #e2e8f0;" />
      <p style="font-size: 12px; color: #64748b;">
        Sent on behalf of ${escapeHtml(agencyName)} via AuthHub.
      </p>
    </div>
  `;

  const text = `Hi ${clientName},

This is a friendly reminder from ${agencyName} to authorize platform access when you are ready. Open the secure link below and complete authorization on your schedule — tokens are issued only after you finish.${expirationTextPlain}

${authorizationUrl}

If you were not expecting this request, contact ${agencyName} before continuing.`;

  return sendEmail({
    to,
    subject: 'Reminder: authorize platform access when ready',
    html,
    text,
    replyTo,
    idempotencyKey,
  });
}

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}
