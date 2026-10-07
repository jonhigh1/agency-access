import {
  META_REVIEW_DEFAULT_SANDBOX_META_USER_ID,
  type ReviewDemoIdentity,
} from '@agency-platform/shared';
import { env } from '@/lib/env.js';
import { metaGraphFetch } from '@/lib/meta-graph-instrumentation.js';
import { META_GRAPH_VERSION } from '@/lib/meta-constants.js';
import { MetaConnector } from '@/services/connectors/meta.js';
const GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export type ReviewDemoAssetMode = 'sandbox' | 'connected';

export interface ReviewDemoResolvedAssets {
  mode: ReviewDemoAssetMode;
  metaUserId: string;
  pageId: string | null;
  adAccountId: string | null;
  businessManagerId: string | null;
  agencyBusinessId: string;
  sandboxDisplay: {
    businessManagerId: string;
    adAccountId: string;
    pageId: string;
    agencyBusinessId: string;
  };
}

function defaultSandboxIds() {
  return {
    businessManagerId: env.META_REVIEW_BM_ID ?? '695982475048959',
    adAccountId: normalizeAdAccountId(env.META_REVIEW_AD_ACCOUNT_ID ?? '557538895783894'),
    pageId: env.META_REVIEW_PAGE_ID ?? '1373353139192376',
    agencyBusinessId: env.META_REVIEW_AGENCY_BM_ID ?? '3808519629379919',
  };
}

function normalizeAdAccountId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('act_')) return trimmed;
  return `act_${trimmed.replace(/^act_/, '')}`;
}

export function resolveSandboxMetaUserId(): string {
  const configured = env.META_REVIEW_SANDBOX_META_USER_ID?.trim();
  return configured || META_REVIEW_DEFAULT_SANDBOX_META_USER_ID;
}

export function isReviewDemoSandboxMetaUser(metaUserId: string | undefined | null): boolean {
  if (!metaUserId?.trim()) return false;
  return metaUserId.trim() === resolveSandboxMetaUserId();
}

function requireAgencyBusinessId(): string {
  const configured = env.META_REVIEW_AGENCY_BM_ID?.trim();
  if (!configured) {
    throw new Error(
      'META_REVIEW_AGENCY_BM_ID must be set to the agency sandbox Business Portfolio id for review-demo partner assignment'
    );
  }
  return configured;
}

async function fetchPages(accessToken: string): Promise<Array<{ id: string; name: string }>> {
  const response = await metaGraphFetch(
    `${GRAPH_BASE}/me/accounts?fields=id,name,picture`,
    { method: 'GET', accessToken, tokenClass: 'client_user' }
  );
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as {
    data?: Array<{ id?: string; name?: string }>;
  };
  return (data.data ?? [])
    .filter((page): page is { id: string; name: string } => Boolean(page.id && page.name))
    .map((page) => ({ id: page.id, name: page.name }));
}

async function fetchAdAccounts(accessToken: string): Promise<Array<{ id: string; name: string }>> {
  const response = await metaGraphFetch(
    `${GRAPH_BASE}/me/adaccounts?fields=id,name,account_status`,
    { method: 'GET', accessToken, tokenClass: 'client_user' }
  );
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as {
    data?: Array<{ id?: string; name?: string }>;
  };
  return (data.data ?? [])
    .filter((row): row is { id: string; name: string } => Boolean(row.id && row.name))
    .map((row) => ({ id: normalizeAdAccountId(row.id), name: row.name }));
}

function filterIdsByGranularScope(
  assetIds: string[],
  granularScopes: Array<{ scope?: string; target_ids?: string[] }>,
  scopeName: string
): string[] {
  const entry = granularScopes.find((item) => item.scope === scopeName);
  if (!entry?.target_ids?.length) {
    return assetIds;
  }
  const allowed = new Set(entry.target_ids.map((id) => id.trim()).filter(Boolean));
  const filtered = assetIds.filter((id) => allowed.has(id.replace(/^act_/, '')) || allowed.has(id));
  return filtered.length > 0 ? filtered : assetIds;
}

export class ReviewDemoContextService {
  sandboxIds() {
    return defaultSandboxIds();
  }

  async resolveAssets(input: {
    accessToken: string;
    identity: ReviewDemoIdentity | null;
  }): Promise<ReviewDemoResolvedAssets> {
    const agencyBusinessId = requireAgencyBusinessId();
    const sandbox = defaultSandboxIds();
    const metaUserId = input.identity?.id?.trim() ?? '';

    if (isReviewDemoSandboxMetaUser(metaUserId)) {
      return {
        mode: 'sandbox',
        metaUserId,
        pageId: sandbox.pageId,
        adAccountId: sandbox.adAccountId,
        businessManagerId: sandbox.businessManagerId,
        agencyBusinessId,
        sandboxDisplay: sandbox,
      };
    }

    const connector = new MetaConnector();
    let granularScopes: Array<{ scope?: string; target_ids?: string[] }> = [];
    try {
      const debug = await connector.getDebugTokenDetails(input.accessToken);
      granularScopes = debug.granularScopes;
    } catch {
      granularScopes = [];
    }

    const pages = await fetchPages(input.accessToken);
    const pageIds = filterIdsByGranularScope(
      pages.map((page) => page.id),
      granularScopes,
      'pages_show_list'
    );
    const selectedPageId = pageIds[0] ?? null;

    const adAccountRows = await fetchAdAccounts(input.accessToken);
    const adAccountIds = filterIdsByGranularScope(
      adAccountRows.map((row) => row.id),
      granularScopes,
      'ads_management'
    );
    const selectedAdAccountId = adAccountIds[0] ?? null;

    let businessManagerId: string | null = null;
    try {
      const businessResult = await connector.getBusinessAccounts(input.accessToken);
      businessManagerId = businessResult.businesses[0]?.id ?? null;
    } catch {
      businessManagerId = null;
    }

    return {
      mode: 'connected',
      metaUserId,
      pageId: selectedPageId,
      adAccountId: selectedAdAccountId,
      businessManagerId,
      agencyBusinessId,
      sandboxDisplay: {
        businessManagerId: businessManagerId ?? '',
        adAccountId: selectedAdAccountId ?? '',
        pageId: selectedPageId ?? '',
        agencyBusinessId,
      },
    };
  }
}

export const reviewDemoContextService = new ReviewDemoContextService();
