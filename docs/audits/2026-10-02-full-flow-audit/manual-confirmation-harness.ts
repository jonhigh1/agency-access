import { writeFile } from 'node:fs/promises';
import type { ManualConfirmationPlatform } from '../../../packages/shared/src/types.ts';
import { PrismaClient } from '../../../apps/api/node_modules/@prisma/client/index.js';
import { prisma } from '../../../apps/api/src/lib/prisma.ts';
import { accessRequestService } from '../../../apps/api/src/services/access-request.service.ts';
import { confirmManualAccess } from '../../../apps/api/src/services/manual-confirmation.service.ts';

const outputPath = process.env.MANUAL_CONFIRMATION_REPORT_PATH;
if (!outputPath) throw new Error('MANUAL_CONFIRMATION_REPORT_PATH is required');

type Case = { name: string; passed: boolean; observed: Record<string, unknown> };
const report: {
  environment: Record<string, unknown>;
  cases: Case[];
  notificationCalls: Array<Record<string, unknown>>;
  passed?: boolean;
  error?: string;
} = {
  environment: {
    database: 'Disposable loopback PostgreSQL',
    port: 55441,
    workersEnabled: false,
    webhookEndpointsSeeded: 0,
    providersInvoked: 0,
  },
  cases: [],
  notificationCalls: [],
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function addCase(name: string, observed: Record<string, unknown>) {
  report.cases.push({ name, passed: true, observed });
}

const future = new Date('2030-01-01T00:00:00.000Z');
const actor = {
  actorId: 'user_manual_persistence',
  actorEmail: 'reviewer@manual-persistence.invalid',
  ipAddress: '127.0.0.1',
  userAgent: 'manual-confirmation-persistence-harness',
};

async function createRequest(input: {
  agencyId: string;
  clientId: string;
  token: string;
  requested: ManualConfirmationPlatform[];
  evidence: Record<string, unknown>;
  status?: string;
  expiresAt?: Date;
}) {
  const request = await prisma.accessRequest.create({
    data: {
      agencyId: input.agencyId,
      clientId: input.clientId,
      clientName: `Client ${input.token}`,
      clientEmail: `${input.token}@manual-persistence.invalid`,
      platforms: input.requested.map((platform) => ({ platform, accessLevel: 'manage' })),
      status: input.status || 'partial',
      uniqueToken: input.token,
      expiresAt: input.expiresAt || future,
    },
  });
  const connection = await prisma.clientConnection.create({
    data: {
      accessRequestId: request.id,
      agencyId: input.agencyId,
      clientEmail: request.clientEmail,
      status: 'pending_verification',
      grantedAssets: input.evidence,
    },
  });
  return { request, connection };
}

function confirm(input: {
  requestId: string;
  agencyId: string;
  platform: ManualConfirmationPlatform;
  actorEmail?: string;
}) {
  return confirmManualAccess({
    accessRequestId: input.requestId,
    agencyId: input.agencyId,
    platform: input.platform,
    ...actor,
    ...(input.actorEmail ? { actorEmail: input.actorEmail } : {}),
  });
}

function pending(platform: ManualConfirmationPlatform, detail: Record<string, unknown> = {}) {
  return {
    platform,
    verificationStatus: 'pending',
    ...detail,
  };
}

async function readAssets(connectionId: string) {
  const row = await prisma.clientConnection.findUniqueOrThrow({ where: { id: connectionId } });
  return row.grantedAssets as Record<string, any>;
}

async function auditCount(requestId: string, platform?: ManualConfirmationPlatform) {
  return prisma.auditLog.count({
    where: {
      action: 'MANUAL_ACCESS_CONFIRMED',
      metadata: {
        path: ['accessRequestId'],
        equals: requestId,
      },
      ...(platform ? {
        AND: [{ metadata: { path: ['platform'], equals: platform } }],
      } : {}),
    },
  });
}

async function run() {
  // Match the lifecycle's dynamic module identity so the local stub intercepts its call.
  const { notificationService } = await import('@/services/notification.service');
  const lockClient = new PrismaClient();
  const originalQueueNotification = notificationService.queueNotification;
  notificationService.queueNotification = async (payload) => {
    report.notificationCalls.push({
      agencyId: payload.agencyId,
      accessRequestId: payload.accessRequestId,
      platforms: payload.platforms,
    });
    return { data: true, error: null };
  };

  try {
    const agency = await prisma.agency.create({
      data: {
        clerkUserId: 'user_manual_persistence_owner',
        name: 'Manual Persistence Agency',
        email: 'owner@manual-persistence.invalid',
      },
    });
    const otherAgency = await prisma.agency.create({
      data: {
        clerkUserId: 'user_manual_persistence_other',
        name: 'Other Manual Persistence Agency',
        email: 'other@manual-persistence.invalid',
      },
    });
    const client = await prisma.client.create({
      data: {
        agencyId: agency.id,
        name: 'Manual Persistence Client',
        company: 'Manual Persistence',
        email: 'client@manual-persistence.invalid',
        language: 'en',
      },
    });

    const sequential = await createRequest({
      agencyId: agency.id,
      clientId: client.id,
      token: 'manual-sequential',
      requested: ['beehiiv', 'mailchimp'],
      evidence: {
        beehiiv: pending('beehiiv', { agencyEmail: 'access@agency.invalid', privateEvidence: 'beehiiv-private' }),
        mailchimp: pending('mailchimp', { accountLabel: 'Marketing', privateEvidence: 'mailchimp-private' }),
        unrelatedSibling: { keep: true, nested: { value: 42 } },
      },
    });

    const first = await confirm({
      requestId: sequential.request.id,
      agencyId: agency.id,
      platform: 'beehiiv',
    });
    const afterFirst = await prisma.accessRequest.findUniqueOrThrow({ where: { id: sequential.request.id } });
    const afterFirstAssets = await readAssets(sequential.connection.id);
    const afterFirstConnection = await prisma.clientConnection.findUniqueOrThrow({ where: { id: sequential.connection.id } });
    assert(afterFirstConnection.status === 'active', 'Confirmed manual connection remained pending verification');
    assert(first.data?.requestStatus === 'partial', 'First confirmation did not leave request partial');
    assert(afterFirst.status === 'partial', 'First confirmation did not persist partial status');
    assert(afterFirstAssets.mailchimp.verificationStatus === 'pending', 'First confirmation changed sibling evidence');
    assert(afterFirstAssets.unrelatedSibling.nested.value === 42, 'First confirmation lost unrelated sibling data');
    addCase('first_confirmation_is_partial_and_preserves_siblings', {
      resultStatus: first.data.requestStatus,
      persistedStatus: afterFirst.status,
      siblingStatus: afterFirstAssets.mailchimp.verificationStatus,
    });

    const repeatedFirst = await confirm({
      requestId: sequential.request.id,
      agencyId: agency.id,
      platform: 'beehiiv',
    });
    assert(repeatedFirst.data?.requestStatus === 'partial', 'Repeated first confirmation changed lifecycle result');
    assert(await auditCount(sequential.request.id, 'beehiiv') === 1, 'Repeated confirmation duplicated audit');
    addCase('repeated_confirmation_is_idempotent_with_one_platform_audit', {
      auditCount: await auditCount(sequential.request.id, 'beehiiv'),
      verifiedAtStable: repeatedFirst.data.confirmation.verifiedAt === first.data.confirmation.verifiedAt,
    });

    const second = await confirm({
      requestId: sequential.request.id,
      agencyId: agency.id,
      platform: 'mailchimp',
    });
    const afterSecond = await prisma.accessRequest.findUniqueOrThrow({ where: { id: sequential.request.id } });
    assert(second.data?.requestStatus === 'completed', 'Second confirmation did not complete request');
    assert(afterSecond.status === 'completed' && afterSecond.authorizedAt, 'Completion lifecycle did not persist');
    assert(await auditCount(sequential.request.id) === 2, 'Sequential confirmations did not create one audit per platform');
    addCase('second_confirmation_completes_request_and_records_each_platform', {
      resultStatus: second.data.requestStatus,
      persistedStatus: afterSecond.status,
      auditCount: await auditCount(sequential.request.id),
    });

    const repeatedSecond = await confirm({
      requestId: sequential.request.id,
      agencyId: agency.id,
      platform: 'mailchimp',
    });
    assert(repeatedSecond.data?.requestStatus === 'completed', 'Repeated completed confirmation regressed request');
    assert(await auditCount(sequential.request.id) === 2, 'Repeated completed confirmation duplicated audit');
    const sequentialNotifications = report.notificationCalls.filter(
      (call) => call.accessRequestId === sequential.request.id
    );
    assert(sequentialNotifications.length === 1, 'Completion notification was not queued exactly once locally');
    addCase('completed_replay_keeps_single_audits_and_single_local_notification', {
      auditCount: await auditCount(sequential.request.id),
      notificationCalls: sequentialNotifications.length,
    });

    const projection = await accessRequestService.getAccessRequestById(sequential.request.id);
    assert(projection.data, 'Projected request could not be loaded');
    const projectionJson = JSON.stringify(projection.data);
    assert(!projectionJson.includes('privateEvidence'), 'Projection exposed private manual evidence');
    assert(!projectionJson.includes('unrelatedSibling'), 'Projection exposed raw sibling grant data');
    assert(!projectionJson.includes('verifiedBy'), 'Projection exposed internal reviewer identity');
    assert(!('grantedAssets' in projection.data), 'Projection exposed top-level granted assets');
    assert(
      JSON.stringify(projection.data.manualConfirmations) === JSON.stringify([
        {
          platform: 'beehiiv',
          verificationStatus: 'verified',
          verificationMethod: 'manual_review',
          verifiedAt: first.data.confirmation.verifiedAt,
        },
        {
          platform: 'mailchimp',
          verificationStatus: 'verified',
          verificationMethod: 'manual_review',
          verifiedAt: second.data.confirmation.verifiedAt,
        },
      ]),
      'Manual confirmation projection did not match safe contract'
    );
    addCase('request_projection_exposes_only_safe_manual_confirmation_fields', {
      manualConfirmations: projection.data.manualConfirmations,
      rawGrantedAssetsPresent: 'grantedAssets' in projection.data,
    });

    const rejected = await createRequest({
      agencyId: agency.id,
      clientId: client.id,
      token: 'manual-rejections',
      requested: ['beehiiv'],
      evidence: { beehiiv: pending('beehiiv') },
    });
    const wrongTenant = await confirm({
      requestId: rejected.request.id,
      agencyId: otherAgency.id,
      platform: 'beehiiv',
    });
    const unrequested = await confirm({
      requestId: rejected.request.id,
      agencyId: agency.id,
      platform: 'shopify',
    });
    const missingEvidenceFixture = await createRequest({
      agencyId: agency.id,
      clientId: client.id,
      token: 'manual-missing-evidence',
      requested: ['kit'],
      evidence: { beehiiv: pending('beehiiv') },
    });
    const missingEvidence = await confirm({
      requestId: missingEvidenceFixture.request.id,
      agencyId: agency.id,
      platform: 'kit',
    });
    const expiredFixture = await createRequest({
      agencyId: agency.id,
      clientId: client.id,
      token: 'manual-expired',
      requested: ['kit'],
      evidence: { kit: pending('kit') },
      status: 'expired',
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    const expired = await confirm({
      requestId: expiredFixture.request.id,
      agencyId: agency.id,
      platform: 'kit',
    });
    const rejectionCodes = [
      wrongTenant.error?.code,
      expired.error?.code,
      unrequested.error?.code,
      missingEvidence.error?.code,
    ];
    assert(
      rejectionCodes.join(',') === 'NOT_FOUND,REQUEST_EXPIRED,PLATFORM_NOT_REQUESTED,MANUAL_EVIDENCE_NOT_FOUND',
      `Unexpected rejection codes: ${rejectionCodes.join(',')}`
    );
    addCase('tenant_expiry_membership_and_evidence_guards_reject', { rejectionCodes });

    const rollback = await createRequest({
      agencyId: agency.id,
      clientId: client.id,
      token: 'manual-audit-rollback',
      requested: ['kit'],
      evidence: { kit: pending('kit', { keep: 'rollback-proof' }) },
    });
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION reject_manual_audit() RETURNS trigger AS $$
      BEGIN
        IF NEW.action = 'MANUAL_ACCESS_CONFIRMED' AND NEW.user_email = 'force-audit-failure@manual-persistence.invalid' THEN
          RAISE EXCEPTION 'injected audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER reject_manual_audit_trigger
      BEFORE INSERT ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION reject_manual_audit();
    `);
    const rollbackResult = await confirm({
      requestId: rollback.request.id,
      agencyId: agency.id,
      platform: 'kit',
      actorEmail: 'force-audit-failure@manual-persistence.invalid',
    });
    const rollbackAssets = await readAssets(rollback.connection.id);
    assert(rollbackResult.error?.code === 'INTERNAL_ERROR', 'Injected audit failure did not return internal error');
    assert(rollbackAssets.kit.verificationStatus === 'pending', 'Audit failure did not roll back evidence update');
    assert(await auditCount(rollback.request.id) === 0, 'Audit failure left a partial audit row');
    await prisma.$executeRawUnsafe('DROP TRIGGER reject_manual_audit_trigger ON audit_logs');
    await prisma.$executeRawUnsafe('DROP FUNCTION reject_manual_audit()');
    addCase('audit_failure_rolls_back_confirmation_transaction', {
      errorCode: rollbackResult.error.code,
      evidenceStatus: rollbackAssets.kit.verificationStatus,
      auditCount: await auditCount(rollback.request.id),
    });

    const concurrent = await createRequest({
      agencyId: agency.id,
      clientId: client.id,
      token: 'manual-concurrent',
      requested: ['klaviyo', 'zapier'],
      evidence: {
        klaviyo: pending('klaviyo', { account: 'one' }),
        zapier: pending('zapier', { workspace: 'two' }),
        sibling: { preserved: true },
      },
    });
    const concurrentResults = await Promise.all([
      confirm({ requestId: concurrent.request.id, agencyId: agency.id, platform: 'klaviyo' }),
      confirm({ requestId: concurrent.request.id, agencyId: agency.id, platform: 'zapier' }),
    ]);
    const concurrentRequest = await prisma.accessRequest.findUniqueOrThrow({ where: { id: concurrent.request.id } });
    const concurrentAssets = await readAssets(concurrent.connection.id);
    assert(concurrentResults.every((result) => !result.error), 'Concurrent confirmation returned an error');
    assert(concurrentRequest.status === 'completed', 'Concurrent confirmation did not finish completed');
    assert(concurrentAssets.klaviyo.verificationStatus === 'verified', 'Concurrent Klaviyo confirmation was lost');
    assert(concurrentAssets.zapier.verificationStatus === 'verified', 'Concurrent Zapier confirmation was lost');
    assert(concurrentAssets.sibling.preserved === true, 'Concurrent confirmation lost sibling evidence');
    assert(await auditCount(concurrent.request.id) === 2, 'Concurrent confirmation did not persist two audits');
    addCase('concurrent_confirmations_complete_without_lost_sibling_data', {
      returnedStatuses: concurrentResults.map((result) => result.data?.requestStatus),
      persistedStatus: concurrentRequest.status,
      auditCount: await auditCount(concurrent.request.id),
    });

    const stale = await createRequest({
      agencyId: agency.id,
      clientId: client.id,
      token: 'manual-stale-lifecycle',
      requested: ['pinterest', 'kit'],
      evidence: {
        pinterest: {
          platform: 'pinterest',
          verificationStatus: 'verified',
          verificationMethod: 'manual_review',
          verifiedAt: '2026-10-04T16:00:00.000Z',
          verifiedBy: actor.actorId,
        },
        kit: pending('kit'),
      },
    });
    let lockReady!: () => void;
    let releaseTableLock!: () => void;
    const tableLocked = new Promise<void>((resolve) => { lockReady = resolve; });
    const releaseLock = new Promise<void>((resolve) => { releaseTableLock = resolve; });
    const heldTableLock = lockClient.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('LOCK TABLE client_connections IN ACCESS EXCLUSIVE MODE');
      lockReady();
      await releaseLock;
    });
    await tableLocked;

    const olderLifecycle = accessRequestService.markRequestAuthorized(stale.request.id);
    await new Promise((resolve) => setTimeout(resolve, 100));
    let newerSettled = false;
    const newer = confirm({ requestId: stale.request.id, agencyId: agency.id, platform: 'kit' })
      .finally(() => { newerSettled = true; });
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert(!newerSettled, 'Newer confirmation bypassed the older lifecycle row lock');
    releaseTableLock();
    const [olderResult, newerResult] = await Promise.all([olderLifecycle, newer]);
    await heldTableLock;
    const staleRequest = await prisma.accessRequest.findUniqueOrThrow({ where: { id: stale.request.id } });
    assert(!olderResult.error && !newerResult.error, 'Delayed lifecycle confirmation returned an error');
    assert(olderResult.data?.status === 'partial', 'Older lifecycle did not evaluate the partial snapshot');
    assert(newerResult.data?.requestStatus === 'completed', 'Newer confirmation did not recompute completed state');
    assert(staleRequest.status === 'completed', 'Older partial lifecycle evaluation overwrote completed state');
    addCase('delayed_older_partial_evaluation_cannot_regress_completed_state', {
      newerBlockedBehindLifecycleLock: true,
      olderReturnedStatus: olderResult.data?.status,
      newerReturnedStatus: newerResult.data?.requestStatus,
      persistedStatus: staleRequest.status,
    });

    assert(await prisma.webhookEndpoint.count() === 0, 'Harness unexpectedly seeded webhook endpoints');
    report.passed = report.cases.every((item) => item.passed);
  } catch (error) {
    report.passed = false;
    report.error = error instanceof Error ? error.message : 'Unknown harness error';
    throw error;
  } finally {
    notificationService.queueNotification = originalQueueNotification;
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    await lockClient.$disconnect();
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
