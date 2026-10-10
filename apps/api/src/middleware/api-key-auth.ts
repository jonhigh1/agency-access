/**
 * API Key Authentication (public v1 credential plane).
 *
 * Parallel preHandler: verifies the bearer API key and attaches a
 * key-principal shape that never touches `request.user`. Dashboard paths use
 * Clerk `authenticate()` instead, so neither credential replays on the
 * other's path. Revocation is checked synchronously on every request.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  INVALID_API_KEY_CODE,
  assertKeyScope,
  verifyApiKey,
  type ApiKeyPrincipal,
  type ApiKeyScope,
} from '@/services/api-key.service';
import { extractClientIp } from '@/lib/ip.js';
import {
  V1_RATE_LIMITED_CODE,
  isV1AuthThrottled,
  noteV1AuthResult,
} from '@/middleware/v1-gate.js';
import { v1Error } from '@/lib/v1-envelope.js';
import type { V1ErrorCode } from '@/lib/v1-errors.js';

function denyKey(reply: FastifyReply) {
  return v1Error(reply, 401, INVALID_API_KEY_CODE, 'Invalid or missing API key');
}

function extractBearerKey(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.substring(7).trim();
  return token.length > 0 ? token : null;
}

/** v1 key gate: attach `request.apiKey`, never `request.user`. */
export function apiKeyPreHandler() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const presented = extractBearerKey(request);
    const ip = extractClientIp(request);
    const prefix =
      typeof presented === 'string' && presented.length >= 12
        ? presented.slice(0, 12)
        : 'unknown';
    // Brute-force bucket first: exhausted IP+prefix probes get 429 without
    // touching the verifier.
    if (isV1AuthThrottled(ip, prefix)) {
      return v1Error(reply, 429, V1_RATE_LIMITED_CODE as V1ErrorCode, 'Rate limit exceeded. Please try again later.');
    }
    const { principal } = await verifyApiKey(presented);
    if (!principal) {
      noteV1AuthResult(ip, presented, false);
      return denyKey(reply);
    }
    request.apiKey = principal as ApiKeyPrincipal;
  };
}

/** Route scope gate: deny-by-default, names the missing scope. */
export function requireKeyScope(scope: ApiKeyScope) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const principal = request.apiKey as ApiKeyPrincipal | undefined;
    if (!principal) {
      return denyKey(reply);
    }
    const scopeError = assertKeyScope(principal, scope);
    if (scopeError) {
      return v1Error(reply, 403, scopeError.code as V1ErrorCode, scopeError.message);
    }
  };
}
