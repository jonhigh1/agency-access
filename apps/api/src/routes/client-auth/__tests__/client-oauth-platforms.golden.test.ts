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
// fact that 8e17c27e exists to enforce. Since the Phase 2a flip (DEC-015)
// the enum is constructed from the registry derivation; order is owned by
// the registry, so the accepted set is pinned here order-free.

// The gate ten, sorted alphabetically; frozen per the DEC-015 protocol.
const FROZEN_GATE_TEN = [
  'ga4',
  'google',
  'google_ads',
  'instagram',
  'linkedin',
  'meta',
  'meta_ads',
  'meta_pages',
  'snapchat',
  'tiktok',
];

describe('clientOAuthPlatform golden', () => {
  it('accepts exactly the ten client-authorizable platforms (frozen set)', () => {
    expect([...clientOAuthPlatform.options].sort()).toEqual(FROZEN_GATE_TEN);
  });

  it('equals the shared registry derivation', () => {
    expect([...clientOAuthPlatforms].sort()).toEqual([...clientOAuthPlatform.options].sort());
  });

  // Phase 2a flip contract (DEC-015): the enum is constructed from the
  // registry derivation itself — elementwise, order included.
  it('is constructed from the registry derivation', () => {
    expect(clientOAuthPlatform.options).toEqual(clientOAuthPlatforms);
  });
});
