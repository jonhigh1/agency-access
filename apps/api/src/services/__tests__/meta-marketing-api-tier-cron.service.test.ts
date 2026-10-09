import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  META_MARKETING_API_TIER_DAILY_AUDIT_ACTION,
  META_REVIEW_DEFAULT_AD_ACCOUNT_NUMERIC,
  normalizeMetaAdAccountId,
} from '@agency-platform/shared';

vi.mock('@/lib/env.js', () => ({
  env: {
    META_APP_ID: '1215220247221414',
    META_MARKETING_API_TIER_CRON_ENABLED: true,
    META_MARKETING_API_TIER_CRON_BURST: false,
    META_MARKETING_API_TIER_CRON_LAB_USER_ID: 'user_lab_reviewer',
    META_MARKETING_API_TIER_FAILURE_ALERT_THRESHOLD: 3,
    META_REVIEW_DEMO_MOCK_GRAPH: false,
    META_REVIEW_AD_ACCOUNT_ID: META_REVIEW_DEFAULT_AD_ACCOUNT_NUMERIC,
    META_REVIEW_LAB_USER_IDS: ['user_lab_reviewer'],
    META_REVIEW_LAB_AGENCY_ID: 'review-lab-agency',
  },
}));

vi.mock('@/services/meta-tier-cron-token.service.js', () => ({
  readMetaTierCronAccessToken: vi.fn(),
}));

vi.mock('@/lib/meta-graph-instrumentation.js', () => ({
  metaGraphFetch: vi.fn(),
}));

vi.mock('@/lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/services/audit.service.js', () => ({
  auditService: {
    createAuditLog: vi.fn(),
  },
}));

vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    auditLog: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@sentry/node', () => ({
  captureMessage: vi.fn(),
}));

import { readMetaTierCronAccessToken } from '@/services/meta-tier-cron-token.service.js';
import { metaGraphFetch } from '@/lib/meta-graph-instrumentation.js';
import { logger } from '@/lib/logger.js';
import { META_MARKETING_API_TIER_CRON_GRAPH_TIMEOUT_MS } from '@agency-platform/shared';
import { auditService } from '@/services/audit.service.js';
import { prisma } from '@/lib/prisma.js';
import * as Sentry from '@sentry/node';
import {
  runMetaMarketingApiTierDailyCron,
  maybeAlertConsecutiveFailures,
  scrubMetaErrorMessage,
  type MetaMarketingApiTierCronDeps,
} from '../meta-marketing-api-tier-cron.service.js';
import type { TierRunDay } from '../meta-marketing-api-tier-cron.queries.js';
import { META_MARKETING_API_TIER_SENTRY_ALERT_KIND } from '../meta-marketing-api-tier-cron.queries.js';

const allowedAdAccount = normalizeMetaAdAccountId(META_REVIEW_DEFAULT_AD_ACCOUNT_NUMERIC);

function mockTierDayCount(
  count: number,
  options?: { todayAlreadySuccessful?: boolean; runDays?: TierRunDay[] },
) {
  vi.mocked(prisma.$queryRaw).mockImplementation(async (query) => {
    const strings = Array.isArray(query) ? query : [query];
    const sql = strings.join(' ');
    if (sql.includes('BOOL_OR')) {
      return (options?.runDays ?? []).map((day) => ({
        tier_utc_date: day.tierUtcDate,
        any_success: day.anySuccess,
        any_failure: day.anyFailure,
      })) as never;
    }
    if (sql.includes('COUNT(DISTINCT')) {
      return [{ count: BigInt(count) }] as never;
    }
    if (sql.includes('EXISTS')) {
      return [{ exists: options?.todayAlreadySuccessful ?? false }] as never;
    }
    if (sql.includes("metadata->>'kind'")) {
      return [] as never;
    }
    return [] as never;
  });
}

function mockGraphOk() {
  vi.mocked(metaGraphFetch).mockResolvedValue({
    ok: true,
    status: 200,
  } as Response);
}

describe('runMetaMarketingApiTierDailyCron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readMetaTierCronAccessToken).mockResolvedValue('lab-tier-cron-token');
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    mockTierDayCount(0);
    vi.mocked(auditService.createAuditLog).mockResolvedValue({ data: {}, error: null });
    mockGraphOk();
  });

  it('skips when cron flag is disabled', async () => {
    const { env } = await import('@/lib/env.js');
    const previous = env.META_MARKETING_API_TIER_CRON_ENABLED;
    env.META_MARKETING_API_TIER_CRON_ENABLED = false;

    const result = await runMetaMarketingApiTierDailyCron();

    expect(result.skipped).toBe(true);
    expect(metaGraphFetch).not.toHaveBeenCalled();
    env.META_MARKETING_API_TIER_CRON_ENABLED = previous;
  });

  it('skips without Graph when meta_tier_cron_token is missing', async () => {
    vi.mocked(readMetaTierCronAccessToken).mockResolvedValue(null);

    const result = await runMetaMarketingApiTierDailyCron();

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('missing_meta_tier_cron_token');
    expect(metaGraphFetch).not.toHaveBeenCalled();
  });

  it('calls read-only Marketing API edges on the locked test ad account only', async () => {
    const result = await runMetaMarketingApiTierDailyCron();

    expect(result.success).toBe(true);
    expect(result.skipped).toBeFalsy();
    expect(metaGraphFetch).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(metaGraphFetch).mock.calls) {
      expect(call[0]).toContain(allowedAdAccount);
      expect(call[0]).toContain('graph.facebook.com');
    }
    expect(result.calls.every((c) => c.success && c.httpStatus === 200)).toBe(true);
  });

  it('append-only audit log includes app id, ad account, status, and tier day count', async () => {
    mockTierDayCount(1);

    const now = new Date('2026-10-07T06:00:00Z');
    const deps: MetaMarketingApiTierCronDeps = { now: () => now };

    await runMetaMarketingApiTierDailyCron(deps);

    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: META_MARKETING_API_TIER_DAILY_AUDIT_ACTION,
        resourceType: 'meta_marketing_api_tier',
        resourceId: allowedAdAccount,
        metadata: expect.objectContaining({
          metaAppId: '1215220247221414',
          adAccountId: allowedAdAccount,
          success: true,
          tierDayCount: 2,
          tierUtcDate: '2026-10-07',
        }),
      }),
    );
  });

  it('records failure and alerts after N consecutive failed days', async () => {
    vi.mocked(metaGraphFetch).mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);
    // The audit row for the current run is already written when the count runs, so the
    // days rollup includes today.
    mockTierDayCount(0, {
      runDays: [
        { tierUtcDate: '2026-10-07', anySuccess: false, anyFailure: true },
        { tierUtcDate: '2026-10-06', anySuccess: false, anyFailure: true },
        { tierUtcDate: '2026-10-05', anySuccess: false, anyFailure: true },
        { tierUtcDate: '2026-10-04', anySuccess: true, anyFailure: false },
      ],
    });

    const result = await runMetaMarketingApiTierDailyCron({
      now: () => new Date('2026-10-07T06:00:00Z'),
    });

    expect(result.success).toBe(false);
    expect(result.consecutiveFailedDays).toBe(3);
    expect(result.alertedConsecutiveFailures).toBe(true);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Meta Marketing API tier cron: 3 consecutive UTC days without a successful run',
      expect.objectContaining({
        level: 'error',
        fingerprint: ['meta-marketing-api-tier-cron', 'consecutive-failed-days'],
        extra: expect.objectContaining({ consecutiveFailedDays: 3, threshold: 3 }),
      }),
    );
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ success: false, httpStatus: 403 }),
      }),
    );
  });

  it('counts the current run once: two failed runs today after a success yesterday is 1 day', async () => {
    vi.mocked(metaGraphFetch).mockResolvedValue({ ok: false, status: 403 } as Response);
    mockTierDayCount(0, {
      runDays: [
        { tierUtcDate: '2026-10-08', anySuccess: false, anyFailure: true },
        { tierUtcDate: '2026-10-07', anySuccess: true, anyFailure: false },
      ],
    });

    const result = await runMetaMarketingApiTierDailyCron({
      now: () => new Date('2026-10-08T18:00:00Z'),
    });

    expect(result.consecutiveFailedDays).toBe(1);
    expect(result.alertedConsecutiveFailures).toBe(false);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('burst mode: failed runs after a same-day success are not a failed day', async () => {
    const { env } = await import('@/lib/env.js');
    env.META_MARKETING_API_TIER_CRON_BURST = true;
    vi.mocked(metaGraphFetch).mockResolvedValue({ ok: false, status: 403 } as Response);
    mockTierDayCount(2, {
      todayAlreadySuccessful: true,
      runDays: [{ tierUtcDate: '2026-10-08', anySuccess: true, anyFailure: true }],
    });

    const result = await runMetaMarketingApiTierDailyCron({
      now: () => new Date('2026-10-08T18:00:00Z'),
    });

    expect(result.success).toBe(false);
    expect(result.consecutiveFailedDays).toBe(0);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    env.META_MARKETING_API_TIER_CRON_BURST = false;
  });

  it('sends Meta error code, subcode, type, message and fbtrace id to Sentry without ids or tokens', async () => {
    const body = JSON.stringify({
      error: {
        message:
          '(#200) Ad account owner has NOT grant ads_management or ads_read permission for act_100000000000002 (user 1234567890123) access_token=EAAsecretsecretsecretsecret',
        type: 'OAuthException',
        code: 200,
        error_subcode: 1487694,
        fbtrace_id: 'AbCdEfGhIjKlMnOpQrStUv-',
      },
    });
    vi.mocked(metaGraphFetch).mockResolvedValue(new Response(body, { status: 403 }));
    mockTierDayCount(0, {
      runDays: [
        { tierUtcDate: '2026-10-08', anySuccess: false, anyFailure: true },
        { tierUtcDate: '2026-10-07', anySuccess: false, anyFailure: true },
        { tierUtcDate: '2026-10-06', anySuccess: false, anyFailure: true },
      ],
    });

    const result = await runMetaMarketingApiTierDailyCron({
      now: () => new Date('2026-10-08T18:00:00Z'),
    });

    expect(result.calls[0]?.metaError).toEqual(
      expect.objectContaining({ code: 200, subcode: 1487694, type: 'OAuthException' }),
    );
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    const [, captureContext] = vi.mocked(Sentry.captureMessage).mock.calls[0] as [
      string,
      { tags: Record<string, string>; extra: Record<string, unknown> },
    ];
    expect(captureContext.tags).toEqual(
      expect.objectContaining({
        meta_error_code: '200',
        meta_error_subcode: '1487694',
        meta_error_type: 'OAuthException',
        tier_cron_failed_call: 'ad_account_read',
        tier_cron_http_status: '403',
      }),
    );
    expect(captureContext.extra.metaError).toEqual({
      code: 200,
      subcode: 1487694,
      type: 'OAuthException',
      message: expect.stringContaining('(#200) Ad account owner has NOT grant ads_management'),
      fbtraceId: 'AbCdEfGhIjKlMnOpQrStUv-',
    });

    const serialized = JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls);
    expect(serialized).not.toContain('100000000000002');
    expect(serialized).not.toContain('1234567890123');
    expect(serialized).not.toContain('EAAsecret');
    expect(serialized).not.toContain('lab-tier-cron-token');
    expect(serialized).not.toContain('adAccountId');
  });

  it('does not call Graph when today already logged a success (burst off)', async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      {
        createdAt: new Date('2026-10-07T05:00:00Z'),
        metadata: { success: true, tierUtcDate: '2026-10-07', tierDayCount: 5 },
      },
    ] as never);

    const result = await runMetaMarketingApiTierDailyCron({
      now: () => new Date('2026-10-07T12:00:00Z'),
    });

    expect(result.skipped).toBe(true);
    expect(result.tierDayCount).toBe(5);
    expect(metaGraphFetch).not.toHaveBeenCalled();
  });

  it('passes a bounded AbortSignal to metaGraphFetch', async () => {
    await runMetaMarketingApiTierDailyCron();

    expect(metaGraphFetch).toHaveBeenCalled();
    const init = vi.mocked(metaGraphFetch).mock.calls[0][1];
    expect(init?.signal).toBeDefined();
    expect(META_MARKETING_API_TIER_CRON_GRAPH_TIMEOUT_MS).toBe(15_000);
  });

  it('records timeout as failed call without throwing', async () => {
    vi.mocked(metaGraphFetch).mockRejectedValue(
      Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' }),
    );

    const result = await runMetaMarketingApiTierDailyCron();

    expect(result.success).toBe(false);
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]?.success).toBe(false);
    expect(result.calls[0]?.httpStatus).toBe(408);
    expect(logger.warn).toHaveBeenCalledWith(
      'meta_marketing_api_tier_graph_call_failed',
      expect.objectContaining({ timedOut: true }),
    );
  });

  it('calls Graph again same UTC day when burst mode is on', async () => {
    const { env } = await import('@/lib/env.js');
    env.META_MARKETING_API_TIER_CRON_BURST = true;

    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      {
        createdAt: new Date('2026-10-07T05:00:00Z'),
        metadata: { success: true, tierUtcDate: '2026-10-07', tierDayCount: 5 },
      },
    ] as never);
    mockTierDayCount(1, { todayAlreadySuccessful: true });

    vi.useFakeTimers();
    try {
      const run = runMetaMarketingApiTierDailyCron({
        now: () => new Date('2026-10-07T12:00:00Z'),
      });
      await vi.runAllTimersAsync();
      const result = await run;

      expect(result.skipped).toBeFalsy();
      expect(metaGraphFetch).toHaveBeenCalledTimes(6);
    } finally {
      vi.useRealTimers();
      env.META_MARKETING_API_TIER_CRON_BURST = false;
    }
  });
});

describe('runMetaMarketingApiTierDailyCron burst mode call list and spacing', () => {
  const fakeAdAccount = 'act_1000000000001';
  let previousAdAccount: string | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { env } = await import('@/lib/env.js');
    previousAdAccount = env.META_REVIEW_AD_ACCOUNT_ID;
    env.META_REVIEW_AD_ACCOUNT_ID = fakeAdAccount;
    env.META_MARKETING_API_TIER_CRON_BURST = true;
    vi.mocked(readMetaTierCronAccessToken).mockResolvedValue('lab-tier-cron-token');
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    mockTierDayCount(0);
    vi.mocked(auditService.createAuditLog).mockResolvedValue({ data: {}, error: null });
    mockGraphOk();
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    const { env } = await import('@/lib/env.js');
    env.META_REVIEW_AD_ACCOUNT_ID = previousAdAccount;
    env.META_MARKETING_API_TIER_CRON_BURST = false;
  });

  it('makes six GETs on distinct read-only edges of the configured ad account', async () => {
    const run = runMetaMarketingApiTierDailyCron();
    await vi.runAllTimersAsync();
    const result = await run;

    expect(result.success).toBe(true);
    expect(result.calls.map((call) => call.callId)).toEqual([
      'ad_account_read',
      'campaigns_list',
      'adsets_list',
      'ads_list',
      'account_insights_last_7d',
      'adcreatives_list',
    ]);

    const fetchCalls = vi.mocked(metaGraphFetch).mock.calls;
    expect(fetchCalls).toHaveLength(6);
    const paths = fetchCalls.map(([url]) => new URL(url).pathname.replace(/^\/v[\d.]+/, ''));
    expect(paths).toEqual([
      `/${fakeAdAccount}`,
      `/${fakeAdAccount}/campaigns`,
      `/${fakeAdAccount}/adsets`,
      `/${fakeAdAccount}/ads`,
      `/${fakeAdAccount}/insights`,
      `/${fakeAdAccount}/adcreatives`,
    ]);
    for (const [url, init] of fetchCalls) {
      expect(new URL(url).hostname).toBe('graph.facebook.com');
      expect(init.method).toBe('GET');
      expect(init.signal).toBeDefined();
    }
    const insightsUrl = new URL(fetchCalls[4][0]);
    expect(insightsUrl.searchParams.get('date_preset')).toBe('last_7d');
  });

  it('treats empty 200 lists as success', async () => {
    vi.mocked(metaGraphFetch).mockImplementation(
      async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    const run = runMetaMarketingApiTierDailyCron();
    await vi.runAllTimersAsync();
    const result = await run;

    expect(result.success).toBe(true);
    expect(result.calls).toHaveLength(6);
  });

  it('spaces calls 1.5s apart', async () => {
    const run = runMetaMarketingApiTierDailyCron();

    await vi.advanceTimersByTimeAsync(0);
    expect(metaGraphFetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_499);
    expect(metaGraphFetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(metaGraphFetch).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1_500 * 4);
    expect(metaGraphFetch).toHaveBeenCalledTimes(6);

    const result = await run;
    expect(result.success).toBe(true);
  });

  it('stops at the first failed call and keeps the failure in the audit log', async () => {
    vi.mocked(metaGraphFetch)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 403 } as Response);

    const run = runMetaMarketingApiTierDailyCron();
    await vi.runAllTimersAsync();
    const result = await run;

    expect(result.success).toBe(false);
    expect(metaGraphFetch).toHaveBeenCalledTimes(2);
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ success: false }),
      }),
    );
  });
});

describe('runMetaMarketingApiTierDailyCron non-burst mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readMetaTierCronAccessToken).mockResolvedValue('lab-tier-cron-token');
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    mockTierDayCount(0);
    vi.mocked(auditService.createAuditLog).mockResolvedValue({ data: {}, error: null });
    mockGraphOk();
  });

  it('makes the original two GETs back to back with no spacing timers', async () => {
    vi.useFakeTimers();
    try {
      const result = await runMetaMarketingApiTierDailyCron();

      expect(vi.getTimerCount()).toBe(0);
      expect(result.calls.map((call) => call.callId)).toEqual(['ad_account_read', 'campaigns_list']);
      expect(metaGraphFetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('maybeAlertConsecutiveFailures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auditService.createAuditLog).mockResolvedValue({ data: {}, error: null });
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
  });

  it('does not alert below the failed-day threshold', async () => {
    const fired = await maybeAlertConsecutiveFailures(2, new Date('2026-10-07T12:00:00Z'), {
      metaAppId: '1215220247221414',
      adAccountId: allowedAdAccount,
      tierUtcDate: '2026-10-07',
    });
    expect(fired).toBe(false);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('sends Sentry at most once per hour', async () => {
    const now = new Date('2026-10-07T12:00:00Z');

    const first = await maybeAlertConsecutiveFailures(3, now, {
      metaAppId: '1215220247221414',
      adAccountId: allowedAdAccount,
      tierUtcDate: '2026-10-07',
    });
    expect(first).toBe(true);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);

    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { created_at: new Date('2026-10-07T11:30:00Z') },
    ] as never);

    const second = await maybeAlertConsecutiveFailures(3, now, {
      metaAppId: '1215220247221414',
      adAccountId: allowedAdAccount,
      tierUtcDate: '2026-10-07',
    });
    expect(second).toBe(false);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
  });

  it('writes alert marker audit row when Sentry fires', async () => {
    await maybeAlertConsecutiveFailures(4, new Date('2026-10-07T12:00:00Z'), {
      metaAppId: '1215220247221414',
      adAccountId: allowedAdAccount,
      tierUtcDate: '2026-10-07',
    });

    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          kind: META_MARKETING_API_TIER_SENTRY_ALERT_KIND,
          consecutiveFailedDays: 4,
        }),
      }),
    );
  });
});

describe('scrubMetaErrorMessage', () => {
  it('removes tokens, act_ ids and long numeric ids, keeps the Meta error text', () => {
    const scrubbed = scrubMetaErrorMessage(
      '(#100) Unsupported get request on act_100000000000002, object 120200000000001 access_token=EAAabc EAABwzLixnjYBO1234567890abcdefXYZ',
    );
    expect(scrubbed).toContain('(#100) Unsupported get request on act_[id]');
    expect(scrubbed).not.toMatch(/\d{6,}/);
    expect(scrubbed).not.toContain('EAAabc');
    expect(scrubbed).not.toContain('EAABwz');
  });

  it('caps length', () => {
    expect(scrubMetaErrorMessage('x'.repeat(1000))).toHaveLength(300);
  });
});
