import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  META_MARKETING_API_TIER_CRON_JOB_EXPIRE_SECONDS,
  META_MARKETING_API_TIER_CRON_SCHEDULE_BURST,
  META_MARKETING_API_TIER_CRON_SCHEDULE_DAILY,
} from '@agency-platform/shared';

const scheduleJobMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma.js', () => ({
  prisma: {},
}));

vi.mock('@/lib/pg-boss.js', () => ({
  scheduleJob: scheduleJobMock,
  registerHandler: vi.fn(),
  enqueueJob: vi.fn(),
}));

vi.mock('@/lib/env.js', () => ({
  env: {
    META_MARKETING_API_TIER_CRON_BURST: false,
  },
}));

import { env } from '@/lib/env.js';
import { scheduleRecurringJobs } from '../job-handlers.js';

describe('scheduleRecurringJobs meta-marketing-api-tier-daily', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scheduleJobMock.mockResolvedValue(undefined);
    env.META_MARKETING_API_TIER_CRON_BURST = false;
  });

  it('uses daily cron when burst flag is off', async () => {
    await scheduleRecurringJobs();

    expect(scheduleJobMock).toHaveBeenCalledWith(
      'meta-marketing-api-tier-daily',
      META_MARKETING_API_TIER_CRON_SCHEDULE_DAILY,
      { type: 'run-daily-tier-exercise' },
      expect.objectContaining({
        expireInSeconds: META_MARKETING_API_TIER_CRON_JOB_EXPIRE_SECONDS,
        retryLimit: 0,
      }),
    );
  });

  it('uses 10-minute cron when burst flag is on', async () => {
    env.META_MARKETING_API_TIER_CRON_BURST = true;

    await scheduleRecurringJobs();

    expect(scheduleJobMock).toHaveBeenCalledWith(
      'meta-marketing-api-tier-daily',
      META_MARKETING_API_TIER_CRON_SCHEDULE_BURST,
      { type: 'run-daily-tier-exercise' },
      expect.objectContaining({
        expireInSeconds: META_MARKETING_API_TIER_CRON_JOB_EXPIRE_SECONDS,
        retryLimit: 0,
      }),
    );
  });
});
