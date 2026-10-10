/**
 * Shared Google grant lifecycle resolution for request progress and client detail
 * (architecture review card 2 / U2).
 *
 * Pure evaluator stays in shared (`evaluateGoogleProductFulfillment`). This
 * module owns default fulfillment mode (including MCC → manager_link) and
 * merging stored lifecycle from grantedAssets / authorization metadata.
 */

import {
  GOOGLE_PLATFORM_PRODUCT_IDS,
  evaluateGoogleProductFulfillment,
  type GooglePlatformProductId,
  type GoogleProductFulfillmentMode,
  type GoogleProductGrantLifecycle,
} from '@agency-platform/shared';
import { normalizeCustomerId } from '@/services/connectors/google.js';

export const GOOGLE_PRODUCT_ID_SET = new Set<string>(GOOGLE_PLATFORM_PRODUCT_IDS);

export const GOOGLE_DEFAULT_FULFILLMENT_MODE: Record<
  GooglePlatformProductId,
  GoogleProductFulfillmentMode
> = {
  google_ads: 'user_invite',
  ga4: 'access_binding',
  google_business_profile: 'location_admin',
  google_tag_manager: 'user_permission',
  google_search_console: 'discovery',
  google_merchant_center: 'merchant_user',
};

export type GoogleAgencyPlatformConnectionSummary = {
  platform: string;
  metadata?: unknown;
};

export function isGooglePlatformProduct(product: string): product is GooglePlatformProductId {
  return GOOGLE_PRODUCT_ID_SET.has(product);
}

export function resolveGoogleDefaultFulfillmentMode(
  product: string,
  agencyPlatformConnections: GoogleAgencyPlatformConnectionSummary[] = []
): GoogleProductFulfillmentMode {
  const defaultMode = GOOGLE_DEFAULT_FULFILLMENT_MODE[product as GooglePlatformProductId];

  if (product !== 'google_ads') {
    return defaultMode;
  }

  const googleConnection = agencyPlatformConnections.find(
    (connection) => connection.platform === 'google'
  );
  const metadata =
    googleConnection?.metadata && typeof googleConnection.metadata === 'object'
      ? (googleConnection.metadata as Record<string, any>)
      : null;
  const managementSettings =
    metadata?.googleAssetSettings &&
    typeof metadata.googleAssetSettings === 'object' &&
    metadata.googleAssetSettings.googleAdsManagement &&
    typeof metadata.googleAssetSettings.googleAdsManagement === 'object'
      ? (metadata.googleAssetSettings.googleAdsManagement as Record<string, any>)
      : null;

  if (managementSettings?.preferredGrantMode !== 'manager_link') {
    return defaultMode;
  }

  const managerCustomerId =
    typeof managementSettings.managerCustomerId === 'string'
      ? normalizeCustomerId(managementSettings.managerCustomerId)
      : '';

  if (!managerCustomerId) {
    return defaultMode;
  }

  const adsAccounts = Array.isArray(metadata?.googleAccounts?.adsAccounts)
    ? metadata.googleAccounts.adsAccounts
    : null;

  if (adsAccounts && adsAccounts.length > 0) {
    const selectedManager = adsAccounts.find(
      (account: any) => account?.id === managerCustomerId && account?.isManager
    );

    return selectedManager ? 'manager_link' : defaultMode;
  }

  return 'manager_link';
}

export interface ResolveGoogleGrantLifecycleInput {
  product: string;
  hasOAuthAuthorization: boolean;
  selectedAssets?: Record<string, unknown> | null;
  authorizationMetadata?: Record<string, unknown> | null;
  agencyPlatformConnections?: GoogleAgencyPlatformConnectionSummary[];
}

/**
 * Resolve GoogleProductGrantLifecycle from stored grant state + defaults.
 * Returns undefined when product is not a Google platform product.
 */
export function resolveGoogleGrantLifecycle(
  input: ResolveGoogleGrantLifecycleInput
): GoogleProductGrantLifecycle | undefined {
  if (!isGooglePlatformProduct(input.product)) {
    return undefined;
  }

  const selectedAssets =
    input.selectedAssets && typeof input.selectedAssets === 'object'
      ? input.selectedAssets
      : null;
  const authorizationMetadata =
    input.authorizationMetadata && typeof input.authorizationMetadata === 'object'
      ? input.authorizationMetadata
      : null;

  const storedLifecycleSource =
    (selectedAssets &&
    selectedAssets.googleGrantLifecycle &&
    typeof selectedAssets.googleGrantLifecycle === 'object'
      ? selectedAssets.googleGrantLifecycle
      : null) ||
    (authorizationMetadata &&
    authorizationMetadata.googleGrantLifecycle &&
    typeof authorizationMetadata.googleGrantLifecycle === 'object'
      ? authorizationMetadata.googleGrantLifecycle
      : null);

  const storedLifecycle = storedLifecycleSource as Partial<GoogleProductGrantLifecycle> | null;

  const fulfillmentMode =
    typeof storedLifecycle?.fulfillmentMode === 'string'
      ? (storedLifecycle.fulfillmentMode as GoogleProductFulfillmentMode)
      : resolveGoogleDefaultFulfillmentMode(
          input.product,
          input.agencyPlatformConnections || []
        );

  const grantStatus =
    typeof storedLifecycle?.grantStatus === 'string' ? storedLifecycle.grantStatus : undefined;

  return evaluateGoogleProductFulfillment({
    productId: input.product,
    hasOAuthAuthorization: input.hasOAuthAuthorization,
    fulfillmentMode,
    grantStatus,
  });
}
