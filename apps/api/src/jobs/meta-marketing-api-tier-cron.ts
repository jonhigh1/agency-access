/**
 * Daily Marketing API / Ads Graph exercise for Meta tier day-counting (#134).
 *
 * Scheduled via pg-boss when BACKGROUND_WORKERS_ENABLED=true.
 * Safe: read-only Graph calls against Review BM test ad account only.
 */

import type { MetaMarketingApiTierCronResult } from '@/services/meta-marketing-api-tier-cron.service.js';
import { runMetaMarketingApiTierDailyCron } from '@/services/meta-marketing-api-tier-cron.service.js';
import { logger } from '@/lib/logger.js';

export interface MetaMarketingApiTierCronJobContext {
  jobId?: string;
  abortSignal?: AbortSignal;
}

function logCronTick(
  payload:
    | { status: 'started'; jobId: string }
    | {
        status: 'completed';
        jobId: string;
        callCount: number;
        successCount: number;
        success: boolean;
      }
    | { status: 'skipped'; jobId: string; reason: string | undefined },
): void {
  logger.info('meta_marketing_api_tier_cron_tick', payload);
}

export async function runMetaMarketingApiTierCronJob(
  context: MetaMarketingApiTierCronJobContext = {},
): Promise<MetaMarketingApiTierCronResult> {
  const jobId = context.jobId ?? 'manual';
  logCronTick({ status: 'started', jobId });

  const result = await runMetaMarketingApiTierDailyCron({
    abortSignal: context.abortSignal,
  });

  if (result.skipped) {
    logCronTick({ status: 'skipped', jobId, reason: result.skipReason });
    return result;
  }

  const successCount = result.calls.filter((call) => call.success).length;
  logCronTick({
    status: 'completed',
    jobId,
    callCount: result.calls.length,
    successCount,
    success: result.success,
  });

  logger.info('meta_marketing_api_tier_cron_job_complete', {
    jobId,
    success: result.success,
    callCount: result.calls.length,
    successCount,
    tierDayCount: result.tierDayCount,
  });

  if (!result.success) {
    throw new Error('Meta Marketing API tier daily cron failed');
  }

  return result;
}

const isDirectExecution =
  process.argv[1]?.includes('meta-marketing-api-tier-cron');

if (isDirectExecution) {
  runMetaMarketingApiTierCronJob()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Meta Marketing API tier cron failed:', error);
      process.exit(1);
    });
}
