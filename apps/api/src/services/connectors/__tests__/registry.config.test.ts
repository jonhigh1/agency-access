import { describe, it, expect } from 'vitest';
import {
  META_GRAPH_VERSION,
  META_PERMISSION_CONTRACT,
  type Platform,
} from '@agency-platform/shared';
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
import { shopifyConnector } from '../shopify.js';
import { tiktokConnector } from '../tiktok.js';
import { snapchatConnector } from '../snapchat.js';

describe('connector registry', () => {
  it('throws typed error for manual platforms without registry entries', () => {
    // Klaviyo, Mailchimp, and Pinterest joined the manual invitation flow —
    // their OAuth credentials no longer exist and their registry entries
    // were removed with the orphaned connectors.
    for (const platform of ['kit', 'beehiiv', 'zapier', 'mailchimp', 'pinterest', 'klaviyo'] as Platform[]) {
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
      'shopify',
    ];
    for (const platform of oauthPlatforms) {
      const config = getPlatformConfig(platform);
      expect(config.authUrl, `${platform} authUrl`).toMatch(/^https:/);
      expect(config.tokenUrl, `${platform} tokenUrl`).toMatch(/^https:/);
    }
  });

  it('requests Page listing and engagement for Meta Ads', () => {
    expect(getPlatformConfig('meta').defaultScopes).toEqual(META_PERMISSION_CONTRACT.core.permissions);
    expect(getPlatformConfig('meta_ads').defaultScopes).toEqual(META_PERMISSION_CONTRACT.core.permissions);
  });

  it('uses Graph v25.0 for every Meta registry entry', () => {
    for (const platform of ['meta', 'meta_ads', 'meta_pages', 'instagram'] as Platform[]) {
      const config = getPlatformConfig(platform);
      expect(config.version).toBe(META_GRAPH_VERSION);
      expect(config.authUrl).toContain(`/${META_GRAPH_VERSION}/`);
      expect(config.tokenUrl).toContain(`/${META_GRAPH_VERSION}/`);
      expect(config.userInfoUrl).toContain(`/${META_GRAPH_VERSION}/`);
    }
  });

  it('constructs every registered connector against the registry', () => {
    // Construction happens at import time; reaching here means every
    // BaseConnector subclass resolved its config without throwing.
    const connectors = [
      metaConnector,
      googleConnector,
      linkedinConnector,
      shopifyConnector,
      tiktokConnector,
      snapchatConnector,
    ];
    for (const connector of connectors) {
      expect(connector).toBeDefined();
    }
  });
});
