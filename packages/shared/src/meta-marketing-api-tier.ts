/** AuditLog.action for append-only Marketing API tier daily exercise (#134). */
export const META_MARKETING_API_TIER_DAILY_AUDIT_ACTION = 'META_MARKETING_API_TIER_DAILY' as const;

/** Meta standard/advanced access tier day-count target for App Review readiness. */
export const META_MARKETING_API_TIER_TARGET_DAYS = 16;

/** Locked prod AuthHub Meta app id for Review BM sandbox (issue #135). */
export const META_REVIEW_LOCKED_APP_ID = '1215220247221414';

/** Default Review BM test ad account (act_557538895783894). */
export const META_REVIEW_DEFAULT_AD_ACCOUNT_NUMERIC = '557538895783894';

export function normalizeMetaAdAccountId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('act_')) return trimmed;
  return `act_${trimmed.replace(/^act_/, '')}`;
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
