/**
 * v1 Write Routes: idempotent creates with strict schemas.
 *
 * Registered inside the v1 plugin context, so the key preHandler already
 * ran. Each create carries tier + rate pre-check + scope as preHandlers,
 * then the handler follows this order strictly:
 *
 *   require header -> strict-validate -> rate consume -> fingerprint ->
 *   atomic claim -> (business write + stored result in one transaction)
 *
 * Validation failures never reach the claim, so they never consume the key.
 * Replay re-checks scope and tier because those preHandlers run before the
 * claim on every call, including retries. Records isolate by agency plus key
 * identity: one key never reads another key's stored result. Usage metrics
 * derive via DB counts with no increment on this path, so a replayed create
 * consumes no allowance twice.
 *
 * Every write schema is strict: unknown fields fail with VALIDATION_ERROR
 * naming the field, never silently dropped. The legacy per-request
 * `externalReference` never appears: it stays internal-only while
 * `externalClientId` is the public join key.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireKeyScope } from '@/middleware/api-key-auth.js';
import { v1Error, v1Success } from '@/lib/v1-envelope.js';
import { IDEMPOTENCY_KEY_REQUIRED } from '@/lib/v1-errors.js';
import {
  V1_RATE_LIMITED_CODE,
  consumeV1RateLimit,
  preCheckV1RateLimit,
  rateHeaders,
  v1TierGate,
} from '@/middleware/v1-gate.js';
import {
  decodeKeysetCursor,
} from '@/services/catalog.service.js';
import {
  fingerprintRequest,
  idempotencyService,
  isPrismaUniqueViolation,
} from '@/services/idempotency.service.js';
import { ClientError } from '@/services/client.service.js';
import type { V1ErrorCode } from '@/lib/v1-errors.js';
import {
  decodeCursorOr400,
  extractIdempotencyKey,
  principalOf,
  sendIdempotencyClaimError,
  validationMessage,
} from '@/lib/v1-route-helpers.js';
import {
  v1ClientCreateSchema,
  v1ExternalRequestsQuerySchema,
  v1RequestCreateSchema,
} from './v1-schemas.js';
import {
  generateUniqueToken,
  listRequestsForExternalClient,
} from '@/services/access-request.service.js';

function sendError(reply: FastifyReply, statusCode: number, code: V1ErrorCode, message: string) {
  return v1Error(reply, statusCode, code, message);
}

function sendSuccess(reply: FastifyReply, statusCode: number, data: unknown, replayed: boolean) {
  return v1Success(reply, data, statusCode, { replayed });
}

/**
 * Per-key rate pre-check before validation: peek without consuming.
 * Consume happens in the handler after strict validation passes.
 */
function v1WriteRatePreCheck() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const principal = principalOf(request);
    if (!principal) return;
    const check = preCheckV1RateLimit(principal.keyId);
    rateHeaders(reply, check.remaining);
    if (!check.allowed) {
      reply.header('Retry-After', String(check.retryAfterSeconds));
      return sendError(reply, 429, V1_RATE_LIMITED_CODE, 'Rate limit exceeded. Please try again later.');
    }
  };
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function isExternalIdTarget(error: unknown): boolean {
  if (!isPrismaUniqueViolation(error)) return false;
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  return Array.isArray(target) && target.includes('externalClientId');
}

type V1ClientCreateBody = z.infer<typeof v1ClientCreateSchema>;
type V1RequestCreateBody = z.infer<typeof v1RequestCreateSchema>;

/** Client write inside the idempotency transaction: dup email + dup external ID map distinctly. */
async function createClientInTx(tx: Tx, agencyId: string, body: V1ClientCreateBody) {
  try {
    return await tx.client.create({
      data: {
        agencyId,
        name: body.name,
        company: body.company,
        email: body.email,
        ...(body.website !== undefined ? { website: body.website } : {}),
        ...(body.language !== undefined ? { language: body.language } : {}),
        ...(body.externalClientId !== undefined ? { externalClientId: body.externalClientId } : {}),
      },
    });
  } catch (error) {
    if (isExternalIdTarget(error)) throw new Error(ClientError.EXTERNAL_ID_CONFLICT);
    if (isPrismaUniqueViolation(error)) throw new Error(ClientError.EMAIL_EXISTS);
    throw error;
  }
}

/** Request write inside the idempotency transaction; client links by id or external ID. */
async function createRequestInTx(tx: Tx, agencyId: string, body: V1RequestCreateBody) {
  let clientId: string | undefined;
  if (body.clientExternalId !== undefined) {
    const client = await tx.client.findFirst({
      where: { agencyId, externalClientId: body.clientExternalId },
      select: { id: true },
    });
    if (!client) throw new Error(ClientError.NOT_FOUND);
    clientId = client.id;
  } else if (body.clientId !== undefined) {
    const client = await tx.client.findFirst({
      where: { id: body.clientId, agencyId },
      select: { id: true },
    });
    if (!client) throw new Error(ClientError.NOT_FOUND);
    clientId = client.id;
  }
  return tx.accessRequest.create({
    data: {
      agencyId,
      ...(clientId !== undefined ? { clientId } : {}),
      clientName: body.clientName,
      clientEmail: body.clientEmail,
      uniqueToken: generateUniqueToken(),
      platforms: body.platforms as Prisma.InputJsonValue,
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
}

function mapWriteError(reply: FastifyReply, error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes(ClientError.EXTERNAL_ID_CONFLICT)) {
      return sendError(reply, 409, ClientError.EXTERNAL_ID_CONFLICT, 'This external client ID is already in use.');
    }
    if (error.message.includes(ClientError.EMAIL_EXISTS)) {
      return sendError(reply, 409, 'CLIENT_EMAIL_EXISTS', 'A client with this email already exists.');
    }
    if (error.message.includes(ClientError.NOT_FOUND)) {
      return sendError(reply, 404, 'CLIENT_NOT_FOUND', 'Client not found.');
    }
  }
  throw error;
}

/**
 * Shared idempotent-create handler. The business write plus the stored
 * result commit in one Postgres transaction; a replay returns the stored
 * result with its original status code without writing anything.
 */
async function handleIdempotentCreate<S extends typeof v1ClientCreateSchema | typeof v1RequestCreateSchema>(
  request: FastifyRequest,
  reply: FastifyReply,
  opts: {
    endpoint: string;
    schema: S;
    write: (tx: Tx, agencyId: string, body: z.infer<S>) => Promise<unknown>;
  },
) {
  const principal = principalOf(request);
  const key = extractIdempotencyKey(request.headers);
  if (!key) {
    return sendError(reply, 400, IDEMPOTENCY_KEY_REQUIRED, 'The Idempotency-Key header is required.');
  }

  const parsed = opts.schema.safeParse(request.body);
  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', validationMessage(parsed.error));
  }

  const consumed = consumeV1RateLimit(principal.keyId);
  rateHeaders(reply, consumed.remaining);
  if (!consumed.allowed) {
    reply.header('Retry-After', String(consumed.retryAfterSeconds));
    return sendError(reply, 429, V1_RATE_LIMITED_CODE, 'Rate limit exceeded. Please try again later.');
  }

  const fingerprint = fingerprintRequest(parsed.data);
  let claim;
  try {
    claim = await idempotencyService.claim({
      agencyId: principal.agencyId,
      keyIdentity: principal.keyId,
      endpoint: opts.endpoint,
      key,
      fingerprint,
    });
  } catch (error) {
    return sendIdempotencyClaimError(reply, error);
  }

  if (claim.status === 'replay') {
    return sendSuccess(reply, claim.record.statusCode ?? 200, claim.record.result, true);
  }

  const recordId = claim.record.id;
  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await opts.write(tx, principal.agencyId, parsed.data);
      const stored = await tx.idempotencyRecord.updateMany({
        where: { id: recordId, state: 'in_progress' },
        data: {
          state: 'completed',
          statusCode: 201,
          result: JSON.parse(JSON.stringify(created)),
        },
      });
      if (stored.count !== 1) throw new Error('IDEMPOTENCY_STATE');
      return created;
    });
    return sendSuccess(reply, 201, row, false);
  } catch (error) {
    // Terminally fail the claim so the poisoned key is never replayed;
    // the caller retries the business write with a fresh key.
    try {
      await idempotencyService.fail({ recordId });
    } catch {
      // The claim row is already gone or settled; the domain error below
      // is the actionable signal for the caller.
    }
    if (error instanceof Error && error.message === 'IDEMPOTENCY_STATE') {
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to record the idempotent result.');
    }
    return mapWriteError(reply, error);
  }
}

export async function v1WritesRoutes(fastify: FastifyInstance) {
  const tier = v1TierGate();
  const ratePre = v1WriteRatePreCheck();

  /**
   * POST /api/v1/clients
   * Retry-safe client creation with an immutable external ID set at
   * creation. Duplicates map to EXTERNAL_ID_CONFLICT via the
   * DB-violation guard.
   */
  fastify.post(
    '/clients',
    { preHandler: [tier, ratePre, requireKeyScope('clients:write')] },
    async (request, reply) =>
      handleIdempotentCreate(request, reply, {
        endpoint: 'POST /api/v1/clients',
        schema: v1ClientCreateSchema,
        write: (tx, agencyId, body) => createClientInTx(tx, agencyId, body),
      }),
  );

  /**
   * POST /api/v1/requests
   * Retry-safe request creation; links to a client by id or by the
   * immutable external ID.
   */
  fastify.post(
    '/requests',
    { preHandler: [tier, ratePre, requireKeyScope('requests:write')] },
    async (request, reply) =>
      handleIdempotentCreate(request, reply, {
        endpoint: 'POST /api/v1/requests',
        schema: v1RequestCreateSchema,
        write: (tx, agencyId, body) => createRequestInTx(tx, agencyId, body),
      }),
  );

  /**
   * GET /api/v1/clients/external/:externalClientId
   * Direct row resolution by the immutable external ID.
   */
  fastify.get(
    '/clients/external/:externalClientId',
    { preHandler: [tier, ratePre, requireKeyScope('clients:read')] },
    async (request, reply) => {
      const principal = principalOf(request);
      const { externalClientId } = request.params as { externalClientId: string };
      const client = await prisma.client.findFirst({
        where: { agencyId: principal.agencyId, externalClientId },
      });
      if (!client) {
        return sendError(reply, 404, 'CLIENT_NOT_FOUND', 'Client not found.');
      }
      return v1Success(reply, client);
    },
  );

  /**
   * GET /api/v1/clients/external/:externalClientId/requests
   * Exactly this client's requests under an opaque keyset cursor.
   */
  fastify.get(
    '/clients/external/:externalClientId/requests',
    { preHandler: [tier, ratePre, requireKeyScope('requests:read')] },
    async (request, reply) => {
      const principal = principalOf(request);
      const { externalClientId } = request.params as { externalClientId: string };
      const parsed = v1ExternalRequestsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return sendError(reply, 400, 'VALIDATION_ERROR', validationMessage(parsed.error));
      }
      const cursor = decodeCursorOr400(reply, decodeKeysetCursor, parsed.data.cursor);
      if (cursor === undefined) return;
      const result = await listRequestsForExternalClient({
        agencyId: principal.agencyId,
        externalClientId,
        limit: parsed.data.limit,
        cursor,
      });
      if (result.error || !result.data) {
        return sendError(reply, 404, 'CLIENT_NOT_FOUND', 'Client not found.');
      }
      return v1Success(reply, result.data.rows, 200, {
        pagination: { nextCursor: result.data.nextCursor, hasMore: result.data.hasMore },
      });
    },
  );
}
