/**
 * Webhook endpoint service — plural CRUD over the contracted schema (U6, KTD7).
 *
 * The singleton era ended with the U6 contract migration (the
 * `webhook_endpoints_agency_id_key` guard is gone, replaced by the plural
 * `webhook_endpoints_agency_id_url_key` guard). The dashboard singleton
 * helpers below keep their names, shapes, and single-record semantics by
 * operating on the agency's first record (creation order); plural v1 CRUD
 * lives in the `*Plural*` / `*ById` functions beside them.
 *
 * Rotation is dual-secret with a 24h overlap (KTD7, R14): the default path
 * stores the new secret as pending and keeps the old one verifying until
 * the window lapses; `immediate: true` replaces at once and deletes the old.
 * Verification order is new-then-old
 * (verifyWebhookSignatureWithRotation in lib/webhook-signature.ts).
 */
import { randomBytes, randomUUID } from 'crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { infisical } from '@/lib/infisical';
import { auditService } from '@/services/audit.service';
import { assertKeyScope, type ApiKeyScope } from '@/services/api-key.service';
import { WEBHOOK_SECRET_ROTATION_OVERLAP_MS } from '@/lib/webhook-signature';

import {
  MAX_WEBHOOK_ENDPOINTS_PER_AGENCY,
  V1_WEBHOOK_SUBSCRIBABLE_EVENTS,
  WEBHOOK_API_VERSION_V1,
  WEBHOOK_API_VERSION_V2,
  type WebhookEventType,
} from '@agency-platform/shared';
import type { ServiceResult } from '@/lib/service-result';

const VALID_API_VERSIONS = [WEBHOOK_API_VERSION_V1, WEBHOOK_API_VERSION_V2] as const;

export const WEBHOOK_ENDPOINT_CAP_EXCEEDED_CODE = 'WEBHOOK_ENDPOINT_CAP_EXCEEDED';
export const WEBHOOK_ENDPOINT_URL_EXISTS_CODE = 'WEBHOOK_ENDPOINT_URL_EXISTS';
export const UNSAFE_ENDPOINT_URL_CODE = 'UNSAFE_ENDPOINT_URL';

const SubscribedEventsSchema = z
  .array(z.enum(V1_WEBHOOK_SUBSCRIBABLE_EVENTS as unknown as [string, ...string[]]))
  .min(1)
  .max(6);

const WebhookEndpointMutationSchema = z.object({
  url: z.string().url(),
  subscribedEvents: SubscribedEventsSchema,
  preferredApiVersion: z.enum(VALID_API_VERSIONS).optional(),
  agencyId: z.string().min(1),
});

const WebhookCreateSchema = WebhookEndpointMutationSchema.extend({
  createdBy: z.string().email(),
});

const WebhookUpdateSchema = WebhookEndpointMutationSchema.extend({
  updatedBy: z.string().email(),
});

const WebhookRotateSchema = z.object({
  agencyId: z.string().min(1),
  rotatedBy: z.string().email(),
  /** Default false: 24h dual-active overlap. True: replace at once. */
  immediate: z.boolean().optional().default(false),
});

const WebhookDisableSchema = z.object({
  agencyId: z.string().min(1),
  disabledBy: z.string().email(),
});

// ============================================================
// SSRF guards: https-only, no credentials, no private/metadata
// targets, with a delivery-time DNS re-check (U6).
// ============================================================

const BLOCKED_HOSTNAMES = new Set(['metadata.google.internal', 'metadata.goog', 'instance-data']);

/** URL hostnames keep IPv6 brackets; strip them before IP classification. */
function stripIpBrackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

function isLoopbackOrPrivateIPv4(parts: number[]): boolean {
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 0) return true;
  return false;
}

/** True for loopback, private, link-local, and metadata IPv4/IPv6 literals. */
export function isPrivateIpAddress(ip: string): boolean {
  // URL hostnames keep IPv6 brackets (and Node compresses mapped forms to
  // hex, e.g. [::ffff:7f00:1]): strip brackets before classifying.
  const host = ip.startsWith('[') && ip.endsWith(']') ? ip.slice(1, -1) : ip;
  const family = isIP(host);
  if (family === 4) {
    return isLoopbackOrPrivateIPv4(host.split('.').map(Number));
  }
  if (family === 6) {
    const lower = host.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    // IPv4-mapped / IPv4-translated forms embed an IPv4 literal:
    // normalize to the embedded IPv4 and apply the IPv4 check, so
    // ::ffff:127.0.0.1 and friends cannot bypass the private check.
    const mapped = lower.match(/^::ffff:(?:0+:)*(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) {
      return isLoopbackOrPrivateIPv4(mapped[1].split('.').map(Number));
    }
    const translated = lower.match(/^\[?::ffff:0:(\d+\.\d+\.\d+\.\d+)\]?$/);
    if (translated?.[1]) {
      return isLoopbackOrPrivateIPv4(translated[1].split('.').map(Number));
    }
    // Hex-form mapped address, e.g. ::ffff:7f00:1 == ::ffff:127.0.0.1.
    const hexMapped = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16);
      const lo = parseInt(hexMapped[2], 16);
      const parts = [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff];
      return isLoopbackOrPrivateIPv4(parts);
    }
    if (lower === '0.0.0.0') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('fe80')) return true;
    return false;
  }
  // Unparseable literals: the URL parser already handed us a string that
  // isIP rejects — treat 0.0.0.0 / unspecified text forms as denied.
  if (host === '0.0.0.0' || host === '::') return true;
  return false;
}

export function isBlockedWebhookHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host === 'localhost') return true;
  if (host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal')) return true;
  if (host === '169.254.169.254') return true;
  return false;
}

export type EndpointUrlCheck = { ok: true } | { ok: false; code: string; message: string };

/**
 * Synchronous creation/update validation: scheme, credentials, literal
 * private IPs, metadata hostnames. Hostnames that need DNS go through
 * assertEndpointHostResolvable as well.
 */
export function validateEndpointUrlSync(rawUrl: string): EndpointUrlCheck {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Endpoint URL is not a valid URL' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, code: UNSAFE_ENDPOINT_URL_CODE, message: 'Endpoint URL must use https' };
  }
  if (url.username || url.password) {
    return { ok: false, code: UNSAFE_ENDPOINT_URL_CODE, message: 'Endpoint URL must not embed credentials' };
  }
  if (isBlockedWebhookHostname(url.hostname)) {
    return { ok: false, code: UNSAFE_ENDPOINT_URL_CODE, message: 'Endpoint URL targets a blocked metadata host' };
  }
  if (isPrivateIpAddress(stripIpBrackets(url.hostname))) {
    return { ok: false, code: UNSAFE_ENDPOINT_URL_CODE, message: 'Endpoint URL targets a private address' };
  }
  return { ok: true };
}

export type EndpointHostCheck = { allowed: true } | { allowed: false; reason: string };

/**
 * Delivery-time DNS re-check (U6): the hostname must not resolve to a
 * private address. Resolver errors fail CLOSED: an unresolvable host is
 * denied here rather than passed to fetch.
 */
export async function assertEndpointHostResolvable(rawUrl: string): Promise<EndpointHostCheck> {
  let hostname: string;
  try {
    hostname = new URL(rawUrl).hostname;
  } catch {
    return { allowed: false, reason: 'Invalid endpoint URL' };
  }
  if (isIP(stripIpBrackets(hostname)) !== 0 || isBlockedWebhookHostname(hostname)) {
    return isBlockedWebhookHostname(hostname) || isPrivateIpAddress(hostname)
      ? { allowed: false, reason: 'Endpoint URL targets a blocked host' }
      : { allowed: true };
  }
  let resolved: Array<{ address: string }>;
  try {
    resolved = (await lookup(hostname, { all: true })) as Array<{ address: string }>;
  } catch {
    return { allowed: false, reason: 'Endpoint hostname could not be resolved' };
  }
  if (!Array.isArray(resolved)) {
    return { allowed: false, reason: 'Endpoint hostname could not be resolved' };
  }
  if (resolved.some((entry) => isPrivateIpAddress(entry.address))) {
    return { allowed: false, reason: 'Endpoint hostname resolves to a private address' };
  }
  return { allowed: true };
}

async function rejectUnsafeUrl(url: string): Promise<{ ok: false; code: string; message: string } | null> {
  const sync = validateEndpointUrlSync(url);
  if (!sync.ok) return sync;
  const host = await assertEndpointHostResolvable(url);
  if (!host.allowed) {
    return { ok: false, code: UNSAFE_ENDPOINT_URL_CODE, message: host.reason };
  }
  return null;
}

function buildSigningSecret(): string {
  return randomBytes(32).toString('hex');
}

function toEndpointSummary(endpoint: any) {
  return {
    id: endpoint.id,
    agencyId: endpoint.agencyId,
    url: endpoint.url,
    status: endpoint.status,
    subscribedEvents: Array.isArray(endpoint.subscribedEvents) ? endpoint.subscribedEvents : [],
    preferredApiVersion: endpoint.preferredApiVersion ?? '2026-03-08',
    failureCount: endpoint.failureCount ?? 0,
    secretLastFour: typeof endpoint.secretId === 'string' ? endpoint.secretId.slice(-4) : null,
    rotationPending: endpoint.pendingSecretId != null,
    pendingSecretExpiresAt:
      endpoint.pendingSecretExpiresAt instanceof Date
        ? endpoint.pendingSecretExpiresAt.toISOString()
        : (endpoint.pendingSecretExpiresAt ?? null),
    lastDeliveredAt: endpoint.lastDeliveredAt ? endpoint.lastDeliveredAt.toISOString() : null,
    lastFailedAt: endpoint.lastFailedAt ? endpoint.lastFailedAt.toISOString() : null,
    createdAt: endpoint.createdAt.toISOString(),
    updatedAt: endpoint.updatedAt.toISOString(),
  };
}

function firstByCreation(agencyId: string) {
  return prisma.webhookEndpoint.findFirst({
    where: { agencyId },
    orderBy: { createdAt: 'asc' },
  });
}

function recheckScope(actorScopes: ApiKeyScope[] | undefined, required: string) {
  if (actorScopes === undefined) return null;
  return assertKeyScope({ scopes: actorScopes }, required);
}

// ============================================================
// Dashboard singleton helpers (first-record semantics, unchanged
// names/shapes for the dashboard routes).
// ============================================================

export async function getWebhookEndpoint(agencyId: string): Promise<ServiceResult<{ endpoint: ReturnType<typeof toEndpointSummary> }>> {
  try {
    const endpoint = await firstByCreation(agencyId);

    if (!endpoint) {
      return {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Webhook endpoint not found',
        },
      };
    }

    return {
      data: {
        endpoint: toEndpointSummary(endpoint),
      },
      error: null,
    };
  } catch {
    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch webhook endpoint',
      },
    };
  }
}

export async function createWebhookEndpoint(
  input: z.infer<typeof WebhookCreateSchema>
): Promise<ServiceResult<{ endpoint: ReturnType<typeof toEndpointSummary>; signingSecret: string }>> {
  try {
    const validated = WebhookCreateSchema.parse(input);

    const existing = await firstByCreation(validated.agencyId);

    if (existing) {
      return {
        data: null,
        error: {
          code: 'WEBHOOK_ENDPOINT_EXISTS',
          message: 'A webhook endpoint already exists for this agency',
        },
      };
    }

    const unsafe = await rejectUnsafeUrl(validated.url);
    if (unsafe) {
      return { data: null, error: { code: unsafe.code, message: unsafe.message } };
    }

    const endpointId = randomUUID();
    const secretId = infisical.generateSecretName('webhook', endpointId);
    const signingSecret = buildSigningSecret();

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        id: endpointId,
        agencyId: validated.agencyId,
        url: validated.url,
        status: 'active',
        subscribedEvents: validated.subscribedEvents,
        preferredApiVersion: validated.preferredApiVersion ?? '2026-03-08',
        secretId,
        createdBy: validated.createdBy,
      },
    });

    await infisical.storePlainSecret(secretId, signingSecret);

    await auditService.createAuditLog({
      agencyId: validated.agencyId,
      userEmail: validated.createdBy,
      action: 'WEBHOOK_ENDPOINT_CREATED',
      resourceType: 'webhook_endpoint',
      resourceId: endpoint.id,
      metadata: {
        subscribedEvents: validated.subscribedEvents,
        preferredApiVersion: validated.preferredApiVersion ?? '2026-03-08',
      },
    });

    return {
      data: {
        endpoint: toEndpointSummary(endpoint),
        signingSecret,
      },
      error: null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid webhook endpoint input',
          details: error.errors,
        },
      };
    }

    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create webhook endpoint',
      },
    };
  }
}

export async function updateWebhookEndpoint(
  input: z.infer<typeof WebhookUpdateSchema>
): Promise<ServiceResult<{ endpoint: ReturnType<typeof toEndpointSummary> }>> {
  try {
    const validated = WebhookUpdateSchema.parse(input);
    const existing = await firstByCreation(validated.agencyId);

    if (!existing) {
      return {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Webhook endpoint not found',
        },
      };
    }

    const unsafe = await rejectUnsafeUrl(validated.url);
    if (unsafe) {
      return { data: null, error: { code: unsafe.code, message: unsafe.message } };
    }

    const endpoint = await prisma.webhookEndpoint.update({
      where: { id: existing.id },
      data: {
        url: validated.url,
        status: 'active',
        subscribedEvents: validated.subscribedEvents,
        ...(validated.preferredApiVersion ? { preferredApiVersion: validated.preferredApiVersion } : {}),
        disabledAt: null,
      },
    });

    await auditService.createAuditLog({
      agencyId: validated.agencyId,
      userEmail: validated.updatedBy,
      action: 'WEBHOOK_ENDPOINT_UPDATED',
      resourceType: 'webhook_endpoint',
      resourceId: endpoint.id,
      metadata: {
        subscribedEvents: validated.subscribedEvents,
        ...(validated.preferredApiVersion ? { preferredApiVersion: validated.preferredApiVersion } : {}),
      },
    });

    return {
      data: { endpoint: toEndpointSummary(endpoint) },
      error: null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid webhook endpoint input',
          details: error.errors,
        },
      };
    }

    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update webhook endpoint',
      },
    };
  }
}

export async function rotateWebhookEndpointSecret(
  input: z.infer<typeof WebhookRotateSchema>
): Promise<ServiceResult<{ endpoint: ReturnType<typeof toEndpointSummary>; signingSecret: string }>> {
  try {
    const validated = WebhookRotateSchema.parse(input);
    const existing = await firstByCreation(validated.agencyId);

    if (!existing) {
      return {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Webhook endpoint not found',
        },
      };
    }

    return rotateById(existing.id, validated.agencyId, validated.rotatedBy, validated.immediate ?? false);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid webhook rotation input',
          details: error.errors,
        },
      };
    }

    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to rotate webhook endpoint secret',
      },
    };
  }
}

async function rotateById(
  endpointId: string,
  agencyId: string,
  rotatedBy: string,
  immediate: boolean
): Promise<ServiceResult<{ endpoint: ReturnType<typeof toEndpointSummary>; signingSecret: string }>> {
  const existing = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, agencyId },
  });
  if (!existing) {
    return { data: null, error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found' } };
  }

  const signingSecret = buildSigningSecret();

  if (immediate) {
    const rotatedSecretId = infisical.generateSecretName('webhook', `${existing.id}_rotated`);
    await infisical.storePlainSecret(rotatedSecretId, signingSecret);
    const endpoint = await prisma.webhookEndpoint.update({
      where: { id: existing.id },
      data: { secretId: rotatedSecretId, pendingSecretId: null, pendingSecretExpiresAt: null },
    });
    await infisical.deleteSecret(existing.secretId).catch(() => undefined);
    if (existing.pendingSecretId) {
      await infisical.deleteSecret(existing.pendingSecretId).catch(() => undefined);
    }
    await auditService.createAuditLog({
      agencyId,
      userEmail: rotatedBy,
      action: 'WEBHOOK_ENDPOINT_SECRET_ROTATED',
      resourceType: 'webhook_endpoint',
      resourceId: endpoint.id,
      metadata: { mode: 'immediate' },
    });
    return { data: { endpoint: toEndpointSummary(endpoint), signingSecret }, error: null };
  }

  // Overlap (default): the new secret verifies as pending for 24h while
  // the current secret keeps verifying; verification order is new-then-old.
  const pendingSecretId = infisical.generateSecretName('webhook', `${existing.id}_pending`);
  await infisical.storePlainSecret(pendingSecretId, signingSecret);
  if (existing.pendingSecretId && existing.pendingSecretId !== pendingSecretId) {
    await infisical.deleteSecret(existing.pendingSecretId).catch(() => undefined);
  }
  const endpoint = await prisma.webhookEndpoint.update({
    where: { id: existing.id },
    data: {
      pendingSecretId,
      pendingSecretExpiresAt: new Date(Date.now() + WEBHOOK_SECRET_ROTATION_OVERLAP_MS),
    },
  });
  await auditService.createAuditLog({
    agencyId,
    userEmail: rotatedBy,
    action: 'WEBHOOK_ENDPOINT_SECRET_ROTATED',
    resourceType: 'webhook_endpoint',
    resourceId: endpoint.id,
    metadata: { mode: 'overlap' },
  });
  return { data: { endpoint: toEndpointSummary(endpoint), signingSecret }, error: null };
}

export async function disableWebhookEndpoint(
  input: z.infer<typeof WebhookDisableSchema>
): Promise<ServiceResult<{ endpoint: ReturnType<typeof toEndpointSummary> }>> {
  try {
    const validated = WebhookDisableSchema.parse(input);
    const existing = await firstByCreation(validated.agencyId);

    if (!existing) {
      return {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Webhook endpoint not found',
        },
      };
    }

    const endpoint = await prisma.webhookEndpoint.update({
      where: { id: existing.id },
      data: {
        status: 'disabled',
        disabledAt: new Date(),
      },
    });

    await auditService.createAuditLog({
      agencyId: validated.agencyId,
      userEmail: validated.disabledBy,
      action: 'WEBHOOK_ENDPOINT_DISABLED',
      resourceType: 'webhook_endpoint',
      resourceId: endpoint.id,
    });

    return {
      data: { endpoint: toEndpointSummary(endpoint) },
      error: null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid webhook disable input',
          details: error.errors,
        },
      };
    }

    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to disable webhook endpoint',
      },
    };
  }
}

// ============================================================
// Plural v1 CRUD (R13): up to MAX_WEBHOOK_ENDPOINTS_PER_AGENCY
// endpoints per agency, each with per-event subscriptions against
// the reconciled taxonomy. Scope re-checks at service entry (KTD2).
// ============================================================

export interface PluralActor {
  /** Key scopes; re-checked here. Omit only for dashboard-internal calls. */
  scopes?: ApiKeyScope[];
}

export async function listWebhookEndpoints(
  agencyId: string,
  actor?: PluralActor
): Promise<ServiceResult<{ endpoints: ReturnType<typeof toEndpointSummary>[] }>> {
  const scopeError = recheckScope(actor?.scopes, 'webhooks:read');
  if (scopeError) return { data: null, error: scopeError };
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { agencyId },
      orderBy: { createdAt: 'asc' },
    });
    return { data: { endpoints: endpoints.map(toEndpointSummary) }, error: null };
  } catch {
    return { data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to list webhook endpoints' } };
  }
}

export async function getWebhookEndpointById(
  agencyId: string,
  endpointId: string,
  actor?: PluralActor
): Promise<ServiceResult<{ endpoint: ReturnType<typeof toEndpointSummary> }>> {
  const scopeError = recheckScope(actor?.scopes, 'webhooks:read');
  if (scopeError) return { data: null, error: scopeError };
  try {
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, agencyId },
    });
    if (!endpoint) {
      return { data: null, error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found' } };
    }
    return { data: { endpoint: toEndpointSummary(endpoint) }, error: null };
  } catch {
    return { data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch webhook endpoint' } };
  }
}

export async function createPluralWebhookEndpoint(
  input: z.infer<typeof WebhookCreateSchema>,
  actor?: PluralActor,
  atomic?: { keyId: string; claimRecordId: string; requestId: string },
): Promise<ServiceResult<{ endpoint: ReturnType<typeof toEndpointSummary>; signingSecret: string; body?: unknown }>> {
  const scopeError = recheckScope(actor?.scopes, 'webhooks:write');
  if (scopeError) return { data: null, error: scopeError };
  try {
    const validated = WebhookCreateSchema.parse(input);

    const unsafe = await rejectUnsafeUrl(validated.url);
    if (unsafe) {
      return { data: null, error: { code: unsafe.code, message: unsafe.message } };
    }

    const [count, duplicate] = await Promise.all([
      prisma.webhookEndpoint.count({ where: { agencyId: validated.agencyId } }),
      prisma.webhookEndpoint.findFirst({
        where: { agencyId: validated.agencyId, url: validated.url },
        select: { id: true },
      }),
    ]);

    if (count >= MAX_WEBHOOK_ENDPOINTS_PER_AGENCY) {
      return {
        data: null,
        error: {
          code: WEBHOOK_ENDPOINT_CAP_EXCEEDED_CODE,
          message: `At most ${MAX_WEBHOOK_ENDPOINTS_PER_AGENCY} webhook endpoints per agency`,
        },
      };
    }
    if (duplicate) {
      return {
        data: null,
        error: { code: WEBHOOK_ENDPOINT_URL_EXISTS_CODE, message: 'A webhook endpoint with this URL already exists' },
      };
    }

    const endpointId = randomUUID();
    const secretId = infisical.generateSecretName('webhook', endpointId);
    const signingSecret = buildSigningSecret();

    await infisical.storePlainSecret(secretId, signingSecret);

    if (atomic) {
      // Atomic path (v1 route): the endpoint insert, the key-liveness
      // re-check (revoke-vs-commit race), and the claim completion commit
      // in one transaction — a crash between steps can never orphan an
      // endpoint behind an uncompletable claim.
      try {
        const body = await prisma.$transaction(async (tx: any) => {
          const keyRow = await tx.apiKey.findUnique({
            where: { id: atomic.keyId },
            select: { revokedAt: true, expiresAt: true },
          });
          if (
            keyRow == null ||
            keyRow.revokedAt != null ||
            (keyRow.expiresAt != null && new Date(keyRow.expiresAt) <= new Date())
          ) {
            throw new Error('V1_KEY_DEAD');
          }
          const created = await tx.webhookEndpoint.create({
            data: {
              id: endpointId,
              agencyId: validated.agencyId,
              url: validated.url,
              status: 'active',
              subscribedEvents: validated.subscribedEvents,
              preferredApiVersion: validated.preferredApiVersion ?? '2026-03-08',
              secretId,
              createdBy: validated.createdBy,
            },
          });
          const completedBody = {
            data: { endpoint: toEndpointSummary(created), signingSecret },
            error: null,
            meta: { requestId: atomic.requestId },
          };
          const stored = await tx.idempotencyRecord.updateMany({
            where: { id: atomic.claimRecordId, state: 'in_progress' },
            data: { state: 'completed', statusCode: 201, result: completedBody as any },
          });
          if (stored.count !== 1) throw new Error('IDEMPOTENCY_STATE');
          return completedBody;
        });

        await auditService.createAuditLog({
          agencyId: validated.agencyId,
          userEmail: validated.createdBy,
          action: 'WEBHOOK_ENDPOINT_CREATED',
          resourceType: 'webhook_endpoint',
          resourceId: endpointId,
          metadata: {
            subscribedEvents: validated.subscribedEvents,
            preferredApiVersion: validated.preferredApiVersion ?? '2026-03-08',
          },
        });

        return {
          data: { endpoint: (body.data as any).endpoint, signingSecret, body },
          error: null,
        };
      } catch (error) {
        if (error instanceof Error && error.message === 'V1_KEY_DEAD') {
          return { data: null, error: { code: 'INVALID_API_KEY', message: 'Invalid or missing API key' } };
        }
        throw error;
      }
    }

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        id: endpointId,
        agencyId: validated.agencyId,
        url: validated.url,
        status: 'active',
        subscribedEvents: validated.subscribedEvents,
        preferredApiVersion: validated.preferredApiVersion ?? '2026-03-08',
        secretId,
        createdBy: validated.createdBy,
      },
    });

    await auditService.createAuditLog({
      agencyId: validated.agencyId,
      userEmail: validated.createdBy,
      action: 'WEBHOOK_ENDPOINT_CREATED',
      resourceType: 'webhook_endpoint',
      resourceId: endpoint.id,
      metadata: {
        subscribedEvents: validated.subscribedEvents,
        preferredApiVersion: validated.preferredApiVersion ?? '2026-03-08',
      },
    });

    return { data: { endpoint: toEndpointSummary(endpoint), signingSecret }, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid webhook endpoint input', details: error.errors },
      };
    }
    return { data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to create webhook endpoint' } };
  }
}

export async function updatePluralWebhookEndpoint(
  endpointId: string,
  input: z.infer<typeof WebhookUpdateSchema> & { reactivate?: boolean },
  actor?: PluralActor
): Promise<ServiceResult<{ endpoint: ReturnType<typeof toEndpointSummary> }>> {
  const scopeError = recheckScope(actor?.scopes, 'webhooks:write');
  if (scopeError) return { data: null, error: scopeError };
  try {
    const validated = WebhookUpdateSchema.parse(input);
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, agencyId: validated.agencyId },
    });
    if (!existing) {
      return { data: null, error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found' } };
    }

    const unsafe = await rejectUnsafeUrl(validated.url);
    if (unsafe) {
      return { data: null, error: { code: unsafe.code, message: unsafe.message } };
    }

    if (validated.url !== existing.url) {
      const duplicate = await prisma.webhookEndpoint.findFirst({
        where: { agencyId: validated.agencyId, url: validated.url },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== existing.id) {
        return {
          data: null,
          error: { code: WEBHOOK_ENDPOINT_URL_EXISTS_CODE, message: 'A webhook endpoint with this URL already exists' },
        };
      }
    }

    // Disabled status is sticky: only an explicit reactivate flag clears
    // disablement; a plain field update preserves it.
    const shouldReactivate = input.reactivate === true;
    const endpoint = await prisma.webhookEndpoint.update({
      where: { id: existing.id },
      data: {
        url: validated.url,
        subscribedEvents: validated.subscribedEvents,
        ...(validated.preferredApiVersion ? { preferredApiVersion: validated.preferredApiVersion } : {}),
        ...(shouldReactivate ? { status: 'active', disabledAt: null } : {}),
      },
    });

    await auditService.createAuditLog({
      agencyId: validated.agencyId,
      userEmail: validated.updatedBy,
      action: 'WEBHOOK_ENDPOINT_UPDATED',
      resourceType: 'webhook_endpoint',
      resourceId: endpoint.id,
      metadata: { subscribedEvents: validated.subscribedEvents },
    });

    return { data: { endpoint: toEndpointSummary(endpoint) }, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid webhook endpoint input', details: error.errors },
      };
    }
    return { data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to update webhook endpoint' } };
  }
}

export async function deleteWebhookEndpointById(
  agencyId: string,
  endpointId: string,
  deletedBy: string,
  actor?: PluralActor
): Promise<ServiceResult<{ deleted: true; endpointId: string }>> {
  const scopeError = recheckScope(actor?.scopes, 'webhooks:write');
  if (scopeError) return { data: null, error: scopeError };
  try {
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, agencyId },
    });
    if (!existing) {
      return { data: null, error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found' } };
    }
    await prisma.webhookEndpoint.delete({ where: { id: existing.id } });
    await infisical.deleteSecret(existing.secretId).catch(() => undefined);
    if (existing.pendingSecretId) {
      await infisical.deleteSecret(existing.pendingSecretId).catch(() => undefined);
    }
    await auditService.createAuditLog({
      agencyId,
      userEmail: deletedBy,
      action: 'WEBHOOK_ENDPOINT_DELETED',
      resourceType: 'webhook_endpoint',
      resourceId: existing.id,
    });
    return { data: { deleted: true as const, endpointId: existing.id }, error: null };
  } catch {
    return { data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete webhook endpoint' } };
  }
}

export async function rotateWebhookEndpointSecretById(
  agencyId: string,
  endpointId: string,
  rotatedBy: string,
  immediate = false,
  actor?: PluralActor
): Promise<ServiceResult<{ endpoint: ReturnType<typeof toEndpointSummary>; signingSecret: string }>> {
  const scopeError = recheckScope(actor?.scopes, 'webhooks:write');
  if (scopeError) return { data: null, error: scopeError };
  try {
    return await rotateById(endpointId, agencyId, rotatedBy, immediate);
  } catch {
    return { data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to rotate webhook endpoint secret' } };
  }
}

export type { WebhookEventType };

export const webhookEndpointService = {
  getWebhookEndpoint,
  createWebhookEndpoint,
  updateWebhookEndpoint,
  rotateWebhookEndpointSecret,
  disableWebhookEndpoint,
  listWebhookEndpoints,
  getWebhookEndpointById,
  createPluralWebhookEndpoint,
  updatePluralWebhookEndpoint,
  deleteWebhookEndpointById,
  rotateWebhookEndpointSecretById,
};
