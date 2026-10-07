/**
 * Daily Marketing API / Ads Graph exercise for Meta tier day-counting (#134).
 *
 * Scheduled via pg-boss when BACKGROUND_WORKERS_ENABLED=true.
 * Safe: read-only Graph calls against Review BM test ad account only.
 */

import { runMetaMarketingApiTierDailyCron } from '@/services/meta-marketing-api-tier-cron.service.js';
import { logger } from '@/lib/logger.js';

export async function runMetaMarketingApiTierCronJob(): Promise<void> {
  const result = await runMetaMarketingApiTierDailyCron();
  logger.info('meta_marketing_api_tier_cron_job_complete', { ...result });
  if (!result.skipped && !result.success) {
    throw new Error('Meta Marketing API tier daily cron failed');
  }
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
