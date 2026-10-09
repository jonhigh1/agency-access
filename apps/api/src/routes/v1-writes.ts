/**
 * v1 Write Routes (U5: R6, R7, R8, R11, R17 — idempotent creates, strict schemas).
 *
 * Registered inside the v1 plugin context, so the key preHandler from
 * v1.ts already ran. Each create carries tier + rate pre-check + scope as
 * preHandlers, then the handler follows the KTD5 order strictly:
 *
 *   require header -> strict-validate -> rate consume -> fingerprint ->
 *   atomic claim -> (business write + stored result in one transaction)
 *
 * Validation failures never reach the claim, so they never consume the key
 * (KTD5). Replay re-checks scope and tier because those preHandlers run
 * before the claim on every call, including retries (KTD5). Records isolate
 * by agency plus key identity: one key never reads another key's stored
 * result. Usage metrics derive via DB counts with no increment on this path,
 * so a replayed create consumes no allowance twice (KTD5, R7).
 *
 * Every write schema is strict: unknown fields fail with VALIDATION_ERROR
 * naming the field, never silently dropped (KTD9, R17, AE5).
 */

import { randomUUID } from 'crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireKeyScope } from '@/middleware/api-key-auth.js';
import {
  V1_RATE_LIMITED_CODE,
  V1_RATE_LIMIT_MAX_REQUESTS,
  consumeV1RateLimit,
  preCheckV1RateLimit,
  v1TierGate,
} from '@/middleware/v1-gate.js';
import type { ApiKeyPrincipal } from '@/services/api-key.service';
import {
  IDEMPOTENCY_CONFLICT_CODE,
  IDEMPOTENCY_EXPIRED_CODE,
  IDEMPOTENCY_IN_PROGRESS_CODE,
  IdempotencyConflictError,
  IdempotencyExpiredError,
  IdempotencyInProgressError,
  fingerprintRequest,
  idempotencyService,
  isPrismaUniqueViolation,
} from '@/services/idempotency.service.js';
import { ClientError } from '@/services/client.service.js';
import {
  generateUniqueToken,
  listRequestsForExternalClient,
} from '@/services/access-request.service.js';
import { decodeKeysetCursor, CursorError } from '@/services/catalog.service.js';

function principalOf(request: FastifyRequest): ApiKeyPrincipal {
  return (request as unknown as { apiKey: ApiKeyPrincipal }).apiKey;
}

/** Missing-or-empty idempotency header code (R7: creates require the key). */
export const IDEMPOTENCY_KEY_REQUIRED_CODE = 'IDEMPOTENCY_KEY_REQUIRED';

function sendError(reply: FastifyReply, statusCode: number, code: string, message: string) {
  return reply.code(statusCode).send({ data: null, error: { code, message } });
}

function sendSuccess(reply: FastifyReply, statusCode: number, data: unknown, replayed: boolean) {
  return reply.code(statusCode).send({
    data,
    error: null,
    meta: { requestId: randomUUID(), replayed },
  });
}

/** Name every unrecognized key; zod's default message drops them (KTD9). */
function validationMessage(error: z.ZodError): string {
  const unknownKeys = error.issues
    .filter((issue) => issue.code === 'unrecognized_keys')
    .flatMap((issue) =>
      issue.code === 'unrecognized_keys' ? (issue.keys as string[]) : [],
    );
  if (unknownKeys.length > 0) {
    return `Unknown field${unknownKeys.length > 1 ? 's' : ''}: ${unknownKeys.join(', ')}`;
  }
  return error.issues[0]?.message ?? 'Invalid request body';
}

/**
 * Per-key rate pre-check before validation: peek without consuming (KTD8).
 * Consume happens in the handler after strict validation passes.
 */
function v1WriteRatePreCheck() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const principal = principalOf(request);
    if (!principal) return;
    const check = preCheckV1RateLimit(principal.keyId);
    reply.header('X-RateLimit-Limit', String(V1_RATE_LIMIT_MAX_REQUESTS));
    reply.header('X-RateLimit-Remaining', String(check.remaining));
    if (!check.allowed) {
      reply.header('Retry-After', String(check.retryAfterSeconds));
      return sendError(reply, 429, V1_RATE_LIMITED_CODE, 'Rate limit exceeded. Please try again later.');
    }
  };
}

// Strict v1 write schemas (KTD9). externalReference never appears: it stays
// internal-only while externalClientId is the public join key (KTD4).
const v1ClientCreateSchema = z
  .object({
    name: z.string().min(1),
    company: z.string().min(1),
    email: z.string().email(),
    website: z.string().url().optional(),
    language: z.string().min(2).max(10).optional(),
    externalClientId: z.string().min(1).max(128).optional(),
  })
  .strict();

const v1RequestCreateSchema = z
  .object({
    clientId: z.string().min(1).optional(),
    clientExternalId: z.string().min(1).max(128).optional(),
    clientName: z.string().min(1),
    clientEmail: z.string().email(),
    platforms: z
      .array(
        z
          .object({
            platform: z.string().min(1),
            accessLevel: z.enum(['manage', 'view_only']),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

const v1ExternalRequestsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().optional(),
  })
  .strict();

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function isExternalIdTarget(error: unknown): boolean {
  if (!isPrismaUniqueViolation(error)) return false;
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  return Array.isArray(target) && target.includes('externalClientId');
}

/** Client write inside the idempotency transaction: dup email + dup external ID map distinctly. */
async function createClientInTx(tx: Tx, agencyId: string, body: z.infer<typeof v1ClientCreateSchema>) {
  const duplicateEmail = await tx.client.findFirst({ where: { agencyId, email: body.email } });
  if (duplicateEmail) {
    throw new Error(ClientError.EMAIL_EXISTS);
  }
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
async function createRequestInTx(tx: Tx, agencyId: string, body: z.infer<typeof v1RequestCreateSchema>) {
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
      platforms: body.platforms as never,
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
async function handleIdempotentCreate(
  request: FastifyRequest,
  reply: FastifyReply,
  opts: {
    endpoint: string;
    schema: typeof v1ClientCreateSchema | typeof v1RequestCreateSchema;
    write: (tx: Tx, agencyId: string, body: never) => Promise<unknown>;
  },
) {
  const principal = principalOf(request);
  const rawKey = request.headers['idempotency-key'];
  const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
  if (!key || key.trim().length === 0) {
    return sendError(reply, 400, IDEMPOTENCY_KEY_REQUIRED_CODE, 'The Idempotency-Key header is required.');
  }

  const parsed = opts.schema.safeParse(request.body);
  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', validationMessage(parsed.error));
  }

  const consumed = consumeV1RateLimit(principal.keyId);
  reply.header('X-RateLimit-Limit', String(V1_RATE_LIMIT_MAX_REQUESTS));
  reply.header('X-RateLimit-Remaining', String(consumed.remaining));
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
    if (error instanceof IdempotencyInProgressError) {
      return sendError(reply, 409, IDEMPOTENCY_IN_PROGRESS_CODE, 'The first request with this idempotency key is still running.');
    }
    if (error instanceof IdempotencyExpiredError) {
      return sendError(reply, 410, IDEMPOTENCY_EXPIRED_CODE, 'Idempotency key has expired; retry with a fresh key.');
    }
    if (error instanceof IdempotencyConflictError) {
      return sendError(reply, 409, IDEMPOTENCY_CONFLICT_CODE, 'Idempotency key is already in use with a different request.');
    }
    throw error;
  }

  if (claim.status === 'replay') {
    return sendSuccess(reply, claim.record.statusCode ?? 200, claim.record.result, true);
  }

  const recordId = claim.record.id;
  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await opts.write(tx, principal.agencyId, parsed.data as never);
      const stored = await tx.idempotencyRecord.updateMany({
        where: { id: recordId, state: 'in_progress' },
        data: {
          state: 'completed',
          statusCode: 201,
          result: JSON.parse(JSON.stringify(created)) as never,
        },
      });
      if (stored.count !== 1) throw new Error('IDEMPOTENCY_STATE');
      return created;
    });
    return sendSuccess(reply, 201, row, false);
  } catch (error) {
    // Terminally fail the claim so the poisoned key is never replayed;
    // the caller retries the business write with a fresh key (KTD5).
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
   * POST /api/v1/clients (R6, R7, R8, R17)
   * Retry-safe client creation with an immutable external ID set at
   * creation (KTD4). Duplicates map to EXTERNAL_ID_CONFLICT via the
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
   * POST /api/v1/requests (R7, R8, R17)
   * Retry-safe request creation; links to a client by id or by the
   * immutable external ID (KTD4).
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
   * GET /api/v1/clients/external/:externalClientId (R6, R11)
   * Direct row resolution by the immutable external ID (AE2).
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
      return reply.send({ data: client, error: null, meta: { requestId: randomUUID() } });
    },
  );

  /**
   * GET /api/v1/clients/external/:externalClientId/requests (R6, R11)
   * Exactly this client's requests under an opaque keyset cursor (AE2).
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
      let cursor;
      try {
        cursor = decodeKeysetCursor(parsed.data.cursor);
      } catch (error) {
        if (error instanceof CursorError) return sendError(reply, 400, 'VALIDATION_ERROR', error.message);
        throw error;
      }
      const result = await listRequestsForExternalClient({
        agencyId: principal.agencyId,
        externalClientId,
        limit: parsed.data.limit,
        cursor,
      });
      if (result.error || !result.data) {
        return sendError(reply, 404, 'CLIENT_NOT_FOUND', 'Client not found.');
      }
      return reply.send({
        data: result.data.rows,
        error: null,
        meta: {
          requestId: randomUUID(),
          pagination: { nextCursor: result.data.nextCursor, hasMore: result.data.hasMore },
        },
      });
    },
  );
}
