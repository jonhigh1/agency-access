import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerAssetCreationRoutes } from '../asset-creation.routes';
import { accessRequestService } from '@/services/access-request.service';
import { prisma } from '@/lib/prisma';
import { metaAssetCreationService } from '@/services/meta-asset-creation.service';

vi.mock('@/services/access-request.service', () => ({
  accessRequestService: {
    getAccessRequestByToken: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    clientConnection: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/services/meta-asset-creation.service', () => ({
  metaAssetCreationService: {
    createAdAccount: vi.fn(),
    createProductCatalog: vi.fn(),
    createBusiness: vi.fn(),
    getUserPages: vi.fn(),
    getAssetCreationLinks: vi.fn(),
    getSupportedCurrencies: vi.fn(),
    getSupportedTimezones: vi.fn(),
  },
}));

describe('Client Auth Asset Creation Routes - Business', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await registerAssetCreationRoutes(app);
    vi.resetAllMocks();

    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: { id: 'request-a', agencyId: 'agency-a' } as any,
      error: null,
    });

    vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue({
      id: 'conn-1',
      accessRequestId: 'request-a',
      agencyId: 'agency-a',
      clientEmail: 'client@example.com',
    } as any);
  });

  describe('POST /client/:token/create/meta/business', () => {
    it('creates a business and returns it with 200', async () => {
      vi.mocked(metaAssetCreationService.createBusiness).mockResolvedValue({
        data: { id: 'biz-1', name: 'Acme Business', timezoneId: '25' },
        error: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/client/token-a/create/meta/business',
        payload: {
          connectionId: 'conn-1',
          name: 'Acme Business',
          primaryPageId: 'page-1',
          timezoneId: '25',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: { id: 'biz-1', name: 'Acme Business', timezoneId: '25' },
        error: null,
      });
      expect(metaAssetCreationService.createBusiness).toHaveBeenCalledWith(
        'conn-1',
        { accessRequestId: 'request-a', name: 'Acme Business', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '25' },
        'client@example.com',
        'agency-a'
      );
    });

    it('passes an explicit vertical through', async () => {
      vi.mocked(metaAssetCreationService.createBusiness).mockResolvedValue({
        data: { id: 'biz-1', name: 'Acme', timezoneId: '25' },
        error: null,
      });

      await app.inject({
        method: 'POST',
        url: '/client/token-a/create/meta/business',
        payload: {
          connectionId: 'conn-1',
          name: 'Acme',
          vertical: 'ECOMMERCE',
          primaryPageId: 'page-1',
          timezoneId: '25',
        },
      });

      expect(metaAssetCreationService.createBusiness).toHaveBeenCalledWith(
        'conn-1',
        expect.objectContaining({ accessRequestId: 'request-a', vertical: 'ECOMMERCE' }),
        'client@example.com',
        'agency-a'
      );
    });

    it('rejects a missing primaryPageId with 400 VALIDATION_ERROR', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/client/token-a/create/meta/business',
        payload: {
          connectionId: 'conn-1',
          name: 'Acme',
          timezoneId: '25',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
      expect(metaAssetCreationService.createBusiness).not.toHaveBeenCalled();
    });

    it('returns 404 when the access request token is unknown', async () => {
      vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
        data: null,
        error: { code: 'NOT_FOUND', message: 'nope' },
      } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/client/token-a/create/meta/business',
        payload: {
          connectionId: 'conn-1',
          name: 'Acme',
          primaryPageId: 'page-1',
          timezoneId: '25',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 403 when the connection belongs to a different access request', async () => {
      vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue({
        id: 'conn-1',
        accessRequestId: 'request-other',
        agencyId: 'agency-other',
        clientEmail: 'someone@example.com',
      } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/client/token-a/create/meta/business',
        payload: {
          connectionId: 'conn-1',
          name: 'Acme',
          primaryPageId: 'page-1',
          timezoneId: '25',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('FORBIDDEN');
    });

    it.each([
      ['AUTHORIZATION_INACTIVE', 400],
      ['TOKEN_EXPIRED', 400],
      ['CREATION_IN_PROGRESS', 409],
      ['CREATION_OUTCOME_UNKNOWN', 409],
      ['IDEMPOTENCY_KEY_REUSED', 409],
      ['LIMIT_EXCEEDED', 500],
      ['INVALID_PRIMARY_PAGE', 500],
      ['INSUFFICIENT_PERMISSIONS', 500],
    ])('maps service error %s to %i', async (code, statusCode) => {
      vi.mocked(metaAssetCreationService.createBusiness).mockResolvedValue({
        data: null,
        error: { code, message: 'failure' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/client/token-a/create/meta/business',
        payload: {
          connectionId: 'conn-1',
          name: 'Acme',
          primaryPageId: 'page-1',
          timezoneId: '25',
        },
      });

      expect(response.statusCode).toBe(statusCode);
      expect(response.json().error.code).toBe(code);
    });
  });

  describe('GET /client/:token/create/meta/user-pages', () => {
    it('returns the user pages with 200', async () => {
      vi.mocked(metaAssetCreationService.getUserPages).mockResolvedValue({
        data: [{ id: 'page-1', name: 'Acme Main', category: 'Retail' }],
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/client/token-a/create/meta/user-pages?connectionId=conn-1',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: { pages: [{ id: 'page-1', name: 'Acme Main', category: 'Retail' }] },
        error: null,
      });
      expect(metaAssetCreationService.getUserPages).toHaveBeenCalledWith('conn-1');
    });

    it('requires a connectionId (400)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/client/token-a/create/meta/user-pages',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 403 when the connection belongs to a different access request', async () => {
      vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue({
        id: 'conn-1',
        accessRequestId: 'request-other',
        agencyId: 'agency-other',
        clientEmail: 'someone@example.com',
      } as any);

      const response = await app.inject({
        method: 'GET',
        url: '/client/token-a/create/meta/user-pages?connectionId=conn-1',
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /client/:token/create/meta/links', () => {
    it('surfaces business verification and payment links alongside page/pixel links', async () => {
      vi.mocked(metaAssetCreationService.getAssetCreationLinks).mockReturnValue({
        pageCreationUrl: 'https://business.facebook.com/pages/creation/?business_id=biz-1',
        pixelCreationUrl: 'https://business.facebook.com/events_manager2/pixel/new/?business_id=biz-1',
        businessVerificationUrl: 'https://business.facebook.com/settings/biz-1/security_center',
        paymentMethodUrl: 'https://business.facebook.com/settings/biz-1/payment',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/client/token-a/create/meta/links?businessId=biz-1',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.businessVerificationUrl).toContain('security_center');
      expect(body.data.paymentMethodUrl).toContain('payment');
    });
  });
});
