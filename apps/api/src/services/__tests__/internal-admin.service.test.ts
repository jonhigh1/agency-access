import { beforeEach, describe, expect, it, vi } from 'vitest';
import { internalAdminService } from '../internal-admin.service.js';
import { prisma } from '@/lib/prisma.js';
import { getProductId } from '@/config/creem.config.js';
import { DEV_BYPASS_AGENCY_EMAIL } from '@/middleware/auth.js';

vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(async (callback: any) => callback(prisma)),
    subscription: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    invoice: {
      aggregate: vi.fn(),
    },
    agencyUsageCounter: {
      findMany: vi.fn(),
    },
    agency: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    affiliatePartner: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    affiliateLink: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    affiliateReferral: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    affiliateClick: {
      count: vi.fn(),
    },
    affiliateCommission: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      aggregate: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    affiliatePayoutBatch: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe('InternalAdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOverview', () => {
    it('calculates booked MRR with monthly/yearly normalization and excludes unknown products', async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([
        {
          id: 'sub_1',
          tier: 'STARTER',
          status: 'active',
          creemData: { product_id: getProductId('STARTER', 'monthly') },
        },
        {
          id: 'sub_2',
          tier: 'SCALE',
          status: 'trialing',
          creemData: { product_id: getProductId('SCALE', 'yearly') },
        },
        {
          id: 'sub_3',
          tier: 'SCALE',
          status: 'active',
          creemData: { product_id: 'prod_unknown' },
        },
        {
          id: 'sub_4',
          tier: 'PRO',
          status: 'past_due',
          creemData: { product_id: getProductId('STARTER', 'monthly') },
        },
      ] as any);

      vi.mocked(prisma.invoice.aggregate).mockResolvedValue({
        _sum: { amount: 19900 },
      } as any);

      vi.mocked(prisma.agencyUsageCounter.findMany).mockResolvedValue([] as any);

      const result = await internalAdminService.getOverview();

      expect(result.error).toBeNull();
      expect(result.data?.mrr.booked).toBe(153.17);
      expect(result.data?.mrr.excludedSubscriptions).toBe(1);
      expect(result.data?.subscriptions.active).toBe(2);
      expect(result.data?.subscriptions.trialing).toBe(1);
      expect(result.data?.subscriptions.pastDue).toBe(1);
      expect(result.data?.mrr.collectedLast30Days).toBe(199);
    });
  });

  describe('listAgencies', () => {
    it('returns paginated agencies with default pagination', async () => {
      vi.mocked(prisma.agency.count).mockResolvedValue(1);
      vi.mocked(prisma.agency.findMany).mockResolvedValue([
        {
          id: 'agency_1',
          name: 'Acme Agency',
          email: 'owner@acme.com',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          subscription: {
            tier: 'STARTER',
            status: 'active',
          },
          _count: { members: 2 },
        },
      ] as any);

      const result = await internalAdminService.listAgencies({});

      expect(result.error).toBeNull();
      expect(result.data?.total).toBe(1);
      expect(result.data?.page).toBe(1);
      expect(result.data?.limit).toBe(20);
      expect(result.data?.items[0]).toMatchObject({
        id: 'agency_1',
        name: 'Acme Agency',
        email: 'owner@acme.com',
        memberCount: 2,
        subscriptionTier: 'STARTER',
        subscriptionStatus: 'active',
      });
      expect(prisma.agency.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          NOT: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      }));
    });

    it('keeps clerk placeholder agencies visible and hides the dev bypass agency', async () => {
      vi.mocked(prisma.agency.count).mockResolvedValue(0);
      vi.mocked(prisma.agency.findMany).mockResolvedValue([] as any);

      await internalAdminService.listAgencies({});

      const syntheticFilters = vi.mocked(prisma.agency.findMany).mock.calls[0][0].where.NOT.OR;
      expect(JSON.stringify(syntheticFilters)).not.toContain('@clerk.temp');
      expect(syntheticFilters).toContainEqual({
        email: {
          equals: DEV_BYPASS_AGENCY_EMAIL,
          mode: 'insensitive',
        },
      });
    });

    it('can include synthetic and test agencies when explicitly requested', async () => {
      vi.mocked(prisma.agency.count).mockResolvedValue(0);
      vi.mocked(prisma.agency.findMany).mockResolvedValue([] as any);

      await internalAdminService.listAgencies({ includeSynthetic: true });

      expect(prisma.agency.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: undefined,
      }));
    });

    it('applies search and synthetic filters together by default', async () => {
      vi.mocked(prisma.agency.count).mockResolvedValue(0);
      vi.mocked(prisma.agency.findMany).mockResolvedValue([] as any);

      await internalAdminService.listAgencies({ search: 'pillar' });

      expect(prisma.agency.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.any(Array),
            }),
            expect.objectContaining({
              NOT: expect.objectContaining({
                OR: expect.any(Array),
              }),
            }),
          ]),
        }),
      }));
    });
  });

  describe('getAgencyDetail', () => {
    it('returns NOT_FOUND when agency does not exist', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue(null);

      const result = await internalAdminService.getAgencyDetail('missing_agency');

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'NOT_FOUND',
        message: 'Agency not found',
      });
    });
  });

  describe('generateAffiliatePayoutBatch', () => {
    it('creates a deterministic payout batch from commissions whose hold window matured in the requested period', async () => {
      vi.mocked(prisma.affiliatePayoutBatch.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.affiliateCommission.findMany).mockResolvedValue([
        {
          id: 'commission_1',
          amount: 3000,
          status: 'pending',
        },
        {
          id: 'commission_2',
          amount: 4500,
          status: 'approved',
        },
      ] as any);
      vi.mocked(prisma.affiliatePayoutBatch.create).mockResolvedValue({
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
      } as any);
      vi.mocked(prisma.affiliateCommission.updateMany).mockResolvedValue({ count: 2 } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: 'audit_1' } as any);

      const result = await internalAdminService.generateAffiliatePayoutBatch({
        periodStart: new Date('2026-02-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-28T23:59:59.999Z'),
        notes: 'February payout run',
        userEmail: 'admin@example.com',
      });

      expect(result.error).toBeNull();
      expect(prisma.affiliateCommission.findMany).toHaveBeenCalledWith({
        where: {
          payoutBatchId: null,
          status: {
            in: ['pending', 'approved'],
          },
          holdUntil: {
            gte: new Date('2026-02-01T00:00:00.000Z'),
            lte: new Date('2026-02-28T23:59:59.999Z'),
          },
        },
        orderBy: [
          { holdUntil: 'asc' },
          { createdAt: 'asc' },
        ],
        select: {
          id: true,
          amount: true,
          status: true,
        },
      });
      expect(prisma.affiliatePayoutBatch.create).toHaveBeenCalledWith({
        data: {
          status: 'draft',
          currency: 'usd',
          periodStart: new Date('2026-02-01T00:00:00.000Z'),
          periodEnd: new Date('2026-02-28T23:59:59.999Z'),
          totalAmount: 7500,
          commissionCount: 2,
          notes: 'February payout run',
        },
      });
      expect(prisma.affiliateCommission.updateMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['commission_1', 'commission_2'],
          },
        },
        data: {
          payoutBatchId: 'batch_1',
          approvedAt: expect.any(Date),
          status: 'approved',
        },
      });
    });

    it('returns the existing payout batch for the same period instead of generating a duplicate', async () => {
      vi.mocked(prisma.affiliatePayoutBatch.findFirst).mockResolvedValue({
        id: 'batch_existing',
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
      } as any);

      const result = await internalAdminService.generateAffiliatePayoutBatch({
        periodStart: new Date('2026-02-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-28T23:59:59.999Z'),
        userEmail: 'admin@example.com',
      });

      expect(result.error).toBeNull();
      expect(result.data?.id).toBe('batch_existing');
      expect(prisma.affiliateCommission.findMany).not.toHaveBeenCalled();
      expect(prisma.affiliatePayoutBatch.create).not.toHaveBeenCalled();
    });
  });

  describe('listAffiliatePayoutBatches', () => {
    it('returns paginated payout batches ordered newest first', async () => {
      vi.mocked(prisma.affiliatePayoutBatch.count).mockResolvedValue(1);
      vi.mocked(prisma.affiliatePayoutBatch.findMany).mockResolvedValue([
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
      ] as any);

      const result = await internalAdminService.listAffiliatePayoutBatches({});

      expect(result.error).toBeNull();
      expect(result.data?.items[0]).toMatchObject({
        id: 'batch_1',
        totalAmount: 7500,
        commissionCount: 2,
      });
      expect(result.data?.page).toBe(1);
      expect(result.data?.limit).toBe(20);
    });
  });

  describe('exportAffiliatePayoutBatch', () => {
    it('exports a deterministic CSV grouped by partner and stamps the batch as exported', async () => {
      vi.mocked(prisma.affiliatePayoutBatch.findUnique).mockResolvedValue({
        id: 'batch_1',
        status: 'draft',
        currency: 'usd',
        totalAmount: 7500,
        commissionCount: 3,
        periodStart: new Date('2026-02-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-28T23:59:59.999Z'),
        notes: 'February payout run',
        exportedAt: null,
        paidAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        commissions: [
          {
            id: 'commission_1',
            amount: 3000,
            partner: {
              id: 'partner_2',
              name: 'Zeta Partner',
              email: 'zeta@example.com',
              payoutMethod: 'paypal',
              payoutDetails: { email: 'pay@zeta.example.com' },
            },
          },
          {
            id: 'commission_2',
            amount: 2500,
            partner: {
              id: 'partner_1',
              name: 'Alpha Partner',
              email: 'alpha@example.com',
              payoutMethod: 'wise',
              payoutDetails: { email: 'finance@alpha.example.com' },
            },
          },
          {
            id: 'commission_3',
            amount: 2000,
            partner: {
              id: 'partner_1',
              name: 'Alpha Partner',
              email: 'alpha@example.com',
              payoutMethod: 'wise',
              payoutDetails: { email: 'finance@alpha.example.com' },
            },
          },
        ],
      } as any);
      vi.mocked(prisma.affiliatePayoutBatch.update).mockResolvedValue({
        id: 'batch_1',
        status: 'exported',
        currency: 'usd',
        totalAmount: 7500,
        commissionCount: 3,
        periodStart: new Date('2026-02-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-28T23:59:59.999Z'),
        notes: 'February payout run',
        exportedAt: new Date('2026-03-08T12:00:00.000Z'),
        paidAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: 'audit_1' } as any);

      const result = await internalAdminService.exportAffiliatePayoutBatch('batch_1', {
        userEmail: 'admin@example.com',
      });

      expect(result.error).toBeNull();
      expect(prisma.affiliatePayoutBatch.findUnique).toHaveBeenCalledWith({
        where: { id: 'batch_1' },
        include: {
          commissions: {
            select: {
              id: true,
              amount: true,
              partner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  payoutMethod: true,
                  payoutDetails: true,
                },
              },
            },
          },
        },
      });
      expect(prisma.affiliatePayoutBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch_1' },
        data: {
          exportedAt: expect.any(Date),
          status: 'exported',
        },
      });
      expect(result.data).toMatchObject({
        batchId: 'batch_1',
        fileName: 'affiliate-payout-batch-batch_1.csv',
        rowCount: 2,
      });
      expect(result.data?.csv.split('\n')).toEqual([
        'partner_id,partner_name,partner_email,payout_method,payout_reference,commission_count,approved_amount_cents,batch_id,period_start,period_end,notes',
        'partner_1,Alpha Partner,alpha@example.com,wise,finance@alpha.example.com,2,4500,batch_1,2026-02-01T00:00:00.000Z,2026-02-28T23:59:59.999Z,February payout run',
        'partner_2,Zeta Partner,zeta@example.com,paypal,pay@zeta.example.com,1,3000,batch_1,2026-02-01T00:00:00.000Z,2026-02-28T23:59:59.999Z,February payout run',
      ]);
      const exportedRows = result.data?.csv.split('\n').slice(1) ?? [];
      const exportedAmountSum = exportedRows.reduce((sum, row) => sum + Number.parseInt(row.split(',')[6] || '0', 10), 0);
      const exportedCommissionCount = exportedRows.reduce((sum, row) => sum + Number.parseInt(row.split(',')[5] || '0', 10), 0);
      expect(exportedAmountSum).toBe(7500);
      expect(exportedCommissionCount).toBe(3);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'AFFILIATE_PAYOUT_BATCH_EXPORTED',
          resourceType: 'affiliate_payout_batch',
          resourceId: 'batch_1',
          userEmail: 'admin@example.com',
          metadata: expect.objectContaining({
            rowCount: 2,
            commissionCount: 3,
          }),
        }),
      });
    });

    it('re-exports an existing payout batch without changing exportedAt', async () => {
      const exportedAt = new Date('2026-03-08T12:00:00.000Z');

      vi.mocked(prisma.affiliatePayoutBatch.findUnique).mockResolvedValue({
        id: 'batch_1',
        status: 'exported',
        currency: 'usd',
        totalAmount: 3000,
        commissionCount: 1,
        periodStart: new Date('2026-02-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-28T23:59:59.999Z'),
        notes: null,
        exportedAt,
        paidAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        commissions: [
          {
            id: 'commission_1',
            amount: 3000,
            partner: {
              id: 'partner_1',
              name: 'Alpha Partner',
              email: 'alpha@example.com',
              payoutMethod: null,
              payoutDetails: null,
            },
          },
        ],
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: 'audit_1' } as any);

      const result = await internalAdminService.exportAffiliatePayoutBatch('batch_1', {
        userEmail: 'admin@example.com',
      });

      expect(result.error).toBeNull();
      expect(prisma.affiliatePayoutBatch.update).not.toHaveBeenCalled();
      expect(result.data?.exportedAt).toBe(exportedAt.toISOString());
      expect(result.data?.csv).toContain('partner_1,Alpha Partner,alpha@example.com,manual_review_required,,1,3000,batch_1');
    });
  });

  describe('listAffiliatePartners', () => {
    it('returns affiliate partners filtered by status with newest applications first', async () => {
      vi.mocked(prisma.affiliatePartner.count).mockResolvedValue(1);
      vi.mocked(prisma.affiliatePartner.findMany).mockResolvedValue([
        {
          id: 'partner_1',
          name: 'Partner One',
          email: 'partner@example.com',
          companyName: 'Growth Studio',
          websiteUrl: 'https://growth.example.com',
          audienceSize: '10k_to_50k',
          status: 'applied',
          notes: 'Newsletter plus LinkedIn',
          defaultCommissionBps: 3000,
          commissionDurationMonths: 12,
          appliedAt: new Date('2026-03-01T00:00:00.000Z'),
          approvedAt: null,
          rejectedAt: null,
          disabledAt: null,
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          _count: {
            links: 0,
            referrals: 0,
            commissions: 0,
          },
        },
      ] as any);

      const result = await internalAdminService.listAffiliatePartners({
        status: 'applied',
      });

      expect(result.error).toBeNull();
      expect(result.data?.items[0]).toMatchObject({
        id: 'partner_1',
        status: 'applied',
        applicationNotes: 'Newsletter plus LinkedIn',
        referralCount: 0,
      });
      expect(prisma.affiliatePartner.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          status: 'applied',
        },
      }));
    });
  });

  describe('updateAffiliatePartner', () => {
    it('approves an affiliate partner and records the action in audit logs', async () => {
      vi.mocked(prisma.affiliatePartner.findUnique).mockResolvedValue({
        id: 'partner_1',
        status: 'applied',
        notes: 'Newsletter plus LinkedIn',
      } as any);
      vi.mocked(prisma.affiliatePartner.update).mockResolvedValue({
        id: 'partner_1',
        name: 'Partner One',
        email: 'partner@example.com',
        companyName: 'Growth Studio',
        websiteUrl: 'https://growth.example.com',
        audienceSize: '10k_to_50k',
        status: 'approved',
        notes: 'Newsletter plus LinkedIn',
        defaultCommissionBps: 3500,
        commissionDurationMonths: 12,
        appliedAt: new Date('2026-03-01T00:00:00.000Z'),
        approvedAt: new Date('2026-03-08T00:00:00.000Z'),
        rejectedAt: null,
        disabledAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: 'audit_2' } as any);

      const result = await internalAdminService.updateAffiliatePartner('partner_1', {
        status: 'approved',
        defaultCommissionBps: 3500,
        commissionDurationMonths: 12,
        internalNotes: 'Strong fit for pilot cohort',
        userEmail: 'admin@example.com',
      });

      expect(result.error).toBeNull();
      expect(prisma.affiliatePartner.update).toHaveBeenCalledWith({
        where: { id: 'partner_1' },
        data: expect.objectContaining({
          status: 'approved',
          defaultCommissionBps: 3500,
          commissionDurationMonths: 12,
          approvedAt: expect.any(Date),
          rejectedAt: null,
        }),
        select: expect.any(Object),
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'AFFILIATE_PARTNER_UPDATED',
          resourceType: 'affiliate_partner',
          resourceId: 'partner_1',
          userEmail: 'admin@example.com',
          metadata: expect.objectContaining({
            internalNotes: 'Strong fit for pilot cohort',
            status: 'approved',
          }),
        }),
      });
    });
  });

  describe('getAffiliatePartnerDetail', () => {
    it('returns partner detail with clicks, referrals, commissions, and fraud context', async () => {
      vi.mocked(prisma.affiliatePartner.findUnique).mockResolvedValue({
        id: 'partner_1',
        name: 'Partner One',
        email: 'partner@example.com',
        companyName: 'Growth Studio',
        websiteUrl: 'https://growth.example.com',
        audienceSize: '10k_to_50k',
        status: 'approved',
        notes: 'Newsletter plus LinkedIn',
        defaultCommissionBps: 3000,
        commissionDurationMonths: 12,
        payoutMethod: 'paypal',
        payoutDetails: null,
        appliedAt: new Date('2026-03-01T00:00:00.000Z'),
        approvedAt: new Date('2026-03-08T00:00:00.000Z'),
        rejectedAt: null,
        disabledAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        _count: {
          referrals: 2,
          commissions: 3,
          links: 1,
        },
      } as any);
      vi.mocked(prisma.affiliateClick.count).mockResolvedValue(12);
      vi.mocked(prisma.affiliateCommission.aggregate)
        .mockResolvedValueOnce({ _sum: { amount: 4500 } } as any)
        .mockResolvedValueOnce({ _sum: { amount: 2400 } } as any);
      vi.mocked(prisma.affiliateLink.findMany).mockResolvedValue([
        {
          id: 'link_1',
          code: 'partner-one',
          status: 'active',
          destinationPath: '/pricing',
          campaign: null,
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          _count: { clicks: 12 },
        },
      ] as any);
      vi.mocked(prisma.affiliateReferral.findMany).mockResolvedValue([
        {
          id: 'referral_1',
          status: 'review_required',
          attributionSource: 'link_cookie',
          commissionBps: 3000,
          commissionDurationMonths: 12,
          disqualificationReason: null,
          metadata: { riskReasons: ['shared_fingerprint'] },
          createdAt: new Date('2026-03-02T00:00:00.000Z'),
          qualifiedAt: null,
          disqualifiedAt: null,
          referredAgency: { name: 'Acme Agency' },
        },
      ] as any);
      vi.mocked(prisma.affiliateCommission.findMany).mockResolvedValue([
        {
          id: 'commission_1',
          status: 'review_required',
          amount: 3000,
          revenueAmount: 10000,
          commissionBps: 3000,
          holdUntil: new Date('2026-04-01T00:00:00.000Z'),
          approvedAt: null,
          paidAt: null,
          voidedAt: null,
          notes: 'Needs manual review',
          createdAt: new Date('2026-03-03T00:00:00.000Z'),
          referral: {
            referredAgency: { name: 'Acme Agency' },
          },
          invoice: {
            invoiceDate: new Date('2026-03-02T00:00:00.000Z'),
          },
        },
      ] as any);

      const result = await internalAdminService.getAffiliatePartnerDetail('partner_1');

      expect(result.error).toBeNull();
      expect(result.data?.metrics).toEqual({
        clicks: 12,
        referrals: 2,
        commissions: 3,
        pendingCommissionCents: 4500,
        paidCommissionCents: 2400,
      });
      expect(result.data?.referrals[0].riskReasons).toEqual(['shared_fingerprint']);
      expect(result.data?.links[0].clickCount).toBe(12);
    });
  });

  describe('listAffiliateFraudQueue', () => {
    it('returns flagged referrals and commissions for operator review', async () => {
      vi.mocked(prisma.affiliateReferral.findMany).mockResolvedValue([
        {
          id: 'referral_1',
          status: 'review_required',
          commissionBps: 3000,
          commissionDurationMonths: 12,
          createdAt: new Date('2026-03-02T00:00:00.000Z'),
          qualifiedAt: null,
          disqualifiedAt: null,
          metadata: { riskReasons: ['same_company_domain'] },
          partner: { id: 'partner_1', name: 'Partner One' },
          referredAgency: { id: 'agency_1', name: 'Acme Agency' },
          _count: { commissions: 2 },
        },
      ] as any);
      vi.mocked(prisma.affiliateCommission.findMany).mockResolvedValue([
        {
          id: 'commission_1',
          status: 'review_required',
          amount: 3000,
          holdUntil: new Date('2026-04-01T00:00:00.000Z'),
          createdAt: new Date('2026-03-03T00:00:00.000Z'),
          notes: 'Commission requires review because the referral includes risk signals.',
          partner: { id: 'partner_1', name: 'Partner One' },
          referral: {
            id: 'referral_1',
            metadata: { riskReasons: ['same_company_domain'] },
            referredAgency: { id: 'agency_1', name: 'Acme Agency' },
          },
        },
      ] as any);

      const result = await internalAdminService.listAffiliateFraudQueue();

      expect(result.error).toBeNull();
      expect(result.data?.counts).toEqual({
        flaggedReferrals: 1,
        flaggedCommissions: 1,
      });
      expect(result.data?.referrals[0]).toMatchObject({
        id: 'referral_1',
        partnerName: 'Partner One',
        referredAgencyName: 'Acme Agency',
        riskReasons: ['same_company_domain'],
      });
      expect(result.data?.commissions[0]).toMatchObject({
        id: 'commission_1',
        referralId: 'referral_1',
        customerName: 'Acme Agency',
        amountCents: 3000,
      });
    });
  });

  describe('disableAffiliateLink', () => {
    it('disables an affiliate link and records an audit note', async () => {
      vi.mocked(prisma.affiliateLink.findUnique).mockResolvedValue({
        id: 'link_1',
        partnerId: 'partner_1',
        status: 'active',
      } as any);
      vi.mocked(prisma.affiliateLink.update).mockResolvedValue({
        id: 'link_1',
        status: 'disabled',
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: 'audit_3' } as any);

      const result = await internalAdminService.disableAffiliateLink('link_1', {
        internalNotes: 'Campaign link was misleading',
        userEmail: 'admin@example.com',
      });

      expect(result.error).toBeNull();
      expect(prisma.affiliateLink.update).toHaveBeenCalledWith({
        where: { id: 'link_1' },
        data: { status: 'disabled' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'AFFILIATE_LINK_DISABLED',
          resourceType: 'affiliate_link',
          resourceId: 'link_1',
        }),
      });
    });
  });

  describe('disqualifyAffiliateReferral', () => {
    it('disqualifies a referral and voids unpaid commissions with audit notes', async () => {
      vi.mocked(prisma.affiliateReferral.findUnique).mockResolvedValue({
        id: 'referral_1',
        status: 'qualified',
        metadata: { riskReasons: ['shared_fingerprint'] },
      } as any);
      vi.mocked(prisma.affiliateReferral.update).mockResolvedValue({
        id: 'referral_1',
        status: 'disqualified',
      } as any);
      vi.mocked(prisma.affiliateCommission.updateMany).mockResolvedValue({ count: 2 } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: 'audit_4' } as any);

      const result = await internalAdminService.disqualifyAffiliateReferral('referral_1', {
        reason: 'self_referral_email',
        internalNotes: 'Matched operator review evidence',
        userEmail: 'admin@example.com',
      });

      expect(result.error).toBeNull();
      expect(prisma.affiliateReferral.update).toHaveBeenCalledWith({
        where: { id: 'referral_1' },
        data: expect.objectContaining({
          status: 'disqualified',
          disqualificationReason: 'self_referral_email',
          disqualifiedAt: expect.any(Date),
        }),
      });
      expect(prisma.affiliateCommission.updateMany).toHaveBeenCalledWith({
        where: {
          referralId: 'referral_1',
          paidAt: null,
          status: {
            in: ['pending', 'approved', 'review_required'],
          },
        },
        data: expect.objectContaining({
          status: 'void',
          voidedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('resolveAffiliateReferralReview', () => {
    it('clears a flagged referral and releases unpaid review commissions back to pending', async () => {
      vi.mocked(prisma.affiliateReferral.findUnique).mockResolvedValue({
        id: 'referral_1',
        partnerId: 'partner_1',
        status: 'review_required',
        qualifiedAt: null,
        metadata: { riskReasons: ['same_company_domain'] },
        _count: {
          commissions: 1,
        },
      } as any);
      vi.mocked(prisma.affiliateReferral.update).mockResolvedValue({
        id: 'referral_1',
        status: 'qualified',
      } as any);
      vi.mocked(prisma.affiliateCommission.updateMany).mockResolvedValue({ count: 1 } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: 'audit_6' } as any);

      const result = await internalAdminService.resolveAffiliateReferralReview('referral_1', {
        resolution: 'clear',
        reason: 'validated billing owner match after manual review',
        internalNotes: 'Matched purchaser identity and allowed payout flow to continue.',
        userEmail: 'admin@example.com',
      });

      expect(result.error).toBeNull();
      expect(prisma.affiliateReferral.update).toHaveBeenCalledWith({
        where: { id: 'referral_1' },
        data: expect.objectContaining({
          status: 'qualified',
          qualifiedAt: expect.any(Date),
          disqualificationReason: null,
          disqualifiedAt: null,
        }),
      });
      expect(prisma.affiliateCommission.updateMany).toHaveBeenCalledWith({
        where: {
          referralId: 'referral_1',
          paidAt: null,
          status: 'review_required',
        },
        data: {
          status: 'pending',
          voidedAt: null,
        },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'AFFILIATE_REFERRAL_REVIEW_RESOLVED',
          resourceType: 'affiliate_referral',
          resourceId: 'referral_1',
          userEmail: 'admin@example.com',
          metadata: expect.objectContaining({
            resolution: 'clear',
            reason: 'validated billing owner match after manual review',
            previousStatus: 'review_required',
          }),
        }),
      });
    });
  });

  describe('adjustAffiliateCommission', () => {
    it('updates the commission amount and status with audit notes', async () => {
      vi.mocked(prisma.affiliateCommission.findUnique).mockResolvedValue({
        id: 'commission_1',
        status: 'review_required',
        amount: 3000,
        notes: null,
      } as any);
      vi.mocked(prisma.affiliateCommission.update).mockResolvedValue({
        id: 'commission_1',
        status: 'approved',
        amount: 3200,
      } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: 'audit_5' } as any);

      const result = await internalAdminService.adjustAffiliateCommission('commission_1', {
        amountCents: 3200,
        status: 'approved',
        internalNotes: 'Restored amount after manual validation',
        userEmail: 'admin@example.com',
      });

      expect(result.error).toBeNull();
      expect(prisma.affiliateCommission.update).toHaveBeenCalledWith({
        where: { id: 'commission_1' },
        data: expect.objectContaining({
          amount: 3200,
          status: 'approved',
          approvedAt: expect.any(Date),
          notes: 'Restored amount after manual validation',
        }),
      });
    });
  });
});
