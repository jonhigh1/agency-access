import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { env } from '@/lib/env.js';
import { infisical } from '@/lib/infisical.js';
import { prisma } from '@/lib/prisma.js';
import { signWebhookPayload } from '@/lib/webhook-signature.js';
import { assertEndpointHostResolvable } from '@/services/webhook-endpoint.service.js';
import { WEBHOOK_DELIVERY_RETENTION_DAYS } from '@agency-platform/shared';
import type { ServiceError, ServiceResult } from '@/lib/service-result.js';

export { WEBHOOK_DELIVERY_RETENTION_DAYS };

const MAX_DELIVERY_REDIRECT_HOPS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const DeliveryInputSchema = z.object({
  eventId: z.string().min(1),
  attemptNumber: z.number().int().min(1),
});

const MAX_RESPONSE_SNIPPET_LENGTH = 1000;
const WEBHOOK_RETRY_BASE_DELAY_MS = 30_000;
const WEBHOOK_RETRY_MAX_DELAY_MS = 15 * 60 * 1000;

function toSnippet(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.slice(0, MAX_RESPONSE_SNIPPET_LENGTH);
}

/**
 * Exponential backoff with equal jitter (R14): half the capped delay is
 * deterministic, half is uniform random. The cap always holds, so the
 * worst case never exceeds WEBHOOK_RETRY_MAX_DELAY_MS.
 */
export function getRetryDelayMs(attemptNumber: number): number {
  const capped = Math.min(
    WEBHOOK_RETRY_MAX_DELAY_MS,
    WEBHOOK_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attemptNumber - 1)
  );
  const half = capped / 2;
  return Math.floor(half + Math.random() * half);
}

function isRetryableStatusCode(statusCode: number): boolean {
  return statusCode === 429 || statusCode >= 500;
}

function isRetryableError(error: unknown): boolean {
  const message = String(error ?? '').toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('etimedout') ||
    message.includes('network') ||
    message.includes('fetch failed') ||
    message.includes('aborted')
  );
}

export async function deliverWebhookEvent(
  input: z.infer<typeof DeliveryInputSchema>
): Promise<ServiceResult<{
  deliveryId: string;
  retryable: boolean;
  responseStatus: number | null;
}>> {
  try {
    const validated = DeliveryInputSchema.parse(input);

    const event = await prisma.webhookEvent.findUnique({
      where: { id: validated.eventId },
      include: {
        endpoint: true,
      },
    });

    if (!event) {
      return {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Webhook event not found',
        },
      };
    }

    if (event.endpoint.status !== 'active') {
      return {
        data: null,
        error: {
          code: 'ENDPOINT_DISABLED',
          message: 'Webhook endpoint is not active',
        },
      };
    }

    // Delivery-time SSRF re-check (U6): the stored URL is re-resolved on
    // every attempt, so a hostname that went private after creation fails
    // here instead of connecting.
    const target = await assertEndpointHostResolvable(event.endpoint.url);
    if (!target.allowed) {
      const failedAt = new Date();
      const failureCount = (event.endpoint.failureCount ?? 0) + 1;
      // Outcome + counter commit together: no orphan delivery rows and no
      // lost failure counts on a crash between the two writes.
      await prisma.$transaction([
        prisma.webhookDelivery.create({
          data: {
            id: randomUUID(),
            endpointId: event.endpoint.id,
            eventId: event.id,
            attemptNumber: validated.attemptNumber,
            status: 'failed',
            errorCode: 'UNSAFE_ENDPOINT_TARGET',
            errorMessage: target.reason,
            nextAttemptAt: null,
          },
        }),
        prisma.webhookEndpoint.update({
          where: { id: event.endpoint.id },
          data: { failureCount, lastFailedAt: failedAt },
        }),
      ]);
      return {
        data: null,
        error: { code: 'DELIVERY_FAILED', message: target.reason },
      };
    }

    const payload = JSON.stringify(event.payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Rotation overlap (KTD7, R14): on overlap expiry lazily promote the
    // pending secret to active and delete the superseded secret material.
    // During a live overlap deliveries carry BOTH signatures (old + pending)
    // so receivers on either side of the rotation verify; verification
    // order is new-then-old (verifyWebhookSignatureWithRotation).
    let endpoint = event.endpoint;
    const pendingId: string | null =
      typeof endpoint.pendingSecretId === 'string' ? endpoint.pendingSecretId : null;
    const pendingExpiresAt: Date | null =
      endpoint.pendingSecretExpiresAt instanceof Date
        ? endpoint.pendingSecretExpiresAt
        : endpoint.pendingSecretExpiresAt != null
          ? new Date(endpoint.pendingSecretExpiresAt)
          : null;
    const pendingExpired =
      pendingId != null &&
      pendingExpiresAt != null &&
      !Number.isNaN(pendingExpiresAt.getTime()) &&
      pendingExpiresAt.getTime() <= Date.now();
    if (pendingExpired && pendingId != null) {
      const supersededSecretId: string = endpoint.secretId;
      const promoted = await prisma.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: { secretId: pendingId, pendingSecretId: null, pendingSecretExpiresAt: null },
      });
      endpoint = { ...endpoint, ...promoted };
      await infisical.deleteSecret(supersededSecretId).catch(() => undefined);
    }
    const overlapLive =
      typeof endpoint.pendingSecretId === 'string' &&
      endpoint.pendingSecretId.length > 0 &&
      (endpoint.pendingSecretExpiresAt == null ||
        new Date(endpoint.pendingSecretExpiresAt).getTime() > Date.now());

    const signingSecret = await infisical.getPlainSecret(endpoint.secretId);
    let pendingSecret: string | null = null;
    if (overlapLive && typeof endpoint.pendingSecretId === 'string') {
      try {
        pendingSecret = await infisical.getPlainSecret(endpoint.pendingSecretId);
      } catch {
        pendingSecret = null;
      }
    }

    const deliveryId = randomUUID();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-AgencyAccess-Event': event.type,
      'X-AgencyAccess-Delivery-Id': deliveryId,
      'X-AgencyAccess-Timestamp': timestamp,
      'X-AgencyAccess-Signature': signWebhookPayload(payload, signingSecret, timestamp),
      ...(pendingSecret != null
        ? {
            'X-AgencyAccess-Pending-Signature': signWebhookPayload(payload, pendingSecret, timestamp),
          }
        : {}),
    };

    const pendingDelivery = await prisma.webhookDelivery.create({
      data: {
        id: deliveryId,
        endpointId: event.endpoint.id,
        eventId: event.id,
        attemptNumber: validated.attemptNumber,
        status: 'pending',
        requestHeaders: headers,
      },
    });

    try {
      // Same-host redirects only (U6): each hop is re-resolved and
      // re-checked; cross-host chains and https→http downgrades fail
      // without retry. Redirect-following is manual so the policy holds.
      let targetUrl = event.endpoint.url;
      let response: globalThis.Response | null = null;
      for (let hop = 0; hop <= MAX_DELIVERY_REDIRECT_HOPS; hop++) {
        const hopCheck = hop === 0 ? null : await assertEndpointHostResolvable(targetUrl);
        if (hopCheck && !hopCheck.allowed) {
          throw Object.assign(new Error(hopCheck.reason), { code: 'UNSAFE_ENDPOINT_TARGET' });
        }
        const attempt: any = await fetch(targetUrl, {
          method: 'POST',
          headers,
          body: payload,
          redirect: 'manual',
          signal: AbortSignal.timeout(env.WEBHOOK_DELIVERY_TIMEOUT_MS),
        });
        if (!REDIRECT_STATUSES.has(attempt.status)) {
          response = attempt as globalThis.Response;
          break;
        }
        const location = attempt.headers?.get?.('location') ?? null;
        if (!location) {
          response = attempt as globalThis.Response;
          break;
        }
        let next: URL;
        try {
          next = new URL(location, targetUrl);
        } catch {
          throw Object.assign(new Error('Invalid redirect location'), { code: 'REDIRECT_REJECTED' });
        }
        const currentHost = new URL(targetUrl).hostname.toLowerCase();
        if (next.hostname.toLowerCase() !== currentHost) {
          throw Object.assign(new Error('Cross-host redirects are rejected'), { code: 'CROSS_HOST_REDIRECT' });
        }
        if (next.protocol !== 'https:') {
          throw Object.assign(new Error('Redirect downgrades to http are rejected'), { code: 'REDIRECT_REJECTED' });
        }
        targetUrl = next.toString();
        if (hop === MAX_DELIVERY_REDIRECT_HOPS) {
          throw Object.assign(new Error('Too many redirects'), { code: 'REDIRECT_REJECTED' });
        }
      }
      const finalResponse = response as unknown as {
        ok: boolean;
        status: number;
        text: () => Promise<string>;
      };
      const responseText = toSnippet(await finalResponse.text());
      const deliveredAt = new Date();

      if (finalResponse.ok) {
        await prisma.$transaction([
          prisma.webhookDelivery.update({
            where: { id: pendingDelivery.id },
            data: {
              status: 'delivered',
              responseStatus: finalResponse.status,
              responseBodySnippet: responseText,
              deliveredAt,
              nextAttemptAt: null,
            },
          }),
          prisma.webhookEndpoint.update({
            where: { id: event.endpoint.id },
            data: {
              failureCount: 0,
              status: 'active',
              disabledAt: null,
              lastDeliveredAt: deliveredAt,
            },
          }),
        ]);

        return {
          data: {
            deliveryId: pendingDelivery.id,
            retryable: false,
            responseStatus: finalResponse.status,
          },
          error: null,
        };
      }

      const retryable =
        validated.attemptNumber < env.WEBHOOK_MAX_ATTEMPTS &&
        isRetryableStatusCode(finalResponse.status);
      const failedAt = new Date();
      const failureCount = (event.endpoint.failureCount ?? 0) + 1;
      const disabled = failureCount >= env.WEBHOOK_FAILURE_DISABLE_THRESHOLD;

      await prisma.$transaction([
        prisma.webhookDelivery.update({
          where: { id: pendingDelivery.id },
          data: {
            status: 'failed',
            responseStatus: finalResponse.status,
            responseBodySnippet: responseText,
            errorCode: `HTTP_${finalResponse.status}`,
            errorMessage: `Webhook endpoint returned ${finalResponse.status}`,
            nextAttemptAt: retryable
              ? new Date(failedAt.getTime() + getRetryDelayMs(validated.attemptNumber))
              : null,
          },
        }),
        prisma.webhookEndpoint.update({
          where: { id: event.endpoint.id },
          data: {
            failureCount,
            lastFailedAt: failedAt,
            status: disabled ? 'disabled' : 'active',
            disabledAt: disabled ? failedAt : null,
          },
        }),
      ]);

      return {
        data: {
          deliveryId: pendingDelivery.id,
          retryable,
          responseStatus: finalResponse.status,
        },
        error: {
          code: 'DELIVERY_FAILED',
          message: `Webhook endpoint returned ${finalResponse.status}`,
        },
      };
    } catch (error) {
      const policyCode =
        error instanceof Error
          ? (error as Error & { code?: unknown }).code
          : undefined;
      const knownPolicyCode =
        policyCode === 'UNSAFE_ENDPOINT_TARGET' ||
        policyCode === 'CROSS_HOST_REDIRECT' ||
        policyCode === 'REDIRECT_REJECTED'
          ? (policyCode as string)
          : null;
      const retryable =
        knownPolicyCode == null &&
        validated.attemptNumber < env.WEBHOOK_MAX_ATTEMPTS &&
        isRetryableError(error);
      const failedAt = new Date();
      const failureCount = (event.endpoint.failureCount ?? 0) + 1;
      const disabled = failureCount >= env.WEBHOOK_FAILURE_DISABLE_THRESHOLD;
      const message = error instanceof Error ? error.message : 'Webhook delivery failed';

      await prisma.$transaction([
        prisma.webhookDelivery.update({
          where: { id: pendingDelivery.id },
          data: {
            status: 'failed',
            errorCode: knownPolicyCode ?? (isRetryableError(error) ? 'NETWORK_ERROR' : 'DELIVERY_ERROR'),
            errorMessage: message,
            nextAttemptAt: retryable
              ? new Date(failedAt.getTime() + getRetryDelayMs(validated.attemptNumber))
              : null,
          },
        }),
        prisma.webhookEndpoint.update({
          where: { id: event.endpoint.id },
          data: {
            failureCount,
            lastFailedAt: failedAt,
            status: disabled ? 'disabled' : 'active',
            disabledAt: disabled ? failedAt : null,
          },
        }),
      ]);

      return {
        data: {
          deliveryId: pendingDelivery.id,
          retryable,
          responseStatus: null,
        },
        error: {
          code: 'DELIVERY_FAILED',
          message,
        },
      };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid webhook delivery input',
          details: error.errors,
        },
      };
    }

    return {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to deliver webhook event',
      },
    };
  }
}

export const webhookDeliveryService = {
  deliverWebhookEvent,
  listWebhookDeliveriesKeyset,
  purgeExpiredWebhookDeliveries,
};

/* ============================================================
 * Deliveries log (R14): cursor pagination over (createdAt, id),
 * per-endpoint scoping, minimized PII. Summaries never carry
 * request headers or full bodies — only status, attempt, snippet,
 * and the ordering primitives needed to debug from the log alone.
 * ============================================================
 */

export interface DeliveryCursor {
  createdAt: string;
  id: string;
}

export class DeliveryCursorError extends Error {}

export function encodeDeliveryCursor(cursor: DeliveryCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeDeliveryCursor(raw: string | undefined): DeliveryCursor | null {
  if (raw == null || raw === '') return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown;
    if (
      parsed == null ||
      typeof parsed !== 'object' ||
      typeof (parsed as DeliveryCursor).createdAt !== 'string' ||
      typeof (parsed as DeliveryCursor).id !== 'string'
    ) {
      throw new DeliveryCursorError('Invalid deliveries cursor');
    }
    return parsed as DeliveryCursor;
  } catch (error) {
    if (error instanceof DeliveryCursorError) throw error;
    throw new DeliveryCursorError('Invalid deliveries cursor');
  }
}

function toDeliverySummary(delivery: any) {
  return {
    id: delivery.id,
    eventId: delivery.eventId,
    eventType: delivery.event?.type ?? null,
    sequenceNumber:
      delivery.event?.sequenceNumber != null ? String(delivery.event.sequenceNumber) : null,
    correlationId: delivery.event?.correlationId ?? null,
    status: delivery.status,
    attemptNumber: delivery.attemptNumber,
    responseStatus: delivery.responseStatus ?? null,
    responseBodySnippet: delivery.responseBodySnippet ?? null,
    errorCode: delivery.errorCode ?? null,
    errorMessage: delivery.errorMessage ?? null,
    nextAttemptAt: delivery.nextAttemptAt ? new Date(delivery.nextAttemptAt).toISOString() : null,
    deliveredAt: delivery.deliveredAt ? new Date(delivery.deliveredAt).toISOString() : null,
    createdAt: new Date(delivery.createdAt).toISOString(),
  };
}

export async function listWebhookDeliveriesKeyset(input: {
  agencyId: string;
  endpointId: string;
  limit: number;
  cursor?: DeliveryCursor | null;
}): Promise<{
  data: { deliveries: ReturnType<typeof toDeliverySummary>[]; nextCursor: string | null; hasMore: boolean } | null;
  error: { code: string; message: string } | null;
}> {
  try {
    const where: Record<string, unknown> = { endpointId: input.endpointId };
    if (input.cursor) {
      where.OR = [
        { createdAt: { lt: new Date(input.cursor.createdAt) } },
        { createdAt: new Date(input.cursor.createdAt), id: { lt: input.cursor.id } },
      ];
    }
    // Per-endpoint scoping is agency-checked by the caller: the endpoint
    // must belong to the key's agency before this runs.
    const rows = (await prisma.webhookDelivery.findMany({
      where: where as any,
      include: { event: { select: { type: true, sequenceNumber: true, correlationId: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
    })) as any[];

    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    const last = page[page.length - 1];
    return {
      data: {
        deliveries: page.map(toDeliverySummary),
        nextCursor: hasMore && last ? encodeDeliveryCursor({ createdAt: new Date(last.createdAt).toISOString(), id: last.id }) : null,
        hasMore,
      },
      error: null,
    };
  } catch {
    return { data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to list webhook deliveries' } };
  }
}

/**
 * Owned purge path (R14): deletes deliveries older than the retention
 * window. Delivery rows carry no token pointers (payloads are sanitized
 * at emit; only capped snippets persist), so expiry is purely by age.
 */
export async function purgeExpiredWebhookDeliveries(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - WEBHOOK_DELIVERY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await prisma.webhookDelivery.deleteMany({
    where: { createdAt: { lte: cutoff } },
  });
  return deleted.count;
}
