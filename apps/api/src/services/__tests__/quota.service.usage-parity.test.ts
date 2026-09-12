/**
 * QuotaService.getUsage efficiency tests (U13)
 *
 * Parity: the parallelized snapshot must report the same numbers the
 * sequential per-metric queries produced for a fixed agency.
 * Efficiency: members/team_seats share one agencyMember count;
 * client_onboards/platform_audits share one Clerk user read.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTierLimitsConfig } from '@agency-platform/shared';

const getUserMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agency: {
      findUnique: vi.fn(),
    },
    accessRequest: {
      count: vi.fn(),
    },
    client: {
      count: vi.fn(),
    },
    agencyMember: {
      count: vi.fn(),
    },
    accessRequestTemplate: {
      count: vi.fn(),
    },
  },
}));

vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    users: {
      getUser: getUserMock,
      updateUser: vi.fn(),
    },
  }),
}));

import { quotaService } from '../quota.service';
import { prisma } from '@/lib/prisma';

describe('QuotaService.getUsage - parity and fetch counts', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(prisma.agency.findUnique).mockResolvedValue({
      id: 'agency-1',
      clerkUserId: 'clerk-user-1',
      subscription: { tier: 'SCALE', status: 'active' },
    } as any);
    vi.mocked(prisma.accessRequest.count).mockResolvedValue(4);
    vi.mocked(prisma.client.count).mockResolvedValue(10);
    vi.mocked(prisma.agencyMember.count).mockResolvedValue(3);
    vi.mocked(prisma.accessRequestTemplate.count).mockResolvedValue(2);
    getUserMock.mockResolvedValue({
      privateMetadata: {
        quotaLimits: {
          client_onboards: { used: 7 },
          platform_audits: { used: 9 },
        },
      },
    });
  });

  it('returns the same numbers the sequential implementation produced', async () => {
    const usage = await quotaService.getUsage('agency-1');

    expect(usage).not.toBeNull();
    expect(usage!.currentTier).toBe('SCALE');

    const limits = getTierLimitsConfig('SCALE');
    const asLimit = (value: number | 'unlimited') =>
      value === -1 || value === 'unlimited' ? 'unlimited' : value;
    const asRemaining = (value: number | 'unlimited', used: number) =>
      value === -1 || value === 'unlimited' ? 'unlimited' : Math.max(0, (value as number) - used);

    expect(usage!.accessRequests).toEqual({
      limit: asLimit(limits.accessRequests as number),
      used: 4,
      remaining: asRemaining(limits.accessRequests as number, 4),
    });
    expect(usage!.clients).toEqual({
      limit: asLimit(limits.clients as number),
      used: 10,
      remaining: asRemaining(limits.clients as number, 10),
    });
    expect(usage!.members).toEqual({
      limit: asLimit(limits.members as number),
      used: 3,
      remaining: asRemaining(limits.members as number, 3),
    });
    expect(usage!.templates).toEqual({
      limit: asLimit(limits.templates as number),
      used: 2,
      remaining: asRemaining(limits.templates as number, 2),
    });
    expect(usage!.clientOnboards).toEqual({
      limit: asLimit(limits.clientOnboards as number),
      used: 7,
      remaining: asRemaining(limits.clientOnboards as number, 7),
    });
    expect(usage!.platformAudits).toEqual({
      limit: asLimit(limits.platformAudits as number),
      used: 9,
      remaining: asRemaining(limits.platformAudits as number, 9),
    });
    // team_seats is counted by the same agencyMember query as members
    expect(usage!.teamSeats).toEqual(usage!.members);
  });

  it('counts members once and reads the Clerk user once for both cumulative metrics', async () => {
    await quotaService.getUsage('agency-1');

    expect(prisma.agencyMember.count).toHaveBeenCalledTimes(1);
    expect(getUserMock).toHaveBeenCalledTimes(1);
    // one read for tier/subscription, one for clerkUserId — no per-metric re-reads
    expect(prisma.agency.findUnique).toHaveBeenCalledTimes(2);
  });

  it('returns null for a non-existent agency without any usage reads', async () => {
    vi.mocked(prisma.agency.findUnique).mockResolvedValue(null as any);

    const usage = await quotaService.getUsage('agency-404');

    expect(usage).toBeNull();
    expect(prisma.client.count).not.toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
  });
});
