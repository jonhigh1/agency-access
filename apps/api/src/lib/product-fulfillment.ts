/**
 * Shared product-fulfillment helpers for invite progress and client detail
 * (architecture review card 2 / U4).
 *
 * Instagram selections are stored under the meta_ads grantedAssets key
 * (access-request / invite truth). Client detail must use the same remap.
 */

import {
  platformGroupOf,
  type GoogleProductGrantLifecycle,
  type UnresolvedProductReason,
} from '@agency-platform/shared';
import {
  getSelectedAssetCount,
  hasNoAssetsSignal,
} from '@/lib/product-selection-signals.js';
import {
  evaluateMetaProductFulfillment,
  type MetaFulfillmentConnection,
} from '@/lib/meta-product-fulfillment.js';
import {
  isGooglePlatformProduct,
  resolveGoogleGrantLifecycle,
  type GoogleAgencyPlatformConnectionSummary,
} from '@/lib/google-grant-lifecycle-resolver.js';

export type ProductFulfillmentRequestedProduct = {
  product: string;
  platformGroup: string;
};

export type ProductFulfillmentConnection = {
  grantedAssets?: unknown;
  authorizations?: Array<{ platform: string; status: string }>;
};

export type ProductSelectionSnapshot = {
  hasOAuthAuthorization: boolean;
  selectedAssets: Record<string, unknown> | null;
  hasSelectedAssets: boolean;
  hasNoAssets: boolean;
};

export type AssetSelectingFulfillmentOutcome =
  | { outcome: 'fulfilled'; googleGrantLifecycle?: GoogleProductGrantLifecycle }
  | {
      outcome: 'unresolved';
      reason: UnresolvedProductReason;
      googleGrantLifecycle?: GoogleProductGrantLifecycle;
    };

function isActiveAuthorizationStatus(status?: string | null): boolean {
  return status === 'active' || status === 'expiring';
}

/** Canonical grantedAssets key; Instagram selections live under meta_ads. */
export function grantedAssetsKeyForProduct(product: string): string {
  return product === 'instagram' ? 'meta_ads' : product;
}

export function extractSelectedAssets(
  product: string,
  grantedAssets: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!grantedAssets) {
    return null;
  }

  const selectedAssets = grantedAssets[grantedAssetsKeyForProduct(product)];
  return selectedAssets && typeof selectedAssets === 'object'
    ? (selectedAssets as Record<string, unknown>)
    : null;
}

export function summarizeProductSelectionAcrossConnections(
  product: string,
  platformGroup: string,
  connections: ProductFulfillmentConnection[],
  options?: {
    isActiveAuthorization?: (status?: string | null) => boolean;
  }
): ProductSelectionSnapshot {
  const isActive = options?.isActiveAuthorization ?? isActiveAuthorizationStatus;
  let hasOAuthAuthorization = false;
  let hasSelectedAssets = false;
  let hasNoAssets = false;
  let selectedAssets: Record<string, unknown> | null = null;

  for (const connection of connections) {
    if (
      (connection.authorizations || []).some(
        (authorization) =>
          isActive(authorization.status) &&
          platformGroupOf(authorization.platform) === platformGroup
      )
    ) {
      hasOAuthAuthorization = true;
    }

    const assets = extractSelectedAssets(
      product,
      (connection.grantedAssets as Record<string, unknown> | null) || null
    );
    if (!assets) {
      continue;
    }

    selectedAssets = assets;

    if (getSelectedAssetCount(product, assets) > 0) {
      hasSelectedAssets = true;
    }

    if (hasNoAssetsSignal(product, assets)) {
      hasNoAssets = true;
    }
  }

  return {
    hasOAuthAuthorization,
    selectedAssets,
    hasSelectedAssets,
    hasNoAssets,
  };
}

export function evaluateAssetSelectingProductFulfillment(input: {
  requestedProduct: ProductFulfillmentRequestedProduct;
  selection: ProductSelectionSnapshot;
  connections: MetaFulfillmentConnection[];
  metaAccessConfig?: unknown;
  agencyPlatformConnections?: GoogleAgencyPlatformConnectionSummary[];
  authorizationMetadata?: Record<string, unknown> | null;
}): AssetSelectingFulfillmentOutcome {
  const {
    requestedProduct,
    selection,
    connections,
    metaAccessConfig,
    agencyPlatformConnections = [],
    authorizationMetadata = null,
  } = input;
  const {
    hasOAuthAuthorization,
    selectedAssets,
    hasSelectedAssets,
    hasNoAssets,
  } = selection;

  if (isGooglePlatformProduct(requestedProduct.product)) {
    const lifecycle = resolveGoogleGrantLifecycle({
      product: requestedProduct.product,
      hasOAuthAuthorization,
      selectedAssets,
      authorizationMetadata,
      agencyPlatformConnections,
    });
    if (!lifecycle) {
      return { outcome: 'unresolved', reason: 'authorization_required' };
    }

    if (!hasOAuthAuthorization) {
      return {
        outcome: 'unresolved',
        reason: 'authorization_required',
        googleGrantLifecycle: lifecycle,
      };
    }

    if (hasNoAssets) {
      return { outcome: 'unresolved', reason: 'no_assets', googleGrantLifecycle: lifecycle };
    }

    if (!hasSelectedAssets) {
      return {
        outcome: 'unresolved',
        reason: 'selection_required',
        googleGrantLifecycle: lifecycle,
      };
    }

    if (lifecycle.isFulfilled) {
      return { outcome: 'fulfilled', googleGrantLifecycle: lifecycle };
    }

    return {
      outcome: 'unresolved',
      reason: lifecycle.state as UnresolvedProductReason,
      googleGrantLifecycle: lifecycle,
    };
  }

  if (requestedProduct.platformGroup === 'meta') {
    if (!hasOAuthAuthorization && (!hasSelectedAssets || !selectedAssets)) {
      return { outcome: 'unresolved', reason: 'authorization_required' };
    }

    if (hasNoAssets) {
      return { outcome: 'unresolved', reason: 'no_assets' };
    }

    if (!hasSelectedAssets || !selectedAssets) {
      if (hasOAuthAuthorization) {
        return { outcome: 'unresolved', reason: 'selection_required' };
      }
      return { outcome: 'unresolved', reason: 'authorization_required' };
    }

    const fulfillment = evaluateMetaProductFulfillment(
      requestedProduct,
      selectedAssets,
      connections,
      metaAccessConfig
    );
    if (fulfillment.fulfilled) {
      return { outcome: 'fulfilled' };
    }
    return {
      outcome: 'unresolved',
      reason: (fulfillment.reason || 'sharing_required') as UnresolvedProductReason,
    };
  }

  if (!hasOAuthAuthorization) {
    return { outcome: 'unresolved', reason: 'authorization_required' };
  }

  if (hasSelectedAssets) {
    return { outcome: 'fulfilled' };
  }

  if (hasNoAssets) {
    return { outcome: 'unresolved', reason: 'no_assets' };
  }

  return { outcome: 'unresolved', reason: 'selection_required' };
}
