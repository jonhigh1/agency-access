/**
 * API Key Authentication (public v1 credential plane)
 *
 * Parallel preHandler per KTD2: verifies the bearer API key and attaches a
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
} from '@/services/api-key.service';
import { v1Error } from '@/lib/v1-envelope.js';

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
    const { principal } = await verifyApiKey(presented);
    if (!principal) {
      return denyKey(reply);
    }
    (request as any).apiKey = principal as ApiKeyPrincipal;
  };
}

/** Route scope gate: deny-by-default, names the missing scope (R2, AE4). */
export function requireKeyScope(scope: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const principal = (request as any).apiKey as ApiKeyPrincipal | undefined;
    if (!principal) {
      return denyKey(reply);
    }
    const scopeError = assertKeyScope(principal, scope);
    if (scopeError) {
      return v1Error(reply, 403, scopeError.code, scopeError.message);
    }
  };
}
