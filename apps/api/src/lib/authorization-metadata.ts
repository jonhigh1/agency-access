import type { Prisma, PlatformAuthorization } from '@prisma/client';
import { prisma } from './prisma.js';

type AuthorizationMetadata = Record<string, unknown>;

function asAuthorizationMetadata(metadata: unknown): AuthorizationMetadata {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? { ...(metadata as AuthorizationMetadata) }
    : {};
}

export async function updateAuthorizationMetadata(
  authorizationId: string,
  update: (current: AuthorizationMetadata) => AuthorizationMetadata | undefined,
  status?: string
): Promise<PlatformAuthorization | null> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; metadata: Prisma.JsonValue | null }>>`
      SELECT "id", "metadata"
      FROM "platform_authorizations"
      WHERE "id" = ${authorizationId}
      FOR UPDATE
    `;
    const authorization = rows[0];
    if (!authorization) throw new Error(`Platform authorization ${authorizationId} not found`);

    const current = asAuthorizationMetadata(authorization.metadata);
    const metadata = update(current);
    if (!metadata) return null;
    return tx.platformAuthorization.update({
      where: { id: authorizationId },
      data: { metadata: metadata as Prisma.InputJsonValue, ...(status ? { status } : {}) },
    });
  });
}
