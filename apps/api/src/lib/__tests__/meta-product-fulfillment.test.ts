import { describe, expect, it } from 'vitest';
import { evaluateMetaProductFulfillment } from '../meta-product-fulfillment.js';

const META_ACCESS_CONFIG = {
  recipients: [
    { type: 'human' as const, id: 'person-1', name: 'Agency Owner' },
    { type: 'system_user' as const, id: 'sys-1', name: 'Automation' },
  ],
  pageTasks: ['MANAGE'],
  adAccountTasks: ['ANALYZE'],
};

describe('evaluateMetaProductFulfillment', () => {
  it('fulfills Meta pages when partner share is verified even if person assignment failed', () => {
    const result = evaluateMetaProductFulfillment(
      { product: 'meta_pages', platformGroup: 'meta' },
      { pages: ['page_1'] },
      [
        {
          id: 'conn-1',
          platformGroup: 'meta',
          metaAssetGrants: [
            {
              assetKind: 'page',
              assetId: 'page_1',
              recipientType: 'business',
              recipientId: 'partner-bm',
              status: 'verified',
              requestedTasks: ['MANAGE'],
              verifiedTasks: ['MANAGE'],
              grantMethod: 'automatic_agency_partner',
              destination: {
                businessId: 'partner-bm',
                agencyConnection: { status: 'active', businessId: 'partner-bm' },
              },
              authorization: {
                status: 'active',
                expiresAt: null,
                authorizationEpoch: 1,
              },
              verifiedAuthorizationEpoch: 1,
            },
            {
              assetKind: 'page',
              assetId: 'page_1',
              recipientType: 'human',
              recipientId: 'person-1',
              status: 'blocked',
              requestedTasks: ['MANAGE'],
              verifiedTasks: [],
              grantMethod: 'assigned_users',
              destination: {
                businessId: 'partner-bm',
                agencyConnection: { status: 'active', businessId: 'partner-bm' },
              },
              authorization: {
                status: 'active',
                expiresAt: null,
                authorizationEpoch: 1,
              },
              verifiedAuthorizationEpoch: 1,
            },
          ],
        },
      ],
      META_ACCESS_CONFIG
    );

    expect(result).toEqual({ fulfilled: true });
  });
});
