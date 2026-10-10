import { randomUUID } from 'crypto';
import {
  WEBHOOK_API_VERSION_V1,
  WEBHOOK_API_VERSION_V2,
  type WebhookApiVersion,
  type WebhookConnectionAssetV2,
  type WebhookEventType,
  type WebhookOrderedEnvelope,
  type AccessRequestStatus,
  type ConnectionStatus,
  type WebhookAccessRequestLifecycleEventType,
} from '@agency-platform/shared';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger.js';

interface AccessRequestWebhookEventInput {
  type: WebhookAccessRequestLifecycleEventType;
  apiVersion?: WebhookApiVersion;
  request: {
    id: string;
    status: AccessRequestStatus;
    createdAt: Date;
    authorizedAt: Date | null;
    expiresAt: Date;
    externalReference: string | null;
    uniqueToken: string;
    accessLevel?: string;
  };
  client: {
    id: string;
    name: string;
    email: string;
    company?: string;
  };
  authorizationProgress: {
    requestedPlatforms: string[];
    completedPlatforms: string[];
  };
  connections: Array<{
    connectionId: string;
    status: ConnectionStatus;
    platforms: string[];
    grantedAssetsSummary?: Record<string, unknown>;
    grantedAssets?: Record<string, unknown> | null;
    grantedAt?: Date | null;
    authorizationStatuses?: Array<{
      platform: string;
      status: string;
    }>;
  }>;
  requestUrl: string;
  clientPortalUrl?: string;
  /** ISO string — when the request was revoked */
  revokedAt?: string;
  /** Who revoked the request */
  revokedBy?: string;
  /** ISO string — when the request expired */
  expiredAt?: string;
}

function buildEventId(): string {
  return `evt_${randomUUID().replace(/-/g, '')}`;
}

function buildBaseEnvelope(apiVersion: WebhookApiVersion = WEBHOOK_API_VERSION_V1) {
  return {
    id: buildEventId(),
    apiVersion,
    createdAt: new Date().toISOString(),
  };
}

export function buildWebhookTestEvent() {
  return {
    ...buildBaseEnvelope(),
    type: 'webhook.test',
    data: {
      message: 'This is a test webhook from Agency Access.',
    },
  } as const;
}

/**
 * Maps raw grantedAssets JSON from ClientConnection to normalized V2 asset array.
 * Each platform has a different structure (Meta: adAccounts[], pages[]; Google: adsAccounts[], etc.)
 * This function normalizes them into a uniform WebhookConnectionAssetV2 format.
 */
export function normalizeGrantedAssetsToV2(
  grantedAssets: Record<string, unknown> | null,
  connectionStatus: ConnectionStatus,
  platform: string,
  grantedAt?: Date | null,
  authorizationStatuses?: Array<{ platform: string; status: string }>,
): WebhookConnectionAssetV2[] | undefined {
  if (!grantedAssets || typeof grantedAssets !== 'object' || Array.isArray(grantedAssets)) {
    return undefined;
  }

  /** Safely extract an asset array, filtering out malformed entries. */
  function safeAssetArray<T extends Record<string, unknown>>(
    value: unknown,
    requiredKeys: string[],
  ): T[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (entry): entry is T =>
        entry != null &&
        typeof entry === 'object' &&
        !Array.isArray(entry) &&
        requiredKeys.every((key) => key in entry && typeof (entry as Record<string, unknown>)[key] === 'string'),
    );
  }

  const assets: WebhookConnectionAssetV2[] = [];
  const normalizedPlatform = platform.toLowerCase();

  // Determine connection-level status for individual assets
  const connectionStatusMap: Record<string, 'Connected' | 'Failed' | 'Pending'> = {
    active: 'Connected',
    completed: 'Connected',
    partial: 'Pending',
    pending: 'Pending',
    failed: 'Failed',
    revoked: 'Failed',
    expired: 'Failed',
  };
  const baseConnectionStatus = connectionStatusMap[connectionStatus] ?? 'Pending';

  // Meta assets
  if (normalizedPlatform === 'meta') {
    const adAccounts = safeAssetArray<{ id: string; name: string }>(grantedAssets.adAccounts, ['id', 'name']);
    for (const account of adAccounts) {
      assets.push({
        assetId: account.id,
        assetName: account.name,
        assetType: 'Ad Account',
        platform: 'Meta',
        connectionStatus: baseConnectionStatus,
        grantedAt: grantedAt?.toISOString(),
        linkToAsset: `https://business.facebook.com/settings/${account.id}`,
      });
    }

    const pages = safeAssetArray<{ id: string; name: string }>(grantedAssets.pages, ['id', 'name']);
    for (const page of pages) {
      assets.push({
        assetId: page.id,
        assetName: page.name,
        assetType: 'Page',
        platform: 'Meta',
        connectionStatus: baseConnectionStatus,
        grantedAt: grantedAt?.toISOString(),
        linkToAsset: `https://www.facebook.com/${page.id}`,
      });
    }

    const instagramAccounts = safeAssetArray<{ id: string; username: string }>(grantedAssets.instagramAccounts, ['id', 'username']);
    for (const ig of instagramAccounts) {
      assets.push({
        assetId: ig.id,
        assetName: ig.username,
        assetType: 'Instagram Account',
        platform: 'Meta',
        connectionStatus: baseConnectionStatus,
        grantedAt: grantedAt?.toISOString(),
        linkToAsset: `https://www.instagram.com/${ig.username}`,
      });
    }

    const catalogs = safeAssetArray<{ id: string; name: string }>(grantedAssets.productCatalogs, ['id', 'name']);
    for (const catalog of catalogs) {
      assets.push({
        assetId: catalog.id,
        assetName: catalog.name,
        assetType: 'Product Catalog',
        platform: 'Meta',
        connectionStatus: baseConnectionStatus,
        grantedAt: grantedAt?.toISOString(),
      });
    }
  }

  // Google assets
  if (normalizedPlatform === 'google') {
    const adsAccounts = safeAssetArray<{ id: string; name: string; status: string }>(grantedAssets.adsAccounts, ['id', 'name']);
    for (const account of adsAccounts) {
      const isFailed = account.status === 'FAILED' || account.status === 'NOT_GRANTED';
      assets.push({
        assetId: account.id,
        assetName: account.name,
        assetType: 'Google Ads Account',
        platform: 'Google',
        connectionStatus: isFailed ? 'Failed' : baseConnectionStatus,
        grantedAt: grantedAt?.toISOString(),
        linkToAsset: `https://ads.google.com/aw/accounts/${account.id}`,
        notes: isFailed ? 'Access not granted.' : undefined,
      });
    }

    const analyticsProperties = safeAssetArray<{ id: string; name: string; displayName?: string }>(grantedAssets.analyticsProperties, ['id', 'name']);
    for (const prop of analyticsProperties) {
      assets.push({
        assetId: prop.id,
        assetName: prop.displayName ?? prop.name,
        assetType: 'Google Analytics Property',
        platform: 'Google',
        connectionStatus: baseConnectionStatus,
        grantedAt: grantedAt?.toISOString(),
      });
    }
  }

  // LinkedIn assets
  if (normalizedPlatform === 'linkedin') {
    const linkedinAds = safeAssetArray<{ id: string; name: string }>(grantedAssets.adsAccounts, ['id', 'name']);
    for (const account of linkedinAds) {
      assets.push({
        assetId: account.id,
        assetName: account.name,
        assetType: 'LinkedIn Ad Account',
        platform: 'LinkedIn',
        connectionStatus: baseConnectionStatus,
        grantedAt: grantedAt?.toISOString(),
      });
    }

    const linkedinPages = safeAssetArray<{ id: string; name: string }>(grantedAssets.pages, ['id', 'name']);
    for (const page of linkedinPages) {
      assets.push({
        assetId: page.id,
        assetName: page.name,
        assetType: 'LinkedIn Page',
        platform: 'LinkedIn',
        connectionStatus: baseConnectionStatus,
        grantedAt: grantedAt?.toISOString(),
      });
    }
  }

  return assets.length > 0 ? assets : undefined;
}

/**
 * Builds V2 access request webhook event with per-asset detail.
 * Called when endpoint.preferredApiVersion is '2026-03-19'.
 */
function buildAccessRequestWebhookEventV2(input: AccessRequestWebhookEventInput) {
  return {
    ...buildBaseEnvelope(WEBHOOK_API_VERSION_V2),
    type: input.type,
    data: {
      accessRequest: {
        id: input.request.id,
        status: input.request.status,
        createdAt: input.request.createdAt.toISOString(),
        authorizedAt: input.request.authorizedAt?.toISOString() ?? null,
        expiresAt: input.request.expiresAt.toISOString(),
        requestUrl: input.requestUrl,
        ...(input.clientPortalUrl ? { clientPortalUrl: input.clientPortalUrl } : {}),
        requestedPlatforms: input.authorizationProgress.requestedPlatforms,
        completedPlatforms: input.authorizationProgress.completedPlatforms,
        externalReference: input.request.externalReference,
        ...(input.request.accessLevel ? { accessLevel: input.request.accessLevel } : {}),
        ...(input.revokedAt ? { revokedAt: input.revokedAt } : {}),
        ...(input.revokedBy ? { revokedBy: input.revokedBy } : {}),
        ...(input.expiredAt ? { expiredAt: input.expiredAt } : {}),
      },
      client: {
        id: input.client.id,
        name: input.client.name,
        email: input.client.email,
        ...(input.client.company ? { company: input.client.company } : {}),
      },
      connections: input.connections.map((connection) => {
        const primaryPlatform = connection.platforms[0] ?? 'unknown';
        const assets = normalizeGrantedAssetsToV2(
          (typeof connection.grantedAssets === 'object' && connection.grantedAssets !== null && !Array.isArray(connection.grantedAssets)
            ? connection.grantedAssets as Record<string, unknown>
            : null),
          connection.status,
          primaryPlatform,
          connection.grantedAt ?? undefined,
          connection.authorizationStatuses,
        );

        return {
          connectionId: connection.connectionId,
          status: connection.status,
          platforms: connection.platforms,
          ...(connection.grantedAssetsSummary
            ? { grantedAssetsSummary: connection.grantedAssetsSummary }
            : {}),
          ...(assets ? { assets } : {}),
        };
      }),
    },
  } as const;
}

/**
 * Builds access request webhook event. Routes to V1 or V2 builder based on apiVersion.
 * V1 (default): connection-level summary, unchanged behavior.
 * V2 ('2026-03-19'): per-asset detail with normalized assets array.
 */
export function buildAccessRequestWebhookEvent(input: AccessRequestWebhookEventInput) {
  if (input.apiVersion === WEBHOOK_API_VERSION_V2) {
    return buildAccessRequestWebhookEventV2(input);
  }

  // V1 — existing behavior unchanged
  return {
    ...buildBaseEnvelope(),
    type: input.type,
    data: {
      accessRequest: {
        id: input.request.id,
        status: input.request.status,
        createdAt: input.request.createdAt.toISOString(),
        authorizedAt: input.request.authorizedAt?.toISOString() ?? null,
        expiresAt: input.request.expiresAt.toISOString(),
        requestUrl: input.requestUrl,
        ...(input.clientPortalUrl ? { clientPortalUrl: input.clientPortalUrl } : {}),
        requestedPlatforms: input.authorizationProgress.requestedPlatforms,
        completedPlatforms: input.authorizationProgress.completedPlatforms,
        externalReference: input.request.externalReference,
        ...(input.revokedAt ? { revokedAt: input.revokedAt } : {}),
        ...(input.revokedBy ? { revokedBy: input.revokedBy } : {}),
        ...(input.expiredAt ? { expiredAt: input.expiredAt } : {}),
      },
      client: {
        id: input.client.id,
        name: input.client.name,
        email: input.client.email,
        ...(input.client.company ? { company: input.client.company } : {}),
      },
      connections: input.connections.map((connection) => ({
        connectionId: connection.connectionId,
        status: connection.status,
        platforms: connection.platforms,
        ...(connection.grantedAssetsSummary
          ? { grantedAssetsSummary: connection.grantedAssetsSummary }
          : {}),
      })),
    },
  } as const;
}

/**
 * Builds a connection.status_changed webhook event.
 * Emitted when a PlatformAuthorization status transitions (e.g., active → invalid).
 */
export function buildConnectionStatusChangedEvent(input: {
  connectionId: string;
  agencyId: string;
  platform: string;
  previousStatus: string;
  newStatus: string;
  client?: {
    id: string;
    name: string;
    email: string;
    company?: string;
  };
  apiVersion?: WebhookApiVersion;
}) {
  const detectedAt = new Date().toISOString();
  const apiVersion = input.apiVersion ?? WEBHOOK_API_VERSION_V1;

  return {
    ...buildBaseEnvelope(apiVersion),
    type: 'connection.status_changed' as const,
    data: {
      connectionId: input.connectionId,
      agencyId: input.agencyId,
      platform: input.platform,
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      detectedAt,
      ...(input.client ? { client: input.client } : {}),
    },
  } as const;
}

export const webhookEventService = {
  buildWebhookTestEvent,
  buildAccessRequestWebhookEvent,
  buildConnectionStatusChangedEvent,
  normalizeGrantedAssetsToV2,
};

/* ============================================================
 * U6 ordered fan-out (R15, R16, KTD7)
 *
 * One logical occurrence fans out to one stored event per subscribed
 * endpoint. `correlationId` is set once and copied to every
 * per-endpoint event (cross-endpoint dedupe key); `sequenceNumber`
 * comes from the shared `webhook_endpoint_sequence` object so values
 * are unique per endpoint with documented gap tolerance.
 * ============================================================
 */

/** Secret-bearing keys stripped before a payload is ever stored (R14: minimized PII). */
const TOKEN_POINTER_KEYS = new Set([
  'uniqueToken',
  'secretId',
  'secret',
  'signingSecret',
  'accessToken',
  'refreshToken',
  'clientSecret',
  'apiKey',
]);

/** Recursively strips token pointers; every other value passes through. */
export function sanitizeWebhookPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeWebhookPayload);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (TOKEN_POINTER_KEYS.has(key)) continue;
      out[key] = sanitizeWebhookPayload(entry);
    }
    return out;
  }
  return value;
}

/** Consumer-side ordering: ascending per-endpoint sequence (gaps tolerated). */
export function sortWebhookEventsBySequence<
  T extends { sequenceNumber: bigint | number },
>(events: T[]): T[] {
  return [...events].sort((a, b) => (a.sequenceNumber < b.sequenceNumber ? -1 : a.sequenceNumber > b.sequenceNumber ? 1 : 0));
}

/** Consumer-side dedupe: collapse redeliveries on the global event ID. */
export function collapseDuplicateWebhookEvents<T extends { id: string }>(events: T[]): T[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

/**
 * Ordered v1 envelope: the base event plus the R16 ordering primitives.
 * AE3 consumers reconstruct truth from `sequenceNumber` + `id`.
 */
export function buildOrderedWebhookEnvelope(input: {
  type: WebhookEventType;
  apiVersion?: WebhookApiVersion;
  sequenceNumber: bigint | number;
  correlationId: string;
  data: unknown;
}): WebhookOrderedEnvelope {
  return {
    id: buildEventId(),
    apiVersion: input.apiVersion ?? WEBHOOK_API_VERSION_V1,
    type: input.type,
    createdAt: new Date().toISOString(),
    sequenceNumber: typeof input.sequenceNumber === 'bigint' ? Number(input.sequenceNumber) : input.sequenceNumber,
    correlationId: input.correlationId,
    data: input.data,
  };
}

/** Next value from the shared per-endpoint sequence object (unique per endpoint). */
export async function nextEndpointSequence(): Promise<bigint> {
  const rows = (await prisma.$queryRaw<
    Array<{ next: bigint }>
  >`SELECT nextval('"webhook_endpoint_sequence"') AS next`) as Array<{ next: bigint }>;
  const next = rows?.[0]?.next;
  if (typeof next === 'bigint') return next;
  if (typeof next === 'number') return BigInt(next);
  // Never mint Date.now() fallbacks: duplicate sequence numbers would
  // violate the per-endpoint unique guard and corrupt consumer ordering.
  throw new Error('WEBHOOK_SEQUENCE_UNAVAILABLE');
}

export interface EmitWebhookEventsInput {
  agencyId: string;
  type: WebhookEventType;
  /** Raw data; sanitized before storage so no token pointers persist. */
  data: unknown;
  resourceType?: string;
  resourceId?: string;
  apiVersion?: WebhookApiVersion;
  /** Set once per logical occurrence; generated when omitted. */
  correlationId?: string;
  /** Restrict fan-out to these endpoints (lifecycle groups by API version). */
  endpointIds?: string[];
}

export interface EmittedWebhookEvent {
  id: string;
  endpointId: string;
  type: string;
  sequenceNumber: string;
  correlationId: string;
}

/**
 * Shared-evaluator fan-out: one stored event per active endpoint
 * subscribed to `type`, sharing one correlation ID with distinct
 * per-endpoint sequences. Delivery queueing is best-effort per event;
 * a queue failure never fails the sibling events.
 */
export async function emitWebhookEvents(
  input: EmitWebhookEventsInput
): Promise<{ data: { events: EmittedWebhookEvent[]; correlationId: string } | null; error: { code: string; message: string } | null }> {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { agencyId: input.agencyId, status: 'active' },
      orderBy: { createdAt: 'asc' },
    });
    const subscribed = endpoints.filter((endpoint) =>
      Array.isArray(endpoint.subscribedEvents) &&
      (endpoint.subscribedEvents as string[]).includes(input.type) &&
      (input.endpointIds == null || input.endpointIds.includes(endpoint.id)),
    );

    const correlationId = input.correlationId ?? `corr_${randomUUID().replace(/-/g, '')}`;
    const sanitized = sanitizeWebhookPayload(input.data);
    const events: EmittedWebhookEvent[] = [];

    for (const endpoint of subscribed) {
      const sequenceNumber = await nextEndpointSequence();
      const envelope = buildOrderedWebhookEnvelope({
        type: input.type,
        apiVersion: (endpoint.preferredApiVersion as WebhookApiVersion | undefined) ?? input.apiVersion,
        sequenceNumber,
        correlationId,
        data: sanitized,
      });
      const record = await prisma.webhookEvent.create({
        data: {
          agencyId: input.agencyId,
          endpointId: endpoint.id,
          type: input.type,
          resourceType: input.resourceType ?? null,
          resourceId: input.resourceId ?? null,
          payload: envelope as any,
          sequenceNumber,
          correlationId,
        },
      });
      events.push({
        id: record.id,
        endpointId: endpoint.id,
        type: input.type,
        sequenceNumber: sequenceNumber.toString(),
        correlationId,
      });
      try {
        const { queueWebhookDelivery } = await import('@/lib/queue-helpers');
        await queueWebhookDelivery(record.id);
      } catch (error) {
        // Queue failure is delivery-retryable, never an emit failure — but
        // it must be visible: log with the event identity for triage.
        logger.error('queueWebhookDelivery failed', {
          eventId: record.id,
          endpointId: endpoint.id,
          correlationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { data: { events, correlationId }, error: null };
  } catch {
    return { data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to emit webhook events' } };
  }
}
