/**
 * v1 Webhook Routes: multi-endpoint CRUD, reconciled taxonomy, rotation,
 * ordering primitives, deliveries log.
 *
 * Registered inside the v1 plugin context (same pattern as v1-reads):
 * the key preHandler already ran; each route carries tier gate,
 * per-key rate limit, then the scope gate. Every write schema is strict
 * (unknown fields fail naming the field).
 *
 * Ordering + dedupe contract surfaced here: order by the per-endpoint
 * `sequenceNumber` (gaps tolerated), collapse redeliveries on the global
 * event `id`, and use `correlationId` as the cross-endpoint dedupe key.
 * Secret rotation verifies new-then-old during the 24h overlap window.
 */

import type { FastifyInstance, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { requireKeyScope } from '@/middleware/api-key-auth.js';
import { v1Error, v1Success } from '@/lib/v1-envelope.js';
import { IDEMPOTENCY_KEY_REQUIRED, type V1ErrorCode } from '@/lib/v1-errors.js';
import {
  V1_WEBHOOK_EVENT_DESCRIPTIONS,
  V1_WEBHOOK_IDEMPOTENCY_ENDPOINT,
  v1WebhookDeliveriesQuerySchema,
  v1WebhookEndpointCreateSchema,
  v1WebhookEndpointUpdateSchema,
  v1WebhookRotateSchema,
} from './v1-schemas.js';
import { v1RateConsumeHandler, v1RateLimitPreHandler, v1RatePreCheckHandler, v1TierGate } from '@/middleware/v1-gate.js';
import type { ApiKeyPrincipal } from '@/services/api-key.service';
import {
  fingerprintRequest,
  idempotencyService,
} from '@/services/idempotency.service.js';
import {
  WEBHOOK_ENDPOINT_CAP_EXCEEDED_CODE,
  WEBHOOK_ENDPOINT_URL_EXISTS_CODE,
  createPluralWebhookEndpoint,
  deleteWebhookEndpointById,
  getWebhookEndpointById,
  listWebhookEndpoints,
  rotateWebhookEndpointSecretById,
  updatePluralWebhookEndpoint,
  validateEndpointUrlSync,
} from '@/services/webhook-endpoint.service.js';
import {
  decodeDeliveryCursor,
  listWebhookDeliveriesKeyset,
} from '@/services/webhook-delivery.service.js';
import { V1_WEBHOOK_SUBSCRIBABLE_EVENTS } from '@agency-platform/shared';
import type { ServiceError } from '@/lib/service-result';
import {
  decodeCursorOr400,
  extractIdempotencyKey,
  principalOf,
  sendIdempotencyClaimError,
  validationMessage,
} from '@/lib/v1-route-helpers.js';

function actorEmailOf(principal: ApiKeyPrincipal): string {
  return `${principal.keyId}@api-key.local`;
}

/**
 * Replay a stored webhook-create result with a fresh meta.requestId (matching
 * the writes path, which mints requestId per response) and the
 * shown-once signingSecret stripped: the secret stays returned-once.
 */
export function replayWebhookCreate(
  reply: FastifyReply,
  statusCode: number,
  stored: unknown,
): unknown {
  const record = (stored ?? {}) as {
    data?: { endpoint?: unknown; signingSecret?: unknown };
    error?: unknown;
  };
  return reply.code(statusCode).send({
    data: { endpoint: record.data?.endpoint ?? null },
    error: record.error ?? null,
    meta: { requestId: randomUUID() },
  });
}

const SERVICE_ERROR_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  MISSING_SCOPE: 403,
  INVALID_API_KEY: 401,
  [WEBHOOK_ENDPOINT_CAP_EXCEEDED_CODE]: 409,
  [WEBHOOK_ENDPOINT_URL_EXISTS_CODE]: 409,
  INTERNAL_ERROR: 500,
};

function sendServiceError(reply: FastifyReply, error: ServiceError) {
  return v1Error(
    reply,
    SERVICE_ERROR_STATUS[error.code] ?? 400,
    error.code as V1ErrorCode,
    error.message,
    error.details,
  );
}

export async function v1WebhooksRoutes(fastify: FastifyInstance) {
  const tier = v1TierGate();
  const rate = v1RateLimitPreHandler();
  const ratePre = v1RatePreCheckHandler();
  const rateConsume = v1RateConsumeHandler();

  /**
   * GET /api/v1/webhook-event-types
   * The reconciled taxonomy: every event the evaluator can emit is
   * subscribable, including previously unsubscribable ones.
   */
  fastify.get(
    '/webhook-event-types',
    { preHandler: [tier, ratePre, requireKeyScope('webhooks:read'), rateConsume] },
    async (_request, reply) => {
      return v1Success(
        reply,
        V1_WEBHOOK_SUBSCRIBABLE_EVENTS.map((type) => ({
          type,
          description: V1_WEBHOOK_EVENT_DESCRIPTIONS[type] ?? '',
        })),
      );
    },
  );

  /**
   * GET /api/v1/webhook-endpoints
   * All endpoints for the key's agency, creation order.
   */
  fastify.get(
    '/webhook-endpoints',
    { preHandler: [tier, ratePre, requireKeyScope('webhooks:read'), rateConsume] },
    async (request, reply) => {
      const principal = principalOf(request);
      const result = await listWebhookEndpoints(principal.agencyId, { scopes: principal.scopes });
      if (result.error) return sendServiceError(reply, result.error);
      return v1Success(reply, result.data!.endpoints);
    },
  );

  /**
   * POST /api/v1/webhook-endpoints
   * Creates require the idempotency header via the generic record: a
   * retry with the same key and body replays the original result.
   */
  fastify.post(
    '/webhook-endpoints',
    { preHandler: [tier, rate, requireKeyScope('webhooks:write')] },
    async (request, reply) => {
      const principal = principalOf(request);
      const parsed = v1WebhookEndpointCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return v1Error(reply, 400, 'VALIDATION_ERROR', validationMessage(parsed.error));
      }
      // Sync SSRF screen before the idempotency claim so validation
      // failures never consume the key.
      const syncCheck = validateEndpointUrlSync(parsed.data.url);
      if (!syncCheck.ok) {
        return v1Error(reply, 400, syncCheck.code as V1ErrorCode, syncCheck.message);
      }

      const idemKey = extractIdempotencyKey(request.headers);
      if (!idemKey) {
        return v1Error(reply, 400, IDEMPOTENCY_KEY_REQUIRED, 'The Idempotency-Key header is required');
      }

      let claim: { status: 'claimed' | 'replay'; record: { id: string; statusCode: number | null; result: unknown } };
      try {
        claim = await idempotencyService.claim({
          agencyId: principal.agencyId,
          // Family-scoped identity: rotation retries replay instead of
          // double-writing.
          keyIdentity: principal.familyId,
          endpoint: V1_WEBHOOK_IDEMPOTENCY_ENDPOINT,
          key: idemKey,
          fingerprint: fingerprintRequest(parsed.data),
        });
      } catch (error) {
        return sendIdempotencyClaimError(reply, error);
      }

      if (claim.status === 'replay') {
        // Scope and tier were re-checked by this request's own gate chain.
        // Re-wrap the stored data with a fresh request ID, and never replay
        // the signing secret: it was shown once on the original create.
        return replayWebhookCreate(reply, claim.record.statusCode ?? 200, claim.record.result);
      }

      const requestId = randomUUID();
      const result = await createPluralWebhookEndpoint(
        {
          agencyId: principal.agencyId,
          url: parsed.data.url,
          subscribedEvents: parsed.data.subscribedEvents as Parameters<
            typeof createPluralWebhookEndpoint
          >[0]['subscribedEvents'],
          preferredApiVersion: parsed.data.preferredApiVersion,
          createdBy: actorEmailOf(principal),
        },
        { scopes: principal.scopes },
        // Atomic path: insert + key-liveness re-check + claim completion in
        // one transaction, so a crash between steps leaves no orphan.
        { keyId: principal.keyId, claimRecordId: claim.record.id, requestId },
      );
      if (result.error) {
        await idempotencyService.fail({ recordId: claim.record.id });
        return sendServiceError(reply, result.error);
      }
      return reply.code(201).send(result.data!.body);
    },
  );

  /**
   * GET /api/v1/webhook-endpoints/:id
   */
  fastify.get(
    '/webhook-endpoints/:id',
    { preHandler: [tier, ratePre, requireKeyScope('webhooks:read'), rateConsume] },
    async (request, reply) => {
      const principal = principalOf(request);
      const { id } = request.params as { id: string };
      const result = await getWebhookEndpointById(principal.agencyId, id, { scopes: principal.scopes });
      if (result.error) return sendServiceError(reply, result.error);
      return v1Success(reply, result.data!.endpoint);
    },
  );

  /**
   * PATCH /api/v1/webhook-endpoints/:id
   * URL re-validated like creation; disabled status is sticky and only an
   * explicit {"reactivate": true} clears disablement.
   */
  fastify.patch(
    '/webhook-endpoints/:id',
    { preHandler: [tier, rate, requireKeyScope('webhooks:write')] },
    async (request, reply) => {
      const principal = principalOf(request);
      const { id } = request.params as { id: string };
      const parsed = v1WebhookEndpointUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return v1Error(reply, 400, 'VALIDATION_ERROR', validationMessage(parsed.error));
      }
      const syncCheck = validateEndpointUrlSync(parsed.data.url);
      if (!syncCheck.ok) {
        return v1Error(reply, 400, syncCheck.code as V1ErrorCode, syncCheck.message);
      }
      const result = await updatePluralWebhookEndpoint(
        id,
        {
          agencyId: principal.agencyId,
          url: parsed.data.url,
          subscribedEvents: parsed.data.subscribedEvents as Parameters<
            typeof updatePluralWebhookEndpoint
          >[1]['subscribedEvents'],
          preferredApiVersion: parsed.data.preferredApiVersion,
          updatedBy: actorEmailOf(principal),
          ...(parsed.data.reactivate !== undefined ? { reactivate: parsed.data.reactivate } : {}),
        },
        { scopes: principal.scopes },
      );
      if (result.error) return sendServiceError(reply, result.error);
      return v1Success(reply, result.data!.endpoint);
    },
  );

  /**
   * DELETE /api/v1/webhook-endpoints/:id
   * Removes the endpoint and its secret material.
   */
  fastify.delete(
    '/webhook-endpoints/:id',
    { preHandler: [tier, rate, requireKeyScope('webhooks:write')] },
    async (request, reply) => {
      const principal = principalOf(request);
      const { id } = request.params as { id: string };
      const result = await deleteWebhookEndpointById(principal.agencyId, id, actorEmailOf(principal), {
        scopes: principal.scopes,
      });
      if (result.error) return sendServiceError(reply, result.error);
      return v1Success(reply, result.data);
    },
  );

  /**
   * POST /api/v1/webhook-endpoints/:id/rotate
   * Default overlap keeps the old secret verifying for 24h (new-then-old);
   * `{"immediate": true}` replaces at once and revokes the old secret.
   */
  fastify.post(
    '/webhook-endpoints/:id/rotate',
    { preHandler: [tier, rate, requireKeyScope('webhooks:write')] },
    async (request, reply) => {
      const principal = principalOf(request);
      const { id } = request.params as { id: string };
      const parsed = v1WebhookRotateSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return v1Error(reply, 400, 'VALIDATION_ERROR', validationMessage(parsed.error));
      }
      const result = await rotateWebhookEndpointSecretById(
        principal.agencyId,
        id,
        actorEmailOf(principal),
        parsed.data.immediate ?? false,
        { scopes: principal.scopes },
      );
      if (result.error) return sendServiceError(reply, result.error);
      return v1Success(reply, { endpoint: result.data!.endpoint, signingSecret: result.data!.signingSecret });
    },
  );

  /**
   * GET /api/v1/webhook-endpoints/:id/deliveries
   * Cursor log over (createdAt, id); summaries carry status plus the
   * ordering primitives, never secrets or full bodies.
   */
  fastify.get(
    '/webhook-endpoints/:id/deliveries',
    { preHandler: [tier, ratePre, requireKeyScope('webhooks:read'), rateConsume] },
    async (request, reply) => {
      const principal = principalOf(request);
      const { id } = request.params as { id: string };
      const parsed = v1WebhookDeliveriesQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return v1Error(reply, 400, 'VALIDATION_ERROR', validationMessage(parsed.error));
      }
      const cursor = decodeCursorOr400(reply, decodeDeliveryCursor, parsed.data.cursor);
      if (cursor === undefined) return;
      const endpoint = await getWebhookEndpointById(principal.agencyId, id, { scopes: principal.scopes });
      if (endpoint.error) return sendServiceError(reply, endpoint.error);
      const result = await listWebhookDeliveriesKeyset({
        agencyId: principal.agencyId,
        endpointId: id,
        limit: parsed.data.limit,
        cursor,
      });
      if (result.error) return sendServiceError(reply, result.error);
      return v1Success(reply, result.data!.deliveries, 200, {
        pagination: { nextCursor: result.data!.nextCursor, hasMore: result.data!.hasMore },
      });
    },
  );
}
