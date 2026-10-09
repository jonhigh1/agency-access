import { describe, expect, it } from 'vitest';
import { clientOAuthPlatforms } from '@agency-platform/shared';
import { clientOAuthPlatform } from '../schemas.js';

// GOLDEN — regenerate only via:
//   npx tsx scripts/generate-platform-registry-golden.ts --acknowledge=DEC-015
// Provenance: acknowledged under DEC-015 (docs/DECISIONS.md), 2026-10-08.
// Frozen literals; NEVER snapshots.
//
// Pins the client OAuth gate (createOAuthStateSchema / oauthExchangeSchema)
// to today's ten members and to the shared registry derivation. The four
// ads products (tiktok_ads, linkedin_ads, linkedin_pages, snapchat_ads) are
// connectionMethod 'oauth' but NOT client-authorizable — the curated gate
// fact that 8e17c27e exists to enforce. Phase 2a flips the enum itself to
// derive from the registry; this golden is the equality contract.

describe('clientOAuthPlatform golden', () => {
  it('is exactly the ten client-authorizable platforms, in schema order', () => {
    expect(clientOAuthPlatform.options).toEqual([
      'google',
      'meta',
      'meta_ads',
      'meta_pages',
      'google_ads',
      'ga4',
      'linkedin',
      'instagram',
      'tiktok',
      'snapchat',
    ]);
  });

  it('equals the shared registry derivation', () => {
    expect([...clientOAuthPlatforms].sort()).toEqual([...clientOAuthPlatform.options].sort());
  });
});
