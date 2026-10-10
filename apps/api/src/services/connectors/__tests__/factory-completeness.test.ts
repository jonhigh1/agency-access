import { describe, expect, it } from 'vitest';
import { connectorPlatformIds } from '@agency-platform/shared';
import {
  CONNECTOR_REGISTRY,
  getApiKeyConnector,
  getConnector,
  isApiKeyConnector,
  isOAuthConnector,
} from '../factory.js';
import { beehiivConnector } from '../beehiiv.js';

// Completeness pin (DEC-015 Phase 2b): the factory's key set derives from the
// shared PLATFORMS registry. A platform added to the registry without a
// connector — or a connector with no registry entry — fails here instead of
// at request time. Born green: a characterization pin, not a behavior change.

const FROZEN_CONNECTOR_KEYS = [
  'beehiiv',
  'ga4',
  'google',
  'google_ads',
  'instagram',
  'linkedin',
  'linkedin_ads',
  'linkedin_pages',
  'meta',
  'meta_ads',
  'meta_pages',
  'shopify',
  'snapchat',
  'snapchat_ads',
  'tiktok',
  'tiktok_ads',
];

describe('connector registry completeness', () => {
  it('serves exactly the registry-derived connector platforms', () => {
    expect(Object.keys(CONNECTOR_REGISTRY).sort()).toEqual([...connectorPlatformIds].sort());
  });

  it('matches the frozen sixteen, sorted', () => {
    expect(Object.keys(CONNECTOR_REGISTRY).sort()).toEqual(FROZEN_CONNECTOR_KEYS);
  });

  it('throws for a manual-invite platform with no connector', () => {
    expect(() => getConnector('kit')).toThrow(/No connector found/);
    expect(() => getConnector('zapier')).toThrow(/No connector found/);
  });
});

describe('connector authMode union (card 5 U7)', () => {
  it('registers beehiiv as the api_key connector without OAuth methods', () => {
    const beehiiv = CONNECTOR_REGISTRY.beehiiv;
    expect(beehiiv).toBe(beehiivConnector);
    expect(beehiiv).toBeDefined();
    expect(isApiKeyConnector(beehiiv!)).toBe(true);
    expect(isOAuthConnector(beehiiv!)).toBe(false);
    expect(beehiiv!.authMode).toBe('api_key');
  });

  it('tags OAuth connectors with authMode oauth', () => {
    const meta = CONNECTOR_REGISTRY.meta;
    expect(meta).toBeDefined();
    expect(isOAuthConnector(meta!)).toBe(true);
    expect(isApiKeyConnector(meta!)).toBe(false);
    expect(meta!.authMode).toBe('oauth');
  });

  it('getConnector rejects api_key platforms', () => {
    expect(() => getConnector('beehiiv')).toThrow(/API-key|api_key|api key/i);
  });

  it('getApiKeyConnector returns beehiiv and rejects OAuth platforms', () => {
    expect(getApiKeyConnector('beehiiv')).toBe(beehiivConnector);
    expect(() => getApiKeyConnector('meta')).toThrow(/API-key|api_key|api key|OAuth/i);
  });
});
