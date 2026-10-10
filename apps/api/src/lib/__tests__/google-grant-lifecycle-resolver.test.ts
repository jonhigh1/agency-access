import { describe, expect, it } from 'vitest';
import {
  resolveGoogleDefaultFulfillmentMode,
  resolveGoogleGrantLifecycle,
} from '../google-grant-lifecycle-resolver.js';

describe('resolveGoogleDefaultFulfillmentMode', () => {
  it('returns the static default for non-google_ads products', () => {
    expect(resolveGoogleDefaultFulfillmentMode('ga4', [])).toBe('access_binding');
  });

  it('keeps user_invite for google_ads without MCC manager preference', () => {
    expect(resolveGoogleDefaultFulfillmentMode('google_ads', [])).toBe('user_invite');
  });

  it('promotes google_ads to manager_link when agency MCC preference is set', () => {
    expect(
      resolveGoogleDefaultFulfillmentMode('google_ads', [
        {
          platform: 'google',
          metadata: {
            googleAssetSettings: {
              googleAdsManagement: {
                preferredGrantMode: 'manager_link',
                managerCustomerId: '123-456-7890',
              },
            },
          },
        },
      ])
    ).toBe('manager_link');
  });

  it('keeps user_invite when managerCustomerId is empty', () => {
    expect(
      resolveGoogleDefaultFulfillmentMode('google_ads', [
        {
          platform: 'google',
          metadata: {
            googleAssetSettings: {
              googleAdsManagement: {
                preferredGrantMode: 'manager_link',
                managerCustomerId: '',
              },
            },
          },
        },
      ])
    ).toBe('user_invite');
  });

  it('requires the selected ads account to be a manager when adsAccounts are present', () => {
    expect(
      resolveGoogleDefaultFulfillmentMode('google_ads', [
        {
          platform: 'google',
          metadata: {
            googleAccounts: {
              adsAccounts: [{ id: '1234567890', isManager: false }],
            },
            googleAssetSettings: {
              googleAdsManagement: {
                preferredGrantMode: 'manager_link',
                managerCustomerId: '123-456-7890',
              },
            },
          },
        },
      ])
    ).toBe('user_invite');

    expect(
      resolveGoogleDefaultFulfillmentMode('google_ads', [
        {
          platform: 'google',
          metadata: {
            googleAccounts: {
              adsAccounts: [{ id: '1234567890', isManager: true }],
            },
            googleAssetSettings: {
              googleAdsManagement: {
                preferredGrantMode: 'manager_link',
                managerCustomerId: '123-456-7890',
              },
            },
          },
        },
      ])
    ).toBe('manager_link');
  });
});

describe('resolveGoogleGrantLifecycle', () => {
  it('returns undefined for non-Google products', () => {
    expect(
      resolveGoogleGrantLifecycle({
        product: 'meta_ads',
        hasOAuthAuthorization: true,
      })
    ).toBeUndefined();
  });

  it('prefers stored lifecycle from selectedAssets over defaults', () => {
    const lifecycle = resolveGoogleGrantLifecycle({
      product: 'google_ads',
      hasOAuthAuthorization: true,
      selectedAssets: {
        adAccounts: ['a1'],
        googleGrantLifecycle: {
          fulfillmentMode: 'manager_link',
          grantStatus: 'verified',
        },
      },
    });

    expect(lifecycle).toEqual(
      expect.objectContaining({
        state: 'fulfilled',
        isFulfilled: true,
        fulfillmentMode: 'manager_link',
      })
    );
  });

  it('falls back to authorization metadata lifecycle when assets lack one', () => {
    const lifecycle = resolveGoogleGrantLifecycle({
      product: 'google_ads',
      hasOAuthAuthorization: true,
      selectedAssets: { adAccounts: ['a1'] },
      authorizationMetadata: {
        googleGrantLifecycle: {
          fulfillmentMode: 'user_invite',
          grantStatus: 'verified',
        },
      },
    });

    expect(lifecycle).toEqual(
      expect.objectContaining({
        isFulfilled: true,
        fulfillmentMode: 'user_invite',
      })
    );
  });

  it('uses MCC default when no stored lifecycle is present', () => {
    const lifecycle = resolveGoogleGrantLifecycle({
      product: 'google_ads',
      hasOAuthAuthorization: true,
      selectedAssets: { adAccounts: ['a1'] },
      agencyPlatformConnections: [
        {
          platform: 'google',
          metadata: {
            googleAssetSettings: {
              googleAdsManagement: {
                preferredGrantMode: 'manager_link',
                managerCustomerId: '999-888-7777',
              },
            },
          },
        },
      ],
    });

    expect(lifecycle).toEqual(
      expect.objectContaining({
        fulfillmentMode: 'manager_link',
        state: 'oauth_only_insufficient',
        isFulfilled: false,
        requiresNativeGrant: true,
      })
    );
  });
});
