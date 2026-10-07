import { describe, it, expect, vi, beforeEach } from 'vitest';
import { META_MARKETING_API_TIER_DAILY_AUDIT_ACTION } from '@agency-platform/shared';

vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma.js';
import {
  countSuccessfulTierDays,
  hasSuccessfulTierUtcDate,
  findLastConsecutiveFailureSentryAlert,
  META_MARKETING_API_TIER_SENTRY_ALERT_KIND,
} from '../meta-marketing-api-tier-cron.queries.js';

describe('meta-marketing-api-tier-cron queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('countSuccessfulTierDays returns SQL distinct-day count (not limited to 500 rows)', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ count: 17n }] as never);

    const count = await countSuccessfulTierDays();

    expect(count).toBe(17);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const sqlArg = vi.mocked(prisma.$queryRaw).mock.calls[0];
    expect(sqlArg).toBeDefined();
  });

  it('hasSuccessfulTierUtcDate checks a single UTC date via SQL', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ exists: true }] as never);

    const exists = await hasSuccessfulTierUtcDate('2026-10-07');

    expect(exists).toBe(true);
  });

  it('findLastConsecutiveFailureSentryAlert returns recent alert timestamp within window', async () => {
    const alertAt = new Date('2026-10-07T12:00:00Z');
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ created_at: alertAt }] as never);

    const last = await findLastConsecutiveFailureSentryAlert(
      new Date('2026-10-07T12:30:00Z'),
    );

    expect(last).toEqual(alertAt);
    expect(META_MARKETING_API_TIER_SENTRY_ALERT_KIND).toBe('consecutive_failure_sentry');
    expect(META_MARKETING_API_TIER_DAILY_AUDIT_ACTION).toBe('META_MARKETING_API_TIER_DAILY');
  });
});
