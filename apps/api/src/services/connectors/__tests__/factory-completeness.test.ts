import { describe, expect, it } from 'vitest';
import { connectorPlatformIds } from '@agency-platform/shared';
import { CONNECTOR_REGISTRY, getConnector } from '../factory.js';

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
