import { MetaConnector } from '@/services/connectors/meta';
import { GoogleConnector } from '@/services/connectors/google';
import { LinkedInConnector } from '@/services/connectors/linkedin';
import { TikTokConnector } from '@/services/connectors/tiktok';
import { SnapchatConnector } from '@/services/connectors/snapchat';
import {
  type Platform,
  getPlatformCategory,
  getPlatformTokenCapability,
  PLATFORM_NAMES,
  SUPPORTED_CONNECTION_PLATFORMS,
} from '@agency-platform/shared';

export { PLATFORM_NAMES };

// Single categorization helper (DEC-015 Phase 3 deduped the duplicates).
export { getPlatformCategory };

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
