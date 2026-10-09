import { describe, expect, it } from 'vitest';
import { ASSET_SELECTING_PRODUCTS } from '../asset-selecting-products.js';
import { getSelectedAssetCount, hasNoAssetsSignal } from '../product-selection-signals.js';

/**
 * Characterization for the shared selection/inventory helpers extracted from
 * access-request.service.ts and client.service.ts (review card 2 / DEC-015).
 *
 * Instagram counts only instagramAccounts — the client.service / wizard
 * semantics. access-request previously counted sibling Meta asset kinds for
 * Instagram; that drift is closed by this module.
 */

describe('getSelectedAssetCount', () => {
  it('covers every ASSET_SELECTING_PRODUCTS member without throwing', () => {
    for (const product of ASSET_SELECTING_PRODUCTS) {
      expect(getSelectedAssetCount(product, {})).toBe(0);
    }
  });

  it('counts Meta ads blob fields for meta_ads', () => {
    expect(
      getSelectedAssetCount('meta_ads', {
        adAccounts: ['a1'],
        pages: ['p1'],
        instagramAccounts: ['ig1'],
        catalogs: ['c1'],
        datasets: ['d1'],
      })
    ).toBe(5);
  });

  it('counts only instagramAccounts for instagram (not sibling Meta kinds)', () => {
    expect(
      getSelectedAssetCount('instagram', {
        adAccounts: ['a1'],
        pages: ['p1'],
        instagramAccounts: ['ig1', 'ig2'],
        catalogs: ['c1'],
        datasets: ['d1'],
      })
    ).toBe(2);
  });

  it('counts pages only for meta_pages', () => {
    expect(
      getSelectedAssetCount('meta_pages', {
        pages: ['p1', 'p2'],
        adAccounts: ['a1'],
      })
    ).toBe(2);
  });

  it('counts Google product-specific asset arrays', () => {
    expect(getSelectedAssetCount('google_ads', { adAccounts: ['1'], pages: ['2'] })).toBe(2);
    expect(getSelectedAssetCount('ga4', { properties: ['p'] })).toBe(1);
    expect(getSelectedAssetCount('google_business_profile', { businessAccounts: ['b'] })).toBe(1);
    expect(getSelectedAssetCount('google_tag_manager', { containers: ['c'] })).toBe(1);
    expect(getSelectedAssetCount('google_search_console', { sites: ['s'] })).toBe(1);
    expect(getSelectedAssetCount('google_merchant_center', { merchantAccounts: ['m'] })).toBe(1);
  });

  it('counts LinkedIn ads/pages via the shared Meta-shaped blob fields', () => {
    expect(
      getSelectedAssetCount('linkedin_ads', {
        adAccounts: ['a'],
        pages: ['p'],
      })
    ).toBe(2);
    expect(getSelectedAssetCount('linkedin_pages', { pages: ['p1', 'p2'] })).toBe(2);
  });

  it('prefers TikTok selectedAdvertiserIds, then adAccounts, then advertisers', () => {
    expect(
      getSelectedAssetCount('tiktok', {
        selectedAdvertiserIds: ['s1', 's2'],
        adAccounts: ['a1'],
        advertisers: ['x'],
      })
    ).toBe(2);
    expect(
      getSelectedAssetCount('tiktok_ads', {
        adAccounts: ['a1'],
        advertisers: ['x', 'y'],
      })
    ).toBe(1);
    expect(getSelectedAssetCount('tiktok', { advertisers: ['x', 'y', 'z'] })).toBe(3);
  });

  it('returns 0 for unknown products', () => {
    expect(getSelectedAssetCount('not_a_product', { adAccounts: ['a'] })).toBe(0);
  });
});

describe('hasNoAssetsSignal', () => {
  it('is true when availableAssetCount is 0 for inventory-tracked products', () => {
    for (const product of [
      'google_ads',
      'ga4',
      'google_business_profile',
      'google_tag_manager',
      'google_search_console',
      'google_merchant_center',
      'meta_pages',
      'linkedin_ads',
      'linkedin_pages',
    ]) {
      expect(hasNoAssetsSignal(product, { availableAssetCount: 0 })).toBe(true);
      expect(hasNoAssetsSignal(product, { availableAssetCount: 3 })).toBe(false);
      expect(hasNoAssetsSignal(product, {})).toBe(false);
    }
  });

  it('uses availableAdvertisers emptiness for TikTok products', () => {
    expect(hasNoAssetsSignal('tiktok', { availableAdvertisers: [] })).toBe(true);
    expect(hasNoAssetsSignal('tiktok_ads', { availableAdvertisers: ['a'] })).toBe(false);
    expect(hasNoAssetsSignal('tiktok', {})).toBe(false);
  });

  it('is false for meta_ads and instagram (no inventory signal today)', () => {
    expect(hasNoAssetsSignal('meta_ads', { availableAssetCount: 0 })).toBe(false);
    expect(hasNoAssetsSignal('instagram', { availableAssetCount: 0 })).toBe(false);
  });
});
