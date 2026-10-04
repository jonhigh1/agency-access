import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

type GrantedAssets = Record<string, unknown>;

export async function updateGrantedAssets(
  connectionId: string,
  update: (current: GrantedAssets) => Prisma.InputJsonValue
) {
  return prisma.$transaction(async (tx) => {
    const [connection] = await tx.$queryRaw<Array<{ id: string; granted_assets: Prisma.JsonValue | null }>>(
      Prisma.sql`SELECT id, granted_assets FROM "client_connections" WHERE id = ${connectionId} FOR UPDATE`
    );
    if (!connection) return null;

    const current = connection.granted_assets &&
      typeof connection.granted_assets === 'object' &&
      !Array.isArray(connection.granted_assets)
      ? connection.granted_assets as GrantedAssets
      : {};

    return tx.clientConnection.update({
      where: { id: connectionId },
      data: { grantedAssets: update(current) },
    });
  });
}
