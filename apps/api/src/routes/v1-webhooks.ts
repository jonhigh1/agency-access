/**
 * v1 Webhook Routes (U6: R13–R16 — multi-endpoint CRUD, reconciled
 * taxonomy, rotation, ordering primitives, deliveries log).
 *
 * Registered inside the v1 plugin context (same pattern as v1-reads):
 * the key preHandler already ran; each route carries tier gate,
 * per-key rate limit, then the scope gate. Every write schema is strict
 * (unknown fields fail naming the field, R17/KTD9).
 *
 * Ordering + dedupe contract surfaced here (R16, documented for
 * integrators in @agency-platform/shared): order by the per-endpoint
 * `sequenceNumber` (gaps tolerated), collapse redeliveries on the global
 * event `id`, and use `correlationId` as the cross-endpoint dedupe key.
 * Secret rotation verifies new-then-old during the 24h overlap window.
 */

import { randomUUID } from 'crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireKeyScope } from '@/middleware/api-key-auth.js';
import { v1RateLimitPreHandler, v1TierGate } from '@/middleware/v1-gate.js';
import type { ApiKeyPrincipal } from '@/services/api-key.service';
import {
  IdempotencyConflictError,
  IdempotencyExpiredError,
  IdempotencyInProgressError,
  fingerprintRequest,
  idempotencyService,
} from '@/services/idempotency.service.js';
import {
  UNSAFE_ENDPOINT_URL_CODE,
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
  DeliveryCursorError,
  decodeDeliveryCursor,
  listWebhookDeliveriesKeyset,
} from '@/services/webhook-delivery.service.js';
import { V1_WEBHOOK_SUBSCRIBABLE_EVENTS } from '@agency-platform/shared';
import { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT } from '@/lib/list-pagination.js';

const IDEMPOTENCY_ENDPOINT = 'POST /api/v1/webhook-endpoints';
const IDEMPOTENCY_KEY_REQUIRED_CODE = 'IDEMPOTENCY_KEY_REQUIRED';

const TAXONOMY_DESCRIPTIONS: Record<string, string> = {
  'webhook.test': 'Connectivity probe sent on demand to verify an endpoint.',
  'access_request.partial': 'A request crossed into partial authorization (some services granted).',
  'access_request.completed': 'A request reached full authorization (all services granted).',
  'access_request.revoked': 'A request was revoked after authorization.',
  'access_request.expired': 'A request expired before completion.',
  'connection.status_changed': 'A platform connection changed health status.',
};

const EventEnum = z.enum(V1_WEBHOOK_SUBSCRIBABLE_EVENTS as unknown as [string, ...string[]]);

const endpointCreateBodySchema = z
  .object({
    url: z.string().url().max(2048),
    subscribedEvents: z.array(EventEnum).min(1).max(6),
    preferredApiVersion: z.enum(['2026-03-08', '2026-03-19']).optional(),
  })
  .strict();

const endpointUpdateBodySchema = endpointCreateBodySchema;

const rotateBodySchema = z
  .object({
    /** False (default): 24h dual-active overlap. True: replace at once. */
    immediate: z.boolean().optional().default(false),
  })
  .strict();

const deliveriesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
    cursor: z.string().optional(),
  })
  .strict();

function principalOf(request: unknown): ApiKeyPrincipal {
  return (request as { apiKey: ApiKeyPrincipal }).apiKey;
}

function actorEmailOf(principal: ApiKeyPrincipal): string {
  return `${principal.keyId}@api-key.local`;
}

function sendSuccess(reply: FastifyReply, data: unknown, statusCode = 200) {
  return reply.code(statusCode).send({
    data,
    error: null,
    meta: { requestId: randomUUID() },
  });
}

function sendServiceError(reply: FastifyReply, error: { code: string; message: string; details?: unknown }) {
  const status =
    error.code === 'NOT_FOUND'
      ? 404
      : error.code === 'MISSING_SCOPE'
        ? 403
        : error.code === WEBHOOK_ENDPOINT_CAP_EXCEEDED_CODE ||
            error.code === WEBHOOK_ENDPOINT_URL_EXISTS_CODE
          ? 409
          : error.code === 'INTERNAL_ERROR'
            ? 500
            : 400;
  return reply.code(status).send({ data: null, error, meta: { requestId: randomUUID() } });
}

function sendValidationError(reply: FastifyReply, message: string, code = 'VALIDATION_ERROR') {
  return reply.code(400).send({ data: null, error: { code, message } });
}

export async function v1WebhooksRoutes(fastify: FastifyInstance) {
  const tier = v1TierGate();
  const rate = v1RateLimitPreHandler();

  /**
   * GET /api/v1/webhook-event-types (R15)
   * The reconciled taxonomy: every event the evaluator can emit is
   * subscribable, including previously unsubscribable ones.
   */
  fastify.get(
    '/webhook-event-types',
    { preHandler: [tier, rate, requireKeyScope('webhooks:read')] },
    async (_request, reply) => {
      return sendSuccess(
        reply,
        V1_WEBHOOK_SUBSCRIBABLE_EVENTS.map((type) => ({
          type,
          description: TAXONOMY_DESCRIPTIONS[type] ?? '',
        })),
      );
    },
  );

  /**
   * GET /api/v1/webhook-endpoints (R13)
   * All endpoints for the key's agency, creation order.
   */
  fastify.get(
    '/webhook-endpoints',
    { preHandler: [tier, rate, requireKeyScope('webhooks:read')] },
    async (request, reply) => {
      const principal = principalOf(request);
      const result = await listWebhookEndpoints(principal.agencyId, { scopes: principal.scopes });
      if (result.error) return sendServiceError(reply, result.error);
      return sendSuccess(reply, result.data!.endpoints);
    },
  );

  /**
   * POST /api/v1/webhook-endpoints (R7, R13)
   * Creates require the idempotency header via the generic record: a
   * retry with the same key and body replays the original result.
   */
  fastify.post(
    '/webhook-endpoints',
    { preHandler: [tier, rate, requireKeyScope('webhooks:write')] },
    async (request, reply) => {
      const principal = principalOf(request);
      const parsed = endpointCreateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        const first = parsed.error.errors[0];
        return sendValidationError(
          reply,
          first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid request body',
        );
      }
      // Sync SSRF screen before the idempotency claim so validation
      // failures never consume the key (KTD5).
      const syncCheck = validateEndpointUrlSync(parsed.data.url);
      if (!syncCheck.ok) {
        return sendValidationError(reply, syncCheck.message, syncCheck.code);
      }

      const idemKey = request.headers['idempotency-key'];
      if (typeof idemKey !== 'string' || idemKey.length === 0) {
        return sendValidationError(reply, 'The Idempotency-Key header is required', IDEMPOTENCY_KEY_REQUIRED_CODE);
      }

      let claim: { status: 'claimed' | 'replay'; record: { id: string; statusCode: number | null; result: unknown } };
      try {
        claim = await idempotencyService.claim({
          agencyId: principal.agencyId,
          keyIdentity: principal.keyId,
          endpoint: IDEMPOTENCY_ENDPOINT,
          key: idemKey,
          fingerprint: fingerprintRequest(parsed.data),
        });
      } catch (error) {
        if (error instanceof IdempotencyInProgressError) {
          return reply.code(409).send({ data: null, error: { code: error.code, message: error.message } });
        }
        if (error instanceof IdempotencyConflictError) {
          return reply.code(409).send({ data: null, error: { code: error.code, message: error.message } });
        }
        if (error instanceof IdempotencyExpiredError) {
          return reply.code(410).send({ data: null, error: { code: error.code, message: error.message } });
        }
        throw error;
      }

      if (claim.status === 'replay') {
        // Scope and tier were re-checked by this request's own gate chain.
        return reply.code(claim.record.statusCode ?? 200).send(claim.record.result);
      }

      const result = await createPluralWebhookEndpoint(
        {
          agencyId: principal.agencyId,
          url: parsed.data.url,
          subscribedEvents: parsed.data.subscribedEvents as string[] as never,
          preferredApiVersion: parsed.data.preferredApiVersion,
          createdBy: actorEmailOf(principal),
        } as never,
        { scopes: principal.scopes },
      );
      if (result.error) {
        await idempotencyService.fail({ recordId: claim.record.id });
        return sendServiceError(reply, result.error);
      }
      const body = {
        data: { endpoint: result.data!.endpoint, signingSecret: result.data!.signingSecret },
        error: null,
        meta: { requestId: randomUUID() },
      };
      await idempotencyService.complete({ recordId: claim.record.id, statusCode: 201, result: body });
      return reply.code(201).send(body);
    },
  );

  /**
   * GET /api/v1/webhook-endpoints/:id (R13)
   */
  fastify.get(
    '/webhook-endpoints/:id',
    { preHandler: [tier, rate, requireKeyScope('webhooks:read')] },
    async (request, reply) => {
      const principal = principalOf(request);
      const { id } = request.params as { id: string };
      const result = await getWebhookEndpointById(principal.agencyId, id, { scopes: principal.scopes });
      if (result.error) return sendServiceError(reply, result.error);
      return sendSuccess(reply, result.data!.endpoint);
    },
  );

  /**
   * PATCH /api/v1/webhook-endpoints/:id (R13)
   * URL re-validated like creation; reactivation clears disablement.
   */
  fastify.patch(
    '/webhook-endpoints/:id',
    { preHandler: [tier, rate, requireKeyScope('webhooks:write')] },
    async (request, reply) => {
      const principal = principalOf(request);
      const { id } = request.params as { id: string };
      const parsed = endpointUpdateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        const first = parsed.error.errors[0];
        return sendValidationError(
          reply,
          first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid request body',
        );
      }
      const syncCheck = validateEndpointUrlSync(parsed.data.url);
      if (!syncCheck.ok) {
        return sendValidationError(reply, syncCheck.message, syncCheck.code);
      }
      const result = await updatePluralWebhookEndpoint(
        id,
        {
          agencyId: principal.agencyId,
          url: parsed.data.url,
          subscribedEvents: parsed.data.subscribedEvents as string[] as never,
          preferredApiVersion: parsed.data.preferredApiVersion,
          updatedBy: actorEmailOf(principal),
        } as never,
        { scopes: principal.scopes },
      );
      if (result.error) return sendServiceError(reply, result.error);
      return sendSuccess(reply, result.data!.endpoint);
    },
  );

  /**
   * DELETE /api/v1/webhook-endpoints/:id (R13)
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
      return sendSuccess(reply, result.data);
    },
  );

  /**
   * POST /api/v1/webhook-endpoints/:id/rotate (R14)
   * Default overlap keeps the old secret verifying for 24h (new-then-old);
   * `{"immediate": true}` replaces at once and revokes the old secret.
   */
  fastify.post(
    '/webhook-endpoints/:id/rotate',
    { preHandler: [tier, rate, requireKeyScope('webhooks:write')] },
    async (request, reply) => {
      const principal = principalOf(request);
      const { id } = request.params as { id: string };
      const parsed = rotateBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        const first = parsed.error.errors[0];
        return sendValidationError(
          reply,
          first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid request body',
        );
      }
      const result = await rotateWebhookEndpointSecretById(
        principal.agencyId,
        id,
        actorEmailOf(principal),
        parsed.data.immediate ?? false,
        { scopes: principal.scopes },
      );
      if (result.error) return sendServiceError(reply, result.error);
      return sendSuccess(reply, { endpoint: result.data!.endpoint, signingSecret: result.data!.signingSecret });
    },
  );

  /**
   * GET /api/v1/webhook-endpoints/:id/deliveries (R14)
   * Cursor log over (createdAt, id); summaries carry status plus the
   * ordering primitives, never secrets or full bodies.
   */
  fastify.get(
    '/webhook-endpoints/:id/deliveries',
    { preHandler: [tier, rate, requireKeyScope('webhooks:read')] },
    async (request, reply) => {
      const principal = principalOf(request);
      const { id } = request.params as { id: string };
      const parsed = deliveriesQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        const first = parsed.error.errors[0];
        return sendValidationError(
          reply,
          first ? `${first.path.join('.') || 'query'}: ${first.message}` : 'Invalid query',
        );
      }
      let cursor;
      try {
        cursor = decodeDeliveryCursor(parsed.data.cursor);
      } catch (error) {
        if (error instanceof DeliveryCursorError) return sendValidationError(reply, error.message);
        throw error;
      }
      const endpoint = await getWebhookEndpointById(principal.agencyId, id, { scopes: principal.scopes });
      if (endpoint.error) return sendServiceError(reply, endpoint.error);
      const result = await listWebhookDeliveriesKeyset({
        agencyId: principal.agencyId,
        endpointId: id,
        limit: parsed.data.limit,
        cursor,
      });
      if (result.error) return sendServiceError(reply, result.error);
      return reply.send({
        data: result.data!.deliveries,
        error: null,
        meta: {
          requestId: randomUUID(),
          pagination: { nextCursor: result.data!.nextCursor, hasMore: result.data!.hasMore },
        },
      });
    },
  );
}
