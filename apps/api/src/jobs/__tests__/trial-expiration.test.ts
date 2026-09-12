import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    agency: {
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { expireTrials } from '../trial-expiration';

describe('expireTrials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
    vi.mocked(prisma.subscription.findUnique).mockImplementation(async ({ where }: any) => ({
      id: where.id,
      agencyId: 'agency-1',
      status: 'trialing',
      tier: 'STARTER',
      trialEnd: new Date('2026-02-20T00:00:00Z'),
      cancelAtPeriodEnd: false,
    }) as any);
  });

  it('should downgrade expired trialing subscriptions to FREE', async () => {
    const expiredSub = {
      id: 'sub-1',
      agencyId: 'agency-1',
      tier: 'STARTER',
      status: 'trialing',
      trialEnd: new Date('2026-02-20T00:00:00Z'), // In the past
    };

    vi.mocked(prisma.subscription.findMany).mockResolvedValue([expiredSub] as any);
    vi.mocked(prisma.subscription.update).mockResolvedValue({} as any);
    vi.mocked(prisma.agency.update).mockResolvedValue({} as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

    const result = await expireTrials();

    expect(result.expired).toBe(1);
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        status: 'expired',
        tier: 'STARTER',
      },
    });
    expect(prisma.agency.update).toHaveBeenCalledWith({
      where: { id: 'agency-1' },
      data: { subscriptionTier: null },
    });
  });

  it('should skip subscriptions with trialEnd in the future', async () => {
    vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

    const result = await expireTrials();

    expect(result.expired).toBe(0);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('should handle multiple expired subscriptions', async () => {
    const subs = [
      { id: 'sub-1', agencyId: 'agency-1', tier: 'STARTER', status: 'trialing', trialEnd: new Date('2026-02-20') },
      { id: 'sub-2', agencyId: 'agency-2', tier: 'SCALE', status: 'trialing', trialEnd: new Date('2026-02-21') },
    ];

    vi.mocked(prisma.subscription.findMany).mockResolvedValue(subs as any);
    vi.mocked(prisma.subscription.update).mockResolvedValue({} as any);
    vi.mocked(prisma.agency.update).mockResolvedValue({} as any);

    const result = await expireTrials();

    expect(result.expired).toBe(2);
    expect(prisma.subscription.update).toHaveBeenCalledTimes(2);
    expect(prisma.agency.update).toHaveBeenCalledTimes(2);
  });
});
