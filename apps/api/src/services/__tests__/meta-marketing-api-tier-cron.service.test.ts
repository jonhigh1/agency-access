import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  META_MARKETING_API_TIER_DAILY_AUDIT_ACTION,
  META_REVIEW_DEFAULT_AD_ACCOUNT_NUMERIC,
  normalizeMetaAdAccountId,
} from '@agency-platform/shared';

vi.mock('@/lib/env.js', () => ({
  env: {
    META_APP_ID: '1215220247221414',
    META_MARKETING_API_TIER_CRON_ENABLED: true,
    META_MARKETING_API_TIER_CRON_LAB_USER_ID: 'user_lab_reviewer',
    META_MARKETING_API_TIER_FAILURE_ALERT_THRESHOLD: 3,
    META_REVIEW_DEMO_MOCK_GRAPH: false,
    META_REVIEW_AD_ACCOUNT_ID: META_REVIEW_DEFAULT_AD_ACCOUNT_NUMERIC,
    META_REVIEW_LAB_USER_IDS: ['user_lab_reviewer'],
    META_REVIEW_LAB_AGENCY_ID: 'review-lab-agency',
  },
}));

vi.mock('@/lib/infisical.js', () => ({
  infisical: {
    getPlainSecret: vi.fn(),
  },
}));

vi.mock('@/lib/meta-graph-instrumentation.js', () => ({
  metaGraphFetch: vi.fn(),
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
  },
}));

vi.mock('@sentry/node', () => ({
  captureMessage: vi.fn(),
}));

import { infisical } from '@/lib/infisical.js';
import { metaGraphFetch } from '@/lib/meta-graph-instrumentation.js';
import { auditService } from '@/services/audit.service.js';
import { prisma } from '@/lib/prisma.js';
import * as Sentry from '@sentry/node';
import {
  runMetaMarketingApiTierDailyCron,
  type MetaMarketingApiTierCronDeps,
} from '../meta-marketing-api-tier-cron.service.js';

const allowedAdAccount = normalizeMetaAdAccountId(META_REVIEW_DEFAULT_AD_ACCOUNT_NUMERIC);

function mockGraphOk() {
  vi.mocked(metaGraphFetch).mockResolvedValue({
    ok: true,
    status: 200,
  } as Response);
}

describe('runMetaMarketingApiTierDailyCron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(infisical.getPlainSecret).mockResolvedValue(
      JSON.stringify({ accessToken: 'lab-token' }),
    );
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
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
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      {
        createdAt: new Date('2026-10-05T12:00:00Z'),
        metadata: { success: true, tierUtcDate: '2026-10-05' },
      },
    ] as never);

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

    vi.mocked(prisma.auditLog.findMany).mockImplementation(async (args) => {
      const take = args?.take ?? 10;
      if (take === 120) return [];
      return [
        { createdAt: new Date('2026-10-06T06:00:00Z'), metadata: { success: false } },
        { createdAt: new Date('2026-10-05T06:00:00Z'), metadata: { success: false } },
      ] as never;
    });

    const result = await runMetaMarketingApiTierDailyCron({
      now: () => new Date('2026-10-07T06:00:00Z'),
    });

    expect(result.success).toBe(false);
    expect(result.consecutiveFailures).toBe(3);
    expect(Sentry.captureMessage).toHaveBeenCalled();
    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ success: false, httpStatus: 403 }),
      }),
    );
  });

  it('does not call Graph when today already logged a success', async () => {
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
});
