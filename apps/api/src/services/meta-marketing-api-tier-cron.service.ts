import {
  META_GRAPH_VERSION,
  META_MARKETING_API_TIER_CRON_GRAPH_CALLS,
  META_MARKETING_API_TIER_CRON_GRAPH_TIMEOUT_MS,
  META_MARKETING_API_TIER_DAILY_AUDIT_ACTION,
  META_MARKETING_API_TIER_TARGET_DAYS,
  META_REVIEW_DEFAULT_AD_ACCOUNT_NUMERIC,
  META_REVIEW_LOCKED_APP_ID,
  normalizeMetaAdAccountId,
  parseMetaGraphApiErrorText,
  sanitizeMetaGraphErrorMessage,
} from '@agency-platform/shared';
import * as Sentry from '@sentry/node';
import { env } from '@/lib/env.js';
import { logger } from '@/lib/logger.js';
import { metaGraphFetch } from '@/lib/meta-graph-instrumentation.js';
import { prisma } from '@/lib/prisma.js';
import { auditService } from '@/services/audit.service.js';
import {
  countConsecutiveFailedTierDays,
  countSuccessfulTierDays,
  findLastConsecutiveFailureSentryAlert,
  hasSuccessfulTierUtcDate,
  listTierRunDaysSince,
  META_MARKETING_API_TIER_SENTRY_ALERT_KIND,
} from '@/services/meta-marketing-api-tier-cron.queries.js';
import { readMetaTierCronAccessToken } from '@/services/meta-tier-cron-token.service.js';

const GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

/** Meta Graph error fields from a failed call (message sanitized; no token material). */
export interface TierCronMetaError {
  code?: number;
  subcode?: number;
  type?: string;
  message?: string;
  fbtraceId?: string;
}

export interface TierCronCallResult {
  callId: string;
  edge: string;
  httpStatus: number;
  success: boolean;
  metaError?: TierCronMetaError;
}

export interface MetaMarketingApiTierCronResult {
  skipped?: boolean;
  skipReason?: string;
  success: boolean;
  calls: TierCronCallResult[];
  tierDayCount: number;
  /** Consecutive UTC days with failed runs and no successful run (0 on success/skip). */
  consecutiveFailedDays: number;
  alertedConsecutiveFailures: boolean;
}

export interface MetaMarketingApiTierCronDeps {
  now?: () => Date;
  abortSignal?: AbortSignal;
}

function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === 'AbortError' || error.name === 'TimeoutError';
}

function graphCallAbortSignal(deps: MetaMarketingApiTierCronDeps): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(META_MARKETING_API_TIER_CRON_GRAPH_TIMEOUT_MS);
  if (deps.abortSignal) {
    return AbortSignal.any([deps.abortSignal, timeoutSignal]);
  }
  return timeoutSignal;
}

function tierUtcDateFrom(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function resolveAllowedAdAccountId(): string {
  return normalizeMetaAdAccountId(
    env.META_REVIEW_AD_ACCOUNT_ID ?? META_REVIEW_DEFAULT_AD_ACCOUNT_NUMERIC,
  );
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

/** Look-back for the consecutive failed day count (the alert only needs a few days). */
const CONSECUTIVE_FAILED_DAYS_LOOKBACK_DAYS = 35;

/**
 * Consecutive failed UTC days, including the run that was just written to the audit log.
 * Counts days, not runs (see countConsecutiveFailedTierDays), so the current run is counted
 * exactly once and burst-mode runs or pg-boss retries do not inflate it.
 */
async function countConsecutiveFailedDays(now: Date, tierUtcDate: string): Promise<number> {
  const since = new Date(now.getTime() - CONSECUTIVE_FAILED_DAYS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const days = await listTierRunDaysSince(since);
  return countConsecutiveFailedTierDays(days, tierUtcDate);
}

const META_ERROR_MESSAGE_MAX_LENGTH = 300;

/**
 * Remove anything that could identify an account or carry a credential before a Meta error
 * message goes to Sentry or logs: access tokens, act_ ids and long numeric ids.
 */
export function scrubMetaErrorMessage(message: string): string {
  return sanitizeMetaGraphErrorMessage(message)
    .replace(/\bEA[A-Za-z0-9]{20,}\b/g, '[token]')
    .replace(/\bact_\d+\b/gi, 'act_[id]')
    .replace(/\b\d{6,}\b/g, '[id]')
    .slice(0, META_ERROR_MESSAGE_MAX_LENGTH);
}

async function readMetaError(response: Response): Promise<TierCronMetaError | undefined> {
  try {
    const readable = typeof response.clone === 'function' ? response.clone() : response;
    if (typeof readable.text !== 'function') return undefined;
    const details = parseMetaGraphApiErrorText(await readable.text());
    const metaError: TierCronMetaError = {
      ...(details.code !== undefined ? { code: details.code } : {}),
      ...(details.errorSubcode !== undefined ? { subcode: details.errorSubcode } : {}),
      ...(details.type ? { type: details.type } : {}),
      ...(details.message ? { message: scrubMetaErrorMessage(details.message) } : {}),
      ...(details.fbtraceId ? { fbtraceId: details.fbtraceId } : {}),
    };
    return Object.keys(metaError).length > 0 ? metaError : undefined;
  } catch {
    return undefined;
  }
}

async function executeGraphCalls(
  accessToken: string,
  adAccountId: string,
  deps: MetaMarketingApiTierCronDeps,
): Promise<TierCronCallResult[]> {
  const results: TierCronCallResult[] = [];
  const signal = graphCallAbortSignal(deps);

  for (const call of META_MARKETING_API_TIER_CRON_GRAPH_CALLS) {
    const path = call.pathTemplate.replace('{adAccountId}', adAccountId);
    const url = new URL(`${GRAPH_BASE}${path}`);
    url.searchParams.set('fields', call.fields);
    if ('limit' in call && call.limit !== undefined) {
      url.searchParams.set('limit', String(call.limit));
    }

    try {
      const response = await metaGraphFetch(url.toString(), {
        method: 'GET',
        accessToken,
        tokenClass: 'client_user',
        signal,
      });

      const metaError = response.ok ? undefined : await readMetaError(response);
      results.push({
        callId: call.id,
        edge: path,
        httpStatus: response.status,
        success: response.ok,
        ...(metaError ? { metaError } : {}),
      });

      if (!response.ok) {
        break;
      }
    } catch (error) {
      const timedOut = isAbortError(error);
      logger.warn('meta_marketing_api_tier_graph_call_failed', {
        callId: call.id,
        edge: path,
        timedOut,
        error: error instanceof Error ? error.message : String(error),
      });
      results.push({
        callId: call.id,
        edge: path,
        httpStatus: timedOut ? 408 : 0,
        success: false,
      });
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
      consecutiveFailedDays: 0,
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
      consecutiveFailedDays: 0,
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
        consecutiveFailedDays: 0,
        alertedConsecutiveFailures: false,
      };
    }
  }

  const accessToken = await readMetaTierCronAccessToken();
  if (!accessToken) {
    const skipMetadata = {
      metaAppId,
      adAccountId,
      success: false,
      tierUtcDate,
      error: 'missing_meta_tier_cron_token',
      secretName: 'meta_tier_cron_token',
      targetTierDays: META_MARKETING_API_TIER_TARGET_DAYS,
    };
    Sentry.captureMessage('Meta Marketing API tier cron skipped: missing meta_tier_cron_token', {
      level: 'warning',
      extra: skipMetadata,
    });
    logger.warn('meta_marketing_api_tier_daily_skipped', skipMetadata);
    return {
      skipped: true,
      skipReason: 'missing_meta_tier_cron_token',
      success: false,
      calls: [],
      tierDayCount: await countSuccessfulTierDays(),
      consecutiveFailedDays: 0,
      alertedConsecutiveFailures: false,
    };
  }

  const calls = await executeGraphCalls(accessToken, adAccountId, deps);
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
    tokenSecret: 'meta_tier_cron_token',
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

  const consecutiveFailedDays = success ? 0 : await countConsecutiveFailedDays(now, tierUtcDate);
  const alertedConsecutiveFailures = success
    ? false
    : await maybeAlertConsecutiveFailures(consecutiveFailedDays, now, {
        metaAppId,
        adAccountId,
        tierUtcDate,
        graphCalls: calls,
      });

  return {
    success,
    calls,
    tierDayCount,
    consecutiveFailedDays,
    alertedConsecutiveFailures,
  };
}

export interface TierCronAlertContext {
  metaAppId?: string;
  /** Used for the internal audit marker row only; never sent to Sentry. */
  adAccountId?: string;
  tierUtcDate: string;
  graphCalls?: TierCronCallResult[];
}

/**
 * Sentry-safe view of the Graph calls: call id, HTTP status and Meta error fields only. The
 * edge (which embeds the ad account id) is replaced by the call id; tokens never reach here.
 */
export function buildTierCronSentryPayload(graphCalls: TierCronCallResult[] = []): {
  tags: Record<string, string>;
  extra: Record<string, unknown>;
} {
  const failed = graphCalls.find((call) => !call.success);
  const metaError = failed?.metaError;
  const tags: Record<string, string> = {
    ...(failed ? { tier_cron_failed_call: failed.callId, tier_cron_http_status: String(failed.httpStatus) } : {}),
    ...(metaError?.code !== undefined ? { meta_error_code: String(metaError.code) } : {}),
    ...(metaError?.subcode !== undefined ? { meta_error_subcode: String(metaError.subcode) } : {}),
    ...(metaError?.type ? { meta_error_type: metaError.type } : {}),
  };
  const extra: Record<string, unknown> = {
    graphCalls: graphCalls.map((call) => ({
      callId: call.callId,
      httpStatus: call.httpStatus,
      success: call.success,
    })),
    ...(metaError
      ? {
          metaError: {
            code: metaError.code,
            subcode: metaError.subcode,
            type: metaError.type,
            message: metaError.message,
            fbtraceId: metaError.fbtraceId,
          },
        }
      : {}),
  };
  return { tags, extra };
}

export async function maybeAlertConsecutiveFailures(
  consecutiveFailedDays: number,
  now: Date,
  context: TierCronAlertContext,
): Promise<boolean> {
  const threshold = env.META_MARKETING_API_TIER_FAILURE_ALERT_THRESHOLD;
  if (consecutiveFailedDays < threshold) {
    return false;
  }

  const sentryPayload = buildTierCronSentryPayload(context.graphCalls);
  const logContext = {
    metaAppId: context.metaAppId,
    tierUtcDate: context.tierUtcDate,
    consecutiveFailedDays,
    threshold,
    ...sentryPayload.extra,
  };

  const recentAlert = await findLastConsecutiveFailureSentryAlert(now);
  if (recentAlert) {
    logger.warn('meta_marketing_api_tier_daily_consecutive_failures_alert_throttled', {
      ...logContext,
      lastAlertAt: recentAlert.toISOString(),
    });
    return false;
  }

  const dayLabel = consecutiveFailedDays === 1 ? 'UTC day' : 'consecutive UTC days';
  Sentry.captureMessage(
    `Meta Marketing API tier cron: ${consecutiveFailedDays} ${dayLabel} without a successful run`,
    {
      level: 'error',
      // Stable grouping: the count in the message changes daily.
      fingerprint: ['meta-marketing-api-tier-cron', 'consecutive-failed-days'],
      tags: sentryPayload.tags,
      extra: logContext,
    },
  );
  logger.error('meta_marketing_api_tier_daily_consecutive_failures', logContext);

  await auditService.createAuditLog({
    action: META_MARKETING_API_TIER_DAILY_AUDIT_ACTION,
    resourceType: 'meta_marketing_api_tier',
    resourceId: context.adAccountId,
    agencyId: env.META_REVIEW_LAB_AGENCY_ID,
    metadata: {
      kind: META_MARKETING_API_TIER_SENTRY_ALERT_KIND,
      consecutiveFailedDays,
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
