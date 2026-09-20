/**
 * pg-boss Job Queue Integration
 *
 * Replaces BullMQ with Postgres-backed job processing.
 * Uses existing DATABASE_URL connection for job storage.
 *
 * Features:
 * - Delayed jobs via startAfter
 * - Retries with exponential backoff
 * - Cron-like scheduling
 * - Idempotency via singletonKey
 */

import { PgBoss, type SendOptions, type Job, type JobWithMetadata, type QueueResult } from 'pg-boss';
import type { AccessLevel } from '@agency-platform/shared';
import { env } from './env.js';
import { logger } from './logger.js';

// Singleton instance
let boss: PgBoss | null = null;

/**
 * Job names and their payload types
 */
export interface JobRegistry {
  // Token refresh jobs
  'token-refresh-scan': { type: 'check-expiring-tokens' };
  'token-refresh': { connectionId: string; platform: string };

  // Cleanup jobs
  'cleanup-expired-requests': { type: 'delete-expired-requests' };
  'cleanup-agent-operations': { type: 'sanitize-agent-operations' };

  // Trial expiration
  'trial-expiration-check': { type: 'check-expired-trials' };

  // Notification jobs
  'notification': {
    agencyId: string;
    accessRequestId: string;
    clientEmail: string;
    clientName?: string;
    platforms: string[];
    completedAt: string;
  };

  // Webhook delivery
  'webhook-delivery': { eventId: string };

  // Onboarding emails
  'onboarding-email': {
    agencyId: string;
    emailKey: 'welcome_first_step' | 'get_to_first_link' | 'send_the_link' | 'track_status_keep_momentum' | 'turn_one_request_into_workflow' | 'still_waiting_day14' | 'one_client_day30' | 'closing_the_loop_day60';
    accessRequestId?: string;
  };

  // Google native grant execution
  'google-native-grant': { grantId: string };

  // Authorization verification
  'authorization-verification': {
    verificationId: string;
    jobData: {
      accessRequestId: string;
      platform: string;
      clientEmail: string;
      requiredAccessLevel: AccessLevel;
      agencyConnectionId: string;
      agencyIdentity: {
        email?: string;
        businessId?: string;
      };
    };
  };

  // Google client offboarding
  'google-client-offboarding': { runId: string };
}

export type JobName = keyof JobRegistry;

/**
 * Job options with retry/backoff configuration
 */
export interface JobOptions {
  /** Delay before job becomes available (seconds or Date) */
  startAfter?: number | Date;
  /** Unique key to prevent duplicate jobs */
  singletonKey?: string;
  /** Number of retry attempts */
  retryLimit?: number;
  /** Delay between retries in seconds */
  retryDelay?: number;
  /** Exponential backoff multiplier for retries */
  retryBackoff?: boolean;
  /** Job expiration time in seconds */
  expireInSeconds?: number;
  /** Keep completed jobs for this many seconds */
  keepUntil?: number;
  /** Priority (higher = more important) */
  priority?: number;
}

/**
 * Get or create pg-boss instance
 */
export async function getPgBoss(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss({
      connectionString: env.DATABASE_URL,
      // Schema for pg-boss tables (separate from app schema)
      schema: 'pgboss',
      // How often to check for maintenance
      monitorIntervalSeconds: 60,
    });

    boss.on('error', (error: Error) => {
      logger.error('pg-boss error', { error: error.message });
    });

    await boss.start();
    logger.info('pg-boss started successfully');
  }

  return boss;
}

/**
 * Create a queue if it doesn't exist
 * pg-boss requires queues to be created before work() or schedule() can be called
 */
export async function ensureQueue<K extends JobName>(name: K): Promise<void> {
  const pgBoss = await getPgBoss();
  try {
    await pgBoss.createQueue(name);
    logger.debug(`Queue created: ${name}`);
  } catch (error) {
    // Queue may already exist, which is fine
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('already exists')) {
      logger.warn(`Queue creation warning for ${name}:`, { error: errorMessage });
    }
  }
}

/**
 * Create all queues used by this application
 */
export async function ensureAllQueues(): Promise<void> {
  const queueNames: JobName[] = [
    'token-refresh-scan',
    'token-refresh',
    'cleanup-expired-requests',
    'trial-expiration-check',
    'notification',
    'webhook-delivery',
    'onboarding-email',
    'google-native-grant',
    'authorization-verification',
    'google-client-offboarding',
  ];

  await Promise.all(queueNames.map(name => ensureQueue(name)));
  logger.info('All queues ensured');
}

/**
 * Enqueue a job for processing
 */
export async function enqueueJob<K extends JobName>(
  name: K,
  data: JobRegistry[K],
  options?: JobOptions
): Promise<string | null> {
  const pgBoss = await getPgBoss();

  const jobOptions: SendOptions = {
    ...(options?.startAfter !== undefined ? { startAfter: options.startAfter } : {}),
    ...(options?.singletonKey !== undefined ? { singletonKey: options.singletonKey } : {}),
    retryLimit: options?.retryLimit ?? 0,
    retryDelay: options?.retryDelay ?? 0,
    retryBackoff: options?.retryBackoff ?? false,
    ...(options?.expireInSeconds !== undefined
      ? { expireInSeconds: options.expireInSeconds }
      : {}),
    ...(options?.keepUntil !== undefined ? { keepUntil: options.keepUntil } : {}),
    ...(options?.priority !== undefined ? { priority: options.priority } : {}),
  };

  const jobId = await pgBoss.send(name, data, jobOptions);

  if (jobId) {
    logger.debug(`Job enqueued: ${name}`, { jobId, singletonKey: options?.singletonKey });
  }

  return jobId;
}

/**
 * Schedule a recurring job with cron pattern
 * Note: pg-boss requires the queue to exist before scheduling.
 * This function handles queue creation and retries on failure.
 */
export async function scheduleJob<K extends JobName>(
  name: K,
  cronPattern: string,
  data: JobRegistry[K],
  options?: Omit<JobOptions, 'startAfter'>
): Promise<void> {
  const pgBoss = await getPgBoss();

  // Try to schedule with retries (queue may not be immediately available after work() registration)
  const maxRetries = 3;
  const retryDelayMs = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pgBoss.schedule(name, cronPattern, data);
      logger.info(`Scheduled recurring job: ${name}`, { cronPattern });
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // If queue doesn't exist, wait and retry (work() may still be initializing)
      if (errorMessage.includes('does not exist') && attempt < maxRetries) {
        logger.debug(`Queue ${name} not ready, retrying in ${retryDelayMs}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        continue;
      }

      // Log warning but don't throw - scheduling failures shouldn't crash the server
      // Jobs can still be processed on-demand even if scheduling fails
      logger.warn(`Failed to schedule recurring job: ${name}`, {
        error: errorMessage,
        cronPattern,
        attempt
      });
      return;
    }
  }
}

/**
 * Register a job handler
 */
export async function registerHandler<K extends JobName>(
  name: K,
  handler: (job: { data: JobRegistry[K]; id: string; retryCount?: number }) => Promise<void>,
  options?: { teamSize?: number; teamConcurrency?: number }
): Promise<void> {
  const pgBoss = await getPgBoss();

  await pgBoss.work(name, { includeMetadata: true }, async (jobs: JobWithMetadata<unknown>[]) => {
    // Process each job (pg-boss passes an array)
    for (const job of jobs) {
      try {
        await handler({
          data: job.data as JobRegistry[K],
          id: job.id,
          retryCount: job.retryCount,
        });
        logger.debug(`Job completed: ${name}`, { jobId: job.id });
      } catch (error) {
        logger.error(`Job failed: ${name}`, {
          jobId: job.id,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error; // Re-throw to trigger retry
      }
    }
  });

  logger.info(`Registered handler for job: ${name}`);
}

/**
 * Graceful shutdown
 */
export async function stopPgBoss(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
    logger.info('pg-boss stopped');
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<QueueResult[] | null> {
  if (!boss) {
    return null;
  }
  return boss.getQueues();
}
