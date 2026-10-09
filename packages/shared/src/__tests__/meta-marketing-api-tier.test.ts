import { describe, expect, it } from '@jest/globals';
import {
  META_MARKETING_API_TIER_CRON_BURST_CALL_SPACING_MS,
  META_MARKETING_API_TIER_CRON_BURST_GRAPH_CALLS,
  META_MARKETING_API_TIER_CRON_GRAPH_CALLS,
  META_MARKETING_API_TIER_CRON_GRAPH_TIMEOUT_MS,
  META_MARKETING_API_TIER_CRON_JOB_EXPIRE_SECONDS,
  metaMarketingApiTierCronWorstCaseRunMs,
  resolveMetaMarketingApiTierCronCallSpacingMs,
  resolveMetaMarketingApiTierCronGraphCalls,
} from '../meta-marketing-api-tier';

describe('Marketing API tier cron Graph call selection', () => {
  it('burst mode runs six distinct read-only Marketing API edges', () => {
    const calls = resolveMetaMarketingApiTierCronGraphCalls(true);
    expect(calls).toBe(META_MARKETING_API_TIER_CRON_BURST_GRAPH_CALLS);
    expect(calls.map((call) => call.id)).toEqual([
      'ad_account_read',
      'campaigns_list',
      'adsets_list',
      'ads_list',
      'account_insights_last_7d',
      'adcreatives_list',
    ]);
    expect(new Set(calls.map((call) => call.pathTemplate)).size).toBe(6);
    for (const call of calls) {
      expect(call.pathTemplate.startsWith('/{adAccountId}')).toBe(true);
      expect(call.fields.length).toBeGreaterThan(0);
    }
    const insights = calls.find((call) => call.id === 'account_insights_last_7d');
    expect(insights?.params).toEqual({ date_preset: 'last_7d' });
  });

  it('non-burst mode keeps the original two calls with no spacing', () => {
    const calls = resolveMetaMarketingApiTierCronGraphCalls(false);
    expect(calls).toBe(META_MARKETING_API_TIER_CRON_GRAPH_CALLS);
    expect(calls.map((call) => call.id)).toEqual(['ad_account_read', 'campaigns_list']);
    expect(resolveMetaMarketingApiTierCronCallSpacingMs(false)).toBe(0);
  });

  it('spaces burst calls 1-2s apart', () => {
    const spacing = resolveMetaMarketingApiTierCronCallSpacingMs(true);
    expect(spacing).toBe(META_MARKETING_API_TIER_CRON_BURST_CALL_SPACING_MS);
    expect(spacing).toBeGreaterThanOrEqual(1_000);
    expect(spacing).toBeLessThanOrEqual(2_000);
  });

  it('worst-case burst run stays well under the pg-boss job expiry', () => {
    const worstCaseMs = metaMarketingApiTierCronWorstCaseRunMs(true);
    expect(worstCaseMs).toBe(
      6 * META_MARKETING_API_TIER_CRON_GRAPH_TIMEOUT_MS + 5 * META_MARKETING_API_TIER_CRON_BURST_CALL_SPACING_MS,
    );
    expect(worstCaseMs).toBeLessThan((META_MARKETING_API_TIER_CRON_JOB_EXPIRE_SECONDS * 1000) / 4);
  });
});
