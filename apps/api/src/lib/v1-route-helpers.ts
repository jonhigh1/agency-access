/**
 * Shared v1 route helpers: principal access, cursor decoding, idempotency
 * header handling, and strict-schema validation messages.
 *
 * Every v1 handler runs after the key preHandler, so `request.apiKey` is
 * always present here. The augmentation below keeps that on the
 * FastifyRequest type instead of per-call casts.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { v1Error } from './v1-envelope.js';
import type { ApiKeyPrincipal } from '@/services/api-key.service.js';
import { CursorError } from '@/services/catalog.service.js';
import {
  IdempotencyConflictError,
  IdempotencyExpiredError,
  IdempotencyInProgressError,
  IdempotencyLimitError,
} from '@/services/idempotency.service.js';
import { DeliveryCursorError } from '@/services/webhook-delivery.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: ApiKeyPrincipal;
  }
}

/** The key principal attached by the v1 preHandler. */
export function principalOf(request: FastifyRequest): ApiKeyPrincipal {
  return request.apiKey as ApiKeyPrincipal;
}

/**
 * Decode an opaque keyset cursor, answering 400 on malformed values.
 * Returns `undefined` when the error response was already sent; callers
 * return early on `undefined` (`null` remains the valid missing cursor).
 */
export function decodeCursorOr400<T>(
  reply: FastifyReply,
  decode: (raw: string | undefined) => T,
  raw: string | undefined,
): T | undefined {
  try {
    return decode(raw);
  } catch (error) {
    if (error instanceof CursorError || error instanceof DeliveryCursorError) {
      v1Error(reply, 400, 'VALIDATION_ERROR', error.message);
      return undefined;
    }
    throw error;
  }
}

/** First idempotency header value, trimmed; `null` when missing or blank. */
export function extractIdempotencyKey(headers: FastifyRequest['headers']): string | null {
  const raw = headers['idempotency-key'];
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first !== 'string') return null;
  const key = first.trim();
  return key.length > 0 ? key : null;
}

/** Map an idempotency claim failure to its 409/409/410 response. */
export function sendIdempotencyClaimError(reply: FastifyReply, error: unknown): unknown {
  if (error instanceof IdempotencyInProgressError) {
    return v1Error(reply, 409, error.code, error.message);
  }
  if (error instanceof IdempotencyConflictError) {
    return v1Error(reply, 409, error.code, error.message);
  }
  if (error instanceof IdempotencyExpiredError) {
    return v1Error(reply, 410, error.code, error.message);
  }
  if (error instanceof IdempotencyLimitError) {
    return v1Error(reply, 429, error.code, error.message);
  }
  throw error;
}

/** Name every unrecognized key; zod's default message drops them. */
export function validationMessage(error: z.ZodError): string {
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
