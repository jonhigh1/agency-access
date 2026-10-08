/**
 * pg-boss Job Handlers
 *
 * Handlers for all background jobs, replacing BullMQ workers.
 * Each handler imports business logic from existing services.
 */

import type { PgBoss } from 'pg-boss';
import { getPlatformTokenCapability, type Platform } from '@agency-platform/shared';
import { prisma } from './prisma.js';
import { auditService } from '../services/audit.service.js';
import { refreshClientPlatformAuthorization } from '../services/token-lifecycle.service.js';
import { accessRequestService } from '../services/access-request.service.js';
import { webhookDeliveryService } from '@/services/webhook-delivery.service';
import { logger } from './logger.js';
import { registerHandler, type JobRegistry } from './pg-boss.js';
import { queueTokenRefresh } from './queue-helpers.js';

/**
 * Token Refresh Handlers
 */
export async function startTokenRefreshHandlers(): Promise<void> {
  // Handler for scanning expiring tokens
  await registerHandler('token-refresh-scan', async (job) => {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expiringAuths = await prisma.platformAuthorization.findMany({
      where: {
        status: 'active',
        expiresAt: {
          lte: sevenDaysFromNow,
        },
      },
      include: {
        connection: {
          select: {
            id: true,
            agencyId: true,
            clientEmail: true,
          },
        },
      },
    });

    const eligibleAuths = expiringAuths.filter((auth) => {
      const capability = getPlatformTokenCapability(auth.platform as Platform);
      return capability.connectionMethod === 'oauth' && capability.refreshStrategy === 'automatic';
    });

    // Independent singleton jobs (unique connectionId+platform pairs) —
    // enqueue them concurrently instead of one INSERT round-trip each.
    await Promise.all(eligibleAuths.map((auth) =>
      queueTokenRefresh(auth.connectionId, auth.platform)
    ));

    const queued = eligibleAuths.length;
    logger.info(`Token refresh scan complete`, { queued });
  }, { teamSize: 1, teamConcurrency: 1 });

  // Handler for refreshing individual tokens.
  // Live platform contact (Infisical get + refresh) lives here, not on GET /token-health.
  await registerHandler('token-refresh', async (job) => {
    const { connectionId, platform } = job.data as JobRegistry['token-refresh'];

    const auth = await prisma.platformAuthorization.findFirst({
      where: { connectionId, platform },
      include: { connection: true },
    });

    if (!auth) {
      logger.debug(`Token refresh job: auth not found`, { connectionId, platform });
      return;
    }

    if (auth.status !== 'active') {
      logger.debug(`Token refresh job: auth inactive`, { connectionId, platform, status: auth.status });
      return;
    }

    let refreshResult: Awaited<ReturnType<typeof refreshClientPlatformAuthorization>>;
    try {
      refreshResult = await refreshClientPlatformAuthorization(connectionId, platform as Platform);
    } catch (error) {
      await auditService.createAuditLog({
        resourceId: connectionId,
        resourceType: 'connection',
        action: 'FAILED',
        details: { platform, jobId: job.id, error: String(error) },
      });
      throw error;
    }

    const refreshError = refreshResult.error;
    const requiresReconnect =
      refreshError?.code === 'RECONNECT_REQUIRED' || refreshError?.code === 'INVALID_TOKEN';
    await auditService.createAuditLog({
      agencyId: auth.connection.agencyId,
      resourceId: connectionId,
      resourceType: 'connection',
      action: refreshError ? (requiresReconnect ? 'REFRESH_RECONNECT_REQUIRED' : 'FAILED') : 'REFRESHED',
      userEmail: auth.connection.clientEmail,
      details: {
        platform,
        jobId: job.id,
        ...(refreshError
          ? { error: refreshError.message, code: refreshError.code }
          : { outcome: refreshResult.data?.outcome, expiresAt: refreshResult.data?.expiresAt }),
      },
    });

    // Retry transient provider failures without duplicating their audit event.
    if (refreshError?.code === 'REFRESH_RETRYABLE') {
      throw new Error(refreshError.message);
    }

  }, { teamSize: 1, teamConcurrency: 1 });
}

/**
 * Cleanup Handler
 */
export async function startCleanupHandler(): Promise<void> {
  await registerHandler('cleanup-expired-requests', async (job) => {
    const { type } = job.data;

    if (type === 'delete-expired-requests') {
      const result = await accessRequestService.deleteExpiredRequests();

      if (result.data) {
        logger.info(`Deleted expired requests`, { deleted: result.data.deleted });
      }
    }
  }, { teamSize: 1, teamConcurrency: 1 });

  await registerHandler('cleanup-agent-operations', async () => {
    const { agentOperationRetentionService } = await import('../services/agent-operation-retention.service.js');
    const result = await agentOperationRetentionService.sanitizeExpiredSnapshots();
    logger.info('Sanitized expired agent operation snapshots', { sanitized: result.sanitized });
  }, { teamSize: 1, teamConcurrency: 1 });
}

/**
 * Notification Handler
 */
export async function startNotificationHandler(): Promise<void> {
  await registerHandler('notification', async (job) => {
    const { agencyId, accessRequestId, clientEmail, clientName, platforms, completedAt } = job.data;

    const { notificationService } = await import('../services/notification.service.js');

    // Convert completedAt string to Date (JSON serialization converts Date to string)
    const completedAtDate = typeof completedAt === 'string' ? new Date(completedAt) : completedAt;

    const result = await notificationService.sendNotification({
      agencyId,
      accessRequestId,
      clientEmail,
      clientName: clientName ?? '', // Provide default for optional field
      platforms,
      completedAt: completedAtDate,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }
  }, { teamSize: 1, teamConcurrency: 1 });
}

/**
 * Webhook Delivery Handler
 */
export async function startWebhookDeliveryHandler(): Promise<void> {
  await registerHandler('webhook-delivery', async (job) => {
    const { eventId } = job.data;

    // Get attempt number from job metadata or default to 1
    const attemptNumber = (job.retryCount ?? 0) + 1;

    const result = await webhookDeliveryService.deliverWebhookEvent({
      eventId,
      attemptNumber,
    });

    if (result.error) {
      if (result.data?.retryable) {
        throw new Error(result.error.message);
      }
      // Non-retryable error - log and return
      logger.warn(`Webhook delivery failed (non-retryable)`, {
        eventId,
        error: result.error.code,
        message: result.error.message,
      });
    }
  }, {
    teamSize: 1,
    teamConcurrency: 1,
  });
}

/**
 * Onboarding Email Handler
 */
export async function startOnboardingEmailHandler(): Promise<void> {
  await registerHandler('onboarding-email', async (job) => {
    const { onboardingEmailService } = await import('../services/onboarding-email.service.js');
    const result = await onboardingEmailService.sendOnboardingEmail(job.data);

    if (result.error) {
      throw new Error(result.error.message);
    }
  }, { teamSize: 1, teamConcurrency: 1 });
}

/**
 * Trial Expiration Handler
 */
export async function startTrialExpirationHandler(): Promise<void> {
  await registerHandler('trial-expiration-check', async () => {
    const { expireTrials } = await import('../jobs/trial-expiration.js');
    const result = await expireTrials();
    logger.info(`Trial expiration job completed`, { expired: result.expired });
  }, { teamSize: 1, teamConcurrency: 1 });
}

/**
 * Google Native Grant Handler
 */
export async function startGoogleNativeGrantHandler(): Promise<void> {
  await registerHandler('google-native-grant', async (job) => {
    const { grantId } = job.data;

    const { googleNativeAccessService } = await import('@/services/google-native-access.service');
    const result = await googleNativeAccessService.executeGoogleNativeGrant(grantId);

    if (result.error) {
      const details = result.error.details as { retryable?: boolean } | undefined;
      if (details?.retryable) {
        throw new Error(result.error.message);
      }
      // Non-retryable error - log and return
      logger.warn(`Google native grant failed (non-retryable)`, {
        grantId,
        error: result.error.code,
        message: result.error.message,
      });
    }
  }, { teamSize: 1, teamConcurrency: 1 });
}

/**
 * Authorization Verification Handler
 */
export async function startAuthorizationVerificationHandler(): Promise<void> {
  await registerHandler('authorization-verification', async (job) => {
    const { verificationId, jobData } = job.data;

    const { authorizationVerificationService } = await import(
      '@/services/authorization-verification.service'
    );

    // executeVerification returns void and throws on error
    await authorizationVerificationService.executeVerification(verificationId, jobData);
  }, { teamSize: 1, teamConcurrency: 1 });
}

/**
 * Google Client Offboarding Handler
 */
export async function startGoogleClientOffboardingHandler(): Promise<void> {
  await registerHandler('google-client-offboarding', async (job) => {
    const { runId } = job.data as { runId: string };

    const { executeRun, executeCleanup } = await import('@/services/google-offboarding-executor');
    const runResult = await executeRun(runId);

    if (runResult.errors.length > 0 && runResult.finalStatus === 'incomplete') {
      logger.warn('Google client offboarding run completed with errors', {
        runId,
        errors: runResult.errors,
      });
      return;
    }

    try {
      const cleanupResult = await executeCleanup(runId);
      logger.info('Google client offboarding cleanup completed', {
        runId,
        cleanupResult: cleanupResult.cleanupResult,
        finalStatus: cleanupResult.finalStatus,
      });
    } catch (cleanupError) {
      logger.error('Google client offboarding cleanup failed', {
        runId,
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
      throw cleanupError;
    }
  }, { teamSize: 1, teamConcurrency: 1 });
}

/**
 * Meta Marketing API tier daily cron (#134)
 */
export async function startMetaMarketingApiTierCronHandler(): Promise<void> {
  await registerHandler(
    'meta-marketing-api-tier-daily',
    async (job) => {
      const { runMetaMarketingApiTierCronJob } = await import(
        '../jobs/meta-marketing-api-tier-cron.js'
      );
      await runMetaMarketingApiTierCronJob({ jobId: job.id, abortSignal: job.signal });
    },
    { localConcurrency: 1 },
  );
}

/**
 * Start all job handlers
 */
export async function startAllHandlers(): Promise<void> {
  await Promise.all([
    startTokenRefreshHandlers(),
    startCleanupHandler(),
    startNotificationHandler(),
    startWebhookDeliveryHandler(),
    startOnboardingEmailHandler(),
    startTrialExpirationHandler(),
    startGoogleNativeGrantHandler(),
    startAuthorizationVerificationHandler(),
    startGoogleClientOffboardingHandler(),
    startMetaMarketingApiTierCronHandler(),
  ]);

  logger.info('All pg-boss job handlers started');
}

/**
 * Schedule recurring jobs
 */
export async function scheduleRecurringJobs(): Promise<void> {
  const { scheduleJob } = await import('./pg-boss.js');

  // Token refresh scan - every 12 hours
  await scheduleJob('token-refresh-scan', '0 */12 * * *', { type: 'check-expiring-tokens' });

  // Cleanup - daily at 2 AM UTC
  await scheduleJob('cleanup-expired-requests', '0 2 * * *', { type: 'delete-expired-requests' });
  await scheduleJob('cleanup-agent-operations', '30 2 * * *', { type: 'sanitize-agent-operations' });

  // Trial expiration - daily at 3 AM UTC
  await scheduleJob('trial-expiration-check', '0 3 * * *', { type: 'check-expired-trials' });

  const { resolveMetaMarketingApiTierCronSchedule } = await import('@agency-platform/shared');
  const { env } = await import('./env.js');
  const tierCronPattern = resolveMetaMarketingApiTierCronSchedule(
    env.META_MARKETING_API_TIER_CRON_BURST,
  );

  // Meta Marketing API tier exercise (Review test ad account, read-only). pg-boss upserts schedule on boot.
  const { META_MARKETING_API_TIER_CRON_JOB_EXPIRE_SECONDS } = await import(
    '@agency-platform/shared'
  );

  await scheduleJob(
    'meta-marketing-api-tier-daily',
    tierCronPattern,
    { type: 'run-daily-tier-exercise' },
    {
      expireInSeconds: META_MARKETING_API_TIER_CRON_JOB_EXPIRE_SECONDS,
      retryLimit: 0,
    },
  );

  logger.info('Recurring jobs scheduled');
}
