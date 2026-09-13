/**
 * Access Requests Routes Tests
 *
 * Tests for enforcing platform connection requirements.
 * Following TDD - tests for new validation logic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { accessRequestRoutes } from '../access-requests.js';
import * as accessRequestService from '@/services/access-request.service';
import * as agencyPlatformService from '@/services/agency-platform.service';
import * as auditService from '@/services/audit.service';
import * as authorization from '@/lib/authorization.js';

// Mock services
vi.mock('@/services/access-request.service');
vi.mock('@/services/agency-platform.service');
vi.mock('@/services/audit.service');
vi.mock('@/lib/authorization.js');
vi.mock('@/services/quota.service', () => ({
  quotaService: {
    checkQuota: vi.fn().mockResolvedValue({
      allowed: true,
      current: 0,
      limit: 100,
      remaining: 100,
      metric: 'access_requests',
    }),
  },
  QuotaExceededError: class extends Error {
    toJSON() {
      return { error: { code: 'QUOTA_EXCEEDED', message: 'Quota exceeded' } };
    }
  },
}));
vi.mock('@/middleware/auth.js', () => ({
  authenticate: () => async (request: any) => {
    request.user = { sub: 'user_123' };
  },
}));

// Mock Redis to prevent connection attempts in tests
vi.mock('@/lib/redis', () => ({
  redis: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    quit: vi.fn(),
  },
}));

describe('Access Requests Routes - Platform Connection Validation', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(accessRequestRoutes);
    vi.clearAllMocks();
    vi.mocked(authorization.resolvePrincipalAgency).mockResolvedValue({
      data: { agencyId: 'agency-1', principalId: 'user_123' },
      error: null,
    });
    vi.mocked(authorization.assertAgencyAccess).mockImplementation((requested, principal) => {
      if (requested !== principal) {
        return {
          code: 'FORBIDDEN',
          message: 'You do not have access to this agency resource',
        };
      }
      return null;
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /agencies/:id/access-requests', () => {
    it('should default the list limit to 50 when the query omits limit', async () => {
      vi.mocked(accessRequestService.getAgencyAccessRequests).mockResolvedValue({
        data: [],
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/agencies/agency-1/access-requests',
      });

      expect(response.statusCode).toBe(200);
      expect(accessRequestService.getAgencyAccessRequests).toHaveBeenCalledWith(
        'agency-1',
        expect.objectContaining({
          limit: 50,
          offset: 0,
        })
      );
    });

    it('should reject an oversized list limit with VALIDATION_ERROR', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/agencies/agency-1/access-requests?limit=500',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        data: null,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      });
      expect(accessRequestService.getAgencyAccessRequests).not.toHaveBeenCalled();
    });
  });

  describe('POST /access-requests - payload normalization', () => {
    it('should accept Record<string, string[]> platform payloads', async () => {
      vi.mocked(accessRequestService.createAccessRequest).mockResolvedValue({
        data: { id: 'req-1', agencyId: 'agency-1' } as any,
        error: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/access-requests',
        payload: {
          agencyId: 'agency-1',
          clientName: 'John Doe',
          clientEmail: 'john@client.com',
          platforms: {
            google: ['google_ads', 'ga4'],
            meta: ['meta_ads'],
          },
        },
      });

      expect(response.statusCode).toBe(201);
      expect(accessRequestService.createAccessRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          platforms: expect.arrayContaining([
            { platform: 'google_ads', accessLevel: 'manage' },
            { platform: 'ga4', accessLevel: 'manage' },
            { platform: 'meta_ads', accessLevel: 'manage' },
          ]),
        })
      );
    });

    it('should accept flat platform payloads', async () => {
      vi.mocked(accessRequestService.createAccessRequest).mockResolvedValue({
        data: { id: 'req-1', agencyId: 'agency-1' } as any,
        error: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/access-requests',
        payload: {
          agencyId: 'agency-1',
          clientName: 'John Doe',
          clientEmail: 'john@client.com',
          platforms: [
            { platform: 'google_ads', accessLevel: 'admin' },
            { platform: 'meta_ads', accessLevel: 'read_only' },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      expect(accessRequestService.createAccessRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          platforms: expect.arrayContaining([
            { platform: 'google_ads', accessLevel: 'manage' },
            { platform: 'meta_ads', accessLevel: 'view_only' },
          ]),
        })
      );
    });

    it('should return 400 when normalized platforms are empty', async () => {
      vi.mocked(accessRequestService.createAccessRequest).mockResolvedValue({
        data: null as any,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'At least one platform must be selected',
        } as any,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/access-requests',
        payload: {
          agencyId: 'agency-1',
          clientName: 'John Doe',
          clientEmail: 'john@client.com',
          platforms: {},
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('should ignore empty groups in object payload', async () => {
      vi.mocked(accessRequestService.createAccessRequest).mockResolvedValue({
        data: { id: 'req-1', agencyId: 'agency-1' } as any,
        error: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/access-requests',
        payload: {
          agencyId: 'agency-1',
          clientName: 'John Doe',
          clientEmail: 'john@client.com',
          platforms: {
            google: ['google_ads'],
            meta: [],
          },
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().error).toBeNull();
      expect(accessRequestService.createAccessRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          platforms: [{ platform: 'google_ads', accessLevel: 'manage' }],
        })
      );
    });

    it('should normalize hierarchical platform structure', async () => {
      vi.mocked(accessRequestService.createAccessRequest).mockResolvedValue({
        data: {
          id: 'req-1',
          agencyId: 'agency-1',
          platforms: [
            { platformGroup: 'google', products: [{ product: 'google_ads', accessLevel: 'admin' }] },
          ],
        } as any,
        error: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/access-requests',
        payload: {
          agencyId: 'agency-1',
          clientName: 'John Doe',
          clientEmail: 'john@client.com',
          platforms: [
            { platformGroup: 'google', products: [{ product: 'google_ads', accessLevel: 'admin' }] },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      expect(agencyPlatformService.getConnections).not.toHaveBeenCalled();
      expect(accessRequestService.createAccessRequest).toHaveBeenCalled();
    });

    it('should not require an authorization mode field in the request payload', async () => {
      const mockAccessRequest = {
        id: 'req-1',
        agencyId: 'agency-1',
      };

      vi.mocked(accessRequestService.createAccessRequest).mockResolvedValue({
        data: mockAccessRequest as any,
        error: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/access-requests',
        payload: {
          agencyId: 'agency-1',
          clientName: 'John Doe',
          clientEmail: 'john@client.com',
          platforms: [
            { platformGroup: 'google', products: [{ product: 'google_ads', accessLevel: 'admin' }] },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      expect(agencyPlatformService.getConnections).not.toHaveBeenCalled();
    });
  });

  describe('GET /access-requests/:id', () => {
    it('logs audit event when Shopify submission details are viewed', async () => {
      vi.mocked(accessRequestService.getAccessRequestById).mockResolvedValue({
        data: {
          id: 'req-1',
          agencyId: 'agency-1',
          shopifySubmission: {
            status: 'submitted',
            shopDomain: 'client-store.myshopify.com',
            collaboratorCode: '1234',
            connectionId: 'conn-1',
          },
        } as any,
        error: null,
      });
      vi.mocked(auditService.auditService.createAuditLog).mockResolvedValue({
        data: {} as any,
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/access-requests/req-1',
      });

      expect(response.statusCode).toBe(200);
      expect(auditService.auditService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SHOPIFY_SUBMISSION_VIEWED',
          resourceType: 'access_request',
          resourceId: 'req-1',
          metadata: expect.objectContaining({
            hasCollaboratorCode: true,
            shopDomain: 'client-store.myshopify.com',
            connectionId: 'conn-1',
          }),
        })
      );
    });

    it('does not log Shopify submission event when submission is pending', async () => {
      vi.mocked(accessRequestService.getAccessRequestById).mockResolvedValue({
        data: {
          id: 'req-1',
          agencyId: 'agency-1',
          shopifySubmission: {
            status: 'pending_client',
          },
        } as any,
        error: null,
      });
      vi.mocked(auditService.auditService.createAuditLog).mockResolvedValue({
        data: {} as any,
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/access-requests/req-1',
      });

      expect(response.statusCode).toBe(200);
      expect(auditService.auditService.createAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /access-requests/:id', () => {
    it('should normalize hierarchical platform payload before update', async () => {
      vi.mocked(accessRequestService.getAccessRequestById).mockResolvedValue({
        data: { id: 'req-1', agencyId: 'agency-1' } as any,
        error: null,
      });
      vi.mocked(accessRequestService.updateAccessRequest).mockResolvedValue({
        data: {
          id: 'req-1',
          authorizationLinkChanged: false,
        } as any,
        error: null,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/access-requests/req-1',
        payload: {
          platforms: [
            {
              platformGroup: 'google',
              products: [
                { product: 'google_ads', accessLevel: 'admin' },
                { product: 'ga4', accessLevel: 'read_only' },
              ],
            },
          ],
          branding: { primaryColor: '#FF6B35' },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(accessRequestService.updateAccessRequest).toHaveBeenCalledWith(
        'req-1',
        expect.objectContaining({
          platforms: [
            { platform: 'google_ads', accessLevel: 'manage' },
            { platform: 'ga4', accessLevel: 'view_only' },
          ],
          branding: { primaryColor: '#FF6B35' },
        })
      );
    });

    it('should return 400 for non-editable request status errors', async () => {
      vi.mocked(accessRequestService.getAccessRequestById).mockResolvedValue({
        data: { id: 'req-1', agencyId: 'agency-1' } as any,
        error: null,
      });
      vi.mocked(accessRequestService.updateAccessRequest).mockResolvedValue({
        data: null as any,
        error: {
          code: 'REQUEST_NOT_EDITABLE',
          message: 'Only pending or partial requests can be edited',
        } as any,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/access-requests/req-1',
        payload: { branding: { primaryColor: '#FF6B35' } },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('REQUEST_NOT_EDITABLE');
    });

    it('should reject client identity mutations from request edit payloads', async () => {
      vi.mocked(accessRequestService.getAccessRequestById).mockResolvedValue({
        data: { id: 'req-1', agencyId: 'agency-1' } as any,
        error: null,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/access-requests/req-1',
        payload: {
          clientEmail: 'new-recipient@example.com',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
      expect(response.json().error.message).toMatch(/client profile management/i);
      expect(accessRequestService.getAccessRequestById).toHaveBeenCalledWith('req-1');
      expect(accessRequestService.updateAccessRequest).not.toHaveBeenCalled();
    });
  });

  describe('GET /client/:token - public client payload', () => {
    it('should return enriched client payload from service', async () => {
      vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
        data: {
          id: 'request-1',
          agencyId: 'agency-1',
          agencyName: 'Demo Agency',
          clientName: 'Jane Client',
          clientEmail: 'jane@client.com',
          status: 'pending',
          uniqueToken: 'token-1',
          expiresAt: new Date().toISOString(),
          platforms: [{ platformGroup: 'google', products: [{ product: 'google_ads', accessLevel: 'admin' }] }],
          intakeFields: [],
          branding: {},
          manualInviteTargets: {
            google: {
              agencyEmail: 'ops@demoagency.com',
            },
          },
          authorizationProgress: {
            completedPlatforms: ['google'],
            isComplete: true,
          },
        } as any,
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/client/token-1',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.agencyName).toBe('Demo Agency');
      expect(response.json().data.manualInviteTargets.google.agencyEmail).toBe('ops@demoagency.com');
      expect(response.json().data.authorizationProgress.completedPlatforms).toEqual(['google']);
    });

    it('should return 404 when request token does not exist', async () => {
      vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
        data: null as any,
        error: {
          code: 'REQUEST_NOT_FOUND',
          message: 'Access request not found',
        } as any,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/client/missing-token',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('REQUEST_NOT_FOUND');
    });

    it('should return 404 when request token is expired', async () => {
      vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
        data: null as any,
        error: {
          code: 'REQUEST_EXPIRED',
          message: 'Access request has expired',
        } as any,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/client/expired-token',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('REQUEST_EXPIRED');
    });
  });
});
