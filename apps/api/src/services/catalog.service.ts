/**
 * Catalog Service: read slice projections.
 *
 * Projects catalog reads over internal connection tables:
 * - Connected accounts come from AgencyPlatformConnection rows, projected to
 *   a safe shape. Token material never lives in Postgres for these rows
 *   (OAuth tokens are in Infisical) and the `secretId` pointer plus OAuth
 *   scope stay internal-only — they are stripped here, never exposed.
 * - Per-connection asset detail reuses the webhook V2 asset normalizer
 *   (`normalizeGrantedAssetsToV2`) so catalog assets match webhook payloads.
 * - Requestable services project the shared PLATFORMS registry with the
 *   roles a request may ask for and the grant requirements to fulfill them.
 *
 * Keyset list paths for v1 clients/requests live here too: opaque
 * (createdAt, id) tuple comparison, never offset wrapping.
 */

import { PLATFORMS } from '@agency-platform/shared';
import { prisma } from '@/lib/prisma';
import { normalizeGrantedAssetsToV2 } from './webhook-event.service.js';

// ============================================================
// Connected accounts
// ============================================================

export interface CatalogAccount {
  id: string;
  platform: string;
  connectionMode: string;
  status: string;
  verificationStatus: string | null;
  connectedAt: string;
  assets?: unknown;
}

/**
 * Safe projection of an AgencyPlatformConnection row. Strips every secret
 * pointer (`secretId`), OAuth scope, and actor identity — none of these
 * cross the public contract.
 */
export function toSafeConnectionAccount(row: any): CatalogAccount {
  const grantedAssets =
    row?.metadata != null &&
    typeof row.metadata === 'object' &&
    !Array.isArray(row.metadata) &&
    typeof (row.metadata as Record<string, unknown>).grantedAssets === 'object' &&
    (row.metadata as Record<string, unknown>).grantedAssets !== null
      ? normalizeGrantedAssetsToV2(
          (row.metadata as Record<string, unknown>).grantedAssets as Record<string, unknown>,
          (row.status as any) ?? 'pending',
          String(row.platform ?? 'unknown'),
        )
      : undefined;

  return {
    id: String(row.id),
    platform: String(row.platform),
    connectionMode: String(row.connectionMode ?? 'oauth'),
    status: String(row.status),
    verificationStatus: row.verificationStatus ?? null,
    connectedAt: new Date(row.connectedAt).toISOString(),
    ...(grantedAssets ? { assets: grantedAssets } : {}),
  };
}

export async function listConnectedAccounts(agencyId: string): Promise<CatalogAccount[]> {
  const rows = await prisma.agencyPlatformConnection.findMany({
    where: { agencyId },
    select: {
      id: true,
      platform: true,
      connectionMode: true,
      status: true,
      verificationStatus: true,
      connectedAt: true,
      metadata: true,
    },
    orderBy: { connectedAt: 'desc' },
  });
  return rows.map(toSafeConnectionAccount);
}

// ============================================================
// Requestable services
// ============================================================

export interface CatalogServiceEntry {
  id: string;
  displayName: string;
  kind: string;
  /** Access levels a request may ask for on this service. */
  roles: Array<'manage' | 'view_only'>;
  grantRequirements: Record<string, unknown>;
}

const REQUESTABLE_ROLES = ['manage', 'view_only'] as const;

/** The PLATFORMS registry never changes at runtime; project it once. */
const MEMOIZED_SERVICES: CatalogServiceEntry[] = Object.entries(PLATFORMS as Record<string, any>)
  .filter(([, entry]) => entry?.kind !== 'legacy')
  .map(([id, entry]) => {
    const capabilities = entry?.capabilities as
      | { connectionMethod?: string; tokenKind?: string }
      | undefined;
    const grantRequirements: Record<string, unknown> =
      capabilities?.connectionMethod != null
        ? {
            connectionMethod: capabilities.connectionMethod,
            ...(capabilities.tokenKind ? { tokenKind: capabilities.tokenKind } : {}),
            clientAuthorizable: Boolean(entry.clientAuthorizable),
          }
        : {
            authorizesViaParent: (entry as { parent?: string }).parent ?? null,
            clientAuthorizable: false,
          };
    return {
      id,
      displayName: String(entry.displayName ?? id),
      kind: String(entry.kind),
      roles: [...REQUESTABLE_ROLES],
      grantRequirements,
    };
  });

export function listServices(): CatalogServiceEntry[] {
  return MEMOIZED_SERVICES;
}

// ============================================================
// Opaque keyset cursors
// ============================================================

export interface KeysetCursor {
  createdAt: string;
  id: string;
}

export function encodeKeysetCursor(createdAt: Date | string, id: string): string {
  const iso = createdAt instanceof Date ? createdAt.toISOString() : createdAt;
  return Buffer.from(JSON.stringify({ createdAt: iso, id })).toString('base64url');
}

/** Returns null when the cursor is missing; throws CursorError when malformed. */
export class CursorError extends Error {
  code = 'INVALID_CURSOR' as const;
}

export function decodeKeysetCursor(cursor: string | undefined): KeysetCursor | null {
  if (cursor == null || cursor === '') return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (
      parsed == null ||
      typeof parsed !== 'object' ||
      typeof (parsed as Record<string, unknown>).createdAt !== 'string' ||
      typeof (parsed as Record<string, unknown>).id !== 'string' ||
      Number.isNaN(Date.parse((parsed as { createdAt: string }).createdAt))
    ) {
      throw new CursorError('Malformed pagination cursor');
    }
    return parsed as KeysetCursor;
  } catch (error) {
    if (error instanceof CursorError) throw error;
    throw new CursorError('Malformed pagination cursor');
  }
}

/** Tuple comparison for (createdAt DESC, id DESC) page order. */
function keysetOr(createdAtIso: string, id: string) {
  const createdAt = new Date(createdAtIso);
  return [
    { createdAt: { lt: createdAt } },
    { createdAt: { equals: createdAt }, id: { lt: id } },
  ];
}

export interface KeysetPage<T> {
  rows: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Slice a limit+1 keyset fetch into its page: extras become the cursor. */
export function toKeysetPage<T extends { createdAt: Date | string; id: string }>(
  rows: T[],
  limit: number,
): KeysetPage<T> {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    rows: page,
    nextCursor: hasMore && last ? encodeKeysetCursor(last.createdAt, last.id) : null,
    hasMore,
  };
}

export async function listClientsKeyset(input: {
  agencyId: string;
  limit: number;
  cursor?: KeysetCursor | null;
  email?: string;
}): Promise<KeysetPage<any>> {
  const where: Record<string, unknown> = { agencyId: input.agencyId };
  if (input.email) where.email = input.email;
  if (input.cursor) where.OR = keysetOr(input.cursor.createdAt, input.cursor.id);

  const rows = await prisma.client.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: input.limit + 1,
  });

  return toKeysetPage(rows, input.limit);
}

export async function listRequestsKeyset(input: {
  agencyId: string;
  limit: number;
  cursor?: KeysetCursor | null;
  status?: string;
}): Promise<KeysetPage<any>> {
  const where: Record<string, unknown> = { agencyId: input.agencyId };
  if (input.status) where.status = input.status;
  if (input.cursor) where.OR = keysetOr(input.cursor.createdAt, input.cursor.id);

  const rows = await prisma.accessRequest.findMany({
    where,
    // Never select uniqueToken: it is a bearer credential for the client
    // authorization flow and must not cross the public contract.
    select: {
      id: true,
      agencyId: true,
      clientId: true,
      clientName: true,
      clientEmail: true,
      externalReference: true,
      platforms: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      authorizedAt: true,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: input.limit + 1,
  });

  return toKeysetPage(rows, input.limit);
}

export const catalogService = {
  listConnectedAccounts,
  listServices,
  listClientsKeyset,
  listRequestsKeyset,
  encodeKeysetCursor,
  decodeKeysetCursor,
  toSafeConnectionAccount,
};
