/**
 * API Key Service (public v1 credential plane)
 *
 * Secrets are stored as HMAC-SHA256 hashes under a versioned server pepper.
 * Only hashes land in Postgres; raw secrets are returned once at issuance.
 *
 * Pepper rotation path: set API_KEY_PEPPER to the new value and keep the old
 * value in API_KEY_PEPPER_PREVIOUS. Keys carrying the previous pepperVersion
 * still verify; they adopt the current pepper on their next rotation.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auditService } from '@/services/audit.service';
import type { ServiceResult } from '@/lib/service-result';
import type { V1ErrorCode } from '@/lib/v1-errors';

export const API_KEY_SCOPES = [
  'clients:read',
  'clients:write',
  'requests:read',
  'requests:write',
  'catalog:read',
  'usage:read',
  'webhooks:read',
  'webhooks:write',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

/** Adjustable default cap; raisable without contract change. */
export const MAX_API_KEYS_PER_AGENCY = 10;
/** Max simultaneously active keys sharing one rotation family. */
export const MAX_ACTIVE_KEYS_PER_FAMILY = 2;
/** Dual-active overlap window for rotation. */
export const ROTATION_OVERLAP_MS = 24 * 60 * 60 * 1000;

/** Minimum age of a stored lastUsedAt before it is rewritten. */
const LAST_USED_AT_WRITE_MS = 5 * 60 * 1000;

/** Single external code for every key verification failure. */
export const INVALID_API_KEY_CODE = 'INVALID_API_KEY';

export const KEY_PREFIX = 'ah_live_';
const RANDOM_BYTES = 32;

const ScopeArraySchema = z.array(z.string()).default([]);

export interface ApiKeyPrincipal {
  keyId: string;
  agencyId: string;
  familyId: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
}

export interface ApiKeyMetadata {
  id: string;
  agencyId: string;
  familyId: string;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  isActive: boolean;
}

export type KeyVerifyReason =
  | 'ok'
  | 'missing'
  | 'malformed'
  | 'no-match'
  | 'revoked'
  | 'expired'
  | 'unknown-agency';

function getPepper(version: number): string | null {
  if (version === currentPepperVersion()) return process.env.API_KEY_PEPPER ?? null;
  if (version === currentPepperVersion() - 1) return process.env.API_KEY_PEPPER_PREVIOUS ?? null;
  return null;
}

export function currentPepperVersion(): number {
  const parsed = Number.parseInt(process.env.API_KEY_PEPPER_VERSION ?? '1', 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

function hashWithPepper(secret: string, pepper: string): Buffer {
  return createHmac('sha256', pepper).update(secret, 'utf8').digest();
}

function buildSecret(): { secret: string; prefix: string } {
  const secret = `${KEY_PREFIX}${randomBytes(RANDOM_BYTES).toString('base64url')}`;
  return { secret, prefix: secret.slice(0, 12) };
}

function toMetadata(row: any): ApiKeyMetadata {
  const now = new Date();
  const isActive =
    row.revokedAt == null && (row.expiresAt == null || new Date(row.expiresAt) > now);
  return {
    id: row.id,
    agencyId: row.agencyId,
    familyId: row.familyId,
    name: row.name,
    prefix: row.prefix,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    createdBy: row.createdBy,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt ?? row.createdAt).toISOString(),
    lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : null,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
    revokedAt: row.revokedAt ? new Date(row.revokedAt).toISOString() : null,
    isActive,
  };
}

function validateScopes(scopes: string[]): ApiKeyScope[] | { unknownScope: string } {
  const allowed = new Set<string>(API_KEY_SCOPES);
  for (const scope of scopes) {
    if (!allowed.has(scope)) return { unknownScope: scope };
  }
  return scopes as ApiKeyScope[];
}

function auditMetadata(row: any): Record<string, unknown> {
  // Never log secret or hash material: identifiers and scopes only.
  return {
    keyId: row.id,
    keyPrefix: row.prefix,
    familyId: row.familyId,
    name: row.name,
    scopes: row.scopes,
  };
}

export async function issueApiKey(input: {
  agencyId: string;
  name: string;
  scopes: string[];
  createdBy: string;
}): Promise<ServiceResult<{ key: ApiKeyMetadata; apiKey: string }>> {
  const pepper = process.env.API_KEY_PEPPER;
  if (!pepper) {
    return {
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'API key issuance is not configured' },
    };
  }

  const parsed = ScopeArraySchema.safeParse(input.scopes);
  if (!parsed.success || typeof input.name !== 'string' || input.name.trim().length === 0) {
    return {
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Key name and scopes are required' },
    };
  }
  const scopesOrError = validateScopes(parsed.data);
  if (!Array.isArray(scopesOrError)) {
    return {
      data: null,
      error: { code: 'VALIDATION_ERROR', message: `Unknown scope: ${scopesOrError.unknownScope}` },
    };
  }

  try {
    const activeCount = await prisma.apiKey.count({
      where: { agencyId: input.agencyId, revokedAt: null },
    });
    if (activeCount >= MAX_API_KEYS_PER_AGENCY) {
      return {
        data: null,
        error: {
          code: 'API_KEY_LIMIT_EXCEEDED',
          message: `Agency key limit reached (${MAX_API_KEYS_PER_AGENCY} keys)`,
        },
      };
    }

    const { secret, prefix } = buildSecret();
    const row = await prisma.apiKey.create({
      data: {
        agencyId: input.agencyId,
        familyId: crypto.randomUUID(),
        name: input.name.trim(),
        prefix,
        keyHash: hashWithPepper(secret, pepper).toString('hex'),
        pepperVersion: currentPepperVersion(),
        scopes: scopesOrError,
        createdBy: input.createdBy,
      },
    });

    await auditService.createAuditLog({
      agencyId: input.agencyId,
      userEmail: input.createdBy,
      action: 'API_KEY_ISSUED',
      resourceType: 'api_key',
      resourceId: row.id,
      metadata: auditMetadata(row),
    });

    return { data: { key: toMetadata(row), apiKey: secret }, error: null };
  } catch {
    return { data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to issue API key' } };
  }
}

export async function listApiKeys(
  agencyId: string
): Promise<ServiceResult<{ keys: ApiKeyMetadata[] }>> {
  try {
    const rows = await prisma.apiKey.findMany({
      where: { agencyId },
      orderBy: { createdAt: 'desc' },
    });
    return { data: { keys: rows.map(toMetadata) }, error: null };
  } catch {
    return { data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to list API keys' } };
  }
}

export async function revokeApiKey(input: {
  agencyId: string;
  keyId: string;
  revokedBy: string;
}): Promise<ServiceResult<{ revoked: boolean }>> {
  try {
    const existing = await prisma.apiKey.findFirst({
      where: { id: input.keyId, agencyId: input.agencyId },
    });
    if (!existing) {
      return { data: null, error: { code: 'NOT_FOUND', message: 'API key not found' } };
    }
    if (existing.revokedAt != null) {
      return { data: { revoked: true }, error: null };
    }

    await prisma.apiKey.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), revokedBy: input.revokedBy },
    });

    await auditService.createAuditLog({
      agencyId: input.agencyId,
      userEmail: input.revokedBy,
      action: 'API_KEY_REVOKED',
      resourceType: 'api_key',
      resourceId: existing.id,
      metadata: auditMetadata(existing),
    });

    return { data: { revoked: true }, error: null };
  } catch {
    return { data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke API key' } };
  }
}

export async function rotateApiKey(input: {
  agencyId: string;
  keyId: string;
  rotatedBy: string;
  name?: string;
}): Promise<ServiceResult<{ key: ApiKeyMetadata; apiKey: string }>> {
  const pepper = process.env.API_KEY_PEPPER;
  if (!pepper) {
    return {
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'API key rotation is not configured' },
    };
  }

  try {
    const existing = await prisma.apiKey.findFirst({
      where: { id: input.keyId, agencyId: input.agencyId },
    });
    if (!existing) {
      return { data: null, error: { code: 'NOT_FOUND', message: 'API key not found' } };
    }
    if (existing.revokedAt != null) {
      return {
        data: null,
        error: { code: 'API_KEY_REVOKED', message: 'Revoked keys cannot be rotated' },
      };
    }

    const actives = await prisma.apiKey.findMany({
      where: { familyId: existing.familyId, revokedAt: null },
      select: { id: true, expiresAt: true },
    });
    const stillActive = actives.filter(
      (row: any) => row.expiresAt == null || new Date(row.expiresAt) > new Date()
    );
    if (stillActive.length >= MAX_ACTIVE_KEYS_PER_FAMILY) {
      return {
        data: null,
        error: {
          code: 'API_KEY_FAMILY_LIMIT',
          message: 'Key family already has two active keys',
        },
      };
    }

    const { secret, prefix } = buildSecret();
    const replacement = await prisma.apiKey.create({
      data: {
        agencyId: existing.agencyId,
        familyId: existing.familyId,
        name: input.name?.trim() || `${existing.name} (rotated)`,
        prefix,
        keyHash: hashWithPepper(secret, pepper).toString('hex'),
        pepperVersion: currentPepperVersion(),
        scopes: existing.scopes,
        createdBy: input.rotatedBy,
      },
    });

    // Dual-active overlap: the old key stays valid 24h, then expires.
    const overlapExpiry = new Date(Date.now() + ROTATION_OVERLAP_MS);
    const effectiveExpiry =
      existing.expiresAt != null && new Date(existing.expiresAt) < overlapExpiry
        ? new Date(existing.expiresAt)
        : overlapExpiry;
    await prisma.apiKey.update({
      where: { id: existing.id },
      data: { expiresAt: effectiveExpiry },
    });

    await auditService.createAuditLog({
      agencyId: existing.agencyId,
      userEmail: input.rotatedBy,
      action: 'API_KEY_ROTATED',
      resourceType: 'api_key',
      resourceId: replacement.id,
      metadata: { ...auditMetadata(replacement), replacesKeyId: existing.id },
    });

    return { data: { key: toMetadata(replacement), apiKey: secret }, error: null };
  } catch {
    return { data: null, error: { code: 'INTERNAL_ERROR', message: 'Failed to rotate API key' } };
  }
}

/** Family-wide kill switch: revokes every active key in the family at once. */
export async function revokeApiKeyFamily(input: {
  agencyId: string;
  familyId: string;
  revokedBy: string;
}): Promise<ServiceResult<{ revokedCount: number }>> {
  try {
    const existing = await prisma.apiKey.findFirst({
      where: { familyId: input.familyId, agencyId: input.agencyId },
    });
    if (!existing) {
      return { data: null, error: { code: 'NOT_FOUND', message: 'API key family not found' } };
    }

    const result = await prisma.apiKey.updateMany({
      where: { familyId: input.familyId, agencyId: input.agencyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedBy: input.revokedBy },
    });

    await auditService.createAuditLog({
      agencyId: input.agencyId,
      userEmail: input.revokedBy,
      action: 'API_KEY_FAMILY_REVOKED',
      resourceType: 'api_key_family',
      resourceId: input.familyId,
      metadata: { familyId: input.familyId, revokedCount: result.count },
    });

    return { data: { revokedCount: result.count }, error: null };
  } catch {
    return {
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke API key family' },
    };
  }
}

/**
 * Verify a presented secret. Returns the principal plus a distinct internal
 * reason; callers collapse every non-ok reason to one external code.
 * Never creates an agency row: unknown agencies fail closed.
 */
export async function verifyApiKey(
  presented: string | undefined | null
): Promise<{ principal: ApiKeyPrincipal | null; reason: KeyVerifyReason }> {
  if (!presented) return { principal: null, reason: 'missing' };
  if (typeof presented !== 'string' || !presented.startsWith(KEY_PREFIX)) {
    return { principal: null, reason: 'malformed' };
  }

  const prefix = presented.slice(0, 12);
  const candidates = await prisma.apiKey.findMany({
    where: { prefix },
    select: {
      id: true,
      agencyId: true,
      familyId: true,
      prefix: true,
      scopes: true,
      keyHash: true,
      pepperVersion: true,
      revokedAt: true,
      expiresAt: true,
      lastUsedAt: true,
    },
  });
  let matched: any = null;
  for (const candidate of candidates) {
    const pepper = getPepper(candidate.pepperVersion);
    if (!pepper) continue;
    const expected = hashWithPepper(presented, pepper);
    let stored: Buffer;
    try {
      stored = Buffer.from(candidate.keyHash, 'hex');
    } catch {
      continue;
    }
    if (stored.length === expected.length && timingSafeEqual(stored, expected)) {
      matched = candidate;
      break;
    }
  }
  if (!matched) return { principal: null, reason: 'no-match' };
  if (matched.revokedAt != null) return { principal: null, reason: 'revoked' };
  if (matched.expiresAt != null && new Date(matched.expiresAt) <= new Date()) {
    return { principal: null, reason: 'expired' };
  }

  // Lookup only: agency auto-creation is bypassed on the key path.
  const agency = await prisma.agency.findUnique({ where: { id: matched.agencyId } });
  if (!agency) return { principal: null, reason: 'unknown-agency' };

  // lastUsedAt is advisory: rewrite it only when unset or stale so steady
  // traffic does not write on every request.
  const lastUsedMs = matched.lastUsedAt ? new Date(matched.lastUsedAt).getTime() : 0;
  if (!matched.lastUsedAt || Date.now() - lastUsedMs >= LAST_USED_AT_WRITE_MS) {
    void Promise.resolve(
      prisma.apiKey.update({ where: { id: matched.id }, data: { lastUsedAt: new Date() } })
    ).catch(() => undefined);
  }

  return {
    principal: {
      keyId: matched.id,
      agencyId: matched.agencyId,
      familyId: matched.familyId,
      keyPrefix: matched.prefix,
      scopes: Array.isArray(matched.scopes) ? matched.scopes : [],
    },
    reason: 'ok',
  };
}

/**
 * Service-entry scope re-check: every service behind a scoped v1 route
 * calls this with the key principal before doing work. Returns null when the
 * scope is present, otherwise the stable capability error.
 */
export function assertKeyScope(
  principal: Pick<ApiKeyPrincipal, 'scopes'> | null | undefined,
  required: ApiKeyScope | string
): { code: V1ErrorCode; message: string } | null {
  const scopes = principal?.scopes ?? [];
  if (scopes.includes(required as ApiKeyScope)) return null;
  return {
    code: 'MISSING_SCOPE',
    message: `Missing required scope: ${required}`,
  };
}

export const apiKeyService = {
  issueApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  revokeApiKeyFamily,
  verifyApiKey,
  assertKeyScope,
};
