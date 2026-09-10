import { describe, it, expect } from 'vitest';
import type { Platform } from '@agency-platform/shared';
import {
  PLATFORM_CONFIGS,
  getPlatformConfig,
  PlatformNotConfiguredError,
} from '../registry.config.js';
// Importing each connector module constructs its singleton; BaseConnector
// construction calls getPlatformConfig — module load is the config smoke test.
import { metaConnector } from '../meta.js';
import { googleConnector } from '../google.js';
import { linkedinConnector } from '../linkedin.js';
import { mailchimpConnector } from '../mailchimp.js';
import { pinterestConnector } from '../pinterest.js';
import { klaviyoConnector } from '../klaviyo.js';
import { shopifyConnector } from '../shopify.js';
import { tiktokConnector } from '../tiktok.js';
import { snapchatConnector } from '../snapchat.js';

describe('connector registry', () => {
  it('repairs pinterest with documented v5 OAuth endpoints', () => {
    const config = getPlatformConfig('pinterest');
    expect(config.authUrl).toBe('https://www.pinterest.com/oauth/');
    expect(config.tokenUrl).toBe('https://api.pinterest.com/v5/oauth/token');
    // Connector relies on refresh tokens (continuous); flag must be truthful
    expect(config.supportsRefreshTokens).toBe(true);
  });

  it('throws typed error for non-OAuth platforms without registry entries', () => {
    for (const platform of ['kit', 'beehiiv', 'zapier'] as Platform[]) {
      expect(() => getPlatformConfig(platform)).toThrow(PlatformNotConfiguredError);
      expect(PLATFORM_CONFIGS[platform]).toBeUndefined();
    }
  });

  it('resolves a config with real endpoints for every registered OAuth platform', () => {
    const oauthPlatforms: Platform[] = [
      'google',
      'google_ads',
      'ga4',
      'meta',
      'meta_ads',
      'meta_pages',
      'instagram',
      'linkedin',
      'linkedin_ads',
      'linkedin_pages',
      'tiktok',
      'tiktok_ads',
      'snapchat',
      'snapchat_ads',
      'mailchimp',
      'pinterest',
      'klaviyo',
      'shopify',
    ];
    for (const platform of oauthPlatforms) {
      const config = getPlatformConfig(platform);
      expect(config.authUrl, `${platform} authUrl`).toMatch(/^https:/);
      expect(config.tokenUrl, `${platform} tokenUrl`).toMatch(/^https:/);
    }
  });

  it('constructs every registered connector against the registry', () => {
    // Construction happens at import time; reaching here means every
    // BaseConnector subclass resolved its config without throwing.
    const connectors = [
      metaConnector,
      googleConnector,
      linkedinConnector,
      mailchimpConnector,
      pinterestConnector,
      klaviyoConnector,
      shopifyConnector,
      tiktokConnector,
      snapchatConnector,
    ];
    for (const connector of connectors) {
      expect(connector).toBeDefined();
    }
  });
});
