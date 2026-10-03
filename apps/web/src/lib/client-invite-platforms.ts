import { getPlatformTokenCapability, type Platform } from '@agency-platform/shared';

type ClientInviteFlow = 'oauth' | 'manual';

/**
 * Platforms whose agency-side "connect" action opens the manual-invite modal
 * (no standard OAuth). Single source of truth for the connections page,
 * onboarding platform picker, and platform cards. Includes zapier — the
 * onboarding copy previously omitted it (drift, fixed per refactor plan U11).
 */
export const MANUAL_INVITE_PLATFORMS: readonly string[] = [
  'kit',
  'mailchimp',
  'beehiiv',
  'klaviyo',
  'pinterest',
  'shopify',
  'zapier',
];

export function isManualInvitePlatform(platform: string): boolean {
  return MANUAL_INVITE_PLATFORMS.includes(platform);
}

interface ClientInvitePlatformCapability {
  flow: ClientInviteFlow;
  manualRoute: string | null;
}

const CLIENT_INVITE_MANUAL_ROUTE_SEGMENTS: Partial<Record<Platform, string>> = {
  beehiiv: 'beehiiv/manual',
  kit: 'kit/manual',
  mailchimp: 'mailchimp/manual',
  klaviyo: 'klaviyo/manual',
  pinterest: 'pinterest/manual',
  shopify: 'shopify/manual',
  zapier: 'zapier/manual',
};

const CLIENT_INVITE_MANUAL_PLATFORMS = new Set<Platform>([
  'beehiiv',
  'kit',
  'mailchimp',
  'klaviyo',
  'pinterest',
  'shopify',
  'zapier',
]);

export function getClientInvitePlatformCapability(platform: Platform): ClientInvitePlatformCapability {
  const sharedCapability = getPlatformTokenCapability(platform);
  const manualRoute = CLIENT_INVITE_MANUAL_ROUTE_SEGMENTS[platform] || null;
  const flow: ClientInviteFlow =
    CLIENT_INVITE_MANUAL_PLATFORMS.has(platform) || sharedCapability.connectionMethod === 'manual'
      ? 'manual'
      : 'oauth';

  return {
    flow,
    manualRoute,
  };
}

export function isClientInviteManualPlatform(platform: Platform): boolean {
  return getClientInvitePlatformCapability(platform).flow === 'manual';
}

export function getInviteSecuritySummary(platforms: Platform[]): {
  detail: string;
  usesOAuthFlow: boolean;
  usesManualFlow: boolean;
} {
  const capabilities = platforms.map((platform) => getClientInvitePlatformCapability(platform));
  const usesOAuthFlow = capabilities.some((capability) => capability.flow === 'oauth');
  const usesManualFlow = capabilities.some((capability) => capability.flow === 'manual');

  if (usesOAuthFlow && usesManualFlow) {
    return {
      detail: 'You will connect some accounts directly and authorize others through official login screens.',
      usesOAuthFlow,
      usesManualFlow,
    };
  }

  if (usesManualFlow) {
    return {
      detail: 'You will invite your agency through each platform\'s own settings. No login credentials are shared.',
      usesOAuthFlow,
      usesManualFlow,
    };
  }

  return {
    detail: 'You will authorize access through each platform\'s official login screen. Your credentials stay with the platform.',
    usesOAuthFlow,
    usesManualFlow,
  };
}

export function getClientInviteManualRoute(platform: Platform): string | null {
  return getClientInvitePlatformCapability(platform).manualRoute;
}

export function buildClientInviteConnectViewUrl(token: string, platform?: Platform | null): string {
  const searchParams = new URLSearchParams({ view: 'connect' });
  if (platform) {
    searchParams.set('platform', platform);
  }

  return `/invite/${token}?${searchParams.toString()}`;
}
