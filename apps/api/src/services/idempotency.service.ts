/**
 * Generic idempotency store for public v1 creates (KTD5; R7, R8).
 *
 * Identity is (agency, key identity, endpoint, key value): one key never
 * reads another key's stored result, and the same key value on different
 * endpoints never collides. The atomic claim is a single insert against the
 * composite unique guard; losers read the winner and replay or fail.
 *
 * Caller order (enforced by v1 routes in U5, not here): strict-validate,
 * fingerprint, atomic claim. Validation failures never reach claim, so they
 * never consume the key. Replay re-checks scope and tier at the route before
 * the stored result is returned. Business write plus stored result commit in
 * one Postgres transaction at the route; this service only owns the claim
 * row lifecycle.
 *
 * States: in_progress (first call running; exempt from purge), completed
 * (replayable until expiry), failed (terminal; caller must use a fresh key).
 * Retention is 72h; expired keys fail with a distinct code and are never
 * silently recreated.
 */
import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/** Retention window for stored idempotent results (KTD5). */
export const IDEMPOTENCY_TTL_MS = 72 * 60 * 60 * 1000;

/** Same key, finished, different body. */
export const IDEMPOTENCY_CONFLICT_CODE = 'IDEMPOTENCY_CONFLICT';
/** Same key, first call still running. */
export const IDEMPOTENCY_IN_PROGRESS_CODE = 'IDEMPOTENCY_IN_PROGRESS';
/** Same key, retention window passed. Never recreated silently. */
export const IDEMPOTENCY_EXPIRED_CODE = 'IDEMPOTENCY_KEY_EXPIRED';
/** Duplicate Client.externalClientId within one agency (KTD4; mapped in U5). */
export const EXTERNAL_ID_CONFLICT_CODE = 'EXTERNAL_ID_CONFLICT';

export class IdempotencyConflictError extends Error {
  readonly code = IDEMPOTENCY_CONFLICT_CODE;
}

export class IdempotencyInProgressError extends Error {
  readonly code = IDEMPOTENCY_IN_PROGRESS_CODE;
}

export class IdempotencyExpiredError extends Error {
  readonly code = IDEMPOTENCY_EXPIRED_CODE;
}

export class IdempotencyStateError extends Error {
  readonly code = 'IDEMPOTENCY_STATE';
}

/** True for Prisma unique-violation errors (P2002), including duck-typed ones. */
export function isPrismaUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: unknown }).code === 'P2002';
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Stable sha256 over the canonical request body; key order never matters. */
export function fingerprintRequest(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(body))).digest('hex');
}

export interface IdempotencyClaimInput {
  agencyId: string;
  /** v1 API key id. Isolates records so keys never share stored results. */
  keyIdentity: string;
  /** Endpoint scope, e.g. 'POST /api/v1/clients'. */
  endpoint: string;
  /** Client-supplied idempotency key value. */
  key: string;
  /** fingerprintRequest(body) computed after strict validation. */
  fingerprint: string;
  now?: Date;
}

export interface IdempotencyClaimOutcome {
  status: 'claimed' | 'replay';
  record: {
    id: string;
    state: string;
    statusCode: number | null;
    result: unknown;
  };
}

function claimWhere(input: IdempotencyClaimInput) {
  return {
    agencyId_keyIdentity_endpoint_idemKey: {
      agencyId: input.agencyId,
      keyIdentity: input.keyIdentity,
      endpoint: input.endpoint,
      idemKey: input.key,
    },
  };
}

export const idempotencyService = {
  fingerprintRequest,

  /**
   * Atomically claim the key. Returns 'claimed' when this caller owns the
   * business write, 'replay' with the stored result for an identical retry.
   * Throws IdempotencyInProgressError while the first call runs,
   * IdempotencyConflictError on body mismatch, IdempotencyExpiredError past
   * retention. Callers must re-check scope and tier before acting on replay.
   */
  async claim(input: IdempotencyClaimInput): Promise<IdempotencyClaimOutcome> {
    const now = input.now ?? new Date();
    try {
      const record = await prisma.idempotencyRecord.create({
        data: {
          agencyId: input.agencyId,
          keyIdentity: input.keyIdentity,
          endpoint: input.endpoint,
          idemKey: input.key,
          fingerprint: input.fingerprint,
          state: 'in_progress',
          expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        },
      });
      return {
        status: 'claimed',
        record: { id: record.id, state: record.state, statusCode: null, result: null },
      };
    } catch (error) {
      if (!isPrismaUniqueViolation(error)) throw error;
    }

    const existing = await prisma.idempotencyRecord.findUnique({ where: claimWhere(input) });
    if (!existing) {
      // Lost race with a concurrent purge; caller retries with the same key.
      throw new IdempotencyConflictError(
        'Idempotency key is already in use with a different request.',
      );
    }
    if (existing.expiresAt.getTime() <= now.getTime()) {
      throw new IdempotencyExpiredError(
        'Idempotency key has expired; retry with a fresh key.',
      );
    }
    if (existing.state === 'in_progress') {
      throw new IdempotencyInProgressError(
        'The first request with this idempotency key is still running.',
      );
    }
    if (existing.fingerprint !== input.fingerprint) {
      throw new IdempotencyConflictError(
        'Idempotency key is already in use with a different request.',
      );
    }
    return {
      status: 'replay',
      record: {
        id: existing.id,
        state: existing.state,
        statusCode: existing.statusCode,
        result: existing.result,
      },
    };
  },

  /** Store the business result; only the claim owner in_progress may complete. */
  async complete(input: { recordId: string; statusCode: number; result: unknown }): Promise<void> {
    const updated = await prisma.idempotencyRecord.updateMany({
      where: { id: input.recordId, state: 'in_progress' },
      data: { state: 'completed', statusCode: input.statusCode, result: input.result as Prisma.InputJsonValue },
    });
    if (updated.count !== 1) {
      throw new IdempotencyStateError('Idempotency record is no longer completable.');
    }
  },

  /** Terminally fail a claimed record; callers must use a fresh key next. */
  async fail(input: { recordId: string }): Promise<void> {
    const updated = await prisma.idempotencyRecord.updateMany({
      where: { id: input.recordId, state: 'in_progress' },
      data: { state: 'failed' },
    });
    if (updated.count !== 1) {
      throw new IdempotencyStateError('Idempotency record is no longer fail-able.');
    }
  },

  /**
   * Owned purge path. Deletes expired records but never in-progress claims,
   * so a slow first call is never collected mid-flight.
   */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const deleted = await prisma.idempotencyRecord.deleteMany({
      where: {
        expiresAt: { lte: now },
        state: { not: 'in_progress' },
      },
    });
    return deleted.count;
  },
};
