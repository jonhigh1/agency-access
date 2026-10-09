/** AuditLog.action for append-only Marketing API tier daily exercise (#134). */
export const META_MARKETING_API_TIER_DAILY_AUDIT_ACTION = 'META_MARKETING_API_TIER_DAILY' as const;

/** Meta standard/advanced access tier day-count target for App Review readiness. */
export const META_MARKETING_API_TIER_TARGET_DAYS = 16;

/** pg-boss cron when burst mode is off (daily 06:00 UTC). */
export const META_MARKETING_API_TIER_CRON_SCHEDULE_DAILY = '0 6 * * *';

/** pg-boss cron when burst mode is on (144 runs/day; ~864 Graph calls/day at 6 calls/run). */
export const META_MARKETING_API_TIER_CRON_SCHEDULE_BURST = '*/10 * * * *';

/** Max wait per Graph GET in the tier cron (AbortSignal.timeout). */
export const META_MARKETING_API_TIER_CRON_GRAPH_TIMEOUT_MS = 15_000;

/**
 * pg-boss active-job expiry for tier cron runs — must stay below the 10-minute burst interval
 * so a stuck handler cannot block the next scheduled tick.
 */
export const META_MARKETING_API_TIER_CRON_JOB_EXPIRE_SECONDS = 9 * 60;

export function resolveMetaMarketingApiTierCronSchedule(burstEnabled: boolean): string {
  return burstEnabled
    ? META_MARKETING_API_TIER_CRON_SCHEDULE_BURST
    : META_MARKETING_API_TIER_CRON_SCHEDULE_DAILY;
}

/** Locked prod AuthHub Meta app id for Review BM sandbox (issue #135). */
export const META_REVIEW_LOCKED_APP_ID = '1215220247221414';

/** Default Review BM test ad account (act_557538895783894). */
export const META_REVIEW_DEFAULT_AD_ACCOUNT_NUMERIC = '557538895783894';

export function normalizeMetaAdAccountId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('act_')) return trimmed;
  return `act_${trimmed.replace(/^act_/, '')}`;
}

/** One read-only Graph GET exercised by the tier cron. */
export interface MetaMarketingApiTierCronGraphCall {
  readonly id: string;
  readonly description: string;
  readonly pathTemplate: string;
  readonly fields: string;
  readonly limit?: number;
  /** Extra query params (e.g. insights date_preset). */
  readonly params?: Readonly<Record<string, string>>;
}

/** Read-only Graph edges exercised by the daily tier cron (Ads / Marketing API). */
export const META_MARKETING_API_TIER_CRON_GRAPH_CALLS = [
  {
    id: 'ad_account_read',
    description: 'Ad account metadata (Marketing API read)',
    pathTemplate: '/{adAccountId}',
    fields: 'id,name,account_status,currency',
  },
  {
    id: 'campaigns_list',
    description: 'Campaign list on test ad account (Marketing API read)',
    pathTemplate: '/{adAccountId}/campaigns',
    fields: 'id,name,status',
    limit: 5,
  },
] as const;

/**
 * Read-only Graph edges exercised per run when burst mode is on: six distinct Marketing API
 * GETs on the review ad account. Empty lists (no campaigns yet) return 200 and count as success.
 */
export const META_MARKETING_API_TIER_CRON_BURST_GRAPH_CALLS: readonly MetaMarketingApiTierCronGraphCall[] = [
  ...META_MARKETING_API_TIER_CRON_GRAPH_CALLS,
  {
    id: 'adsets_list',
    description: 'Ad set list on test ad account (Marketing API read)',
    pathTemplate: '/{adAccountId}/adsets',
    fields: 'id,name,status',
    limit: 5,
  },
  {
    id: 'ads_list',
    description: 'Ad list on test ad account (Marketing API read)',
    pathTemplate: '/{adAccountId}/ads',
    fields: 'id,name,status',
    limit: 5,
  },
  {
    id: 'account_insights_last_7d',
    description: 'Account-level insights for the last 7 days (Marketing API read)',
    pathTemplate: '/{adAccountId}/insights',
    fields: 'impressions,clicks,spend',
    params: { date_preset: 'last_7d' },
  },
  {
    id: 'adcreatives_list',
    description: 'Ad creative list on test ad account (Marketing API read)',
    pathTemplate: '/{adAccountId}/adcreatives',
    fields: 'id,name,status',
    limit: 5,
  },
];

/** Pause between Graph GETs within one burst run (calls are spaced ~1.5s apart). */
export const META_MARKETING_API_TIER_CRON_BURST_CALL_SPACING_MS = 1_500;

export function resolveMetaMarketingApiTierCronGraphCalls(
  burstEnabled: boolean,
): readonly MetaMarketingApiTierCronGraphCall[] {
  return burstEnabled
    ? META_MARKETING_API_TIER_CRON_BURST_GRAPH_CALLS
    : META_MARKETING_API_TIER_CRON_GRAPH_CALLS;
}

/** Spacing between consecutive Graph GETs in a run (0 when burst mode is off). */
export function resolveMetaMarketingApiTierCronCallSpacingMs(burstEnabled: boolean): number {
  return burstEnabled ? META_MARKETING_API_TIER_CRON_BURST_CALL_SPACING_MS : 0;
}

/** Worst-case Graph time for one run: every call hits its timeout, plus the spacing between calls. */
export function metaMarketingApiTierCronWorstCaseRunMs(burstEnabled: boolean): number {
  const callCount = resolveMetaMarketingApiTierCronGraphCalls(burstEnabled).length;
  return (
    callCount * META_MARKETING_API_TIER_CRON_GRAPH_TIMEOUT_MS +
    Math.max(0, callCount - 1) * resolveMetaMarketingApiTierCronCallSpacingMs(burstEnabled)
  );
}
