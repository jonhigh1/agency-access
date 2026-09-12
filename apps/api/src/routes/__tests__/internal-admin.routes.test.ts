import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { internalAdminRoutes } from '../internal-admin.routes.js';
import { internalAdminService } from '@/services/internal-admin.service.js';
import { subscriptionService } from '@/services/subscription.service.js';
import type {
  AffiliateAdminCommissionAdjustment,
  AffiliateAdminPartnerMutation,
  AffiliateAdminReferralDisqualificationInput,
} from '@agency-platform/shared';
import { agentTelemetryService } from '@/services/agent-telemetry.service.js';

vi.mock('@/lib/env.js', () => ({
  env: {
    INTERNAL_ADMIN_USER_IDS: [],
    INTERNAL_ADMIN_EMAILS: [],
    NODE_ENV: 'test',
  },
}));

vi.mock('@/services/internal-admin.service.js', () => ({
  internalAdminService: {
    getOverview: vi.fn(),
    listAgencies: vi.fn(),
    getAgencyDetail: vi.fn(),
    listWebhookEndpoints: vi.fn(),
    getWebhookDetail: vi.fn(),
    listSubscriptions: vi.fn(),
    listAffiliatePayoutBatches: vi.fn(),
    generateAffiliatePayoutBatch: vi.fn(),
    exportAffiliatePayoutBatch: vi.fn(),
    listAffiliateFraudQueue: vi.fn(),
    listAffiliatePartners: vi.fn(),
    updateAffiliatePartner: vi.fn(),
    getAffiliatePartnerDetail: vi.fn(),
    disableAffiliateLink: vi.fn(),
    disqualifyAffiliateReferral: vi.fn(),
    resolveAffiliateReferralReview: vi.fn(),
    adjustAffiliateCommission: vi.fn(),
  },
}));
vi.mock('@/services/subscription.service.js', () => ({
  subscriptionService: {
    upgradeSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
  },
}));

vi.mock('@/middleware/auth.js', () => ({
  authenticate: () => async (request: any, reply: any) => {
    if (!request.headers.authorization) {
      return reply.code(401).send({
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Missing token' },
      });
    }

    const mockUserHeader = request.headers['x-mock-user'];
    if (!mockUserHeader || typeof mockUserHeader !== 'string') {
      request.user = { sub: 'regular_user' };
      return;
    }

    const [sub, email] = mockUserHeader.split('|');
    request.user = { sub, email };
  },
}));

describe('Internal Admin Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    agentTelemetryService.resetForTests();
    app = Fastify();
    await app.register(internalAdminRoutes, {
      allowlist: {
        userIds: ['admin_user'],
        emails: ['admin@example.com'],
      },
    });
    vi.clearAllMocks();
  });

  it('exposes bounded agent metrics only to internal admins', async () => {
    agentTelemetryService.recordApprovalDecision({ agencyId: 'agency-1', grantId: 'grant-1', operationId: 'op-1', decision: 'approved', latencyMs: 250 });
    const response = await app.inject({
      method: 'GET',
      url: '/internal-admin/agent-metrics',
      headers: { authorization: 'Bearer token', 'x-mock-user': 'admin_user|admin@example.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ approvalDecisions: 1, averageApprovalLatencyMs: 250 });
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/internal-admin/overview',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when authenticated user is not internal admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/internal-admin/overview',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'non_admin|user@example.com',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('returns overview data for internal admin users', async () => {
    vi.mocked(internalAdminService.getOverview).mockResolvedValue({
      data: {
        mrr: {
          booked: 133.33,
          collectedLast30Days: 99,
          excludedSubscriptions: 0,
          currency: 'usd',
        },
        subscriptions: {
          total: 5,
          active: 3,
          trialing: 1,
          pastDue: 1,
          canceled: 0,
          canceledThisPeriod: 0,
        },
        topUsageAgencies: [],
      },
      error: null,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/internal-admin/overview',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.mrr.booked).toBe(133.33);
  });

  it('returns 400 for invalid agencies pagination query params', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/internal-admin/agencies?page=0&limit=-1',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('passes includeSynthetic filter to agencies service', async () => {
    vi.mocked(internalAdminService.listAgencies).mockResolvedValue({
      data: {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      },
      error: null,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/internal-admin/agencies?includeSynthetic=true',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(internalAdminService.listAgencies).toHaveBeenCalledWith({
      search: undefined,
      page: undefined,
      limit: undefined,
      includeSynthetic: true,
    });
  });

  it('returns 404 when agency detail is not found', async () => {
    vi.mocked(internalAdminService.getAgencyDetail).mockResolvedValue({
      data: null,
      error: {
        code: 'NOT_FOUND',
        message: 'Agency not found',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/internal-admin/agencies/missing',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('passes webhook support filters to service', async () => {
    vi.mocked(internalAdminService.listWebhookEndpoints).mockResolvedValue({
      data: [
        {
          id: 'endpoint_1',
          agencyId: 'agency_1',
          url: 'https://hooks.example.com/webhooks',
          status: 'active',
          subscribedEvents: ['webhook.test'],
          failureCount: 0,
          secretLastFour: '1234',
          lastDeliveredAt: null,
          lastFailedAt: null,
          createdAt: '2026-03-08T00:00:00.000Z',
          updatedAt: '2026-03-08T00:00:00.000Z',
          agency: {
            id: 'agency_1',
            name: 'Agency One',
            email: 'agency@example.com',
          },
        },
      ],
      error: null,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/internal-admin/webhooks?status=active&limit=25',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(internalAdminService.listWebhookEndpoints).toHaveBeenCalledWith({
      status: 'active',
      limit: 25,
    });
  });

  it('returns webhook support detail for an agency', async () => {
    vi.mocked(internalAdminService.getWebhookDetail).mockResolvedValue({
      data: {
        endpoint: {
          id: 'endpoint_1',
          agencyId: 'agency_1',
          url: 'https://hooks.example.com/webhooks',
          status: 'disabled',
          subscribedEvents: ['access_request.completed'],
          failureCount: 4,
          secretLastFour: '1234',
          lastDeliveredAt: null,
          lastFailedAt: '2026-03-08T00:00:00.000Z',
          createdAt: '2026-03-08T00:00:00.000Z',
          updatedAt: '2026-03-08T00:00:00.000Z',
        },
        deliveries: [],
      },
      error: null,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/internal-admin/webhooks/agency_1?limit=15',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(internalAdminService.getWebhookDetail).toHaveBeenCalledWith('agency_1', 15);
    expect(response.json().data.endpoint.id).toBe('endpoint_1');
  });

  it('passes subscriptions filters and pagination to service', async () => {
    vi.mocked(internalAdminService.listSubscriptions).mockResolvedValue({
      data: {
        items: [],
        total: 0,
        page: 2,
        limit: 25,
      },
      error: null,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/internal-admin/subscriptions?status=active&tier=STARTER&page=2&limit=25',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(internalAdminService.listSubscriptions).toHaveBeenCalledWith({
      status: 'active',
      tier: 'STARTER',
      page: 2,
      limit: 25,
    });
  });

  it('returns 400 for invalid upgrade tier', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/internal-admin/subscriptions/agency_1/upgrade',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
      payload: {
        newTier: 'INVALID',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 for subscription mutations when user is not allowlisted', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/internal-admin/subscriptions/agency_1/cancel',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'non_admin|person@example.com',
      },
      payload: {
        cancelAtPeriodEnd: true,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('upgrades subscription for allowlisted internal admin', async () => {
    vi.mocked(subscriptionService.upgradeSubscription).mockResolvedValue({
      data: {
        tier: 'SCALE',
        status: 'active',
        currentPeriodEnd: new Date('2026-04-01T00:00:00.000Z'),
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/internal-admin/subscriptions/agency_1/upgrade',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
      payload: {
        newTier: 'SCALE',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(subscriptionService.upgradeSubscription).toHaveBeenCalledWith({
      agencyId: 'agency_1',
      newTier: 'SCALE',
      updateBehavior: undefined,
    });
  });

  it('cancels subscription for allowlisted internal admin', async () => {
    vi.mocked(subscriptionService.cancelSubscription).mockResolvedValue({
      data: {
        status: 'canceled',
        cancelAtPeriodEnd: true,
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/internal-admin/subscriptions/agency_1/cancel',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
      payload: {
        cancelAtPeriodEnd: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(subscriptionService.cancelSubscription).toHaveBeenCalledWith({
      agencyId: 'agency_1',
      cancelAtPeriodEnd: true,
    });
  });

  it('lists affiliate payout batches for internal admins', async () => {
    vi.mocked(internalAdminService.listAffiliatePayoutBatches).mockResolvedValue({
      data: {
        items: [
          {
            id: 'batch_1',
            status: 'draft',
            currency: 'usd',
            totalAmount: 7500,
            commissionCount: 2,
            periodStart: new Date('2026-02-01T00:00:00.000Z'),
            periodEnd: new Date('2026-02-28T23:59:59.999Z'),
            notes: 'February payout run',
            exportedAt: null,
            paidAt: null,
            createdAt: new Date('2026-03-01T00:00:00.000Z'),
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'GET',
      url: '/internal-admin/affiliate/payout-batches?status=draft',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.items).toHaveLength(1);
    expect(internalAdminService.listAffiliatePayoutBatches).toHaveBeenCalledWith({
      status: 'draft',
      page: undefined,
      limit: undefined,
    });
  });

  it('generates an affiliate payout batch for internal admins', async () => {
    vi.mocked(internalAdminService.generateAffiliatePayoutBatch).mockResolvedValue({
      data: {
        id: 'batch_1',
        status: 'draft',
        currency: 'usd',
        totalAmount: 7500,
        commissionCount: 2,
        periodStart: new Date('2026-02-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-28T23:59:59.999Z'),
        notes: 'February payout run',
        exportedAt: null,
        paidAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/internal-admin/affiliate/payout-batches',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
      payload: {
        periodStart: '2026-02-01T00:00:00.000Z',
        periodEnd: '2026-02-28T23:59:59.999Z',
        notes: 'February payout run',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.id).toBe('batch_1');
    expect(internalAdminService.generateAffiliatePayoutBatch).toHaveBeenCalledWith({
      periodStart: new Date('2026-02-01T00:00:00.000Z'),
      periodEnd: new Date('2026-02-28T23:59:59.999Z'),
      notes: 'February payout run',
      userEmail: 'admin@example.com',
    });
  });

  it('exports an affiliate payout batch for internal admins', async () => {
    vi.mocked(internalAdminService.exportAffiliatePayoutBatch).mockResolvedValue({
      data: {
        batchId: 'batch_1',
        fileName: 'affiliate-payout-batch-batch_1.csv',
        exportedAt: '2026-03-08T12:00:00.000Z',
        rowCount: 2,
        csv: [
          'partner_id,partner_name,partner_email,payout_method,payout_reference,commission_count,approved_amount_cents,batch_id,period_start,period_end,notes',
          'partner_1,Alpha Partner,alpha@example.com,wise,finance@alpha.example.com,2,4500,batch_1,2026-02-01T00:00:00.000Z,2026-02-28T23:59:59.999Z,February payout run',
        ].join('\n'),
      },
      error: null,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/internal-admin/affiliate/payout-batches/batch_1/export',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.fileName).toBe('affiliate-payout-batch-batch_1.csv');
    expect(internalAdminService.exportAffiliatePayoutBatch).toHaveBeenCalledWith('batch_1', {
      userEmail: 'admin@example.com',
    });
  });

  it('lists the affiliate fraud review queue for internal admins', async () => {
    vi.mocked(internalAdminService.listAffiliateFraudQueue).mockResolvedValue({
      data: {
        referrals: [
          {
            id: 'referral_1',
            partnerId: 'partner_1',
            partnerName: 'Partner One',
            referredAgencyId: 'agency_1',
            referredAgencyName: 'Acme Agency',
            status: 'review_required',
            riskReasons: ['same_company_domain'],
            createdAt: '2026-03-02T00:00:00.000Z',
            qualifiedAt: null,
            commissionCount: 2,
          },
        ],
        commissions: [
          {
            id: 'commission_1',
            referralId: 'referral_1',
            partnerId: 'partner_1',
            partnerName: 'Partner One',
            customerName: 'Acme Agency',
            status: 'review_required',
            amountCents: 3000,
            holdUntil: '2026-04-01T00:00:00.000Z',
            createdAt: '2026-03-03T00:00:00.000Z',
            riskReasons: ['same_company_domain'],
            notes: 'Needs review',
          },
        ],
        counts: {
          flaggedReferrals: 1,
          flaggedCommissions: 1,
        },
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'GET',
      url: '/internal-admin/affiliate/fraud-queue',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.counts.flaggedReferrals).toBe(1);
    expect(internalAdminService.listAffiliateFraudQueue).toHaveBeenCalledWith();
  });

  it('resolves a flagged affiliate referral review for internal admins', async () => {
    vi.mocked(internalAdminService.resolveAffiliateReferralReview).mockResolvedValue({
      data: {
        id: 'referral_1',
        status: 'qualified',
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/internal-admin/affiliate/referrals/referral_1/review',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
      payload: {
        resolution: 'clear',
        reason: 'validated billing owner match after manual review',
        internalNotes: 'Matched purchaser identity and allowed payout flow to continue.',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe('qualified');
    expect(internalAdminService.resolveAffiliateReferralReview).toHaveBeenCalledWith('referral_1', {
      resolution: 'clear',
      reason: 'validated billing owner match after manual review',
      internalNotes: 'Matched purchaser identity and allowed payout flow to continue.',
      userEmail: 'admin@example.com',
    });
  });

  it('lists affiliate partners for review', async () => {
    vi.mocked(internalAdminService.listAffiliatePartners).mockResolvedValue({
      data: {
        items: [
          {
            id: 'partner_1',
            name: 'Partner One',
            email: 'partner@example.com',
            companyName: 'Growth Studio',
            websiteUrl: 'https://growth.example.com',
            audienceSize: '10k_to_50k',
            status: 'applied',
            applicationNotes: 'Newsletter plus LinkedIn',
            defaultCommissionBps: 3000,
            commissionDurationMonths: 12,
            appliedAt: new Date('2026-03-01T00:00:00.000Z'),
            approvedAt: null,
            rejectedAt: null,
            disabledAt: null,
            referralCount: 0,
            commissionCount: 0,
            linkCount: 0,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'GET',
      url: '/internal-admin/affiliate/partners?status=applied',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.items).toHaveLength(1);
    expect(internalAdminService.listAffiliatePartners).toHaveBeenCalledWith({
      status: 'applied',
      search: undefined,
      page: undefined,
      limit: undefined,
    });
  });

  it('updates an affiliate partner review decision for internal admins', async () => {
    vi.mocked(internalAdminService.updateAffiliatePartner).mockResolvedValue({
      data: {
        id: 'partner_1',
        name: 'Partner One',
        email: 'partner@example.com',
        companyName: 'Growth Studio',
        websiteUrl: 'https://growth.example.com',
        audienceSize: '10k_to_50k',
        status: 'approved',
        applicationNotes: 'Newsletter plus LinkedIn',
        defaultCommissionBps: 3500,
        commissionDurationMonths: 12,
        appliedAt: new Date('2026-03-01T00:00:00.000Z'),
        approvedAt: new Date('2026-03-08T00:00:00.000Z'),
        rejectedAt: null,
        disabledAt: null,
        referralCount: 0,
        commissionCount: 0,
        linkCount: 0,
      },
      error: null,
    } as any);

    const payload: AffiliateAdminPartnerMutation = {
      status: 'approved',
      defaultCommissionBps: 3500,
      commissionDurationMonths: 12,
      internalNotes: 'Strong fit for pilot cohort',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/internal-admin/affiliate/partners/partner_1',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe('approved');
    expect(internalAdminService.updateAffiliatePartner).toHaveBeenCalledWith('partner_1', {
      ...payload,
      userEmail: 'admin@example.com',
    });
  });

  it('returns affiliate partner detail for internal admins', async () => {
    vi.mocked(internalAdminService.getAffiliatePartnerDetail).mockResolvedValue({
      data: {
        partner: {
          id: 'partner_1',
          name: 'Partner One',
          email: 'partner@example.com',
          companyName: 'Growth Studio',
          websiteUrl: 'https://growth.example.com',
          audienceSize: '10k_to_50k',
          status: 'approved',
          applicationNotes: 'Newsletter plus LinkedIn',
          defaultCommissionBps: 3000,
          commissionDurationMonths: 12,
          appliedAt: new Date('2026-03-01T00:00:00.000Z'),
          approvedAt: new Date('2026-03-08T00:00:00.000Z'),
          rejectedAt: null,
          disabledAt: null,
          referralCount: 2,
          commissionCount: 3,
          linkCount: 1,
        },
        metrics: {
          clicks: 12,
          referrals: 2,
          commissions: 3,
          pendingCommissionCents: 4500,
          paidCommissionCents: 2400,
        },
        links: [],
        referrals: [],
        commissions: [],
      },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'GET',
      url: '/internal-admin/affiliate/partners/partner_1',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.partner.id).toBe('partner_1');
  });

  it('disables an affiliate link for internal admins', async () => {
    vi.mocked(internalAdminService.disableAffiliateLink).mockResolvedValue({
      data: { id: 'link_1', status: 'disabled' },
      error: null,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/internal-admin/affiliate/links/link_1/disable',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
      payload: {
        internalNotes: 'Campaign link was misleading',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(internalAdminService.disableAffiliateLink).toHaveBeenCalledWith('link_1', {
      internalNotes: 'Campaign link was misleading',
      userEmail: 'admin@example.com',
    });
  });

  it('disqualifies an affiliate referral for internal admins', async () => {
    vi.mocked(internalAdminService.disqualifyAffiliateReferral).mockResolvedValue({
      data: { id: 'referral_1', status: 'disqualified' },
      error: null,
    } as any);
    const payload: AffiliateAdminReferralDisqualificationInput = {
      reason: 'self_referral_email',
      internalNotes: 'Matched operator review evidence',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/internal-admin/affiliate/referrals/referral_1/disqualify',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(internalAdminService.disqualifyAffiliateReferral).toHaveBeenCalledWith('referral_1', {
      ...payload,
      userEmail: 'admin@example.com',
    });
  });

  it('adjusts an affiliate commission for internal admins', async () => {
    vi.mocked(internalAdminService.adjustAffiliateCommission).mockResolvedValue({
      data: { id: 'commission_1', status: 'approved', amount: 3200 },
      error: null,
    } as any);
    const payload: AffiliateAdminCommissionAdjustment = {
      amountCents: 3200,
      status: 'approved',
      internalNotes: 'Restored amount after manual validation',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/internal-admin/affiliate/commissions/commission_1/adjust',
      headers: {
        authorization: 'Bearer token',
        'x-mock-user': 'admin_user|admin@example.com',
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(internalAdminService.adjustAffiliateCommission).toHaveBeenCalledWith('commission_1', {
      ...payload,
      userEmail: 'admin@example.com',
    });
  });
});
