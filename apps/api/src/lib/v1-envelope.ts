/**
 * v1-Only Envelope Serializer (U7, KTD6).
 *
 * Every v1 response — success or denial — carries all three keys:
 * `{ data, error, meta: { requestId } }`. List handlers extend `meta`
 * with `pagination`; idempotent creates extend it with `replayed`.
 * Success sets `error: null`; denials set `data: null`.
 *
 * This module is v1-scoped on purpose: the shared dashboard helpers in
 * `./response.ts` stay byte-identical (U7 must not move dashboard behavior).
 */

import { randomUUID } from 'crypto';
import type { FastifyReply } from 'fastify';
import type { V1ErrorCode } from './v1-errors.js';

export interface V1Meta {
  requestId: string;
  pagination?: { nextCursor: string | null; hasMore: boolean };
  replayed?: boolean;
}

export function newRequestId(): string {
  return randomUUID();
}

/** Uniform headers on every 401 so auth failures are indistinguishable at the edge. */
export function setV1AuthFailureHeaders(reply: FastifyReply): void {
  reply.header('WWW-Authenticate', 'Bearer error="invalid_token"');
  reply.header('Cache-Control', 'no-store');
}

export function v1Success(
  reply: FastifyReply,
  data: unknown,
  statusCode = 200,
  extraMeta?: Omit<V1Meta, 'requestId'>,
  requestId: string = newRequestId(),
): unknown {
  return reply.code(statusCode).send({
    data,
    error: null,
    meta: { requestId, ...extraMeta },
  });
}

export function v1Error(
  reply: FastifyReply,
  statusCode: number,
  code: V1ErrorCode,
  message: string,
  details?: unknown,
  requestId: string = newRequestId(),
): unknown {
  if (statusCode === 401) setV1AuthFailureHeaders(reply);
  return reply.code(statusCode).send({
    data: null,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
    meta: { requestId },
  });
}
