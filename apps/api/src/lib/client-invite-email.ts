/**
 * Client invite email content (agency -> client, sent by AuthHub).
 *
 * Pure helpers so the copy, sender header, and platform wording can be unit
 * tested without Resend or the database.
 */

import { PLATFORM_HIERARCHY, PLATFORM_NAMES, platformGroupOf } from '@agency-platform/shared';

export const DEFAULT_INVITE_SENDER_ADDRESS = 'notifications@notifications.authhub.co';
const MAX_DISPLAY_NAME_LENGTH = 64;

/** Strip characters that could break an email header or the quoted display name. */
export function sanitizeHeaderText(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/["<>\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/** Agency name safe for headers and copy. Falls back to a neutral label. */
export function resolveAgencyDisplayName(agencyName: string | null | undefined): string {
  const cleaned = sanitizeHeaderText(agencyName ?? '');
  if (!cleaned) return 'Your agency';
  return cleaned.length > MAX_DISPLAY_NAME_LENGTH
    ? cleaned.slice(0, MAX_DISPLAY_NAME_LENGTH).trim()
    : cleaned;
}

/**
 * Extract the bare sender address from a configured From value
 * ("AuthHub <x@y>" or "x@y"). Falls back to the verified default.
 */
export function resolveSenderAddress(configuredFrom: string | null | undefined): string {
  const raw = configuredFrom?.trim();
  if (!raw) return DEFAULT_INVITE_SENDER_ADDRESS;
  const bracketed = raw.match(/<([^<>\s]+@[^<>\s]+)>/);
  if (bracketed) return bracketed[1];
  if (/^[^\s<>"]+@[^\s<>"]+$/.test(raw)) return raw;
  return DEFAULT_INVITE_SENDER_ADDRESS;
}

/** `"<Agency name> via AuthHub" <address>` */
export function buildInviteFromHeader(
  agencyName: string | null | undefined,
  configuredFrom: string | null | undefined
): string {
  const displayName = `${resolveAgencyDisplayName(agencyName)} via AuthHub`;
  return `"${displayName}" <${resolveSenderAddress(configuredFrom)}>`;
}

/** Requested platform group names, in request order, de-duplicated. */
export function extractRequestedPlatformNames(platforms: unknown): string[] {
  if (!Array.isArray(platforms)) return [];

  const groups: string[] = [];
  for (const entry of platforms) {
    if (!entry || typeof entry !== 'object') continue;
    const maybeGroup = (entry as Record<string, unknown>).platformGroup;
    const maybeProduct = (entry as Record<string, unknown>).platform;
    const group =
      typeof maybeGroup === 'string' && maybeGroup
        ? maybeGroup
        : typeof maybeProduct === 'string' && maybeProduct
          ? platformGroupOf(maybeProduct)
          : null;
    if (group && !groups.includes(group)) groups.push(group);
  }

  return groups.map(
    (group) =>
      PLATFORM_HIERARCHY[group]?.name ??
      (PLATFORM_NAMES as Record<string, string>)[group] ??
      group.replaceAll('_', ' ')
  );
}

/** "Google", "Google and Meta", "Google, Meta and TikTok". */
export function formatPlatformList(names: string[]): string {
  if (names.length === 0) return 'marketing';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export interface ClientInviteEmailContent {
  subject: string;
  html: string;
  text: string;
}

export function buildClientInviteEmailContent(input: {
  agencyName: string | null | undefined;
  platforms: unknown;
  authorizationUrl: string;
}): ClientInviteEmailContent {
  const agency = resolveAgencyDisplayName(input.agencyName);
  const platformList = sanitizeHeaderText(
    formatPlatformList(extractRequestedPlatformNames(input.platforms))
  );

  const subject = `${agency} needs access to your ${platformList} accounts`;
  const grantLine = `You'll give ${agency} partner access to your ${platformList} accounts.`;
  const partnerLine = `AuthHub only adds ${agency} as a partner. It doesn't manage your ads.`;
  const ctaLabel = 'Grant access';
  const url = input.authorizationUrl;

  const html = `
    <div style="font-family: sans-serif; color: #1e293b; max-width: 560px; margin: 0 auto; line-height: 1.5;">
      <p style="margin: 0 0 12px;">${escapeHtml(grantLine)}</p>
      <p style="margin: 0 0 24px;">${escapeHtml(partnerLine)}</p>
      <p style="margin: 0;">
        <a href="${escapeHtml(url)}" style="background-color: #FF6B35; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">${ctaLabel}</a>
      </p>
    </div>
  `;

  const text = `${grantLine}

${partnerLine}

${ctaLabel}: ${url}
`;

  return { subject, html, text };
}
