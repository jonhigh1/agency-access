/**
 * Generic idempotency store for public v1 creates (KTD5; R7, R8).
 *
 * Identity is (agency, key family, endpoint, key value): a rotated
 * replacement key replays the original result instead of double-writing,
 * while different families never share stored results. The atomic claim is
 * a single insert against the composite unique guard; losers read the
 * winner row and replay or fail.
 *
 * Caller order (enforced by v1 routes in U5, not here): strict-validate,
 * fingerprint, atomic claim. Validation failures never reach claim, so they
 * never consume the key. Replay re-checks scope and tier at the route before
 * the stored result is returned. Business write plus stored result commit in
 * one Postgres transaction at the route; this service only owns the claim
 * row lifecycle.
 *
 * States: in_progress (first call running; stealable past the 15-minute
 * lease, collectible past expiry), completed (replayable until expiry),
 * failed (terminal; caller must use a fresh key). Retention is 72h; expired
 * keys fail with a distinct code and are never silently recreated.
 */
import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { MAX_ACTIVE_IDEMPOTENCY_RECORDS_PER_KEY } from '@/middleware/v1-gate.js';

/** Retention window for stored idempotent results (KTD5). */
export const IDEMPOTENCY_TTL_MS = 72 * 60 * 60 * 1000;

/** In-progress lease: a stuck first call becomes stealable past this age. */
export const IDEMPOTENCY_LEASE_MS = 15 * 60 * 1000;

/** Same key, finished, different body. */
export const IDEMPOTENCY_CONFLICT_CODE = 'IDEMPOTENCY_CONFLICT';
/** Same key, first call still running. */
export const IDEMPOTENCY_IN_PROGRESS_CODE = 'IDEMPOTENCY_IN_PROGRESS';
/** Same key, retention window passed. Never recreated silently. */
export const IDEMPOTENCY_EXPIRED_CODE = 'IDEMPOTENCY_KEY_EXPIRED';
/** Same identity holds too many live records. Back off and retry later. */
export const IDEMPOTENCY_LIMIT_CODE = 'IDEMPOTENCY_LIMIT_EXCEEDED';
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

export class IdempotencyLimitError extends Error {
  readonly code = IDEMPOTENCY_LIMIT_CODE;
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
  /** v1 API key family id. Rotation siblings share results; families never do. */
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
   * IdempotencyConflictError on body mismatch or on a terminally failed
   * record, IdempotencyExpiredError past retention, IdempotencyLimitError
   * past the per-identity live-record cap. Callers must re-check scope and
   * tier before acting on replay.
   */
  async claim(input: IdempotencyClaimInput): Promise<IdempotencyClaimOutcome> {
    const now = input.now ?? new Date();
    // Live-record cap per identity: too many unexpired rows means the
    // caller must back off, not mint another claim.
    const liveCount = await prisma.idempotencyRecord.count({
      where: {
        agencyId: input.agencyId,
        keyIdentity: input.keyIdentity,
        expiresAt: { gt: now },
      },
    });
    if (liveCount >= MAX_ACTIVE_IDEMPOTENCY_RECORDS_PER_KEY) {
      throw new IdempotencyLimitError(
        'Too many active idempotency keys for this identity; retry later with an expired key reclaimed.',
      );
    }
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
    if (existing.state === 'failed') {
      // Terminal: a failed record never replays (its result is null) and
      // never silently revives — the caller must use a fresh key.
      throw new IdempotencyConflictError(
        'Idempotency key failed terminally; retry with a fresh key.',
      );
    }
    if (existing.state === 'in_progress') {
      // Lease steal: a first call older than the lease is presumed stuck;
      // delete + fresh-claim in one transaction so exactly one owner wins.
      const createdAtMs = new Date(existing.createdAt).getTime();
      if (Number.isFinite(createdAtMs) && now.getTime() - createdAtMs > IDEMPOTENCY_LEASE_MS) {
        const record = await prisma.$transaction(async (tx: any) => {
          await tx.idempotencyRecord.delete({ where: { id: existing.id } });
          return tx.idempotencyRecord.create({
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
        });
        return {
          status: 'claimed',
          record: { id: record.id, state: record.state, statusCode: null, result: null },
        };
      }
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
   * Owned purge path. Deletes expired records in every state — including
   * in_progress rows past expiresAt, whose lease has necessarily lapsed —
   * so stuck claims never accumulate.
   */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const deleted = await prisma.idempotencyRecord.deleteMany({
      where: {
        expiresAt: { lte: now },
      },
    });
    return deleted.count;
  },
};
