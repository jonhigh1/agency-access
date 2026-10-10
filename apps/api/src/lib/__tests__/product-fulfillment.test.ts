import { describe, expect, it } from 'vitest';
import {
  extractSelectedAssets,
  grantedAssetsKeyForProduct,
  evaluateAssetSelectingProductFulfillment,
  summarizeProductSelectionAcrossConnections,
} from '../product-fulfillment.js';

describe('grantedAssetsKeyForProduct / extractSelectedAssets', () => {
  it('maps instagram selections to the meta_ads blob (invite/progress truth)', () => {
    expect(grantedAssetsKeyForProduct('instagram')).toBe('meta_ads');
    expect(grantedAssetsKeyForProduct('meta_ads')).toBe('meta_ads');
    expect(grantedAssetsKeyForProduct('ga4')).toBe('ga4');
  });

  it('reads Instagram accounts from meta_ads, not a per-product instagram key', () => {
    const granted = {
      meta_ads: { instagramAccounts: ['ig-1'], catalogs: ['cat-1'] },
      instagram: { instagramAccounts: ['ig-legacy'] },
    };

    expect(extractSelectedAssets('instagram', granted)).toEqual({
      instagramAccounts: ['ig-1'],
      catalogs: ['cat-1'],
    });
    expect(extractSelectedAssets('meta_ads', granted)).toEqual({
      instagramAccounts: ['ig-1'],
      catalogs: ['cat-1'],
    });
  });

  it('returns null when the canonical key is missing', () => {
    expect(extractSelectedAssets('instagram', { instagram: { instagramAccounts: ['ig-1'] } })).toBeNull();
    expect(extractSelectedAssets('ga4', null)).toBeNull();
  });
});

describe('summarizeProductSelectionAcrossConnections', () => {
  it('ORs authorization and selection across connections using the canonical key', () => {
    const snapshot = summarizeProductSelectionAcrossConnections(
      'instagram',
      'meta',
      [
        {
          authorizations: [{ platform: 'meta', status: 'active' }],
          grantedAssets: { meta_ads: { instagramAccounts: ['ig-1'] } },
        },
      ]
    );

    expect(snapshot.hasOAuthAuthorization).toBe(true);
    expect(snapshot.hasSelectedAssets).toBe(true);
    expect(snapshot.hasNoAssets).toBe(false);
    expect(snapshot.selectedAssets).toEqual({ instagramAccounts: ['ig-1'] });
  });
});

describe('evaluateAssetSelectingProductFulfillment', () => {
  it('fulfills Instagram when Meta grants verify against the meta_ads selection blob', () => {
    const outcome = evaluateAssetSelectingProductFulfillment({
      requestedProduct: { product: 'instagram', platformGroup: 'meta' },
      selection: {
        hasOAuthAuthorization: true,
        selectedAssets: { instagramAccounts: ['ig-1'] },
        hasSelectedAssets: true,
        hasNoAssets: false,
      },
      connections: [
        {
          authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 1 }],
          metaAssetGrants: [
            {
              assetKind: 'instagram_account',
              assetId: 'ig-1',
              status: 'verified',
              recipientType: 'business',
              recipientId: 'partner-bm',
              requestedTasks: ['MANAGE'],
              verifiedTasks: ['MANAGE'],
              verifiedAuthorizationEpoch: 1,
              authorization: { authorizationEpoch: 1, status: 'active', expiresAt: null },
              destination: {
                businessId: 'partner-bm',
                agencyConnection: { businessId: 'partner-bm', status: 'active' },
              },
            },
          ],
        },
      ],
      metaAccessConfig: {
        recipients: [
          { type: 'human', id: 'person-1', name: 'Operator' },
          { type: 'system_user', id: 'sys-1', name: 'Automation' },
        ],
        pageTasks: ['MANAGE'],
        adAccountTasks: ['ANALYZE'],
      },
    });

    expect(outcome).toEqual({ outcome: 'fulfilled' });
  });

  it('returns selection_required when OAuth exists but no assets were selected', () => {
    const outcome = evaluateAssetSelectingProductFulfillment({
      requestedProduct: { product: 'linkedin_ads', platformGroup: 'linkedin' },
      selection: {
        hasOAuthAuthorization: true,
        selectedAssets: null,
        hasSelectedAssets: false,
        hasNoAssets: false,
      },
      connections: [],
    });

    expect(outcome).toEqual({ outcome: 'unresolved', reason: 'selection_required' });
  });
});
