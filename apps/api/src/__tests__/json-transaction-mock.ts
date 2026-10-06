import { vi } from 'vitest';

/** Keeps JSON row reads and writes coherent across the real transaction callbacks. */
export function mockJsonTransactions(prisma: any, initialAssets: Record<string, unknown> = {}) {
  const metadata = new Map<string, unknown>();
  const assets = new Map<string, unknown>(Object.entries(initialAssets));
  const lastResult = async (method: any) => method?.mock?.results.at(-1)?.value;

  vi.mocked(prisma.$queryRaw).mockImplementation(async (query: any, ...values: unknown[]) => {
    const sql = (query.strings || query).join('');
    const id = String(query.values?.[0] ?? values[0]);
    if (sql.includes('platform_authorizations')) {
      const authorization = await lastResult(prisma.platformAuthorization.findUnique)
        || await lastResult(prisma.platformAuthorization.findFirst)
        || (await lastResult(prisma.platformAuthorization.findMany))?.find((row: any) => row.id === id);
      if (!authorization && !metadata.has(id)) return [];
      return [{ id, metadata: metadata.has(id) ? metadata.get(id) : authorization.metadata }];
    }
    const connection = await lastResult(prisma.clientConnection.findUnique);
    return [{ id, granted_assets: assets.has(id) ? assets.get(id) : connection?.grantedAssets || {} }];
  });

  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback({
    ...prisma,
    platformAuthorization: {
      ...prisma.platformAuthorization,
      update: async (args: any) => {
        const updated = await prisma.platformAuthorization.update(args);
        if ('metadata' in args.data) metadata.set(args.where.id, args.data.metadata);
        return updated;
      },
    },
    clientConnection: {
      ...prisma.clientConnection,
      update: async (args: any) => {
        const updated = await prisma.clientConnection.update(args);
        if ('grantedAssets' in args.data) assets.set(args.where.id, args.data.grantedAssets);
        return updated;
      },
    },
  }));
}
