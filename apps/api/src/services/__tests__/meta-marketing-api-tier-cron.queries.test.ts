import { describe, it, expect, vi, beforeEach } from 'vitest';
import { META_MARKETING_API_TIER_DAILY_AUDIT_ACTION } from '@agency-platform/shared';

vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma.js';
import {
  countConsecutiveFailedTierDays,
  countSuccessfulTierDays,
  hasSuccessfulTierUtcDate,
  listTierRunDaysSince,
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

describe('consecutive failed tier days', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fail = (tierUtcDate: string) => ({ tierUtcDate, anySuccess: false, anyFailure: true });
  const ok = (tierUtcDate: string) => ({ tierUtcDate, anySuccess: true, anyFailure: false });

  it('listTierRunDaysSince maps the per-day SQL rollup', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { tier_utc_date: '2026-10-08', any_success: true, any_failure: true },
      { tier_utc_date: '2026-10-07', any_success: null, any_failure: true },
    ] as never);

    const days = await listTierRunDaysSince(new Date('2026-09-01T00:00:00Z'));

    expect(days).toEqual([
      { tierUtcDate: '2026-10-08', anySuccess: true, anyFailure: true },
      { tierUtcDate: '2026-10-07', anySuccess: false, anyFailure: true },
    ]);
  });

  it('counts each failed day once, however many runs it had', () => {
    expect(countConsecutiveFailedTierDays([fail('2026-10-08'), ok('2026-10-07')], '2026-10-08')).toBe(1);
  });

  it('stops at the most recent day with any success', () => {
    expect(
      countConsecutiveFailedTierDays(
        [fail('2026-10-08'), fail('2026-10-07'), ok('2026-10-06'), fail('2026-10-05')],
        '2026-10-08',
      ),
    ).toBe(2);
  });

  it('a day with both success and failure is not a failed day', () => {
    expect(
      countConsecutiveFailedTierDays(
        [{ tierUtcDate: '2026-10-08', anySuccess: true, anyFailure: true }, fail('2026-10-07')],
        '2026-10-08',
      ),
    ).toBe(0);
  });

  it('skips days with no runs instead of resetting, and ignores days after the run date', () => {
    expect(
      countConsecutiveFailedTierDays(
        [fail('2026-10-09'), fail('2026-10-08'), fail('2026-10-05'), ok('2026-10-01')],
        '2026-10-08',
      ),
    ).toBe(2);
  });

  it('orders unsorted input newest first', () => {
    expect(
      countConsecutiveFailedTierDays([ok('2026-10-06'), fail('2026-10-08'), fail('2026-10-07')], '2026-10-08'),
    ).toBe(2);
  });
});
