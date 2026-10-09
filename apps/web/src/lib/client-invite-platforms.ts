import { manualConfirmationPlatforms, type Platform } from '@agency-platform/shared';

type ClientInviteFlow = 'oauth' | 'manual';

/**
 * Platforms whose client-facing flow is NOT OAuth: manual invitation
 * (kit, mailchimp, pinterest, klaviyo, zapier, shopify) and the api-key
 * email invite (beehiiv). Derived from the shared registry (DEC-015 Phase
 * 2c). Single source of truth for the connections page, onboarding platform
 * picker, and platform cards.
 */
export const MANUAL_INVITE_PLATFORMS: readonly string[] = manualConfirmationPlatforms;

export function isManualInvitePlatform(platform: string): boolean {
  return MANUAL_INVITE_PLATFORMS.includes(platform);
}

interface ClientInvitePlatformCapability {
  flow: ClientInviteFlow;
  manualRoute: string | null;
}

// Mechanical projection: one manual-invite route per manual platform. The
// physical routes live at app/invite/[token]/<platform>/manual/page.tsx.
const CLIENT_INVITE_MANUAL_ROUTE_SEGMENTS: Partial<Record<Platform, string>> = Object.fromEntries(
  manualConfirmationPlatforms.map((platform) => [platform, `${platform}/manual`] as const)
);

export function getClientInvitePlatformCapability(platform: Platform): ClientInvitePlatformCapability {
  // The derived list includes beehiiv (api_key): its client-facing flow is a
  // manual-style email invite even though its agency-side auth is an API key.
  const manualRoute = CLIENT_INVITE_MANUAL_ROUTE_SEGMENTS[platform] || null;
  const flow: ClientInviteFlow = MANUAL_INVITE_PLATFORMS.includes(platform) ? 'manual' : 'oauth';

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
