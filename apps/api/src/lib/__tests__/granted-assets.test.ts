import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { updateGrantedAssets } from '../granted-assets.js';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

describe('updateGrantedAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('locks then updates from the latest granted assets', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'connection-1' });
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'connection-1', granted_assets: { sibling: { id: 'keep' } } }]),
      clientConnection: { update },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx));

    await updateGrantedAssets('connection-1', (current) => ({
      ...current,
      meta: { status: 'verified' },
    }));

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'connection-1' },
      data: {
        grantedAssets: {
          sibling: { id: 'keep' },
          meta: { status: 'verified' },
        },
      },
    });
  });
});
