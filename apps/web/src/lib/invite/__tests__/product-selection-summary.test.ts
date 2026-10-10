import { describe, expect, it } from 'vitest';
import type { MetaSelectionBlob } from '@/components/client-auth/meta-selection-blob';
import type { MetaGrantChecklist } from '../meta-grant-checklist';
import {
  getMetaFollowUpLines,
  getMetaZeroSelectionMode,
  getProductCtaState,
  getProductSummaryLines,
  getSelectedAssetCount,
  hasGrantFollowUp,
  hasNoAssetsFollowUp,
  isGoogleProduct,
  isMetaAssetProduct,
  shouldPersistMetaProductSave,
  supportsAssetSelection,
} from '../product-selection-summary';

function blob(overrides: Partial<MetaSelectionBlob> = {}): MetaSelectionBlob {
  return {
    adAccounts: [],
    pages: [],
    instagramAccounts: [],
    catalogs: [],
    datasets: [],
    ...overrides,
  };
}

describe('getSelectedAssetCount', () => {
  it('counts Meta-shaped fields for meta_ads / google_ads / linkedin', () => {
    const assets = blob({
      adAccounts: ['a1'],
      pages: ['p1'],
      instagramAccounts: ['ig1'],
      catalogs: ['c1'],
      datasets: ['d1'],
    });
    expect(getSelectedAssetCount('meta_ads', assets)).toBe(5);
    expect(getSelectedAssetCount('google_ads', assets)).toBe(5);
    expect(getSelectedAssetCount('linkedin_ads', assets)).toBe(5);
    expect(getSelectedAssetCount('linkedin_pages', assets)).toBe(5);
  });

  it('counts only instagramAccounts for instagram (not sibling Meta kinds)', () => {
    expect(
      getSelectedAssetCount(
        'instagram',
        blob({
          adAccounts: ['a1'],
          pages: ['p1'],
          instagramAccounts: ['ig1', 'ig2'],
          catalogs: ['c1'],
          datasets: ['d1'],
        })
      )
    ).toBe(2);
  });

  it('counts pages only for meta_pages', () => {
    expect(
      getSelectedAssetCount(
        'meta_pages',
        blob({ pages: ['p1', 'p2'], adAccounts: ['a1'] })
      )
    ).toBe(2);
  });

  it('counts Google product-specific arrays', () => {
    expect(getSelectedAssetCount('ga4', { ...blob(), properties: ['p'] })).toBe(1);
    expect(
      getSelectedAssetCount('google_business_profile', {
        ...blob(),
        businessAccounts: ['b'],
      })
    ).toBe(1);
    expect(
      getSelectedAssetCount('google_tag_manager', { ...blob(), containers: ['c'] })
    ).toBe(1);
    expect(
      getSelectedAssetCount('google_search_console', { ...blob(), sites: ['s'] })
    ).toBe(1);
    expect(
      getSelectedAssetCount('google_merchant_center', {
        ...blob(),
        merchantAccounts: ['m'],
      })
    ).toBe(1);
  });

  it('prefers TikTok selectedAdvertiserIds then adAccounts; ignores advertisers array', () => {
    expect(
      getSelectedAssetCount('tiktok', {
        ...blob(),
        selectedAdvertiserIds: ['s1', 's2'],
        adAccounts: ['a1'],
        advertisers: ['x', 'y', 'z'],
      } as MetaSelectionBlob & { selectedAdvertiserIds: string[]; advertisers: string[] })
    ).toBe(2);
    expect(
      getSelectedAssetCount('tiktok_ads', {
        ...blob(),
        adAccounts: ['a1'],
        advertisers: ['x', 'y'],
      } as MetaSelectionBlob & { advertisers: string[] })
    ).toBe(1);
    expect(
      getSelectedAssetCount('tiktok', {
        ...blob(),
        advertisers: ['x', 'y', 'z'],
      } as MetaSelectionBlob & { advertisers: string[] })
    ).toBe(0);
  });

  it('returns 0 for unknown products', () => {
    expect(getSelectedAssetCount('not_a_product', blob({ adAccounts: ['a'] }))).toBe(0);
  });
});

describe('hasNoAssetsFollowUp', () => {
  it('is true when google/linkedin availableAssetCount is 0', () => {
    expect(hasNoAssetsFollowUp('google_ads', blob({ availableAssetCount: 0 }))).toBe(true);
    expect(hasNoAssetsFollowUp('ga4', blob({ availableAssetCount: 0 }))).toBe(true);
    expect(hasNoAssetsFollowUp('linkedin_ads', blob({ availableAssetCount: 0 }))).toBe(true);
    expect(hasNoAssetsFollowUp('linkedin_pages', blob({ availableAssetCount: 0 }))).toBe(true);
  });

  it('is true when TikTok availableAdvertisers is an empty array', () => {
    expect(
      hasNoAssetsFollowUp('tiktok_ads', blob({ availableAdvertisers: [] }))
    ).toBe(true);
    expect(hasNoAssetsFollowUp('tiktok', blob({ availableAdvertisers: [] }))).toBe(true);
  });

  it('is false for Meta products even with empty inventory', () => {
    expect(hasNoAssetsFollowUp('meta_ads', blob({ availableAssetCount: 0 }))).toBe(false);
  });
});

describe('getProductSummaryLines', () => {
  it('summarizes google_ads selection and empty inventory follow-up', () => {
    expect(
      getProductSummaryLines('google_ads', blob({ adAccounts: ['a1', 'a2'] }))
    ).toEqual(['2 Ad Accounts selected']);
    expect(
      getProductSummaryLines('google_ads', blob({ availableAssetCount: 0 }))
    ).toEqual(['Follow-up needed: No ad accounts found yet']);
  });

  it('summarizes meta_ads asset kinds and appends follow-up lines', () => {
    const checklist: MetaGrantChecklist = {
      items: [],
      remainingCount: 0,
      hasAny: false,
    };
    expect(
      getProductSummaryLines(
        'meta_ads',
        blob({
          adAccounts: ['a1'],
          pages: ['p1'],
          instagramAccounts: ['ig1'],
          selectedInstagramWithNames: [{ id: 'ig1', name: 'IG One' }],
        }),
        checklist
      )
    ).toEqual([
      '1 Ad Account selected',
      '1 Page selected',
      '1 IG Account selected',
      'Follow-up needed: IG One needs agency Business Portfolio sharing and verification',
    ]);
  });

  it('summarizes TikTok advertisers from selectedAdvertiserIds or adAccounts', () => {
    expect(
      getProductSummaryLines('tiktok_ads', {
        ...blob(),
        selectedAdvertiserIds: ['s1'],
      } as MetaSelectionBlob & { selectedAdvertiserIds: string[] })
    ).toEqual(['1 Advertiser selected']);
    expect(
      getProductSummaryLines('tiktok', blob({ adAccounts: ['a1', 'a2'] }))
    ).toEqual(['2 Advertisers selected']);
    expect(
      getProductSummaryLines('tiktok_ads', blob({ availableAdvertisers: [] }))
    ).toEqual(['Follow-up needed: No advertisers found yet']);
  });
});

describe('shouldPersistMetaProductSave', () => {
  it('persists meta_ads when ads-shaped selection or declines exist', () => {
    expect(shouldPersistMetaProductSave('meta_ads', blob({ adAccounts: ['a'] }))).toBe(true);
    expect(
      shouldPersistMetaProductSave('meta_ads', blob({ declinedAssetKinds: ['ad_account'] }))
    ).toBe(true);
    expect(shouldPersistMetaProductSave('meta_ads', blob())).toBe(false);
  });

  it('persists meta_pages only when pages are selected', () => {
    expect(shouldPersistMetaProductSave('meta_pages', blob({ pages: ['p'] }))).toBe(true);
    expect(
      shouldPersistMetaProductSave('meta_pages', blob({ adAccounts: ['a'] }))
    ).toBe(false);
  });

  it('persists instagram only when instagramAccounts are selected', () => {
    expect(
      shouldPersistMetaProductSave('instagram', blob({ instagramAccounts: ['ig'] }))
    ).toBe(true);
    expect(
      shouldPersistMetaProductSave('instagram', blob({ pages: ['p'] }))
    ).toBe(false);
  });
});

describe('getMetaZeroSelectionMode', () => {
  it('returns declined-save when every allowed type was declined', () => {
    expect(
      getMetaZeroSelectionMode(blob({ declinedAssetKinds: ['ad_account', 'page'] }), [
        'ad_account',
        'page',
      ])
    ).toBe('declined-save');
  });

  it('returns create-required when the business has no available assets', () => {
    expect(getMetaZeroSelectionMode(blob(), ['ad_account'])).toBe('create-required');
  });

  it('returns selection-required when inventory exists', () => {
    expect(
      getMetaZeroSelectionMode(blob({ allAdAccounts: [{ id: 'a', name: 'A' }] }), [
        'ad_account',
      ])
    ).toBe('selection-required');
  });
});

describe('getProductCtaState', () => {
  it('maps Meta zero-selection via getMetaZeroSelectionMode', () => {
    expect(getProductCtaState('meta_ads', blob(), ['ad_account'])).toEqual({
      product: 'meta_ads',
      selectedCount: 0,
      zeroSelectionMode: 'create-required',
    });
  });

  it('maps empty google inventory to follow-up-save', () => {
    expect(
      getProductCtaState('google_ads', blob({ availableAssetCount: 0 }), [])
    ).toEqual({
      product: 'google_ads',
      selectedCount: 0,
      zeroSelectionMode: 'follow-up-save',
    });
  });
});

describe('product predicates', () => {
  it('identifies Meta asset products and Google products', () => {
    expect(isMetaAssetProduct('meta_ads')).toBe(true);
    expect(isMetaAssetProduct('instagram')).toBe(true);
    expect(isMetaAssetProduct('google_ads')).toBe(false);
    expect(isGoogleProduct('ga4')).toBe(true);
    expect(isGoogleProduct('google_ads')).toBe(true);
    expect(isGoogleProduct('meta_ads')).toBe(false);
  });

  it('supports asset selection for Meta, Google, LinkedIn, and TikTok products', () => {
    expect(supportsAssetSelection('meta_pages')).toBe(true);
    expect(supportsAssetSelection('google_tag_manager')).toBe(true);
    expect(supportsAssetSelection('linkedin_ads')).toBe(true);
    expect(supportsAssetSelection('tiktok_ads')).toBe(true);
    expect(supportsAssetSelection('beehiiv')).toBe(false);
  });

  it('hasGrantFollowUp only for Meta products with follow-up lines', () => {
    expect(
      hasGrantFollowUp(
        'meta_ads',
        blob({
          instagramAccounts: ['ig1'],
          selectedInstagramWithNames: [{ id: 'ig1', name: 'IG' }],
        })
      )
    ).toBe(true);
    expect(hasGrantFollowUp('google_ads', blob({ availableAssetCount: 0 }))).toBe(false);
  });
});

describe('getMetaFollowUpLines', () => {
  it('skips dataset follow-up when the checklist marks dataset done', () => {
    const checklist = {
      items: [{ key: 'dataset', state: 'done' as const }],
      remainingCount: 0,
      hasAny: true,
    } as MetaGrantChecklist;
    expect(
      getMetaFollowUpLines(
        blob({
          datasets: ['d1'],
          selectedDatasetsWithNames: [{ id: 'd1', name: 'Dataset One' }],
        }),
        checklist
      )
    ).toEqual([]);
  });
});
