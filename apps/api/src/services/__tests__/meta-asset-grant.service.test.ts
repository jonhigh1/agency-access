import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { MetaGrantAttemptSupersededError, metaAssetGrantService } from '@/services/meta-asset-grant.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    metaAgencyDestination: { upsert: vi.fn() },
    metaAssetGrant: { upsert: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  },
}));

const context = {
  accessRequestId: 'request-1',
  connectionId: 'connection-1',
  authorizationId: 'authorization-1',
  authorizationEpoch: 2,
  clientBusinessId: 'client-business-1',
  destination: {
    agencyId: 'agency-1',
    agencyConnectionId: 'agency-connection-1',
    businessId: 'partner-business-1',
  },
};

describe('metaAssetGrantService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.metaAgencyDestination.upsert).mockResolvedValue({ id: 'destination-1' } as any);
    vi.mocked(prisma.metaAssetGrant.upsert).mockResolvedValue({ id: 'grant-1' } as any);
    vi.mocked(prisma.metaAssetGrant.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.metaAssetGrant.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.metaAssetGrant.findMany).mockResolvedValue([] as any);
  });

  it('creates one requirement per asset and recipient without resetting existing status', async () => {
    await metaAssetGrantService.syncRequirements({
      ...context,
      requirements: [{ assetId: 'page-1', assetKind: 'page', requestedTasks: ['MANAGE'] }],
      recipients: [
        { type: 'business', id: 'partner-business-1', grantMethod: 'manual_business_share' },
        { type: 'human', id: 'person-1', grantMethod: 'assigned_users' },
      ],
    });

    expect(prisma.metaAssetGrant.upsert).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(prisma.metaAssetGrant.upsert).mock.calls) {
      expect(call[0].create).toMatchObject({ status: 'selected', assetId: 'page-1' });
      expect(call[0].update).not.toHaveProperty('status');
      expect(call[0].update).not.toHaveProperty('verifiedAt');
    }
  });

  it('caps concurrent requirement upserts while writing every asset-recipient pair', async () => {
    let active = 0;
    let peak = 0;
    vi.mocked(prisma.metaAssetGrant.upsert).mockImplementation(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 0));
      active--;
      return { id: 'grant-1' } as any;
    });

    await metaAssetGrantService.syncRequirements({
      ...context,
      requirements: Array.from({ length: 6 }, (_, index) => ({
        assetId: `page-${index}`, assetKind: 'page' as const, requestedTasks: ['MANAGE'],
      })),
      recipients: [
        { type: 'human', id: 'person-1', grantMethod: 'assigned_users' },
        { type: 'system_user', id: 'system-1', grantMethod: 'assigned_users' },
      ],
    });

    expect(peak).toBe(5);
    expect(prisma.metaAssetGrant.upsert).toHaveBeenCalledTimes(12);
  });

  it('caps concurrent attempt claims and outcome writes', async () => {
    let active = 0;
    let peak = 0;
    const trackWrite = async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 0));
      active--;
    };
    const requirements = Array.from({ length: 12 }, (_, index) => ({
      assetId: `page-${index}`, assetKind: 'page' as const, requestedTasks: ['MANAGE'],
    }));
    vi.mocked(prisma.metaAssetGrant.upsert).mockImplementation(async () => {
      await trackWrite();
      return { attemptVersion: 1 } as any;
    });

    const attempts = await metaAssetGrantService.claimAttempts({
      ...context,
      requirements,
      recipient: { type: 'human', id: 'person-1', grantMethod: 'assigned_users' },
    });
    expect(peak).toBe(5);
    expect(attempts.size).toBe(12);

    active = 0;
    peak = 0;
    vi.mocked(prisma.metaAssetGrant.updateMany).mockImplementation(async () => {
      await trackWrite();
      return { count: 1 } as any;
    });
    await metaAssetGrantService.recordOutcomes({
      ...context,
      recipient: { type: 'human', id: 'person-1', grantMethod: 'assigned_users' },
      attemptVersions: attempts,
      results: requirements.map(({ assetId, assetKind, requestedTasks }) => ({
        assetId,
        assetType: assetKind,
        requestedTasks,
        status: 'verified' as const,
      })),
    });
    expect(peak).toBe(5);
    expect(prisma.metaAssetGrant.updateMany).toHaveBeenCalledTimes(12);
  });

  it('records an outcome only for the named recipient', async () => {
    await metaAssetGrantService.recordOutcomes({
      ...context,
      recipient: { type: 'system_user', id: 'system-user-1', grantMethod: 'assigned_users' },
      attemptVersions: new Map([['page:page-1', 3]]),
      results: [{
        assetId: 'page-1',
        assetType: 'page',
        requestedTasks: ['MANAGE'],
        verifiedTasks: ['MANAGE'],
        status: 'verified',
        verifiedAt: '2026-09-22T00:00:00.000Z',
      }],
    });

    expect(prisma.metaAssetGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        recipientType: 'system_user',
        recipientId: 'system-user-1',
        attemptVersion: 3,
        status: { not: 'excluded' },
      }),
      data: expect.objectContaining({
        status: 'verified',
        verifiedAuthorizationEpoch: 2,
        verifiedTasks: ['MANAGE'],
      }),
    }));
    expect(vi.mocked(prisma.metaAssetGrant.updateMany).mock.calls[0][0].data).not.toHaveProperty('grantedAt');
  });

  it('claims a new version so a late result cannot overwrite a newer attempt', async () => {
    vi.mocked(prisma.metaAssetGrant.upsert)
      .mockResolvedValueOnce({ attemptVersion: 2 } as any)
      .mockResolvedValueOnce({ attemptVersion: 3 } as any);
    const input = {
      ...context,
      requirements: [{ assetId: 'page-1', assetKind: 'page' as const, requestedTasks: ['MANAGE'] }],
      recipient: { type: 'human' as const, id: 'person-1', grantMethod: 'assigned_users' },
    };

    const older = await metaAssetGrantService.claimAttempts(input);
    const newer = await metaAssetGrantService.claimAttempts(input);

    vi.mocked(prisma.metaAssetGrant.updateMany).mockResolvedValueOnce({ count: 0 } as any);
    await expect(metaAssetGrantService.recordOutcomes({
      ...context,
      recipient: input.recipient,
      attemptVersions: older,
      results: [{ assetId: 'page-1', assetType: 'page', requestedTasks: ['MANAGE'], status: 'failed' }],
    })).rejects.toBeInstanceOf(MetaGrantAttemptSupersededError);

    vi.mocked(prisma.metaAssetGrant.updateMany).mockResolvedValueOnce({ count: 1 } as any);
    await metaAssetGrantService.recordOutcomes({
      ...context,
      recipient: input.recipient,
      attemptVersions: newer,
      results: [{ assetId: 'page-1', assetType: 'page', requestedTasks: ['MANAGE'], status: 'verified' }],
    });

    expect(vi.mocked(prisma.metaAssetGrant.updateMany).mock.calls.slice(-2).map(([query]) => query.where.attemptVersion))
      .toEqual([2, 3]);
    expect(vi.mocked(prisma.metaAssetGrant.updateMany).mock.calls.slice(-2).map(([query]) => query.data.status))
      .toEqual(['blocked', 'verified']);
    expect(vi.mocked(prisma.metaAssetGrant.upsert).mock.calls[0][0].where)
      .toMatchObject({ status: { not: 'excluded' } });
  });

  it('rechecks current verified grants so retries refresh their saved result', async () => {
    vi.mocked(prisma.metaAssetGrant.upsert).mockResolvedValueOnce({ attemptVersion: 1 } as any);
    vi.mocked(prisma.metaAssetGrant.findMany).mockResolvedValue([{
      assetKind: 'page',
      assetId: 'page-1',
      status: 'verified',
      verifiedAuthorizationEpoch: context.authorizationEpoch,
      requestedTasks: ['MANAGE'],
    }] as any);

    const attempts = await metaAssetGrantService.claimAttempts({
      ...context,
      requirements: [{ assetId: 'page-1', assetKind: 'page', requestedTasks: ['MANAGE'] }],
      recipient: { type: 'human', id: 'person-1', grantMethod: 'assigned_users' },
    });

    expect(attempts).toEqual(new Map([['page:page-1', 1]]));
    expect(prisma.metaAssetGrant.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ status: 'sharing_attempted', attemptVersion: { increment: 1 } }),
    }));
  });

  it('rejects stale outcome writes so callers cannot publish results from an older attempt', async () => {
    vi.mocked(prisma.metaAssetGrant.updateMany).mockResolvedValue({ count: 0 } as any);

    await expect(metaAssetGrantService.recordOutcomes({
      ...context,
      recipient: { type: 'human', id: 'person-1', grantMethod: 'assigned_users' },
      attemptVersions: new Map([['page:page-1', 2]]),
      results: [{ assetId: 'page-1', assetType: 'page', requestedTasks: ['MANAGE'], status: 'verified' }],
    })).rejects.toBeInstanceOf(MetaGrantAttemptSupersededError);
  });

  it('skips an owner-excluded grant while other assets can be retried', async () => {
    vi.mocked(prisma.metaAssetGrant.findMany).mockResolvedValue([
      { assetKind: 'page', assetId: 'page-1', status: 'excluded' },
    ] as any);
    vi.mocked(prisma.metaAssetGrant.upsert).mockResolvedValue({ attemptVersion: 2 } as any);

    const attempts = await metaAssetGrantService.claimAttempts({
      ...context,
      requirements: [
        { assetId: 'page-1', assetKind: 'page', requestedTasks: ['MANAGE'] },
        { assetId: 'page-2', assetKind: 'page', requestedTasks: ['MANAGE'] },
      ],
      recipient: { type: 'human', id: 'person-1', grantMethod: 'assigned_users' },
    });

    expect(attempts).toEqual(new Map([['page:page-1', 0], ['page:page-2', 2]]));
    expect(prisma.metaAssetGrant.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.metaAssetGrant.findUnique).not.toHaveBeenCalled();
    expect(prisma.metaAssetGrant.upsert).toHaveBeenCalledTimes(1);
    await metaAssetGrantService.recordOutcomes({
      ...context,
      recipient: { type: 'human', id: 'person-1', grantMethod: 'assigned_users' },
      attemptVersions: attempts,
      results: [
        { assetId: 'page-1', assetType: 'page', requestedTasks: ['MANAGE'], status: 'failed' },
        { assetId: 'page-2', assetType: 'page', requestedTasks: ['MANAGE'], status: 'verified' },
      ],
    });
    expect(prisma.metaAssetGrant.updateMany).toHaveBeenCalledTimes(1);
  });

  it('treats a concurrent exclusion as skipped and rejects unrelated unique conflicts', async () => {
    const uniqueConflict = () => new Prisma.PrismaClientKnownRequestError('unique constraint', {
      code: 'P2002', clientVersion: 'test',
    });
    vi.mocked(prisma.metaAssetGrant.upsert).mockRejectedValueOnce(uniqueConflict());
    vi.mocked(prisma.metaAssetGrant.findUnique).mockResolvedValueOnce({ status: 'excluded' } as any);
    const attempts = await metaAssetGrantService.claimAttempts({
      ...context,
      requirements: [{ assetId: 'page-1', assetKind: 'page', requestedTasks: ['MANAGE'] }],
      recipient: { type: 'human', id: 'person-1', grantMethod: 'assigned_users' },
    });

    expect(attempts).toEqual(new Map([['page:page-1', 0]]));
    await metaAssetGrantService.recordOutcomes({
      ...context,
      recipient: { type: 'human', id: 'person-1', grantMethod: 'assigned_users' },
      attemptVersions: attempts,
      results: [{ assetId: 'page-1', assetType: 'page', requestedTasks: ['MANAGE'], status: 'verified' }],
    });
    expect(prisma.metaAssetGrant.updateMany).not.toHaveBeenCalled();

    vi.mocked(prisma.metaAssetGrant.upsert).mockRejectedValueOnce(uniqueConflict());
    vi.mocked(prisma.metaAssetGrant.findUnique).mockResolvedValueOnce({ status: 'sharing_attempted' } as any);
    await expect(metaAssetGrantService.claimAttempts({
      ...context,
      requirements: [{ assetId: 'page-2', assetKind: 'page', requestedTasks: ['MANAGE'] }],
      recipient: { type: 'human', id: 'person-1', grantMethod: 'assigned_users' },
    })).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  describe('reconcileRemovedRequirements', () => {
    const requirement = (assetId: string, assetKind = 'page') => ({
      assetId,
      assetKind,
      requestedTasks: ['MANAGE'],
    });

    it('excludes removed non-verified rows with a client-authored envelope', async () => {
      vi.mocked(prisma.metaAssetGrant.findMany).mockResolvedValueOnce([
        { assetKind: 'page', assetId: 'page-kept', status: 'sharing_attempted', metadata: null },
        { assetKind: 'page', assetId: 'page-gone', status: 'manual_action_required', metadata: null },
      ] as any);

      const diff = await metaAssetGrantService.reconcileRemovedRequirements({
        ...context,
        requirements: [requirement('page-kept')],
      });

      expect(diff.removed).toEqual([{ assetKind: 'page', assetId: 'page-gone' }]);
      expect(diff.readded).toEqual([]);
      expect(prisma.metaAssetGrant.updateMany).toHaveBeenCalledTimes(1);
      const [input] = vi.mocked(prisma.metaAssetGrant.updateMany).mock.calls[0] as any as [any];
      expect(input.where.assetId).toBe('page-gone');
      expect(input.where.status).toEqual({ notIn: ['verified', 'excluded'] });
      expect(input.data.status).toBe('excluded');
      expect(input.data.metadata.exclusion).toEqual(
        expect.objectContaining({ reason: 'removed_from_selection', excludedBy: 'client' })
      );
    });

    it('never excludes verified rows that left the selection', async () => {
      vi.mocked(prisma.metaAssetGrant.findMany).mockResolvedValueOnce([
        { assetKind: 'page', assetId: 'page-verified', status: 'verified', metadata: null },
      ] as any);

      const diff = await metaAssetGrantService.reconcileRemovedRequirements({
        ...context,
        requirements: [],
      });

      expect(diff.removed).toEqual([]);
      expect(prisma.metaAssetGrant.updateMany).not.toHaveBeenCalled();
    });

    it('leaves already-excluded rows alone', async () => {
      vi.mocked(prisma.metaAssetGrant.findMany).mockResolvedValueOnce([
        { assetKind: 'page', assetId: 'page-gone', status: 'excluded', metadata: { exclusion: { excludedBy: 'client' } } },
      ] as any);

      const diff = await metaAssetGrantService.reconcileRemovedRequirements({
        ...context,
        requirements: [],
      });

      expect(diff.removed).toEqual([]);
      expect(prisma.metaAssetGrant.updateMany).not.toHaveBeenCalled();
    });

    it('resets client-excluded rows to selected when the asset re-enters', async () => {
      vi.mocked(prisma.metaAssetGrant.findMany).mockResolvedValueOnce([
        {
          assetKind: 'ad_account',
          assetId: 'act-back',
          status: 'excluded',
          metadata: { exclusion: { reason: 'removed_from_selection', excludedBy: 'client' } },
        },
      ] as any);

      const diff = await metaAssetGrantService.reconcileRemovedRequirements({
        ...context,
        requirements: [requirement('act-back', 'ad_account')],
      });

      expect(diff.readded).toEqual([{ assetKind: 'ad_account', assetId: 'act-back' }]);
      expect(prisma.metaAssetGrant.updateMany).toHaveBeenCalledTimes(1);
      const [input] = vi.mocked(prisma.metaAssetGrant.updateMany).mock.calls[0] as any as [any];
      expect(input.where.status).toBe('excluded');
      expect(input.data.status).toBe('selected');
      expect(input.data.metadata).toBe(Prisma.JsonNull);
    });

    it('keeps agency exclusions when the asset re-enters', async () => {
      vi.mocked(prisma.metaAssetGrant.findMany).mockResolvedValueOnce([
        {
          assetKind: 'ad_account',
          assetId: 'act-agency',
          status: 'excluded',
          metadata: { exclusion: { reason: 'duplicate_asset', excludedBy: 'agency_owner' } },
        },
      ] as any);

      const diff = await metaAssetGrantService.reconcileRemovedRequirements({
        ...context,
        requirements: [requirement('act-agency', 'ad_account')],
      });

      expect(diff.readded).toEqual([]);
      expect(prisma.metaAssetGrant.updateMany).not.toHaveBeenCalled();
    });
  });
});
