import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { prisma } from '../prisma.js';
import { updateAuthorizationMetadata } from '../authorization-metadata.js';

describe('updateAuthorizationMetadata', () => {
  beforeEach(() => vi.resetAllMocks());

  it('serializes sibling metadata updates against the row locked in the transaction', async () => {
    let storedMetadata: Record<string, unknown> = {};
    let transactionTail = Promise.resolve();

    vi.mocked(prisma.$transaction).mockImplementation((callback: any) => {
      const run = transactionTail.then(() => callback({
        $queryRaw: vi.fn(async () => [{ id: 'auth-1', metadata: storedMetadata }]),
        platformAuthorization: {
          update: vi.fn(async ({ data }: any) => {
            storedMetadata = data.metadata;
            return { id: 'auth-1', metadata: storedMetadata };
          }),
        },
      }));
      transactionTail = run.then(() => undefined, () => undefined);
      return run;
    });

    await Promise.all([
      updateAuthorizationMetadata('auth-1', (current) => ({
        ...current,
        selectedAssets: { meta_ads: { adAccounts: ['act-1'] } },
      })),
      updateAuthorizationMetadata('auth-1', (current) => ({
        ...current,
        meta: { discovery: { availableBusinesses: [{ id: 'biz-1', name: 'Acme' }] } },
      })),
    ]);

    expect(storedMetadata).toEqual({
      selectedAssets: { meta_ads: { adAccounts: ['act-1'] } },
      meta: { discovery: { availableBusinesses: [{ id: 'biz-1', name: 'Acme' }] } },
    });
  });

  it('rejects when the authorization does not exist', async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback({
      $queryRaw: vi.fn(async () => []),
      platformAuthorization: { update: vi.fn() },
    }));

    await expect(updateAuthorizationMetadata('missing', (current) => current))
      .rejects.toThrow('Platform authorization missing not found');
  });
});
