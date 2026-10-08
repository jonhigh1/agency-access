import { describe, expect, it } from 'vitest';
import {
  buildClientInviteEmailContent,
  buildInviteFromHeader,
  extractRequestedPlatformNames,
  formatPlatformList,
  resolveSenderAddress,
} from '../client-invite-email.js';

const INVITE_URL = 'https://app.example.com/invite/tok-example';

describe('client invite email content', () => {
  it('builds the spec subject from agency name and requested platform groups', () => {
    const content = buildClientInviteEmailContent({
      agencyName: 'Example Agency',
      platforms: [
        { platformGroup: 'google', products: [{ product: 'google_ads' }] },
        { platformGroup: 'meta', products: [{ product: 'meta_ads' }] },
      ],
      authorizationUrl: INVITE_URL,
    });

    expect(content.subject).toBe('Example Agency needs access to your Google and Meta accounts');
  });

  it('has one CTA to the invite and the two required lines', () => {
    const content = buildClientInviteEmailContent({
      agencyName: 'Example Agency',
      platforms: [{ platform: 'google_ads' }],
      authorizationUrl: INVITE_URL,
    });

    expect(content.html.match(/<a /g)).toHaveLength(1);
    expect(content.html).toContain(`href="${INVITE_URL}"`);
    expect(content.html).toContain('partner access to your Google accounts');
    expect(content.html).toContain('AuthHub only adds Example Agency as a partner. It doesn&#039;t manage your ads.');
    expect(content.text).toContain(INVITE_URL);
    expect(content.text).toContain("It doesn't manage your ads.");
  });

  it('escapes agency names in HTML and strips header-breaking characters', () => {
    const content = buildClientInviteEmailContent({
      agencyName: 'Evil <script>"Agency"\r\nBcc: x@example.com',
      platforms: [],
      authorizationUrl: INVITE_URL,
    });

    expect(content.subject).not.toMatch(/[\r\n<>"]/);
    expect(content.html).not.toContain('<script>');
    expect(content.subject).toContain('your marketing accounts');
  });
});

describe('buildInviteFromHeader', () => {
  it('uses "<Agency> via AuthHub" with the verified default sender', () => {
    expect(buildInviteFromHeader('Example Agency', undefined)).toBe(
      '"Example Agency via AuthHub" <notifications@notifications.authhub.co>'
    );
  });

  it('reuses the configured sender address but replaces its display name', () => {
    expect(buildInviteFromHeader('Example Agency', 'AuthHub <hello@mail.example.com>')).toBe(
      '"Example Agency via AuthHub" <hello@mail.example.com>'
    );
  });

  it('cannot be used to inject headers or break the quoted name', () => {
    const header = buildInviteFromHeader('A"\r\nBcc: victim@example.com <x>', undefined);
    expect(header).not.toMatch(/[\r\n]/);
    expect(header.match(/"/g)).toHaveLength(2);
    expect(header.endsWith('<notifications@notifications.authhub.co>')).toBe(true);
  });

  it('falls back to a neutral name when the agency name is blank', () => {
    expect(buildInviteFromHeader('   ', undefined)).toBe(
      '"Your agency via AuthHub" <notifications@notifications.authhub.co>'
    );
  });
});

describe('platform helpers', () => {
  it('dedupes product rows into groups in request order', () => {
    expect(
      extractRequestedPlatformNames([
        { platform: 'meta_ads' },
        { platform: 'google_ads' },
        { platform: 'ga4' },
      ])
    ).toEqual(['Meta', 'Google']);
  });

  it('formats lists with commas and "and"', () => {
    expect(formatPlatformList(['Google'])).toBe('Google');
    expect(formatPlatformList(['Google', 'Meta', 'TikTok'])).toBe('Google, Meta and TikTok');
  });

  it('only accepts a bare or bracketed sender address', () => {
    expect(resolveSenderAddress('x@example.com')).toBe('x@example.com');
    expect(resolveSenderAddress('not an address')).toBe('notifications@notifications.authhub.co');
  });
});
