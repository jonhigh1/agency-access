/**
 * Access Request Service Unit Tests
 *
 * Tests for access request creation and management.
 */

import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { queueWebhookDelivery } from '@/lib/queue-helpers';
import * as accessRequestService from '@/services/access-request.service';

// Mock env first to prevent Zod validation errors
vi.mock('@/lib/env', () => ({
  env: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    CLERK_PUBLISHABLE_KEY: 'pk_test_key',
    CLERK_SECRET_KEY: 'sk_test_secret_key',
  },
}));

// Mock crypto for token generation
var cryptoCallCount = 0;
vi.mock('crypto', () => ({
  randomUUID: () => '11111111-1111-4111-8111-111111111111',
  randomBytes: (size: number) => ({
    toString: (encoding: string) => {
      if (encoding === 'hex') {
        cryptoCallCount++;
        // Return different values for different calls to test uniqueness
        const hex = cryptoCallCount.toString(16).padStart(12, '0').slice(0, 12);
        return hex;
      }
      return '';
    },
  }),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    accessRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    agency: {
      findUnique: vi.fn(),
    },
    agencyPlatformConnection: {
      findMany: vi.fn(),
    },
    clientConnection: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    platformAuthorization: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    webhookEndpoint: {
      findUnique: vi.fn(),
    },
    webhookEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/queue-helpers', () => ({
  queueWebhookDelivery: vi.fn(),
}));

describe('AccessRequestService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createAccessRequest', () => {
    it('should create a new access request with unique token', async () => {
      const mockAgency = {
        id: 'agency-1',
        name: 'Test Agency',
      };

      const mockRequest = {
        id: 'request-1',
        agencyId: 'agency-1',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        uniqueToken: 'a1b2c3d4e5f6',
        platforms: ['meta_ads', 'google_ads'],
        intakeFields: [],
        branding: {},
        status: 'pending',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.agency.findUnique).mockResolvedValue(mockAgency as any);
      vi.mocked(prisma.accessRequest.create).mockResolvedValue(mockRequest as any);

      const result = await accessRequestService.createAccessRequest({
        agencyId: 'agency-1',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        intakeFields: [],
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data?.uniqueToken).toBe('a1b2c3d4e5f6');
      expect(result.data?.status).toBe('pending');
    });

    it('should expire new access requests after seven days by default', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-23T12:00:00.000Z'));

      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        id: 'agency-1',
        name: 'Test Agency',
      } as any);
      vi.mocked(prisma.accessRequest.create).mockResolvedValue({
        id: 'request-1',
        uniqueToken: 'a1b2c3d4e5f6',
        status: 'pending',
      } as any);

      await accessRequestService.createAccessRequest({
        agencyId: 'agency-1',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        intakeFields: [],
      });

      expect(prisma.accessRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: new Date('2026-06-30T12:00:00.000Z'),
        }),
      });
    });

    it('should return error for invalid input', async () => {
      const result = await accessRequestService.createAccessRequest({
        agencyId: '', // Invalid
        clientName: '', // Invalid
        clientEmail: 'invalid-email', // Invalid email
        platforms: [], // Invalid - empty platforms
        intakeFields: [],
      });

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should return error if agency not found', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue(null);

      const result = await accessRequestService.createAccessRequest({
        agencyId: 'non-existent',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        intakeFields: [],
      });

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('AGENCY_NOT_FOUND');
    });

    it('should generate unique token (retry on collision)', async () => {
      const mockAgency = { id: 'agency-1' };
      vi.mocked(prisma.agency.findUnique).mockResolvedValue(mockAgency as any);

      vi.mocked(prisma.accessRequest.create)
        .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }))
        .mockResolvedValue({
          id: 'request-1',
          uniqueToken: 'a1b2c3d4e5f6',
        } as any);

      const result = await accessRequestService.createAccessRequest({
        agencyId: 'agency-1',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        intakeFields: [],
      });

      expect(result.error).toBeNull();
      expect(result.data?.uniqueToken).toBeTruthy();
    });

    it('should accept onboarding platform ids like linkedin_ads and kit', async () => {
      const mockAgency = {
        id: 'agency-1',
        name: 'Test Agency',
      };

      vi.mocked(prisma.agency.findUnique).mockResolvedValue(mockAgency as any);
      vi.mocked(prisma.accessRequest.create).mockResolvedValue({
        id: 'request-1',
        uniqueToken: 'a1b2c3d4e5f6',
      } as any);

      const result = await accessRequestService.createAccessRequest({
        agencyId: 'agency-1',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        platforms: [
          { platform: 'linkedin_ads' as any, accessLevel: 'manage' },
          { platform: 'kit' as any, accessLevel: 'view_only' },
        ],
        intakeFields: [],
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
    });

    it('should accept meta_pages as a supported access request product', async () => {
      const mockAgency = {
        id: 'agency-1',
        name: 'Test Agency',
      };

      vi.mocked(prisma.agency.findUnique).mockResolvedValue(mockAgency as any);
      vi.mocked(prisma.accessRequest.create).mockResolvedValue({
        id: 'request-1',
        uniqueToken: 'a1b2c3d4e5f6',
      } as any);

      const result = await accessRequestService.createAccessRequest({
        agencyId: 'agency-1',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        platforms: [{ platform: 'meta_pages' as any, accessLevel: 'manage' }],
        intakeFields: [],
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
    });

    it('should persist externalReference when provided', async () => {
      const mockAgency = {
        id: 'agency-1',
        name: 'Test Agency',
      };

      vi.mocked(prisma.agency.findUnique).mockResolvedValue(mockAgency as any);
      vi.mocked(prisma.accessRequest.create).mockResolvedValue({
        id: 'request-1',
        uniqueToken: 'a1b2c3d4e5f6',
        externalReference: 'crm-123',
      } as any);

      const result = await accessRequestService.createAccessRequest({
        agencyId: 'agency-1',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        intakeFields: [],
        externalReference: 'crm-123',
      } as any);

      expect(result.error).toBeNull();
      expect(prisma.accessRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            externalReference: 'crm-123',
          }),
        })
      );
    });
  });

  describe('getAccessRequestByToken', () => {
    it('should return access request by token', async () => {
      const mockRequest = {
        id: 'request-1',
        uniqueToken: 'a1b2c3d4e5f6',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        agencyId: 'agency-1',
        expiresAt: new Date(Date.now() + 100000),
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        intakeFields: [],
        branding: {},
      };

      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ name: 'Agency' } as any);
      vi.mocked(prisma.agencyPlatformConnection.findMany).mockResolvedValue([]);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([]);

      const result = await accessRequestService.getAccessRequestByToken('a1b2c3d4e5f6');

      expect(result.error).toBeNull();
      expect(result.data?.id).toBe(mockRequest.id);
      expect(result.data?.uniqueToken).toBe(mockRequest.uniqueToken);
      expect(result.data?.platforms).toEqual([
        {
          platformGroup: 'meta',
          products: [{ product: 'meta_ads', accessLevel: 'admin', accounts: [] }],
        },
      ]);
    });

    it('groups google_tag_manager under google and meta_ads under meta', async () => {
      const mockRequest = {
        id: 'request-gtm',
        uniqueToken: 'gtmtoken1',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        agencyId: 'agency-1',
        expiresAt: new Date(Date.now() + 100000),
        platforms: [
          { platform: 'google_tag_manager', accessLevel: 'manage' },
          { platform: 'meta_ads', accessLevel: 'manage' },
        ],
        intakeFields: [],
        branding: {},
      };

      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ name: 'Agency' } as any);
      vi.mocked(prisma.agencyPlatformConnection.findMany).mockResolvedValue([]);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([]);

      const result = await accessRequestService.getAccessRequestByToken('gtmtoken1');

      expect(result.error).toBeNull();
      expect(result.data?.platforms).toEqual([
        {
          platformGroup: 'google',
          products: [{ product: 'google_tag_manager', accessLevel: 'admin', accounts: [] }],
        },
        {
          platformGroup: 'meta',
          products: [{ product: 'meta_ads', accessLevel: 'admin', accounts: [] }],
        },
      ]);
    });

    it('does not count OAuth-only Google discovery as completed for native-grant-supported products', async () => {
      const mockRequest = {
        id: 'request-1',
        uniqueToken: 'token-123',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        agencyId: 'agency-1',
        expiresAt: new Date(Date.now() + 100000),
        platforms: [
          { platform: 'google_ads', accessLevel: 'manage' },
          { platform: 'beehiiv', accessLevel: 'manage' },
        ],
        intakeFields: [],
        branding: {},
      };

      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ name: 'Agency' } as any);
      vi.mocked(prisma.agencyPlatformConnection.findMany).mockResolvedValue([]);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([
        {
          id: 'conn-oauth',
          grantedAssets: {
            google_ads: {
              adAccounts: ['customers/123'],
              availableAssetCount: 1,
            },
          },
          authorizations: [{ platform: 'google_ads', status: 'active' }],
        },
        {
          id: 'conn-manual',
          grantedAssets: { platform: 'beehiiv' },
          authorizations: [],
        },
      ] as any);

      const result = await accessRequestService.getAccessRequestByToken('token-123');

      expect(result.error).toBeNull();
      expect(result.data?.authorizationProgress.completedPlatforms).toEqual(
        expect.arrayContaining(['beehiiv'])
      );
      expect(result.data?.authorizationProgress.completedPlatforms).not.toContain('google');
      expect((result.data as any)?.authorizationProgress.unresolvedProducts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            product: 'google_ads',
            platformGroup: 'google',
            reason: 'oauth_only_insufficient',
          }),
        ])
      );
      expect((result.data as any)?.authorizationProgress.googleProductFulfillment).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            product: 'google_ads',
            state: 'oauth_only_insufficient',
            isFulfilled: false,
          }),
        ])
      );
      expect(result.data?.authorizationProgress.isComplete).toBe(false);
    });

    it('marks Google products complete once the native grant lifecycle is verified', async () => {
      const mockRequest = {
        id: 'request-1',
        uniqueToken: 'token-google-verified-123',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        agencyId: 'agency-1',
        expiresAt: new Date(Date.now() + 100000),
        platforms: [{ platform: 'google_ads', accessLevel: 'manage' }],
        intakeFields: [],
        branding: {},
      };

      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ name: 'Agency' } as any);
      vi.mocked(prisma.agencyPlatformConnection.findMany).mockResolvedValue([]);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([
        {
          id: 'conn-google-verified',
          grantedAssets: {
            google_ads: {
              adAccounts: ['customers/123'],
              availableAssetCount: 1,
              googleGrantLifecycle: {
                fulfillmentMode: 'manager_link',
                grantStatus: 'verified',
              },
            },
          },
          authorizations: [{ platform: 'google', status: 'active' }],
        },
      ] as any);

      const result = await accessRequestService.getAccessRequestByToken(
        'token-google-verified-123'
      );

      expect(result.error).toBeNull();
      expect(result.data?.authorizationProgress.completedPlatforms).toEqual(['google']);
      expect((result.data as any)?.authorizationProgress.googleProductFulfillment).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            product: 'google_ads',
            state: 'fulfilled',
            isFulfilled: true,
          }),
        ])
      );
      expect(result.data?.authorizationProgress.isComplete).toBe(true);
    });

    it('defaults Google Ads fulfillment to manager_link when the agency has valid MCC settings configured', async () => {
      const mockRequest = {
        id: 'request-1',
        uniqueToken: 'token-google-mcc-default-123',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        agencyId: 'agency-1',
        expiresAt: new Date(Date.now() + 100000),
        platforms: [{ platform: 'google_ads', accessLevel: 'manage' }],
        intakeFields: [],
        branding: {},
      };

      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ name: 'Agency' } as any);
      vi.mocked(prisma.agencyPlatformConnection.findMany).mockResolvedValue([
        {
          platform: 'google',
          connectedBy: 'owner@agency.test',
          metadata: {
            googleAssetSettings: {
              googleAdsManagement: {
                preferredGrantMode: 'manager_link',
                managerCustomerId: '6449142979',
                inviteEmail: 'jon.highmu@gmail.com',
              },
            },
            googleAccounts: {
              adsAccounts: [
                {
                  id: '6449142979',
                  isManager: true,
                  type: 'google_ads',
                  status: 'active',
                  name: 'Pillar AI Agency MCC',
                },
              ],
            },
          },
        },
      ] as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([
        {
          id: 'conn-google-pending',
          grantedAssets: {
            google_ads: {
              adAccounts: ['customers/123'],
              availableAssetCount: 1,
            },
          },
          authorizations: [{ platform: 'google', status: 'active' }],
        },
      ] as any);

      const result = await accessRequestService.getAccessRequestByToken(
        'token-google-mcc-default-123'
      );

      expect(result.error).toBeNull();
      expect((result.data as any)?.authorizationProgress.googleProductFulfillment).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            product: 'google_ads',
            fulfillmentMode: 'manager_link',
            state: 'oauth_only_insufficient',
            pendingActor: 'system',
          }),
        ])
      );
    });

    it('does not mark unsupported Search Console automation paths as complete', async () => {
      const mockRequest = {
        id: 'request-1',
        uniqueToken: 'token-gsc-unsupported-123',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        agencyId: 'agency-1',
        expiresAt: new Date(Date.now() + 100000),
        platforms: [{ platform: 'google_search_console', accessLevel: 'manage' }],
        intakeFields: [],
        branding: {},
      };

      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ name: 'Agency' } as any);
      vi.mocked(prisma.agencyPlatformConnection.findMany).mockResolvedValue([]);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([
        {
          id: 'conn-gsc-unsupported',
          grantedAssets: {
            google_search_console: {
              sites: ['sc-domain:example.com'],
              availableAssetCount: 1,
              googleGrantLifecycle: {
                fulfillmentMode: 'user_permission',
                grantStatus: 'verified',
              },
            },
          },
          authorizations: [{ platform: 'google', status: 'active' }],
        },
      ] as any);

      const result = await accessRequestService.getAccessRequestByToken(
        'token-gsc-unsupported-123'
      );

      expect(result.error).toBeNull();
      expect(result.data?.authorizationProgress.completedPlatforms).toEqual([]);
      expect((result.data as any)?.authorizationProgress.unresolvedProducts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            product: 'google_search_console',
            platformGroup: 'google',
            reason: 'unsupported_automation_path',
          }),
        ])
      );
      expect((result.data as any)?.authorizationProgress.googleProductFulfillment).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            product: 'google_search_console',
            state: 'unsupported_automation_path',
            isFulfilled: false,
          }),
        ])
      );
      expect(result.data?.authorizationProgress.isComplete).toBe(false);
    });

    it('marks LinkedIn Ads unresolved when OAuth exists without any selected accounts', async () => {
      const mockRequest = {
        id: 'request-1',
        uniqueToken: 'token-linkedin-123',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        agencyId: 'agency-1',
        expiresAt: new Date(Date.now() + 100000),
        platforms: [{ platform: 'linkedin_ads', accessLevel: 'manage' }],
        intakeFields: [],
        branding: {},
      };

      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ name: 'Agency' } as any);
      vi.mocked(prisma.agencyPlatformConnection.findMany).mockResolvedValue([]);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([
        {
          id: 'conn-linkedin',
          grantedAssets: {},
          authorizations: [{ platform: 'linkedin', status: 'active' }],
        },
      ] as any);

      const result = await accessRequestService.getAccessRequestByToken('token-linkedin-123');

      expect(result.error).toBeNull();
      expect(result.data?.authorizationProgress.completedPlatforms).toEqual([]);
      expect((result.data as any)?.authorizationProgress.fulfilledProducts).toEqual([]);
      expect((result.data as any)?.authorizationProgress.unresolvedProducts).toEqual([
        {
          product: 'linkedin_ads',
          platformGroup: 'linkedin',
          reason: 'selection_required',
        },
      ]);
      expect(result.data?.authorizationProgress.isComplete).toBe(false);
    });

    it('marks LinkedIn Pages unresolved when OAuth exists without any selected pages', async () => {
      const mockRequest = {
        id: 'request-1',
        uniqueToken: 'token-linkedin-pages-123',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        agencyId: 'agency-1',
        expiresAt: new Date(Date.now() + 100000),
        platforms: [{ platform: 'linkedin_pages', accessLevel: 'manage' }],
        intakeFields: [],
        branding: {},
      };

      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ name: 'Agency' } as any);
      vi.mocked(prisma.agencyPlatformConnection.findMany).mockResolvedValue([]);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([
        {
          id: 'conn-linkedin-pages',
          grantedAssets: {},
          authorizations: [{ platform: 'linkedin', status: 'active' }],
        },
      ] as any);

      const result = await accessRequestService.getAccessRequestByToken('token-linkedin-pages-123');

      expect(result.error).toBeNull();
      expect((result.data as any)?.authorizationProgress.unresolvedProducts).toEqual([
        {
          product: 'linkedin_pages',
          platformGroup: 'linkedin',
          reason: 'selection_required',
        },
      ]);
      expect(result.data?.authorizationProgress.isComplete).toBe(false);
    });

    it('marks asset-selecting products unresolved with no_assets when saved discovery shows empty inventory', async () => {
      const mockRequest = {
        id: 'request-1',
        uniqueToken: 'token-google-123',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        agencyId: 'agency-1',
        expiresAt: new Date(Date.now() + 100000),
        platforms: [{ platform: 'google_business_profile', accessLevel: 'manage' }],
        intakeFields: [],
        branding: {},
      };

      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ name: 'Agency' } as any);
      vi.mocked(prisma.agencyPlatformConnection.findMany).mockResolvedValue([]);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([
        {
          id: 'conn-google',
          grantedAssets: {
            google_business_profile: {
              businessAccounts: [],
              availableAssetCount: 0,
            },
          },
          authorizations: [{ platform: 'google', status: 'active' }],
        },
      ] as any);

      const result = await accessRequestService.getAccessRequestByToken('token-google-123');

      expect(result.error).toBeNull();
      expect(result.data?.authorizationProgress.completedPlatforms).toEqual([]);
      expect((result.data as any)?.authorizationProgress.unresolvedProducts).toEqual([
        {
          product: 'google_business_profile',
          platformGroup: 'google',
          reason: 'no_assets',
        },
      ]);
    });

    it('should return error if request not found', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(null);

      const result = await accessRequestService.getAccessRequestByToken('invalid-token');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('REQUEST_NOT_FOUND');
    });

    it('should return error for expired request', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        expiresAt: new Date(Date.now() - 100000), // Expired
      } as any);

      const result = await accessRequestService.getAccessRequestByToken('expired-token');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('REQUEST_EXPIRED');
    });
  });

  describe('getAgencyAccessRequests', () => {
    it('should return all access requests for an agency', async () => {
      const mockRequests = [
        { id: 'request-1', clientName: 'Client 1', status: 'pending' },
        { id: 'request-2', clientName: 'Client 2', status: 'completed' },
      ];

      vi.mocked(prisma.accessRequest.findMany).mockResolvedValue(mockRequests as any);

      const result = await accessRequestService.getAgencyAccessRequests('agency-1');

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockRequests);
    });
  });

  describe('getAccessRequestById', () => {
    it('scopes a request lookup to the agency when one is supplied', async () => {
      vi.mocked(prisma.accessRequest.findFirst).mockResolvedValue(null);

      const result = await accessRequestService.getAccessRequestById('request-1', 'agency-1');

      expect(result).toMatchObject({ data: null, error: { code: 'NOT_FOUND' } });
      expect(prisma.accessRequest.findFirst).toHaveBeenCalledWith({ where: { id: 'request-1', agencyId: 'agency-1' } });
      expect(prisma.accessRequest.findUnique).not.toHaveBeenCalled();
    });

    it('finds an access request created for an agent operation within its agency', async () => {
      vi.mocked(prisma.accessRequest.findFirst).mockResolvedValue({ id: 'request-1', agencyId: 'agency-1' } as any);

      const result = await accessRequestService.findByAgentOperation('agency-1', 'operation-1');

      expect(result).toEqual({ data: { id: 'request-1', agencyId: 'agency-1' }, error: null });
      expect(prisma.accessRequest.findFirst).toHaveBeenCalledWith({
        where: { agencyId: 'agency-1', externalReference: 'agent-operation:operation-1' },
      });
    });

    it('returns pending Shopify submission state when Shopify is requested but not submitted', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        agencyId: 'agency-1',
        clientName: 'Client',
        clientEmail: 'client@example.com',
        status: 'pending',
        uniqueToken: 'token12345678',
        expiresAt: new Date(Date.now() + 100000),
        createdAt: new Date(),
        platforms: [{ platform: 'shopify', accessLevel: 'manage' }],
      } as any);
      vi.mocked(prisma.clientConnection.findFirst).mockResolvedValue(null);

      const result = await accessRequestService.getAccessRequestById('request-1');

      expect(result.error).toBeNull();
      expect((result.data as any)?.shopifySubmission).toMatchObject({
        status: 'pending_client',
      });
    });

    it('returns submitted Shopify details when client has provided them', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        agencyId: 'agency-1',
        clientName: 'Client',
        clientEmail: 'client@example.com',
        status: 'partial',
        uniqueToken: 'token12345678',
        expiresAt: new Date(Date.now() + 100000),
        createdAt: new Date(),
        platforms: [{ platform: 'shopify', accessLevel: 'manage' }],
      } as any);
      vi.mocked(prisma.clientConnection.findFirst).mockResolvedValue({
        id: 'conn-1',
        createdAt: new Date('2026-03-05T00:00:00.000Z'),
        grantedAssets: {
          platform: 'shopify',
          shopDomain: 'client-store.myshopify.com',
          collaboratorCode: '1234',
        },
      } as any);

      const result = await accessRequestService.getAccessRequestById('request-1');

      expect(result.error).toBeNull();
      expect((result.data as any)?.shopifySubmission).toMatchObject({
        status: 'submitted',
        connectionId: 'conn-1',
        shopDomain: 'client-store.myshopify.com',
        collaboratorCode: '1234',
      });
    });
  });

  describe('markRequestAuthorized', () => {
    it('should mark request as completed and emit a completed webhook event once', async () => {
      vi.mocked(prisma.accessRequest.findUnique)
        .mockResolvedValueOnce({
          id: 'request-1',
          platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        } as any)
        .mockResolvedValueOnce({
          id: 'request-1',
          status: 'pending',
          agencyId: 'agency-1',
          authorizedAt: null,
        } as any)
        .mockResolvedValueOnce({
          id: 'request-1',
          agencyId: 'agency-1',
          clientId: 'client-1',
          clientName: 'Test Client',
          clientEmail: 'client@test.com',
          externalReference: 'crm-123',
          platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
          status: 'completed',
          uniqueToken: 'token-complete-1',
          createdAt: new Date('2026-03-08T00:00:00.000Z'),
          authorizedAt: new Date('2026-03-08T01:00:00.000Z'),
          expiresAt: new Date('2026-04-07T00:00:00.000Z'),
          client: {
            id: 'client-1',
            company: 'Acme Inc',
          },
        } as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([
        {
          id: 'connection-1',
          status: 'active',
          grantedAssets: {
            meta_ads: {
              adAccounts: ['act_123'],
              availableAssetCount: 1,
            },
          },
          authorizations: [{ platform: 'meta', status: 'active' }],
        },
      ] as any);
      vi.mocked(prisma.webhookEndpoint.findUnique).mockResolvedValue({
        id: 'endpoint-1',
        agencyId: 'agency-1',
        status: 'active',
        subscribedEvents: ['access_request.completed'],
      } as any);
      vi.mocked(prisma.webhookEvent.create).mockResolvedValue({
        id: 'event-1',
      } as any);

      const mockRequest = {
        id: 'request-1',
        status: 'completed',
        authorizedAt: new Date(),
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
      };

      vi.mocked(prisma.accessRequest.update).mockResolvedValue(mockRequest as any);

      const result = await accessRequestService.markRequestAuthorized('request-1');

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data?.status).toBe('completed');
      expect(prisma.accessRequest.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: {
          status: 'completed',
          authorizedAt: expect.any(Date),
        },
      });
      expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          agencyId: 'agency-1',
          endpointId: 'endpoint-1',
          type: 'access_request.completed',
          resourceType: 'access_request',
          resourceId: 'request-1',
          payload: expect.objectContaining({
            type: 'access_request.completed',
          }),
        }),
      });
      expect(queueWebhookDelivery).toHaveBeenCalledWith('event-1');
    });

    it('should mark request as partial when requested asset-selecting products remain unresolved', async () => {
      vi.mocked(prisma.accessRequest.findUnique)
        .mockResolvedValueOnce({
          id: 'request-1',
          platforms: [{ platform: 'linkedin_ads', accessLevel: 'manage' }],
        } as any)
        .mockResolvedValueOnce({
          id: 'request-1',
          status: 'pending',
          agencyId: 'agency-1',
          authorizedAt: null,
        } as any)
        .mockResolvedValueOnce({
          id: 'request-1',
          agencyId: 'agency-1',
          clientId: 'client-1',
          clientName: 'Test Client',
          clientEmail: 'client@test.com',
          externalReference: 'crm-123',
          platforms: [{ platform: 'linkedin_ads', accessLevel: 'manage' }],
          status: 'partial',
          uniqueToken: 'token-partial-1',
          createdAt: new Date('2026-03-08T00:00:00.000Z'),
          authorizedAt: null,
          expiresAt: new Date('2026-04-07T00:00:00.000Z'),
          client: {
            id: 'client-1',
            company: 'Acme Inc',
          },
        } as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([
        {
          id: 'connection-1',
          status: 'active',
          grantedAssets: {},
          authorizations: [{ platform: 'linkedin', status: 'active' }],
        },
      ] as any);
      vi.mocked(prisma.webhookEndpoint.findUnique).mockResolvedValue({
        id: 'endpoint-1',
        agencyId: 'agency-1',
        status: 'active',
        subscribedEvents: ['access_request.partial'],
      } as any);
      vi.mocked(prisma.webhookEvent.create).mockResolvedValue({
        id: 'event-partial-1',
      } as any);
      vi.mocked(prisma.accessRequest.update).mockResolvedValue({
        id: 'request-1',
        status: 'partial',
        authorizedAt: null,
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
      } as any);

      const result = await accessRequestService.markRequestAuthorized('request-1');

      expect(result.error).toBeNull();
      expect(result.data?.status).toBe('partial');
      expect(prisma.accessRequest.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: {
          status: 'partial',
        },
      });
      expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'access_request.partial',
          resourceId: 'request-1',
        }),
      });
      expect(queueWebhookDelivery).toHaveBeenCalledWith('event-partial-1');
    });

    it('should return error if request not found', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.accessRequest.update).mockRejectedValue(
        new Error('Record to update not found')
      );

      const result = await accessRequestService.markRequestAuthorized('non-existent');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('REQUEST_NOT_FOUND');
    });

    it('should not emit a duplicate completed webhook when request is already completed', async () => {
      const completedAt = new Date('2026-03-08T01:00:00.000Z');
      vi.mocked(prisma.accessRequest.findUnique)
        .mockResolvedValueOnce({
          id: 'request-1',
          platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        } as any)
        .mockResolvedValueOnce({
          id: 'request-1',
          agencyId: 'agency-1',
          status: 'completed',
          authorizedAt: completedAt,
        } as any)
        .mockResolvedValueOnce({
          id: 'request-1',
          agencyId: 'agency-1',
          status: 'completed',
          authorizedAt: completedAt,
          clientName: 'Test Client',
          clientEmail: 'client@test.com',
        } as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([
        {
          id: 'connection-1',
          status: 'active',
          grantedAssets: {
            meta_ads: {
              adAccounts: ['act_123'],
              availableAssetCount: 1,
            },
          },
          authorizations: [{ platform: 'meta', status: 'active' }],
        },
      ] as any);

      const result = await accessRequestService.markRequestAuthorized('request-1');

      expect(result.error).toBeNull();
      expect(result.data?.status).toBe('completed');
      expect(prisma.accessRequest.update).not.toHaveBeenCalled();
      expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
      expect(queueWebhookDelivery).not.toHaveBeenCalled();
    });
  });

  describe('updateAccessRequest', () => {
    it('should reject updates for non-editable request statuses', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        status: 'completed',
        clientEmail: 'client@test.com',
        uniqueToken: 'tokenold12345',
      } as any);

      const result = await accessRequestService.updateAccessRequest('request-1', {
        branding: { primaryColor: '#FF6B35' },
      } as any);

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('REQUEST_NOT_EDITABLE');
      expect(prisma.accessRequest.update).not.toHaveBeenCalled();
    });

    it('should update editable request without rotating token when recipient is unchanged', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        status: 'pending',
        clientEmail: 'client@test.com',
        uniqueToken: 'tokenold12345',
      } as any);
      vi.mocked(prisma.accessRequest.update).mockResolvedValue({
        id: 'request-1',
        status: 'pending',
        clientEmail: 'client@test.com',
        uniqueToken: 'tokenold12345',
      } as any);

      const result = await accessRequestService.updateAccessRequest('request-1', {
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        intakeFields: [{ id: '1', label: 'Website', type: 'url', required: true, order: 0 }],
        branding: { primaryColor: '#FF6B35' },
      } as any);

      expect(result.error).toBeNull();
      expect(result.data).toMatchObject({
        id: 'request-1',
        uniqueToken: 'tokenold12345',
        authorizationLinkChanged: false,
      });
      expect(prisma.accessRequest.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: expect.objectContaining({
          platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
          intakeFields: [{ id: '1', label: 'Website', type: 'url', required: true, order: 0 }],
          branding: { primaryColor: '#FF6B35' },
        }),
      });
    });

    it('should reject identity-only updates', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        status: 'pending',
        agencyId: 'agency-1',
      } as any);

      const result = await accessRequestService.updateAccessRequest('request-1', {
        clientEmail: 'new@test.com',
      } as any);

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(prisma.accessRequest.update).not.toHaveBeenCalled();
    });

    it('should allow updating externalReference on editable requests', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        status: 'pending',
        agencyId: 'agency-1',
      } as any);
      vi.mocked(prisma.accessRequest.update).mockResolvedValue({
        id: 'request-1',
        status: 'pending',
        externalReference: 'crm-456',
      } as any);

      const result = await accessRequestService.updateAccessRequest('request-1', {
        externalReference: 'crm-456',
      } as any);

      expect(result.error).toBeNull();
      expect(prisma.accessRequest.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: expect.objectContaining({
          externalReference: 'crm-456',
        }),
      });
    });

    it('should emit a partial webhook when request status newly transitions to partial', async () => {
      vi.mocked(prisma.accessRequest.findUnique)
        .mockResolvedValueOnce({
          id: 'request-1',
          status: 'pending',
          agencyId: 'agency-1',
        } as any)
        .mockResolvedValueOnce({
          id: 'request-1',
          agencyId: 'agency-1',
          clientId: null,
          clientName: 'Client Partial',
          clientEmail: 'partial@test.com',
          externalReference: null,
          platforms: [
            { platform: 'google_ads', accessLevel: 'manage' },
            { platform: 'meta_ads', accessLevel: 'manage' },
          ],
          status: 'partial',
          uniqueToken: 'token-partial-1',
          createdAt: new Date('2026-03-08T00:00:00.000Z'),
          authorizedAt: null,
          expiresAt: new Date('2026-04-07T00:00:00.000Z'),
          client: null,
        } as any);
      vi.mocked(prisma.accessRequest.update).mockResolvedValue({
        id: 'request-1',
        agencyId: 'agency-1',
        status: 'partial',
        uniqueToken: 'token-partial-1',
      } as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([
        {
          id: 'connection-1',
          status: 'active',
          grantedAssets: null,
          authorizations: [{ platform: 'google_ads', status: 'active' }],
        },
      ] as any);
      vi.mocked(prisma.webhookEndpoint.findUnique).mockResolvedValue({
        id: 'endpoint-1',
        agencyId: 'agency-1',
        status: 'active',
        subscribedEvents: ['access_request.partial'],
      } as any);
      vi.mocked(prisma.webhookEvent.create).mockResolvedValue({
        id: 'event-partial-1',
      } as any);

      const result = await accessRequestService.updateAccessRequest('request-1', {
        status: 'partial',
      } as any);

      expect(result.error).toBeNull();
      expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          agencyId: 'agency-1',
          endpointId: 'endpoint-1',
          type: 'access_request.partial',
          resourceId: 'request-1',
          payload: expect.objectContaining({
            type: 'access_request.partial',
          }),
        }),
      });
      expect(queueWebhookDelivery).toHaveBeenCalledWith('event-partial-1');
    });

    it('should not emit a duplicate partial webhook when status remains unchanged', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        status: 'partial',
        agencyId: 'agency-1',
      } as any);
      vi.mocked(prisma.accessRequest.update).mockResolvedValue({
        id: 'request-1',
        status: 'partial',
      } as any);

      const result = await accessRequestService.updateAccessRequest('request-1', {
        status: 'partial',
      } as any);

      expect(result.error).toBeNull();
      expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
      expect(queueWebhookDelivery).not.toHaveBeenCalled();
    });
  });

  describe('getDashboardAccessRequestSummaries', () => {
    it('should exclude revoked (canceled) and expired requests from dashboard', async () => {
      const mockRequests = [
        {
          id: 'request-1',
          clientId: 'client-1',
          clientName: 'Active Client',
          clientEmail: 'active@test.com',
          status: 'pending',
          createdAt: new Date('2026-03-15T10:00:00.000Z'),
          platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        },
        {
          id: 'request-2',
          clientId: 'client-2',
          clientName: 'Canceled Client',
          clientEmail: 'canceled@test.com',
          status: 'revoked', // Canceled request
          createdAt: new Date('2026-03-15T09:00:00.000Z'),
          platforms: [{ platform: 'google_ads', accessLevel: 'manage' }],
        },
        {
          id: 'request-3',
          clientId: 'client-3',
          clientName: 'Another Active Client',
          clientEmail: 'active2@test.com',
          status: 'completed',
          createdAt: new Date('2026-03-15T08:00:00.000Z'),
          platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        },
        {
          id: 'request-4',
          clientId: 'client-4',
          clientName: 'Expired Client',
          clientEmail: 'expired@test.com',
          status: 'expired', // Expired request
          createdAt: new Date('2026-03-14T10:00:00.000Z'),
          platforms: [{ platform: 'ga4', accessLevel: 'manage' }],
        },
      ];

      vi.mocked(prisma.accessRequest.findMany).mockResolvedValue(mockRequests as any);
      vi.mocked(prisma.accessRequest.count).mockResolvedValue(4);

      const result = await accessRequestService.getDashboardAccessRequestSummaries(
        'agency-1',
        10
      );

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();

      const items = result.data!.items;
      // Should only include pending, partial, and completed requests
      // NOT include revoked (canceled) or expired requests
      expect(items).toHaveLength(2);
      expect(items.map((i) => i.id)).toEqual(['request-1', 'request-3']);
      expect(items.every((i) => i.status !== 'revoked' && i.status !== 'expired')).toBe(true);
    });

    it('should include pending, partial, and completed requests', async () => {
      const mockRequests = [
        {
          id: 'request-1',
          clientId: 'client-1',
          clientName: 'Pending Client',
          clientEmail: 'pending@test.com',
          status: 'pending',
          createdAt: new Date('2026-03-15T10:00:00.000Z'),
          platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        },
        {
          id: 'request-2',
          clientId: 'client-2',
          clientName: 'Partial Client',
          clientEmail: 'partial@test.com',
          status: 'partial',
          createdAt: new Date('2026-03-15T09:00:00.000Z'),
          platforms: [{ platform: 'google_ads', accessLevel: 'manage' }],
        },
        {
          id: 'request-3',
          clientId: 'client-3',
          clientName: 'Completed Client',
          clientEmail: 'completed@test.com',
          status: 'completed',
          createdAt: new Date('2026-03-15T08:00:00.000Z'),
          platforms: [{ platform: 'ga4', accessLevel: 'manage' }],
        },
      ];

      vi.mocked(prisma.accessRequest.findMany).mockResolvedValue(mockRequests as any);
      vi.mocked(prisma.accessRequest.count).mockResolvedValue(3);

      const result = await accessRequestService.getDashboardAccessRequestSummaries(
        'agency-1',
        10
      );

      expect(result.error).toBeNull();
      expect(result.data?.items).toHaveLength(3);
      expect(result.data?.items.map((i) => i.status)).toEqual(
        expect.arrayContaining(['pending', 'partial', 'completed'])
      );
    });

    it('should exclude orphaned requests (clientId is null)', async () => {
      const mockRequests = [
        {
          id: 'request-1',
          clientId: 'client-1',
          clientName: 'Valid Client',
          clientEmail: 'valid@test.com',
          status: 'pending',
          createdAt: new Date('2026-03-15T10:00:00.000Z'),
          platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        },
        {
          id: 'request-orphan',
          clientId: null, // Orphaned request
          clientName: 'Orphaned Client',
          clientEmail: 'orphan@test.com',
          status: 'pending',
          createdAt: new Date('2026-03-15T09:00:00.000Z'),
          platforms: [{ platform: 'google_ads', accessLevel: 'manage' }],
        },
      ];

      vi.mocked(prisma.accessRequest.findMany).mockResolvedValue(mockRequests as any);
      vi.mocked(prisma.accessRequest.count).mockResolvedValue(2);

      const result = await accessRequestService.getDashboardAccessRequestSummaries(
        'agency-1',
        10
      );

      expect(result.error).toBeNull();
      // The where clause should filter out clientId: null at the database level
      // So the mocked result shouldn't include orphaned requests
      expect(prisma.accessRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId: { not: null },
          }),
        })
      );
    });

    it('should include uniqueToken for dashboard invite actions', async () => {
      const mockRequests = [
        {
          id: 'request-1',
          clientId: 'client-1',
          clientName: 'Pending Client',
          clientEmail: 'pending@test.com',
          status: 'pending',
          createdAt: new Date('2026-03-15T10:00:00.000Z'),
          uniqueToken: 'abc123token456',
          platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        },
      ];

      vi.mocked(prisma.accessRequest.findMany).mockResolvedValue(mockRequests as any);
      vi.mocked(prisma.accessRequest.count).mockResolvedValue(1);

      const result = await accessRequestService.getDashboardAccessRequestSummaries(
        'agency-1',
        10
      );

      expect(result.error).toBeNull();
      expect(result.data?.items[0]?.uniqueToken).toBe('abc123token456');
    });
  });

  describe('generateUniqueToken', () => {
    it('should generate a 12-character hex string', () => {
      const token = accessRequestService.generateUniqueToken();

      expect(token).toHaveLength(12);
      expect(token).toMatch(/^[a-f0-9]{12}$/);
    });

    it('should generate different tokens on multiple calls', () => {
      const tokens = new Set();

      for (let i = 0; i < 100; i++) {
        tokens.add(accessRequestService.generateUniqueToken());
      }

      // With crypto.randomBytes, collisions should be extremely rare
      expect(tokens.size).toBeGreaterThan(95);
    });
  });
});
