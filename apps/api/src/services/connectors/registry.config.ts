import {
  PLATFORMS,
  type Platform,
  type PlatformOAuthConfig,
} from '@agency-platform/shared';

/**
 * Platform OAuth Registry — api facade over the shared PLATFORMS registry.
 *
 * The OAuth "personality" data (endpoints, scopes, behavioral quirks) moved to
 * the shared registry in DEC-015 Phase 2b; this module keeps the api-side
 * access surface (`PLATFORM_CONFIGS`, `getPlatformConfig`,
 * `PlatformNotConfiguredError`) stable for `BaseConnector` and the factory.
 *
 * Partial: only platforms with a real OAuth flow have entries. Non-OAuth
 * platforms (Kit, Beehiiv, Zapier — team invitation / API key flows) are
 * intentionally absent; their connectors are standalone. Shopify is the dual
 * identity: client-manual, agency-OAuth with {shop} context.
 */

export type { PlatformOAuthConfig } from '@agency-platform/shared';

/**
 * Typed error thrown when a platform has no OAuth configuration.
 * Carries the platform identifier for upstream error mapping.
 */
export class PlatformNotConfiguredError extends Error {
  constructor(public platform: Platform) {
    super(`No OAuth configuration found for platform: ${platform}`);
    this.name = 'PlatformNotConfiguredError';
  }
}

/**
 * Platform Configuration Registry, derived from the shared registry's oauth
 * blocks. Adding a platform is a one-file registry edit; this projection
 * follows automatically (pinned by registry.config.test.ts).
 */
export const PLATFORM_CONFIGS: Partial<Record<Platform, PlatformOAuthConfig>> = Object.fromEntries(
  (Object.entries(PLATFORMS) as [string, { oauth?: PlatformOAuthConfig }][]).flatMap(
    ([id, entry]) => (entry.oauth !== undefined ? [[id, entry.oauth] as const] : [])
  )
) as Partial<Record<Platform, PlatformOAuthConfig>>;

/**
 * Get configuration for a platform
 *
 * @param platform - Platform identifier
 * @returns Platform OAuth configuration
 * @throws PlatformNotConfiguredError if platform config doesn't exist
 */
export function getPlatformConfig(platform: Platform): PlatformOAuthConfig {
  const config = PLATFORM_CONFIGS[platform];
  if (!config) {
    throw new PlatformNotConfiguredError(platform);
  }
  return config;
}
