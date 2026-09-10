import { describe, expect, it } from 'vitest';
import {
  getClientInviteManualRoute,
  getClientInvitePlatformCapability,
  getInviteSecuritySummary,
  isClientInviteManualCallbackPlatform,
  isClientInviteManualPlatform,
  MANUAL_INVITE_PLATFORMS,
  isManualInvitePlatform,
} from '../client-invite-platforms';

describe('client invite platform capabilities', () => {
  it('treats beehiiv as a manual client invite platform despite api-key agency auth', () => {
    expect(getClientInvitePlatformCapability('beehiiv')).toMatchObject({
      flow: 'manual',
      manualRoute: 'beehiiv/manual',
      manualCallback: true,
    });
  });

  it('routes mailchimp and klaviyo through manual invite flows', () => {
    expect(getClientInvitePlatformCapability('mailchimp')).toMatchObject({
      flow: 'manual',
      manualRoute: 'mailchimp/manual',
      manualCallback: true,
    });

    expect(getClientInvitePlatformCapability('klaviyo')).toMatchObject({
      flow: 'manual',
      manualRoute: 'klaviyo/manual',
      manualCallback: true,
    });
  });

  it('keeps linkedin on oauth flow', () => {
    expect(getClientInvitePlatformCapability('linkedin')).toMatchObject({
      flow: 'oauth',
      manualRoute: null,
      manualCallback: false,
    });
  });

  it('routes snapchat through oauth with no manual surface', () => {
    expect(getClientInvitePlatformCapability('snapchat')).toMatchObject({
      flow: 'oauth',
      manualRoute: null,
      manualCallback: false,
    });
    expect(isClientInviteManualPlatform('snapchat')).toBe(false);
    expect(getClientInviteManualRoute('snapchat')).toBeNull();
  });

  it('reports mixed security copy when both oauth and manual platforms are requested', () => {
    expect(getInviteSecuritySummary(['google', 'mailchimp'])).toMatchObject({
      badge: expect.stringMatching(/secure — passwords never requested/i),
      detail: expect.stringMatching(/official login screens/i),
      usesManualFlow: true,
      usesOAuthFlow: true,
    });
  });

  it('flags mailchimp manual callback handling as complete-on-return', () => {
    expect(isClientInviteManualCallbackPlatform('mailchimp')).toBe(true);
    expect(isClientInviteManualCallbackPlatform('google')).toBe(false);
  });
});

describe('MANUAL_INVITE_PLATFORMS', () => {
  it('includes all manual-invite platforms, including zapier (drift fix, U11)', () => {
    expect(MANUAL_INVITE_PLATFORMS).toEqual([
      'kit',
      'mailchimp',
      'beehiiv',
      'klaviyo',
      'pinterest',
      'shopify',
      'zapier',
    ]);
    expect(MANUAL_INVITE_PLATFORMS).not.toContain('snapchat');
  });

  it('isManualInvitePlatform matches the constant', () => {
    expect(isManualInvitePlatform('zapier')).toBe(true);
    expect(isManualInvitePlatform('shopify')).toBe(true);
    expect(isManualInvitePlatform('google')).toBe(false);
  });
});
