/**
 * Meta product fulfillment evaluator.
 *
 * Extracted from access-request.service.ts so client-detail and request
 * progress share one pure module (architecture review card 2 / U1).
 * Client completion is gated on Partner (business) share per asset; person
 * and system-user assigned_users rows are agency follow-up.
 */

import {
  MetaAccessConfigSchema,
  type MetaFulfillmentStatus,
  type UnresolvedProductReason,
} from '@agency-platform/shared';

export type MetaFulfillmentRequestedProduct = {
  product: string;
  platformGroup: string;
};

export type MetaFulfillmentGrantRow = {
  assetKind: string;
  assetId: string;
  grantMethod?: string;
  status: MetaFulfillmentStatus | 'pending' | 'granted' | 'failed' | 'unresolved';
  recipientType: string;
  recipientId: string;
  requestedTasks?: unknown;
  verifiedTasks?: unknown;
  nextActor?: string | null;
  verifiedAuthorizationEpoch?: number | null;
  authorization?: { authorizationEpoch: number; status: string; expiresAt?: Date | null } | null;
  destination?: {
    businessId?: string;
    agencyConnection?: { businessId?: string; status: string } | null;
  } | null;
};

export type MetaFulfillmentConnection = {
  status?: string;
  grantedAssets?: unknown;
  authorizations?: Array<{
    platform: string;
    status: string;
    authorizationEpoch?: number;
  }>;
  metaAssetGrants?: MetaFulfillmentGrantRow[];
};

function getSelectedMetaAssets(
  product: string,
  assets: Record<string, unknown>
): Array<{ assetKind: string; assetId: string }> {
  const pairs: Array<{ assetKind: string; assetId: string }> = [];
  const add = (assetKind: string, ids: unknown) => {
    if (!Array.isArray(ids)) return;
    for (const id of ids) {
      if (typeof id === 'string' && id) pairs.push({ assetKind, assetId: id });
    }
  };

  if (product === 'meta_ads') {
    add('ad_account', assets.adAccounts);
    add('page', assets.pages);
    add('instagram_account', assets.instagramAccounts);
    add('catalog', assets.catalogs);
    add('dataset', assets.datasets);
  } else if (product === 'instagram') {
    add('instagram_account', assets.instagramAccounts);
  } else if (product === 'meta_pages') {
    add('page', assets.pages);
  }

  return pairs;
}

export function getVerifiedMetaGrantProblem(
  grant: MetaFulfillmentGrantRow
): 'missing_tasks' | 'stale' | null {
  if (!Array.isArray(grant.requestedTasks)) return 'missing_tasks';
  if (
    grant.requestedTasks.length > 0 &&
    (!Array.isArray(grant.verifiedTasks) ||
      !grant.requestedTasks.every(
        (task) =>
          typeof task === 'string' && (grant.verifiedTasks as string[]).includes(task)
      ))
  ) {
    return 'missing_tasks';
  }

  if (
    !grant.authorization ||
    grant.authorization.status !== 'active' ||
    (grant.authorization.expiresAt !== null &&
      grant.authorization.expiresAt !== undefined &&
      grant.authorization.expiresAt.getTime() <= Date.now()) ||
    grant.verifiedAuthorizationEpoch !== grant.authorization.authorizationEpoch
  ) {
    return 'stale';
  }

  if (
    grant.destination?.agencyConnection &&
    (grant.destination.agencyConnection.status !== 'active' ||
      (grant.destination.businessId &&
        grant.destination.businessId !== grant.destination.agencyConnection.businessId))
  ) {
    return 'stale';
  }

  return null;
}

export function evaluateMetaProductFulfillment(
  requestedProduct: MetaFulfillmentRequestedProduct,
  selectedAssets: Record<string, unknown>,
  connections: MetaFulfillmentConnection[],
  metaAccessConfig: unknown
): { fulfilled: boolean; reason?: UnresolvedProductReason } {
  const config = MetaAccessConfigSchema.safeParse(metaAccessConfig);
  if (!config.success || !config.data.recipients.some((recipient) => recipient.type === 'human')) {
    return { fulfilled: false, reason: 'assignee_selection_required' };
  }
  const selected = getSelectedMetaAssets(requestedProduct.product, selectedAssets);
  const grants = connections.flatMap((connection) => connection.metaAssetGrants || []);
  type Grant = (typeof grants)[number];
  const grantsByAsset = new Map<string, Map<string, Grant[]>>();

  for (const grant of grants) {
    let grantsById = grantsByAsset.get(grant.assetKind);
    if (!grantsById) {
      grantsById = new Map();
      grantsByAsset.set(grant.assetKind, grantsById);
    }

    const assetGrants = grantsById.get(grant.assetId) || [];
    assetGrants.push(grant);
    grantsById.set(grant.assetId, assetGrants);
  }

  for (const asset of selected) {
    const assetGrants = grantsByAsset.get(asset.assetKind)?.get(asset.assetId) || [];
    const currentDestinationIds = new Set(
      assetGrants.flatMap((grant) => {
        const destination = grant.destination;
        const agencyConnection = destination?.agencyConnection;
        return destination?.businessId &&
          agencyConnection?.status === 'active' &&
          agencyConnection.businessId === destination.businessId
          ? [destination.businessId]
          : [];
      })
    );
    const grantsForCurrentDestinations =
      currentDestinationIds.size > 0
        ? assetGrants.filter((grant) =>
            currentDestinationIds.has(grant.destination?.businessId || '')
          )
        : assetGrants;
    const businessGrants = grantsForCurrentDestinations.filter(
      (grant) => grant.recipientType === 'business'
    );
    if (businessGrants.length === 0) return { fulfilled: false, reason: 'sharing_required' };
    // Client completion is gated on Partner (business) share per asset. Person and
    // system-user assigned_users rows are follow-up work for the agency.
    const requiredGrants = [...businessGrants];

    for (const grant of requiredGrants) {
      if (grant.status === 'excluded') continue;
      if (grant.status !== 'verified') return { fulfilled: false, reason: grant.status };
      const problem = getVerifiedMetaGrantProblem(grant);
      if (problem) return { fulfilled: false, reason: problem };
    }
  }

  return { fulfilled: selected.length > 0 };
}
