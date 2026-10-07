import {
  META_GRAPH_VERSION,
  META_MARKETING_API_TIER_CRON_GRAPH_CALLS,
  META_MARKETING_API_TIER_DAILY_AUDIT_ACTION,
  META_MARKETING_API_TIER_TARGET_DAYS,
  META_REVIEW_DEFAULT_AD_ACCOUNT_NUMERIC,
  META_REVIEW_LOCKED_APP_ID,
  normalizeMetaAdAccountId,
} from '@agency-platform/shared';
import * as Sentry from '@sentry/node';
import { env } from '@/lib/env.js';
import { infisical } from '@/lib/infisical.js';
import { logger } from '@/lib/logger.js';
import { metaGraphFetch } from '@/lib/meta-graph-instrumentation.js';
import { prisma } from '@/lib/prisma.js';
import { auditService } from '@/services/audit.service.js';
import {
  countSuccessfulTierDays,
  findLastConsecutiveFailureSentryAlert,
  hasSuccessfulTierUtcDate,
  META_MARKETING_API_TIER_SENTRY_ALERT_KIND,
} from '@/services/meta-marketing-api-tier-cron.queries.js';

const GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export interface TierCronCallResult {
  callId: string;
  edge: string;
  httpStatus: number;
  success: boolean;
}

export interface MetaMarketingApiTierCronResult {
  skipped?: boolean;
  skipReason?: string;
  success: boolean;
  calls: TierCronCallResult[];
  tierDayCount: number;
  consecutiveFailures: number;
  alertedConsecutiveFailures: boolean;
}

export interface MetaMarketingApiTierCronDeps {
  now?: () => Date;
}

function tierUtcDateFrom(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function reviewDemoSecretName(clerkUserId: string): string {
  return `review_demo_meta_${clerkUserId}`;
}

function resolveLabClerkUserId(): string | null {
  if (env.META_MARKETING_API_TIER_CRON_LAB_USER_ID?.trim()) {
    return env.META_MARKETING_API_TIER_CRON_LAB_USER_ID.trim();
  }
  const first = env.META_REVIEW_LAB_USER_IDS[0];
  return first?.trim() ? first.trim() : null;
}

function resolveAllowedAdAccountId(): string {
  return normalizeMetaAdAccountId(
    env.META_REVIEW_AD_ACCOUNT_ID ?? META_REVIEW_DEFAULT_AD_ACCOUNT_NUMERIC,
  );
}

async function readLabAccessToken(clerkUserId: string): Promise<string | null> {
  try {
    const raw = await infisical.getPlainSecret(reviewDemoSecretName(clerkUserId));
    const parsed = JSON.parse(raw) as { accessToken?: string };
    return parsed.accessToken?.trim() ? parsed.accessToken.trim() : null;
  } catch {
    return null;
  }
}

async function findTodaySuccessLog(tierUtcDate: string) {
  const rows = await prisma.auditLog.findMany({
    where: { action: META_MARKETING_API_TIER_DAILY_AUDIT_ACTION },
    select: { metadata: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  return rows.find((row: { metadata: unknown; createdAt: Date }) => {
    const metadata = row.metadata as { success?: boolean; tierUtcDate?: string; tierDayCount?: number } | null;
    if (metadata?.success !== true) return false;
    const date =
      typeof metadata.tierUtcDate === 'string'
        ? metadata.tierUtcDate
        : tierUtcDateFrom(row.createdAt);
    return date === tierUtcDate;
  });
}

async function countConsecutiveFailuresIncludingToday(todaySuccess: boolean): Promise<number> {
  const rows = await prisma.auditLog.findMany({
    where: { action: META_MARKETING_API_TIER_DAILY_AUDIT_ACTION },
    select: { metadata: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  let consecutive = todaySuccess ? 0 : 1;
  for (const row of rows) {
    const metadata = row.metadata as { success?: boolean; kind?: string } | null;
    if (metadata?.kind === META_MARKETING_API_TIER_SENTRY_ALERT_KIND) continue;
    if (metadata?.success === true) break;
    if (metadata?.success === false) consecutive += 1;
  }
  return consecutive;
}

async function executeGraphCalls(
  accessToken: string,
  adAccountId: string,
): Promise<TierCronCallResult[]> {
  const results: TierCronCallResult[] = [];

  for (const call of META_MARKETING_API_TIER_CRON_GRAPH_CALLS) {
    const path = call.pathTemplate.replace('{adAccountId}', adAccountId);
    const url = new URL(`${GRAPH_BASE}${path}`);
    url.searchParams.set('fields', call.fields);
    if ('limit' in call && call.limit !== undefined) {
      url.searchParams.set('limit', String(call.limit));
    }

    const response = await metaGraphFetch(url.toString(), {
      method: 'GET',
      accessToken,
      tokenClass: 'client_user',
    });

    results.push({
      callId: call.id,
      edge: path,
      httpStatus: response.status,
      success: response.ok,
    });

    if (!response.ok) {
      break;
    }
  }

  return results;
}

async function resolveTierDayCountAfterRun(
  success: boolean,
  tierUtcDate: string,
): Promise<number> {
  const priorSuccessDays = await countSuccessfulTierDays();
  if (!success) {
    return priorSuccessDays;
  }
  const todayAlreadyCounted = await hasSuccessfulTierUtcDate(tierUtcDate);
  return todayAlreadyCounted ? priorSuccessDays : priorSuccessDays + 1;
}

export async function runMetaMarketingApiTierDailyCron(
  deps: MetaMarketingApiTierCronDeps = {},
): Promise<MetaMarketingApiTierCronResult> {
  const now = deps.now?.() ?? new Date();
  const tierUtcDate = tierUtcDateFrom(now);
  const adAccountId = resolveAllowedAdAccountId();
  const metaAppId = env.META_APP_ID;

  if (!env.META_MARKETING_API_TIER_CRON_ENABLED) {
    return {
      skipped: true,
      skipReason: 'META_MARKETING_API_TIER_CRON_ENABLED=false',
      success: false,
      calls: [],
      tierDayCount: 0,
      consecutiveFailures: 0,
      alertedConsecutiveFailures: false,
    };
  }

  if (env.META_REVIEW_DEMO_MOCK_GRAPH) {
    return {
      skipped: true,
      skipReason: 'META_REVIEW_DEMO_MOCK_GRAPH=true',
      success: false,
      calls: [],
      tierDayCount: 0,
      consecutiveFailures: 0,
      alertedConsecutiveFailures: false,
    };
  }

  if (metaAppId !== META_REVIEW_LOCKED_APP_ID) {
    logger.warn('meta_marketing_api_tier_daily_app_id_mismatch', {
      configuredAppId: metaAppId,
      expectedAppId: META_REVIEW_LOCKED_APP_ID,
    });
  }

  if (!env.META_MARKETING_API_TIER_CRON_BURST) {
    const existingToday = await findTodaySuccessLog(tierUtcDate);
    if (existingToday) {
      const metadata = existingToday.metadata as { tierDayCount?: number } | null;
      return {
        skipped: true,
        skipReason: 'already_successful_today',
        success: true,
        calls: [],
        tierDayCount: metadata?.tierDayCount ?? (await countSuccessfulTierDays()),
        consecutiveFailures: 0,
        alertedConsecutiveFailures: false,
      };
    }
  }

  const clerkUserId = resolveLabClerkUserId();
  if (!clerkUserId) {
    const failureMetadata = {
      metaAppId,
      adAccountId,
      success: false,
      tierUtcDate,
      error: 'missing_lab_clerk_user_id',
      targetTierDays: META_MARKETING_API_TIER_TARGET_DAYS,
    };
    await auditService.createAuditLog({
      action: META_MARKETING_API_TIER_DAILY_AUDIT_ACTION,
      resourceType: 'meta_marketing_api_tier',
      resourceId: adAccountId,
      agencyId: env.META_REVIEW_LAB_AGENCY_ID,
      metadata: failureMetadata,
      ipAddress: '127.0.0.1',
      userAgent: 'meta-marketing-api-tier-cron',
    });
    logger.error('meta_marketing_api_tier_daily', failureMetadata);
    return {
      success: false,
      calls: [],
      tierDayCount: await countSuccessfulTierDays(),
      consecutiveFailures: await countConsecutiveFailuresIncludingToday(false),
      alertedConsecutiveFailures: false,
    };
  }

  const accessToken = await readLabAccessToken(clerkUserId);
  if (!accessToken) {
    const failureMetadata = {
      metaAppId,
      adAccountId,
      success: false,
      tierUtcDate,
      error: 'missing_lab_access_token',
      clerkUserId,
      targetTierDays: META_MARKETING_API_TIER_TARGET_DAYS,
    };
    await auditService.createAuditLog({
      action: META_MARKETING_API_TIER_DAILY_AUDIT_ACTION,
      resourceType: 'meta_marketing_api_tier',
      resourceId: adAccountId,
      agencyId: env.META_REVIEW_LAB_AGENCY_ID,
      metadata: failureMetadata,
      ipAddress: '127.0.0.1',
      userAgent: 'meta-marketing-api-tier-cron',
    });
    logger.error('meta_marketing_api_tier_daily', failureMetadata);
    const consecutiveFailures = await countConsecutiveFailuresIncludingToday(false);
    const alerted = await maybeAlertConsecutiveFailures(consecutiveFailures, now, {
      metaAppId,
      adAccountId,
      tierUtcDate,
    });
    return {
      success: false,
      calls: [],
      tierDayCount: await countSuccessfulTierDays(),
      consecutiveFailures,
      alertedConsecutiveFailures: alerted,
    };
  }

  const calls = await executeGraphCalls(accessToken, adAccountId);
  const success = calls.length > 0 && calls.every((call) => call.success);
  const primaryStatus = calls[0]?.httpStatus ?? 0;

  const tierDayCount = await resolveTierDayCountAfterRun(success, tierUtcDate);

  const logPayload = {
    timestamp: now.toISOString(),
    metaAppId,
    adAccountId,
    httpStatus: primaryStatus,
    success,
    tierUtcDate,
    tierDayCount,
    targetTierDays: META_MARKETING_API_TIER_TARGET_DAYS,
    graphCalls: calls,
    clerkUserId,
  };

  await auditService.createAuditLog({
    action: META_MARKETING_API_TIER_DAILY_AUDIT_ACTION,
    resourceType: 'meta_marketing_api_tier',
    resourceId: adAccountId,
    agencyId: env.META_REVIEW_LAB_AGENCY_ID,
    metadata: logPayload,
    ipAddress: '127.0.0.1',
    userAgent: 'meta-marketing-api-tier-cron',
  });

  logger.info('meta_marketing_api_tier_daily', logPayload);

  const consecutiveFailures = success
    ? 0
    : await countConsecutiveFailuresIncludingToday(false);
  const alertedConsecutiveFailures = success
    ? false
    : await maybeAlertConsecutiveFailures(consecutiveFailures, now, {
        metaAppId,
        adAccountId,
        tierUtcDate,
        graphCalls: calls,
      });

  return {
    success,
    calls,
    tierDayCount,
    consecutiveFailures,
    alertedConsecutiveFailures,
  };
}

export async function maybeAlertConsecutiveFailures(
  consecutiveFailures: number,
  now: Date,
  context: Record<string, unknown>,
): Promise<boolean> {
  const threshold = env.META_MARKETING_API_TIER_FAILURE_ALERT_THRESHOLD;
  if (consecutiveFailures < threshold) {
    return false;
  }

  const recentAlert = await findLastConsecutiveFailureSentryAlert(now);
  if (recentAlert) {
    logger.warn('meta_marketing_api_tier_daily_consecutive_failures_alert_throttled', {
      ...context,
      consecutiveFailures,
      threshold,
      lastAlertAt: recentAlert.toISOString(),
    });
    return false;
  }

  Sentry.captureMessage(
    `Meta Marketing API tier cron: ${consecutiveFailures} consecutive daily failures`,
    {
      level: 'error',
      extra: {
        ...context,
        consecutiveFailures,
        threshold,
      },
    },
  );
  logger.error('meta_marketing_api_tier_daily_consecutive_failures', {
    ...context,
    consecutiveFailures,
    threshold,
  });

  await auditService.createAuditLog({
    action: META_MARKETING_API_TIER_DAILY_AUDIT_ACTION,
    resourceType: 'meta_marketing_api_tier',
    resourceId: typeof context.adAccountId === 'string' ? context.adAccountId : undefined,
    agencyId: env.META_REVIEW_LAB_AGENCY_ID,
    metadata: {
      kind: META_MARKETING_API_TIER_SENTRY_ALERT_KIND,
      consecutiveFailures,
      threshold,
      tierUtcDate: context.tierUtcDate,
      metaAppId: context.metaAppId,
      adAccountId: context.adAccountId,
    },
    ipAddress: '127.0.0.1',
    userAgent: 'meta-marketing-api-tier-cron',
  });

  return true;
}
