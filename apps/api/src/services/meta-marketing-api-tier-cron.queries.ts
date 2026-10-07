import { META_MARKETING_API_TIER_DAILY_AUDIT_ACTION } from '@agency-platform/shared';
import { prisma } from '@/lib/prisma.js';

export const META_MARKETING_API_TIER_SENTRY_ALERT_KIND = 'consecutive_failure_sentry' as const;

const ONE_HOUR_MS = 60 * 60 * 1000;

function tierUtcDateFromCreatedAt(createdAt: Date): string {
  return createdAt.toISOString().slice(0, 10);
}

/**
 * Distinct UTC dates with at least one successful tier cron run (all history).
 * Uses SQL so burst mode (>500 rows) does not truncate counts.
 */
export async function countSuccessfulTierDays(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT COALESCE(
      metadata->>'tierUtcDate',
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    )) AS count
    FROM audit_logs
    WHERE action = ${META_MARKETING_API_TIER_DAILY_AUDIT_ACTION}
      AND (metadata->>'success') = 'true'
  `;
  return Number(rows[0]?.count ?? 0n);
}

export async function hasSuccessfulTierUtcDate(tierUtcDate: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM audit_logs
      WHERE action = ${META_MARKETING_API_TIER_DAILY_AUDIT_ACTION}
        AND (metadata->>'success') = 'true'
        AND COALESCE(
          metadata->>'tierUtcDate',
          to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
        ) = ${tierUtcDate}
    ) AS exists
  `;
  return rows[0]?.exists === true;
}

export async function findLastConsecutiveFailureSentryAlert(
  now: Date,
  withinMs: number = ONE_HOUR_MS,
): Promise<Date | null> {
  const since = new Date(now.getTime() - withinMs);
  const rows = await prisma.$queryRaw<{ created_at: Date }[]>`
    SELECT created_at
    FROM audit_logs
    WHERE action = ${META_MARKETING_API_TIER_DAILY_AUDIT_ACTION}
      AND metadata->>'kind' = ${META_MARKETING_API_TIER_SENTRY_ALERT_KIND}
      AND created_at >= ${since}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0]?.created_at ?? null;
}
