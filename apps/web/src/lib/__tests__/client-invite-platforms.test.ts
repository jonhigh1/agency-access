import { describe, expect, it } from 'vitest';
import {
  getClientInviteManualRoute,
  getClientInvitePlatformCapability,
  getInviteSecuritySummary,
  isClientInviteManualPlatform,
  MANUAL_INVITE_PLATFORMS,
  isManualInvitePlatform,
} from '../client-invite-platforms';

describe('client invite platform capabilities', () => {
  it('treats beehiiv as a manual client invite platform despite api-key agency auth', () => {
    expect(getClientInvitePlatformCapability('beehiiv')).toMatchObject({
      flow: 'manual',
      manualRoute: 'beehiiv/manual',
    });
  });

  it('routes mailchimp and klaviyo through manual invite flows', () => {
    expect(getClientInvitePlatformCapability('mailchimp')).toMatchObject({
      flow: 'manual',
      manualRoute: 'mailchimp/manual',
    });

    expect(getClientInvitePlatformCapability('klaviyo')).toMatchObject({
      flow: 'manual',
      manualRoute: 'klaviyo/manual',
    });
  });

  it('routes Zapier through its manual invite flow', () => {
    expect(getClientInvitePlatformCapability('zapier')).toMatchObject({
      flow: 'manual',
      manualRoute: 'zapier/manual',
    });
    expect(getClientInviteManualRoute('zapier')).toBe('zapier/manual');
  });

  it('keeps linkedin on oauth flow', () => {
    expect(getClientInvitePlatformCapability('linkedin')).toMatchObject({
      flow: 'oauth',
      manualRoute: null,
    });
  });

  it('routes snapchat through oauth with no manual surface', () => {
    expect(getClientInvitePlatformCapability('snapchat')).toMatchObject({
      flow: 'oauth',
      manualRoute: null,
    });
    expect(isClientInviteManualPlatform('snapchat')).toBe(false);
    expect(getClientInviteManualRoute('snapchat')).toBeNull();
  });

  it('reports mixed security copy when both oauth and manual platforms are requested', () => {
    const summary = getInviteSecuritySummary(['google', 'mailchimp']);
    expect(summary).toMatchObject({
      detail: expect.stringMatching(/official login screens/i),
      usesManualFlow: true,
      usesOAuthFlow: true,
    });
    // The badge was removed: the hero sentence already carries the
    // "passwords never requested" promise, and the label duplicated it.
    expect('badge' in summary).toBe(false);
  });

});

describe('MANUAL_INVITE_PLATFORMS', () => {
  it('includes all manual-invite platforms, including zapier (drift fix, U11)', () => {
    // Order is owned by the shared registry's derivation (DEC-015 Phase 2c);
    // the membership set stays pinned here.
    expect([...MANUAL_INVITE_PLATFORMS].sort()).toEqual([
      'beehiiv',
      'kit',
      'klaviyo',
      'mailchimp',
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
