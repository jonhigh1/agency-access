import { describe, expect, it } from 'vitest';
import { ASSET_SELECTING_PRODUCTS } from '../asset-selecting-products.js';

// GOLDEN — regenerate only via:
//   npx tsx scripts/generate-platform-registry-golden.ts --acknowledge=DEC-015
// Provenance: DEC-015 (docs/DECISIONS.md), 2026-10-08. Frozen literals; NEVER snapshots.
//
// Intentionally NOT a registry projection: the set includes group-level 'tiktok'
// and omits 'snapchat_ads'. Usage is .has() membership only. Do not derive this
// set from the PLATFORMS registry (DEC-015).

describe('ASSET_SELECTING_PRODUCTS', () => {
  it('is the 13-product asset-selection set, characterized verbatim (DEC-015)', () => {
    expect([...ASSET_SELECTING_PRODUCTS]).toEqual([
      'google_ads',
      'ga4',
      'google_business_profile',
      'google_tag_manager',
      'google_search_console',
      'google_merchant_center',
      'meta_ads',
      'meta_pages',
      'instagram',
      'linkedin_ads',
      'linkedin_pages',
      'tiktok',
      'tiktok_ads',
    ]);
  });
});
