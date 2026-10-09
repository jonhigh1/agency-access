/**
 * v1 Gate: read-aware tier gate plus per-key rate limits.
 *
 * Every v1 call, reads included, passes entitlement and per-key throttling.
 * The tier check lives in the service layer keyed off the key's agency,
 * fail-closed with a per-request re-check, and is never the GET-skipping
 * dashboard quota middleware.
 *
 * Rate-limit contract (published limits, standard headers, retry contract):
 * - The per-key limiter in this module is the ONE authoritative limiter for
 *   v1 traffic. The global IP limiter must skip the v1 prefix via
 *   shouldSkipGlobalLimiter(url) so v1 traffic never double-counts.
 * - Uniform consumption rule: budget is consumed only after tier, scope,
 *   and validation all pass. Every denial before the consumption point
 *   (tier, pre-check, scope, validation, idempotency-claim failure) burns
 *   nothing. Reads run tier -> peek -> scope -> consume; idempotent writes
 *   run tier -> peek -> scope, then consume inside the handler after strict
 *   validation passes.
 * - Pre-check runs before validation; consume runs after validation
 *   (preCheckV1RateLimit / consumeV1RateLimit). The bundled
 *   v1RateLimitPreHandler consumes in one step for routes that own no later
 *   consumption point; read-style routes prefer the split pair
 *   v1RatePreCheckHandler / v1RateConsumeHandler around the scope gate.
 * - Every gated response carries X-RateLimit-Limit (and Remaining once the
 *   budget is touched); 429s add Retry-After.
 * - Bad-key attempts throttle in a separate, stricter bucket keyed by
 *   IP + key prefix.
 * - MAX_ACTIVE_IDEMPOTENCY_RECORDS_PER_KEY caps live idempotency records
 *   per key; enforced by the idempotency store.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  V1_ENTITLED_SUBSCRIPTION_STATUSES,
  checkV1TierEntitlement,
} from '@/services/quota.service.js';
import type { ApiKeyPrincipal } from '@/services/api-key.service.js';
import { v1Error } from '@/lib/v1-envelope.js';

export { V1_ENTITLED_SUBSCRIPTION_STATUSES };

/** Distinct tier-denial code: names the plan gate, not the scope. */
export const V1_TIER_DENIED_CODE = 'TIER_ACCESS_DENIED';
/** Fail-closed outage code: tier could not be verified, retry later. */
export const V1_TIER_UNAVAILABLE_CODE = 'TIER_CHECK_UNAVAILABLE';
/** 429 code, shared with the global limiter for one retry contract. */
export const V1_RATE_LIMITED_CODE = 'RATE_LIMIT_EXCEEDED';

/** Published per-key budget: 100 requests per 60s sliding window. */
export const V1_RATE_LIMIT_MAX_REQUESTS = 100;
export const V1_RATE_LIMIT_WINDOW_SECONDS = 60;
/** Stricter brute-force bucket for auth failures: 10 per 60s per IP+prefix. */
export const V1_AUTH_FAILURE_MAX_REQUESTS = 10;
export const V1_AUTH_FAILURE_WINDOW_SECONDS = 60;
/** Adjustable default cap on live idempotency records per key (enforced U4). */
export const MAX_ACTIVE_IDEMPOTENCY_RECORDS_PER_KEY = 100;

/** v1 prefix exempt from the global IP limiter (no double-count). */
export const V1_RATE_LIMIT_PREFIX = '/api/v1';

/**
 * URL-prefix predicate for the global IP limiter: return true to skip
 * global counting for v1 traffic, which the per-key limiter owns.
 */
export function shouldSkipGlobalLimiter(url: string): boolean {
  return url === V1_RATE_LIMIT_PREFIX || url.startsWith(`${V1_RATE_LIMIT_PREFIX}/`);
}

// ============================================================
// In-memory sliding-window stores (per-process; DB-backed budgets
// remain the dashboard path — v1 keys are capped without new tables)
// ============================================================

const rateBuckets = new Map<string, number[]>();
const authFailureBuckets = new Map<string, number[]>();

/** Upper bound on tracked keys per bucket map; oversized maps get swept. */
const MAX_BUCKET_KEYS = 10000;

function prune(bucket: number[], now: number, windowMs: number): number[] {
  const cutoff = now - windowMs;
  return bucket.filter((ts) => ts > cutoff);
}

/** Keep only live entries; drop the key entirely when nothing remains. */
function storePruned(store: Map<string, number[]>, key: string, pruned: number[]): void {
  if (pruned.length === 0) {
    store.delete(key);
  } else {
    store.set(key, pruned);
  }
}

/** Drop expired entries across all keys; runs only when the map is oversized. */
function sweepBuckets(store: Map<string, number[]>, windowMs: number, now: number): void {
  for (const [key, bucket] of store) {
    const pruned = prune(bucket, now, windowMs);
    if (pruned.length === 0) {
      store.delete(key);
    } else if (pruned.length !== bucket.length) {
      store.set(key, pruned);
    }
  }
}

function sweepIfOversized(store: Map<string, number[]>, windowMs: number, now: number): void {
  if (store.size > MAX_BUCKET_KEYS) sweepBuckets(store, windowMs, now);
}

export interface V1RateCheck {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

function checkAndConsume(
  store: Map<string, number[]>,
  key: string,
  max: number,
  windowMs: number,
  now: number = Date.now()
): V1RateCheck {
  sweepIfOversized(store, windowMs, now);
  const pruned = prune(store.get(key) ?? [], now, windowMs);
  if (pruned.length >= max) {
    const oldest = pruned[0];
    store.set(key, pruned);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }
  pruned.push(now);
  store.set(key, pruned);
  return { allowed: true, remaining: max - pruned.length, retryAfterSeconds: 0 };
}

function peek(
  store: Map<string, number[]>,
  key: string,
  max: number,
  windowMs: number,
  now: number = Date.now()
): V1RateCheck {
  sweepIfOversized(store, windowMs, now);
  const pruned = prune(store.get(key) ?? [], now, windowMs);
  storePruned(store, key, pruned);
  if (pruned.length >= max) {
    const oldest = pruned[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }
  return { allowed: true, remaining: max - pruned.length, retryAfterSeconds: 0 };
}

/** Pre-check before validation: does not consume budget. */
export function preCheckV1RateLimit(keyId: string, now: number = Date.now()): V1RateCheck {
  return peek(rateBuckets, keyId, V1_RATE_LIMIT_MAX_REQUESTS, V1_RATE_LIMIT_WINDOW_SECONDS * 1000, now);
}

/** Consume after validation passes. Also serves read-style routes directly. */
export function consumeV1RateLimit(keyId: string, now: number = Date.now()): V1RateCheck {
  return checkAndConsume(
    rateBuckets,
    keyId,
    V1_RATE_LIMIT_MAX_REQUESTS,
    V1_RATE_LIMIT_WINDOW_SECONDS * 1000,
    now
  );
}

/** Record a failed key verification for the brute-force bucket. */
export function recordV1AuthFailure(ip: string, keyPrefix: string, now: number = Date.now()): void {
  checkAndConsume(
    authFailureBuckets,
    `${ip}:${keyPrefix}`,
    V1_AUTH_FAILURE_MAX_REQUESTS,
    V1_AUTH_FAILURE_WINDOW_SECONDS * 1000,
    now
  );
}

/** True when this IP+prefix bucket exhausted its stricter budget. */
export function isV1AuthThrottled(ip: string, keyPrefix: string, now: number = Date.now()): boolean {
  return !peek(
    authFailureBuckets,
    `${ip}:${keyPrefix}`,
    V1_AUTH_FAILURE_MAX_REQUESTS,
    V1_AUTH_FAILURE_WINDOW_SECONDS * 1000,
    now
  ).allowed;
}

/**
 * Convenience for the auth layer: on a failed verification, record the
 * attempt under the caller's IP plus the presented key's prefix (first 12
 * chars, matching prefix indexing; falls back to 'unknown' when the
 * presented value has no usable prefix so malformed probes share one
 * bucket per IP instead of escaping it).
 */
export function noteV1AuthResult(
  ip: string,
  presented: string | null | undefined,
  ok: boolean,
  now: number = Date.now()
): void {
  if (ok) return;
  const prefix =
    typeof presented === 'string' && presented.length >= 12 ? presented.slice(0, 12) : 'unknown';
  recordV1AuthFailure(ip, prefix, now);
}

export function resetV1RateLimits(): void {
  rateBuckets.clear();
}

export function resetV1AuthFailures(): void {
  authFailureBuckets.clear();
}

function principalOf(request: FastifyRequest): ApiKeyPrincipal | undefined {
  return request.apiKey;
}

export function rateHeaders(reply: FastifyReply, remaining: number): void {
  reply.header('X-RateLimit-Limit', String(V1_RATE_LIMIT_MAX_REQUESTS));
  reply.header('X-RateLimit-Remaining', String(remaining));
}

/**
 * Service-layer tier gate off the key's agency. Reads included —
 * never the GET-skipping dashboard middleware. Per-request re-check; no
 * cache in front. Fail-closed: store/provider outage → 503.
 */
export function v1TierGate() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const principal = principalOf(request);
    if (!principal) return;
    const result = await checkV1TierEntitlement(principal.agencyId);
    reply.header('X-RateLimit-Limit', String(V1_RATE_LIMIT_MAX_REQUESTS));
    if (result.unavailable) {
      return v1Error(
        reply,
        503,
        V1_TIER_UNAVAILABLE_CODE,
        'Unable to verify API access for this plan. Please try again later.',
      );
    }
    if (!result.entitled) {
      return v1Error(reply, 403, V1_TIER_DENIED_CODE, 'API access requires a paid plan or active trial.');
    }
  };
}

/**
 * Per-key rate pre-check + consume with standard headers on every gated
 * response and Retry-After on 429.
 */
export function v1RateLimitPreHandler() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const principal = principalOf(request);
    if (!principal) return;
    const check = consumeV1RateLimit(principal.keyId);
    rateHeaders(reply, check.remaining);
    if (!check.allowed) {
      reply.header('Retry-After', String(check.retryAfterSeconds));
      return v1Error(reply, 429, V1_RATE_LIMITED_CODE, 'Rate limit exceeded. Please try again later.');
    }
  };
}

/**
 * Peek half of the split gate for reads: tier -> peek -> scope -> consume.
 * Denied here burns nothing.
 */
export function v1RatePreCheckHandler() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const principal = principalOf(request);
    if (!principal) return;
    const check = preCheckV1RateLimit(principal.keyId);
    rateHeaders(reply, check.remaining);
    if (!check.allowed) {
      reply.header('Retry-After', String(check.retryAfterSeconds));
      return v1Error(reply, 429, V1_RATE_LIMITED_CODE, 'Rate limit exceeded. Please try again later.');
    }
  };
}

/**
 * Consume half of the split gate: runs after the scope gate, so
 * scope-denied reads never touch the budget.
 */
export function v1RateConsumeHandler() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const principal = principalOf(request);
    if (!principal) return;
    const check = consumeV1RateLimit(principal.keyId);
    rateHeaders(reply, check.remaining);
    if (!check.allowed) {
      reply.header('Retry-After', String(check.retryAfterSeconds));
      return v1Error(reply, 429, V1_RATE_LIMITED_CODE, 'Rate limit exceeded. Please try again later.');
    }
  };
}
