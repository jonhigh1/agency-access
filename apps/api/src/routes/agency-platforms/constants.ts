import { MetaConnector } from '@/services/connectors/meta';
import { GoogleConnector } from '@/services/connectors/google';
import { LinkedInConnector } from '@/services/connectors/linkedin';
import { TikTokConnector } from '@/services/connectors/tiktok';
import { SnapchatConnector } from '@/services/connectors/snapchat';
import {
  type Platform,
  getPlatformTokenCapability,
  PLATFORM_NAMES,
  RECOMMENDED_CONNECTION_PLATFORMS,
  SUPPORTED_CONNECTION_PLATFORMS,
} from '@agency-platform/shared';

export { PLATFORM_NAMES };

export function getPlatformCategory(platform: Platform): 'recommended' | 'other' {
  return RECOMMENDED_CONNECTION_PLATFORMS.includes(platform as any) ? 'recommended' : 'other';
}

export const SUPPORTED_PLATFORMS = SUPPORTED_CONNECTION_PLATFORMS;
export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

export const MANUAL_PLATFORMS = SUPPORTED_PLATFORMS.filter(
  (platform) => getPlatformTokenCapability(platform).connectionMethod !== 'oauth'
) as Platform[];

export const PLATFORM_CONNECTORS = {
  google: GoogleConnector,
  meta: MetaConnector,
  linkedin: LinkedInConnector,
  tiktok: TikTokConnector,
  snapchat: SnapchatConnector,
} as const;

export function getPlatformDisplayName(platform: string): string {
  const displayNames: Record<string, string> = {
    meta: 'Meta',
    google: 'Google',
    linkedin: 'LinkedIn',
  };
  return displayNames[platform] || platform;
}
