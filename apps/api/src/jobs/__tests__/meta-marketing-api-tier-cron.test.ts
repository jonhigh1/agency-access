import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/meta-marketing-api-tier-cron.service.js', () => ({
  runMetaMarketingApiTierDailyCron: vi.fn(),
}));

vi.mock('@/lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { logger } from '@/lib/logger.js';
import { runMetaMarketingApiTierDailyCron } from '@/services/meta-marketing-api-tier-cron.service.js';
import { runMetaMarketingApiTierCronJob } from '../meta-marketing-api-tier-cron.js';

describe('runMetaMarketingApiTierCronJob tick logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs started then completed with call counts on success', async () => {
    vi.mocked(runMetaMarketingApiTierDailyCron).mockResolvedValue({
      success: true,
      calls: [
        { callId: 'ad_account_read', edge: '/act_x', httpStatus: 200, success: true },
        { callId: 'campaigns_list', edge: '/act_x/campaigns', httpStatus: 200, success: true },
      ],
      tierDayCount: 3,
      consecutiveFailures: 0,
      alertedConsecutiveFailures: false,
    });

    await runMetaMarketingApiTierCronJob({ jobId: 'job-abc' });

    expect(logger.info).toHaveBeenCalledWith(
      'meta_marketing_api_tier_cron_tick',
      expect.objectContaining({ status: 'started', jobId: 'job-abc' }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'meta_marketing_api_tier_cron_tick',
      expect.objectContaining({
        status: 'completed',
        jobId: 'job-abc',
        callCount: 2,
        successCount: 2,
        success: true,
      }),
    );
  });

  it('logs started then skipped with reason when service skips', async () => {
    vi.mocked(runMetaMarketingApiTierDailyCron).mockResolvedValue({
      skipped: true,
      skipReason: 'META_MARKETING_API_TIER_CRON_ENABLED=false',
      success: false,
      calls: [],
      tierDayCount: 0,
      consecutiveFailures: 0,
      alertedConsecutiveFailures: false,
    });

    await runMetaMarketingApiTierCronJob({ jobId: 'job-skip' });

    expect(logger.info).toHaveBeenCalledWith(
      'meta_marketing_api_tier_cron_tick',
      expect.objectContaining({
        status: 'skipped',
        jobId: 'job-skip',
        reason: 'META_MARKETING_API_TIER_CRON_ENABLED=false',
      }),
    );
  });
});
