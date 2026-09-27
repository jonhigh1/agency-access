import type { MetaAssetGrantResult, MetaAssetKind, MetaGrantRecipientType } from '@agency-platform/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type MetaDestination = {
  agencyId: string;
  agencyConnectionId: string;
  businessId: string;
  name?: string | null;
};

type MetaRecipient = {
  type: MetaGrantRecipientType;
  id: string;
  grantMethod: string;
};

type MetaRequirement = {
  assetId: string;
  assetKind: MetaAssetKind;
  assetName?: string;
  requestedTasks: string[];
};

const grantKey = (assetKind: string, assetId: string) => `${assetKind}:${assetId}`;
const MAX_CONCURRENT_GRANT_WRITES = 5;

type MetaGrantContext = {
  accessRequestId: string;
  connectionId: string;
  authorizationId: string;
  authorizationEpoch: number;
  clientBusinessId: string;
  destination: MetaDestination;
};

async function runGrantWrites<T>(operations: Array<() => Promise<T>>): Promise<T[]> {
  const outcomes: PromiseSettledResult<T>[] = [];
  for (let index = 0; index < operations.length; index += MAX_CONCURRENT_GRANT_WRITES) {
    outcomes.push(
      ...await Promise.allSettled(
        operations.slice(index, index + MAX_CONCURRENT_GRANT_WRITES).map((operation) => operation()),
      ),
    );
  }

  const failure = outcomes.find(
    (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
  );
  if (failure) throw failure.reason;
  return outcomes.map((outcome) => (outcome as PromiseFulfilledResult<T>).value);
}

export class MetaGrantAttemptSupersededError extends Error {
  constructor() {
    super('A newer Meta access check started before this result could be saved. Refresh the request and review the latest result.');
    this.name = 'MetaGrantAttemptSupersededError';
  }
}

function toDurableStatus(status: MetaAssetGrantResult['status']) {
  if (status === 'verified') return 'verified';
  if (status === 'failed') return 'blocked';
  if (status === 'unresolved') return 'manual_action_required';
  return 'sharing_attempted';
}

async function upsertDestination(destination: MetaDestination) {
  return prisma.metaAgencyDestination.upsert({
    where: {
      agencyId_businessId: {
        agencyId: destination.agencyId,
        businessId: destination.businessId,
      },
    },
    create: {
      agencyId: destination.agencyId,
      agencyConnectionId: destination.agencyConnectionId,
      businessId: destination.businessId,
      name: destination.name || destination.businessId,
    },
    update: {
      agencyConnectionId: destination.agencyConnectionId,
      name: destination.name || destination.businessId,
    },
  });
}

async function syncRequirements(
  input: MetaGrantContext & { requirements: MetaRequirement[]; recipients: MetaRecipient[] }
) {
  const destination = await upsertDestination(input.destination);
  const operations = input.requirements.flatMap((requirement) => input.recipients.map((recipient) => async () => {
    const requestedTasks = requirement.assetKind === 'dataset' && recipient.type === 'business'
      ? requirement.requestedTasks.filter((task) => task !== 'AA_ANALYZE')
      : requirement.requestedTasks;
    const identity = {
      accessRequestId: input.accessRequestId,
      destinationId: destination.id,
      clientBusinessId: input.clientBusinessId,
      assetKind: requirement.assetKind,
      assetId: requirement.assetId,
      recipientType: recipient.type,
      recipientId: recipient.id,
    };

    await prisma.metaAssetGrant.upsert({
      where: {
        accessRequestId_destinationId_clientBusinessId_assetKind_assetId_recipientType_recipientId: identity,
      },
      create: {
        ...identity,
        connectionId: input.connectionId,
        authorizationId: input.authorizationId,
        recipeId: recipient.grantMethod,
        recipeVersion: 1,
        assetName: requirement.assetName,
        requestedTasks,
        grantMethod: recipient.grantMethod,
        status: requirement.assetKind === 'dataset' ? 'manual_action_required' : 'selected',
        nextActor: requirement.assetKind === 'dataset' ? 'client_admin' : null,
      },
      update: {
        connectionId: input.connectionId,
        authorizationId: input.authorizationId,
        assetName: requirement.assetName,
        requestedTasks,
        grantMethod: recipient.grantMethod,
      },
    });
  }));

  await runGrantWrites(operations);
}

async function claimAttempts(
  input: MetaGrantContext & { requirements: MetaRequirement[]; recipient: MetaRecipient }
) {
  const destination = await upsertDestination(input.destination);
  const attempts = new Map<string, number>();
  const existingGrants = input.requirements.length === 0
    ? []
    : await prisma.metaAssetGrant.findMany({
        where: {
          accessRequestId: input.accessRequestId,
          destinationId: destination.id,
          clientBusinessId: input.clientBusinessId,
          recipientType: input.recipient.type,
          recipientId: input.recipient.id,
          OR: input.requirements.map(({ assetKind, assetId }) => ({ assetKind, assetId })),
        },
        select: {
          assetKind: true,
          assetId: true,
          status: true,
        },
      });
  const excludedGrants = new Set(
    existingGrants
      .filter((grant) => grant.status === 'excluded')
      .map((grant) => grantKey(grant.assetKind, grant.assetId)),
  );
  const operations = input.requirements.map((requirement) => async () => {
    const identity = {
      accessRequestId: input.accessRequestId,
      destinationId: destination.id,
      clientBusinessId: input.clientBusinessId,
      assetKind: requirement.assetKind,
      assetId: requirement.assetId,
      recipientType: input.recipient.type,
      recipientId: input.recipient.id,
    };
    const where = { accessRequestId_destinationId_clientBusinessId_assetKind_assetId_recipientType_recipientId: identity };
    if (excludedGrants.has(grantKey(requirement.assetKind, requirement.assetId))) {
      attempts.set(grantKey(requirement.assetKind, requirement.assetId), 0);
      return;
    }
    let grant;
    try {
      grant = await prisma.metaAssetGrant.upsert({
      where: {
        ...where,
        status: { not: 'excluded' },
      },
      create: {
        ...identity,
        connectionId: input.connectionId,
        authorizationId: input.authorizationId,
        recipeId: input.recipient.grantMethod,
        recipeVersion: 1,
        assetName: requirement.assetName,
        requestedTasks: requirement.requestedTasks,
        grantMethod: input.recipient.grantMethod,
        status: 'sharing_attempted',
        lastAttemptAt: new Date(),
      },
      update: {
        authorizationId: input.authorizationId,
        requestedTasks: requirement.requestedTasks,
        grantMethod: input.recipient.grantMethod,
        status: 'sharing_attempted',
        attemptVersion: { increment: 1 },
        lastAttemptAt: new Date(),
        verifiedAt: null,
        verifiedTasks: Prisma.DbNull,
        verifiedAuthorizationEpoch: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        nextActor: null,
      },
      select: { attemptVersion: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const current = await prisma.metaAssetGrant.findUnique({ where, select: { status: true } });
        if (current?.status === 'excluded') {
          attempts.set(grantKey(requirement.assetKind, requirement.assetId), 0);
          return;
        }
      }
      throw error;
    }
    attempts.set(grantKey(requirement.assetKind, requirement.assetId), grant.attemptVersion);
  });
  await runGrantWrites(operations);

  return attempts;
}

async function recordOutcomes(
  input: MetaGrantContext & {
    recipient: MetaRecipient;
    results: MetaAssetGrantResult[];
    attemptVersions: Map<string, number>;
  }
) {
  const destination = await upsertDestination(input.destination);

  const updates = await runGrantWrites(input.results.map((result) => async () => {
    const attemptVersion = input.attemptVersions.get(grantKey(result.assetType, result.assetId));
    if (attemptVersion === 0) return { count: 1 };
    if (attemptVersion === undefined) throw new Error(`Missing Meta grant attempt for ${result.assetType}:${result.assetId}`);
    const status = toDurableStatus(result.status);
    const identity = {
      accessRequestId: input.accessRequestId,
      destinationId: destination.id,
      clientBusinessId: input.clientBusinessId,
      assetKind: result.assetType,
      assetId: result.assetId,
      recipientType: input.recipient.type,
      recipientId: input.recipient.id,
    };
    const outcome = {
      authorizationId: input.authorizationId,
      recipeId: input.recipient.grantMethod,
      recipeVersion: 1,
      requestedTasks: result.requestedTasks,
      verifiedTasks: result.verifiedTasks || Prisma.DbNull,
      grantMethod: input.recipient.grantMethod,
      status,
      lastErrorCode: result.errorCode,
      lastErrorMessage: result.errorMessage,
      nextActor: status === 'manual_action_required' ? 'client_admin' : status === 'blocked' ? 'agency_owner' : null,
      lastAttemptAt: new Date(),
      ...(result.grantedAt ? { grantedAt: new Date(result.grantedAt) } : {}),
      verifiedAt: result.verifiedAt ? new Date(result.verifiedAt) : null,
      verifiedAuthorizationEpoch: status === 'verified' ? input.authorizationEpoch : null,
    };

    return prisma.metaAssetGrant.updateMany({
      where: { ...identity, attemptVersion, status: { not: 'excluded' } },
      data: outcome,
    });
  }));
  if (updates.some(({ count }) => count !== 1)) throw new MetaGrantAttemptSupersededError();
}

export const metaAssetGrantService = { syncRequirements, claimAttempts, recordOutcomes };
