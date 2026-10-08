import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuotaService } from '../quota.service';
import { prisma } from '@/lib/prisma';

vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn(() => ({
    users: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
    },
  })),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agency: {
      findUnique: vi.fn(),
    },
    client: {
      count: vi.fn(),
    },
    agencyMember: {
      count: vi.fn(),
    },
    accessRequest: {
      count: vi.fn(),
    },
    accessRequestTemplate: {
      count: vi.fn(),
    },
  },
}));

describe('QuotaService effective tier resolution', () => {
  const quotaService = new QuotaService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses free limits when subscription is not active', async () => {
    vi.mocked(prisma.agency.findUnique).mockResolvedValue({
      subscriptionTier: 'STARTER',
      subscription: {
        tier: 'STARTER',
        status: 'incomplete',
      },
    } as any);
    vi.mocked(prisma.client.count).mockResolvedValue(3);

    const result = await quotaService.checkQuota({
      agencyId: 'agency-free',
      metric: 'clients',
      action: 'create',
      requestedAmount: 1,
    });

    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(3);
    expect(result.used).toBe(3);
    expect(result.currentTier).toBe('STARTER');
    expect(result.suggestedTier).toBe('STARTER');
  });
});
