/**
 * Access Request Service Unit Tests
 *
 * Tests for access request creation and management.
 */

import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { CacheKeys, getCached } from '@/lib/cache.js';
import { Prisma } from '@prisma/client';
import { queueWebhookDelivery } from '@/lib/queue-helpers';
import * as accessRequestService from '@/services/access-request.service';
import { metaAssetsService } from '@/services/meta-assets.service';
import { notificationService } from '@/services/notification.service';

const META_ACCESS_CONFIG = {
  recipients: [{ type: 'human' as const, id: 'person-1', name: 'Jon High' }],
  pageTasks: ['MANAGE'],
  adAccountTasks: ['ANALYZE'],
};

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
    metaAssetGrant: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    webhookEndpoint: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    webhookEvent: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/queue-helpers', () => ({
  queueWebhookDelivery: vi.fn(),
}));

vi.mock('@/services/meta-assets.service', () => ({
  metaAssetsService: {
    getAssignableRecipients: vi.fn(),
    getAssetSettings: vi.fn(),
  },
}));

vi.mock('@/services/notification.service', () => ({
  notificationService: {
    queueNotification: vi.fn(),
  },
}));

describe('AccessRequestService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: 'request-1' }] as any);
    vi.mocked(metaAssetsService.getAssignableRecipients).mockResolvedValue({
      data: [{ type: 'human', id: 'person-1', name: 'Jon High' }],
      error: null,
    });
    vi.mocked(metaAssetsService.getAssetSettings).mockResolvedValue({
      data: {
        adAccount: { enabled: true, permissionLevel: 'analyze' },
        page: { enabled: true, permissionLevel: 'analyze', limitPermissions: false },
        catalog: { enabled: false, permissionLevel: 'analyze' },
        dataset: { enabled: true, requestFullAccess: false },
        instagramAccount: { enabled: true, requestFullAccess: false },
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createAccessRequest', () => {
    it('rejects a Meta assignee that is not in the agency portfolio', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ id: 'agency-1' } as any);
      vi.mocked(metaAssetsService.getAssignableRecipients).mockResolvedValue({
        data: [{ type: 'human', id: 'person-1', name: 'Jon High' }],
        error: null,
      });

      const result = await accessRequestService.createAccessRequest({
        agencyId: 'agency-1',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        metaAccessConfig: {
          recipients: [{ type: 'human', id: 'person-from-another-agency' }],
          pageTasks: ['MANAGE'],
          adAccountTasks: ['ANALYZE'],
        },
      });

      expect(result.error?.code).toBe('INVALID_META_ASSIGNEE');
      expect(prisma.accessRequest.create).not.toHaveBeenCalled();
    });

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
        metaAccessConfig: META_ACCESS_CONFIG,
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data?.uniqueToken).toBe('a1b2c3d4e5f6');
      expect(result.data?.status).toBe('pending');
      expect(prisma.accessRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metaAccessConfig: {
            ...META_ACCESS_CONFIG,
            catalogTasks: ['MANAGE'],
            datasetTasks: ['ADVERTISE', 'ANALYZE'],
          },
        }),
      });
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
        metaAccessConfig: META_ACCESS_CONFIG,
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
        metaAccessConfig: META_ACCESS_CONFIG,
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
        metaAccessConfig: META_ACCESS_CONFIG,
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
        metaAccessConfig: META_ACCESS_CONFIG,
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

    it('defaults Meta assignee to agency owner when omitted for Meta requests', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ id: 'agency-1', email: 'owner@agency.test' } as any);
      vi.mocked(metaAssetsService.getAssignableRecipients).mockResolvedValue({
        data: [
          { type: 'human', id: 'person-1', name: 'Agency Owner', email: 'owner@agency.test' },
          { type: 'system_user', id: 'system-user-1', name: 'Automation' },
        ],
        error: null,
      });
      vi.mocked(prisma.accessRequest.create).mockResolvedValue({ id: 'request-1' } as any);

      const result = await accessRequestService.createAccessRequest({
        agencyId: 'agency-1',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
      });

      expect(result.error).toBeNull();
      expect(prisma.accessRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metaAccessConfig: expect.objectContaining({
              recipients: [{ type: 'human', id: 'person-1', name: 'Agency Owner' }],
            }),
          }),
        })
      );
    });

    it('adds a default human Meta assignee when only a system user was selected', async () => {
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ id: 'agency-1', email: 'owner@agency.test' } as any);
      vi.mocked(metaAssetsService.getAssignableRecipients).mockResolvedValue({
        data: [
          { type: 'human', id: 'person-1', name: 'Agency Owner', email: 'owner@agency.test' },
          { type: 'system_user', id: 'system-user-1', name: 'Automation' },
        ],
        error: null,
      });
      vi.mocked(prisma.accessRequest.create).mockResolvedValue({ id: 'request-1' } as any);

      const result = await accessRequestService.createAccessRequest({
        agencyId: 'agency-1',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        metaAccessConfig: {
          recipients: [{ type: 'system_user', id: 'system-user-1', name: 'Automation' }],
          pageTasks: ['MANAGE'],
          adAccountTasks: ['ANALYZE'],
        },
      });

      expect(result.error).toBeNull();
      expect(prisma.accessRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metaAccessConfig: expect.objectContaining({
              recipients: expect.arrayContaining([
                { type: 'human', id: 'person-1', name: 'Agency Owner' },
                { type: 'system_user', id: 'system-user-1', name: 'Automation' },
              ]),
            }),
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
      expect(result.data?.metaCatalogEnabled).toBe(false);
      expect(metaAssetsService.getAssetSettings).toHaveBeenCalledWith('agency-1');
    });

    it('exposes metaCatalogEnabled when agency enables catalogs in Meta settings', async () => {
      const mockRequest = {
        id: 'request-catalog',
        uniqueToken: 'catalogtoken',
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
      vi.mocked(metaAssetsService.getAssetSettings).mockResolvedValue({
        data: {
          adAccount: { enabled: true, permissionLevel: 'analyze' },
          page: { enabled: true, permissionLevel: 'analyze', limitPermissions: false },
          catalog: { enabled: true, permissionLevel: 'analyze' },
          dataset: { enabled: true, requestFullAccess: false },
          instagramAccount: { enabled: true, requestFullAccess: false },
        },
        error: null,
      });

      const result = await accessRequestService.getAccessRequestByToken('catalogtoken');

      expect(result.error).toBeNull();
      expect(result.data?.metaCatalogEnabled).toBe(true);
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
          status: 'pending_verification',
          grantedAssets: { beehiiv: { platform: 'beehiiv' } },
          authorizations: [],
        },
      ] as any);

      const result = await accessRequestService.getAccessRequestByToken('token-123');

      expect(result.error).toBeNull();
      expect(result.data?.authorizationProgress.completedPlatforms).not.toContain('beehiiv');
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

    it('counts a manual platform only after that platform is verified', async () => {
      const mockRequest = {
        id: 'request-manual',
        uniqueToken: 'token-manual-verified-123',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        agencyId: 'agency-1',
        expiresAt: new Date(Date.now() + 100000),
        platforms: [{ platform: 'beehiiv', accessLevel: 'manage' }],
        intakeFields: [],
        branding: {},
      };

      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(mockRequest as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ name: 'Agency' } as any);
      vi.mocked(prisma.agencyPlatformConnection.findMany).mockResolvedValue([]);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([
        {
          id: 'conn-manual-active',
          status: 'active',
          grantedAssets: { beehiiv: { platform: 'beehiiv', verificationStatus: 'verified' } },
          authorizations: [],
        },
      ] as any);

      const result = await accessRequestService.getAccessRequestByToken('token-manual-verified-123');

      expect(result.error).toBeNull();
      expect(result.data?.authorizationProgress.completedPlatforms).toEqual(['beehiiv']);
      expect(result.data?.authorizationProgress.isComplete).toBe(true);
    });

    it('keeps pending manual evidence unresolved when the shared connection is active', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-manual-pending',
        uniqueToken: 'token-manual-pending-123',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        agencyId: 'agency-1',
        expiresAt: new Date(Date.now() + 100000),
        platforms: [{ platform: 'beehiiv', accessLevel: 'manage' }],
        intakeFields: [],
        branding: {},
      } as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ name: 'Agency' } as any);
      vi.mocked(prisma.agencyPlatformConnection.findMany).mockResolvedValue([]);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([
        {
          id: 'conn-shared-active',
          status: 'active',
          grantedAssets: { beehiiv: { platform: 'beehiiv', verificationStatus: 'pending' } },
          authorizations: [{ platform: 'google', status: 'active' }],
        },
      ] as any);

      const result = await accessRequestService.getAccessRequestByToken('token-manual-pending-123');

      expect(result.error).toBeNull();
      expect(result.data?.authorizationProgress.completedPlatforms).toEqual([]);
      expect((result.data as any)?.authorizationProgress.unresolvedProducts).toEqual([
        { product: 'beehiiv', platformGroup: 'beehiiv', reason: 'pending' },
      ]);
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
                inviteEmail: 'client@example.com',
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

    it('should return error for a request with expired lifecycle status', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        status: 'expired',
        expiresAt: new Date(Date.now() + 100000),
      } as any);

      const result = await accessRequestService.getAccessRequestByToken('expired-status-token');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('REQUEST_EXPIRED');
    });

    it('surfaces Meta declined asset kinds from the client connection grant blob', async () => {
      const mockRequest = {
        id: 'request-declines',
        uniqueToken: 'declinetoken1',
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
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([
        {
          id: 'conn-meta',
          status: 'active',
          grantedAssets: {
            meta: {
              declinedAssetKinds: {
                kinds: ['catalog', 'dataset'],
                declinedAt: '2026-10-01T00:00:00.000Z',
              },
            },
          },
          authorizations: [{
            platform: 'meta',
            status: 'active',
            authorizationEpoch: 1,
            metadata: {
              meta: {
                selection: {
                  clientBusinessId: 'client-business-1',
                  selectedAt: '2026-10-03T00:00:00.000Z',
                },
              },
            },
          }],
          metaAssetGrants: [],
        },
      ] as any);

      const result = await accessRequestService.getAccessRequestByToken('declinetoken1');

      expect(result.error).toBeNull();
      expect(result.data?.metaDeclines).toEqual([
        { assetKind: 'catalog', declinedAt: '2026-10-01T00:00:00.000Z' },
        { assetKind: 'dataset', declinedAt: '2026-10-01T00:00:00.000Z' },
      ]);
    });

    it('drops invalid asset kinds from the Meta decline blob', async () => {
      const mockRequest = {
        id: 'request-declines',
        uniqueToken: 'declinetoken2',
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
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([
        {
          id: 'conn-meta',
          status: 'active',
          grantedAssets: {
            meta: {
              declinedAssetKinds: {
                kinds: ['catalog', 'not_a_kind', 42],
                declinedAt: '2026-10-01T00:00:00.000Z',
              },
            },
          },
          authorizations: [{
            platform: 'meta',
            status: 'active',
            authorizationEpoch: 1,
            metadata: {
              meta: {
                selection: {
                  clientBusinessId: 'client-business-1',
                  selectedAt: '2026-10-03T00:00:00.000Z',
                },
              },
            },
          }],
          metaAssetGrants: [],
        },
      ] as any);

      const result = await accessRequestService.getAccessRequestByToken('declinetoken2');

      expect(result.error).toBeNull();
      expect(result.data?.metaDeclines).toEqual([
        { assetKind: 'catalog', declinedAt: '2026-10-01T00:00:00.000Z' },
      ]);
    });

    it('maps client connections to platform groups for wizard resume', async () => {
      const mockRequest = {
        id: 'request-connections',
        uniqueToken: 'conntoken123',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        agencyId: 'agency-1',
        expiresAt: new Date(Date.now() + 100000),
        platforms: [
          { platform: 'meta_ads', accessLevel: 'manage' },
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
          id: 'conn-meta',
          status: 'active',
          grantedAssets: {},
          authorizations: [{
            platform: 'meta',
            status: 'active',
            authorizationEpoch: 1,
            metadata: {
              meta: {
                selection: {
                  clientBusinessId: 'client-business-1',
                  selectedAt: '2026-10-03T00:00:00.000Z',
                },
              },
            },
          }],
          metaAssetGrants: [],
        },
        {
          id: 'conn-manual',
          status: 'active',
          grantedAssets: {},
          authorizations: [
            { platform: 'beehiiv', status: 'active', authorizationEpoch: 1 },
            { platform: 'google_ads', status: 'active', authorizationEpoch: 1 },
          ],
          metaAssetGrants: [],
        },
      ] as any);

      const result = await accessRequestService.getAccessRequestByToken('conntoken123');

      expect(result.error).toBeNull();
      expect(result.data?.connections).toEqual([
        { id: 'conn-meta', platformGroup: 'meta' },
        { id: 'conn-manual', platformGroup: 'beehiiv' },
        { id: 'conn-manual', platformGroup: 'google' },
      ]);
      expect(result.data?.metaResumeSelections).toEqual([
        { connectionId: 'conn-meta', clientBusinessId: 'client-business-1' },
      ]);
    });

    it('ignores Meta decline blobs on connections outside the meta platform group', async () => {
      const mockRequest = {
        id: 'request-google-only',
        uniqueToken: 'googleonly1',
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
          id: 'conn-google',
          status: 'active',
          grantedAssets: {
            meta: {
              declinedAssetKinds: {
                kinds: ['catalog'],
                declinedAt: '2026-10-01T00:00:00.000Z',
              },
            },
          },
          authorizations: [{ platform: 'google_ads', status: 'active', authorizationEpoch: 1 }],
          metaAssetGrants: [],
        },
      ] as any);

      const result = await accessRequestService.getAccessRequestByToken('googleonly1');

      expect(result.error).toBeNull();
      expect(result.data?.metaDeclines).toEqual([]);
    });

    it('returns empty metaDeclines and connections when there are no client connections', async () => {
      const mockRequest = {
        id: 'request-empty',
        uniqueToken: 'emptytoken1',
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

      const result = await accessRequestService.getAccessRequestByToken('emptytoken1');

      expect(result.error).toBeNull();
      expect(result.data?.metaDeclines).toEqual([]);
      expect(result.data?.connections).toEqual([]);
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

    it('should default the agency list to 50 rows and omit large JSON columns', async () => {
      vi.mocked(prisma.accessRequest.findMany).mockResolvedValue([] as any);

      await accessRequestService.getAgencyAccessRequests('agency-1');

      expect(prisma.accessRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { agencyId: 'agency-1' },
          take: 50,
          skip: 0,
          select: {
            id: true,
            agencyId: true,
            clientId: true,
            clientName: true,
            clientEmail: true,
            externalReference: true,
            platforms: true,
            status: true,
            expiresAt: true,
            createdAt: true,
            authorizedAt: true,
          },
        })
      );
      const query = vi.mocked(prisma.accessRequest.findMany).mock.calls[0][0] as {
        select?: Record<string, unknown>;
      };
      expect(query.select).not.toHaveProperty('branding');
      expect(query.select).not.toHaveProperty('intakeFields');
      expect(query.select).not.toHaveProperty('metaAccessConfig');
      expect(query.select).not.toHaveProperty('uniqueToken');
    });

    it('should cap an oversized access-request list limit at 100', async () => {
      vi.mocked(prisma.accessRequest.findMany).mockResolvedValue([] as any);

      await accessRequestService.getAgencyAccessRequests('agency-1', {
        status: 'pending',
        limit: 500,
        offset: 25,
      });

      expect(prisma.accessRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { agencyId: 'agency-1', status: 'pending' },
          take: 100,
          skip: 25,
        })
      );
    });
  });

  describe('getAccessRequestById', () => {
    it('returns only the safe manual confirmation projection', async () => {
      const grantedAssets = {
        beehiiv: {
          platform: 'beehiiv',
          verificationStatus: 'verified',
          verificationMethod: 'manual_review',
          verifiedAt: '2026-10-04T16:00:00.000Z',
          verifiedBy: 'user_1',
          agencyEmail: 'access@agency.test',
        },
        shopify: {
          platform: 'shopify',
          verificationStatus: 'pending',
          shopDomain: 'store.myshopify.com',
          collaboratorCode: '1234',
          collaboratorCodeHash: 'hash',
        },
        mailchimp: {
          platform: 'mailchimp',
          verificationStatus: 'pending',
          agencyEmail: 'unrequested@agency.test',
        },
      };
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-manual',
        agencyId: 'agency-1',
        platforms: [
          { platform: 'beehiiv', accessLevel: 'manage' },
          { platform: 'shopify', accessLevel: 'manage' },
        ],
      } as any);
      vi.mocked(prisma.clientConnection.findFirst).mockResolvedValue({
        id: 'connection-1',
        createdAt: new Date('2026-10-04T15:00:00.000Z'),
        grantedAssets,
      } as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([{
        status: 'pending_verification',
        grantedAssets,
        authorizations: [],
        metaAssetGrants: [],
      }] as any);

      const result = await accessRequestService.getAccessRequestById('request-manual');

      expect((result.data as any).manualConfirmations).toEqual([
        {
          platform: 'beehiiv',
          verificationStatus: 'verified',
          verificationMethod: 'manual_review',
          verifiedAt: '2026-10-04T16:00:00.000Z',
        },
        { platform: 'shopify', verificationStatus: 'pending' },
      ]);
      expect((result.data as any).shopifySubmission).toEqual({
        status: 'submitted',
        connectionId: 'connection-1',
        shopDomain: 'store.myshopify.com',
        collaboratorCode: '1234',
        submittedAt: '2026-10-04T15:00:00.000Z',
      });
      expect(JSON.stringify(result.data)).not.toContain('access@agency.test');
      expect(JSON.stringify(result.data)).not.toContain('user_1');
      expect(JSON.stringify(result.data)).not.toContain('unrequested@agency.test');
    });

    it('includes stored intake answers in the agency-facing payload (G2)', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        agencyId: 'agency-1',
        platforms: [{ platform: 'google_ads', accessLevel: 'manage' }],
        intakeFields: [{ id: 'company', label: 'Company name', type: 'text', required: true }],
        intakeResponses: { company: 'Acme' },
      } as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([] as any);

      const result = await accessRequestService.getAccessRequestById('request-1');

      expect(result.error).toBeNull();
      expect((result.data as any).intakeResponses).toEqual({ company: 'Acme' });
    });

    it('surfaces client Meta declines in the agency-facing payload', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-declines',
        agencyId: 'agency-1',
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
      } as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([
        {
          grantedAssets: {
            meta: {
              declinedAssetKinds: {
                kinds: ['catalog', 'dataset'],
                declinedAt: '2026-10-01T00:00:00.000Z',
              },
            },
          },
          authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 1 }],
          metaAssetGrants: [],
        },
      ] as any);
      vi.mocked(prisma.agencyPlatformConnection.findMany).mockResolvedValue([] as any);

      const result = await accessRequestService.getAccessRequestById('request-declines');

      expect(result.error).toBeNull();
      expect(result.data?.metaDeclines).toEqual([
        { assetKind: 'catalog', declinedAt: '2026-10-01T00:00:00.000Z' },
        { assetKind: 'dataset', declinedAt: '2026-10-01T00:00:00.000Z' },
      ]);
    });

    it('does not treat Instagram OAuth alone as completed access', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-instagram',
        agencyId: 'agency-1',
        platforms: [{ platform: 'instagram', accessLevel: 'manage' }],
        metaAccessConfig: { recipients: [{ type: 'human', id: 'person-1' }] },
      } as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([{
        grantedAssets: {},
        authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 1 }],
        metaAssetGrants: [],
      }] as any);
      vi.mocked(prisma.agencyPlatformConnection.findMany).mockResolvedValue([] as any);

      const result = await accessRequestService.getAccessRequestById('request-instagram');

      expect(result.data?.authorizationProgress.isComplete).toBe(false);
      expect(result.data?.authorizationProgress.unresolvedProducts).toEqual([
        { product: 'instagram', platformGroup: 'meta', reason: 'selection_required' },
      ]);
    });

    it('requires verified access for the selected Instagram account', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-instagram',
        agencyId: 'agency-1',
        platforms: [{ platform: 'instagram', accessLevel: 'manage' }],
        metaAccessConfig: { recipients: [{ type: 'human', id: 'person-1' }] },
      } as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([{
        grantedAssets: { meta_ads: { instagramAccounts: ['ig-1'] } },
        authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 1 }],
        metaAssetGrants: [],
      }] as any);
      vi.mocked(prisma.agencyPlatformConnection.findMany).mockResolvedValue([] as any);

      const result = await accessRequestService.getAccessRequestById('request-instagram');

      expect(result.data?.authorizationProgress.isComplete).toBe(false);
      expect(result.data?.authorizationProgress.unresolvedProducts).toEqual([
        { product: 'instagram', platformGroup: 'meta', reason: 'sharing_required' },
      ]);
    });

    it('completes Instagram only after linked-asset access is verified for the business and human', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-instagram',
        agencyId: 'agency-1',
        platforms: [{ platform: 'instagram', accessLevel: 'manage' }],
        metaAccessConfig: { recipients: [{ type: 'human', id: 'person-1' }] },
      } as any);
      const verifiedGrant = (recipientType: string, recipientId: string) => ({
        assetKind: 'instagram_account',
        assetId: 'ig-1',
        status: 'verified',
        recipientType,
        recipientId,
        updatedAt: new Date('2026-09-23T00:00:00.000Z'),
        requestedTasks: [],
        verifiedTasks: [],
        verifiedAuthorizationEpoch: 1,
        authorization: { authorizationEpoch: 1, status: 'active' },
        destination: { businessId: 'agency-business', agencyConnection: { status: 'active', businessId: 'agency-business' } },
      });
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([{
        grantedAssets: { meta_ads: { instagramAccounts: ['ig-1'] } },
        authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 1 }],
        metaAssetGrants: [
          verifiedGrant('business', 'agency-business'),
          verifiedGrant('human', 'person-1'),
        ],
      }] as any);
      vi.mocked(prisma.agencyPlatformConnection.findMany).mockResolvedValue([] as any);

      const result = await accessRequestService.getAccessRequestById('request-instagram');

      expect(result.error).toBeNull();
      expect(result.data?.authorizationProgress.completedPlatforms).toEqual(['meta']);
      expect(result.data?.authorizationProgress.unresolvedProducts).toEqual([]);
    });

    it('names every requested product that still needs authorization', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-auth-needed',
        agencyId: 'agency-1',
        platforms: [
          { platform: 'beehiiv', accessLevel: 'manage' },
          { platform: 'linkedin_ads', accessLevel: 'manage' },
        ],
      } as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([] as any);

      const result = await accessRequestService.getAccessRequestById('request-auth-needed');

      expect(result.data?.authorizationProgress).toMatchObject({
        isComplete: false,
        unresolvedProducts: [
          { product: 'beehiiv', platformGroup: 'beehiiv', reason: 'authorization_required' },
          { product: 'linkedin_ads', platformGroup: 'linkedin', reason: 'authorization_required' },
        ],
      });
    });

    it('keeps Meta Ads incomplete until selected catalogs are granted', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        agencyId: 'agency-1',
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        metaAccessConfig: { recipients: [{ type: 'human', id: 'person-1' }] },
      } as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([{
        grantedAssets: { meta_ads: { catalogs: ['catalog-1'] } },
        authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 1 }],
        metaAssetGrants: [],
      }] as any);

      const result = await accessRequestService.getAccessRequestById('request-1');

      expect(result.data?.authorizationProgress.isComplete).toBe(false);
      expect(result.data?.authorizationProgress.unresolvedProducts).toEqual([
        { product: 'meta_ads', platformGroup: 'meta', reason: 'sharing_required' },
      ]);
    });

    it('keeps Meta Ads incomplete while selected Pixel access needs manual action', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-pixel',
        agencyId: 'agency-1',
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        metaAccessConfig: { recipients: [{ type: 'human', id: 'person-1', name: 'Owner' }] },
      } as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([{
        grantedAssets: { meta_ads: { datasets: ['pixel-1'] } },
        authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 1 }],
        metaAssetGrants: [
          { id: 'pixel-business', assetKind: 'dataset', assetId: 'pixel-1', assetName: 'Website Pixel', status: 'manual_action_required', recipientType: 'business', recipientId: 'business-1', requestedTasks: [], verifiedTasks: [], nextActor: 'client_admin', updatedAt: new Date() },
          { id: 'pixel-person', assetKind: 'dataset', assetId: 'pixel-1', assetName: 'Website Pixel', status: 'manual_action_required', recipientType: 'human', recipientId: 'person-1', requestedTasks: [], verifiedTasks: [], nextActor: 'client_admin', updatedAt: new Date() },
        ],
      }] as any);

      const result = await accessRequestService.getAccessRequestById('request-pixel');

      expect(result.data?.authorizationProgress.isComplete).toBe(false);
      expect(result.data?.authorizationProgress.unresolvedProducts).toEqual([
        { product: 'meta_ads', platformGroup: 'meta', reason: 'manual_action_required' },
      ]);
      expect((result.data as any)?.metaFulfillment).toEqual(expect.arrayContaining([
        expect.objectContaining({ assetKind: 'dataset', assetId: 'pixel-1', status: 'manual_action_required', nextActor: 'client_admin' }),
      ]));
    });

    it('requires every configured Meta recipient and the agency business', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        agencyId: 'agency-1',
        platforms: [{ platform: 'meta_pages', accessLevel: 'manage' }],
        metaAccessConfig: {
          recipients: [
            { type: 'human', id: 'person-1', name: 'Owner' },
            { type: 'system_user', id: 'system-1', name: 'Automation' },
          ],
          pageTasks: ['MANAGE'],
          adAccountTasks: [],
        },
      } as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([{
        grantedAssets: { meta_pages: { pages: ['page-1'] } },
        authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 1 }],
        metaAssetGrants: [{
          assetKind: 'page',
          assetId: 'page-1',
          status: 'verified',
          recipientType: 'human',
          recipientId: 'person-1',
          requestedTasks: ['MANAGE'],
          verifiedTasks: ['MANAGE'],
          verifiedAuthorizationEpoch: 1,
          authorization: { authorizationEpoch: 1, status: 'active' },
          updatedAt: new Date('2026-09-22T12:00:00.000Z'),
        }],
      }] as any);

      const result = await accessRequestService.getAccessRequestById('request-1');

      expect(result.data?.authorizationProgress.isComplete).toBe(false);
      expect(result.data?.authorizationProgress.unresolvedProducts).toEqual([
        { product: 'meta_pages', platformGroup: 'meta', reason: 'sharing_required' },
      ]);
    });

    it('does not count a verified Meta grant with no authorization record', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        agencyId: 'agency-1',
        platforms: [{ platform: 'meta_pages', accessLevel: 'manage' }],
        metaAccessConfig: { recipients: [{ type: 'human', id: 'person-1' }] },
      } as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([{
        grantedAssets: { meta_pages: { pages: ['page-1'] } },
        authorizations: [],
        metaAssetGrants: [{
          assetKind: 'page', assetId: 'page-1', status: 'verified',
          recipientType: 'business', recipientId: 'business-1',
          requestedTasks: [], verifiedTasks: [], verifiedAuthorizationEpoch: 1,
          authorization: { authorizationEpoch: 1, status: 'active' },
          updatedAt: new Date('2026-09-22T12:00:00.000Z'),
        }, {
          assetKind: 'page',
          assetId: 'page-1',
          status: 'verified',
          recipientType: 'human',
          recipientId: 'person-1',
          requestedTasks: ['MANAGE'],
          verifiedTasks: ['MANAGE'],
          verifiedAuthorizationEpoch: 1,
          updatedAt: new Date('2026-09-22T12:00:00.000Z'),
          authorization: null,
        }],
      }] as any);

      const result = await accessRequestService.getAccessRequestById('request-1');

      expect(result.data?.authorizationProgress.isComplete).toBe(true);
      expect(result.data?.authorizationProgress.unresolvedProducts).toEqual([]);
      expect((result.data as any)?.metaFulfillment).toEqual([
        expect.objectContaining({ status: 'verified' }),
        expect.objectContaining({ status: 'stale', nextActor: 'client_admin' }),
      ]);
    });

    it('does not block Meta completion when only a non-gating person grant omits a requested task', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        agencyId: 'agency-1',
        platforms: [{ platform: 'meta_pages', accessLevel: 'manage' }],
        metaAccessConfig: { recipients: [{ type: 'human', id: 'person-1' }] },
      } as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([{
        grantedAssets: { meta_pages: { pages: ['page-1'] } },
        authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 1 }],
        metaAssetGrants: [{
          assetKind: 'page', assetId: 'page-1', status: 'verified',
          recipientType: 'business', recipientId: 'business-1',
          requestedTasks: [], verifiedTasks: [], verifiedAuthorizationEpoch: 1,
          authorization: { authorizationEpoch: 1, status: 'active' },
          updatedAt: new Date('2026-09-22T12:00:00.000Z'),
        }, {
          assetKind: 'page',
          assetId: 'page-1',
          status: 'verified',
          recipientType: 'human',
          recipientId: 'person-1',
          requestedTasks: ['MANAGE', 'ADVERTISE'],
          verifiedTasks: ['MANAGE'],
          verifiedAuthorizationEpoch: 1,
          updatedAt: new Date('2026-09-22T12:00:00.000Z'),
          authorization: { authorizationEpoch: 1, status: 'active' },
        }],
      }] as any);

      const result = await accessRequestService.getAccessRequestById('request-1');

      expect(result.data?.authorizationProgress.isComplete).toBe(true);
      expect(result.data?.authorizationProgress.unresolvedProducts).toEqual([]);
      expect((result.data as any)?.metaFulfillment).toEqual([
        expect.objectContaining({ status: 'verified' }),
        expect.objectContaining({ status: 'blocked', errorCode: 'MISSING_TASKS' }),
      ]);
    });

    it('accepts verified business visibility without inventing person tasks', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1', agencyId: 'agency-1',
        platforms: [{ platform: 'meta_pages', accessLevel: 'manage' }],
        metaAccessConfig: { recipients: [{ type: 'human', id: 'person-1' }] },
      } as any);
      const authorization = { authorizationEpoch: 1, status: 'active', expiresAt: new Date(Date.now() + 60_000) };
      const common = {
        assetKind: 'page', assetId: 'page-1', status: 'verified',
        verifiedAuthorizationEpoch: 1, authorization,
        updatedAt: new Date(),
      };
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([{
        grantedAssets: { meta_pages: { pages: ['page-1'] } },
        authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 1 }],
        metaAssetGrants: [
          { ...common, recipientType: 'business', recipientId: 'business-1', requestedTasks: [], verifiedTasks: null },
          { ...common, recipientType: 'human', recipientId: 'person-1', requestedTasks: ['MANAGE'], verifiedTasks: ['MANAGE'] },
        ],
      }] as any);

      const result = await accessRequestService.getAccessRequestById('request-1');

      expect(result.data?.authorizationProgress.isComplete).toBe(true);
    });

    it('keeps prior portfolio grants in history without letting them block current verified access', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1', agencyId: 'agency-1',
        platforms: [{ platform: 'meta_pages', accessLevel: 'manage' }],
        metaAccessConfig: { recipients: [{ type: 'human', id: 'person-1' }] },
      } as any);
      const currentAgencyConnection = { status: 'active', businessId: 'business-current' };
      const previousAgencyConnection = { status: 'active', businessId: 'business-current' };
      const common = {
        assetKind: 'page', assetId: 'page-1', status: 'verified',
        requestedTasks: ['MANAGE'], verifiedTasks: ['MANAGE'],
        verifiedAuthorizationEpoch: 1,
        authorization: { authorizationEpoch: 1, status: 'active' },
        updatedAt: new Date(),
      };
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([{
        grantedAssets: { meta_pages: { pages: ['page-1'] } },
        authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 1 }],
        metaAssetGrants: [
          { ...common, recipientType: 'business', recipientId: 'business-old', destination: {
            businessId: 'business-old', agencyConnection: previousAgencyConnection,
          } },
          { ...common, recipientType: 'human', recipientId: 'person-1', destination: {
            businessId: 'business-old', agencyConnection: previousAgencyConnection,
          } },
          { ...common, recipientType: 'business', recipientId: 'business-current', destination: {
            businessId: 'business-current', agencyConnection: currentAgencyConnection,
          } },
          { ...common, recipientType: 'human', recipientId: 'person-1', destination: {
            businessId: 'business-current', agencyConnection: currentAgencyConnection,
          } },
        ],
      }] as any);

      const result = await accessRequestService.getAccessRequestById('request-1');

      expect(result.data?.authorizationProgress.isComplete).toBe(true);
      expect((result.data as any)?.metaFulfillment).toEqual([
        expect.objectContaining({ status: 'stale' }),
        expect.objectContaining({ status: 'stale' }),
        expect.objectContaining({ status: 'verified' }),
        expect.objectContaining({ status: 'verified' }),
      ]);
    });

    it('does not count Meta grants when the agency destination is revoked or changed', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1', agencyId: 'agency-1',
        platforms: [{ platform: 'meta_pages', accessLevel: 'manage' }],
        metaAccessConfig: { recipients: [{ type: 'human', id: 'person-1' }] },
      } as any);
      const baseGrant = {
        assetKind: 'page', assetId: 'page-1', status: 'verified',
        requestedTasks: ['MANAGE'], verifiedTasks: ['MANAGE'],
        verifiedAuthorizationEpoch: 1,
        authorization: { authorizationEpoch: 1, status: 'active' },
        destination: { businessId: 'former-business', agencyConnection: { status: 'active', businessId: 'current-business' } },
        updatedAt: new Date('2026-09-22T12:00:00.000Z'),
      };
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([{
        grantedAssets: { meta_pages: { pages: ['page-1'] } },
        authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 1 }],
        metaAssetGrants: [
          { ...baseGrant, recipientType: 'business', recipientId: 'business-1' },
          { ...baseGrant, recipientType: 'human', recipientId: 'person-1' },
        ],
      }] as any);

      const result = await accessRequestService.getAccessRequestById('request-1');

      expect(result.data?.authorizationProgress.isComplete).toBe(false);
      expect(result.data?.authorizationProgress.unresolvedProducts).toEqual([
        { product: 'meta_pages', platformGroup: 'meta', reason: 'stale' },
      ]);
      expect((result.data as any)?.metaFulfillment).toEqual([
        expect.objectContaining({ status: 'stale' }),
        expect.objectContaining({ status: 'stale' }),
      ]);
    });

    it('does not count verified Meta grants after their authorization expires', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1', agencyId: 'agency-1',
        platforms: [{ platform: 'meta_pages', accessLevel: 'manage' }],
        metaAccessConfig: { recipients: [{ type: 'human', id: 'person-1' }] },
      } as any);
      const expiredAuthorization = {
        authorizationEpoch: 1,
        status: 'active',
        expiresAt: new Date(Date.now() - 60_000),
      };
      const baseGrant = {
        assetKind: 'page', assetId: 'page-1', status: 'verified',
        requestedTasks: ['MANAGE'], verifiedTasks: ['MANAGE'],
        verifiedAuthorizationEpoch: 1,
        authorization: expiredAuthorization,
        updatedAt: new Date(),
      };
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([{
        grantedAssets: { meta_pages: { pages: ['page-1'] } },
        authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 1 }],
        metaAssetGrants: [
          { ...baseGrant, recipientType: 'business', recipientId: 'business-1', requestedTasks: [], verifiedTasks: [] },
          { ...baseGrant, recipientType: 'human', recipientId: 'person-1' },
        ],
      }] as any);

      const result = await accessRequestService.getAccessRequestById('request-1');

      expect(result.data?.authorizationProgress.isComplete).toBe(false);
      expect(result.data?.authorizationProgress.unresolvedProducts).toEqual([
        { product: 'meta_pages', platformGroup: 'meta', reason: 'stale' },
      ]);
      expect((result.data as any)?.metaFulfillment).toEqual([
        expect.objectContaining({ status: 'stale', nextActor: 'client_admin' }),
        expect.objectContaining({ status: 'stale', nextActor: 'client_admin' }),
      ]);
    });

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

    it('returns truthful per-asset and per-recipient Meta fulfillment details', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        agencyId: 'agency-1',
        platforms: [{ platform: 'meta_pages', accessLevel: 'manage' }],
        metaAccessConfig: {
          recipients: [{ type: 'human', id: 'person-1', name: 'Jon High' }],
          pageTasks: ['MANAGE'],
          adAccountTasks: [],
        },
      } as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([{
        grantedAssets: { meta_pages: { pages: ['page-1'] } },
        authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 2 }],
        metaAssetGrants: [{
          id: 'grant-1',
          assetKind: 'page',
          assetId: 'page-1',
          assetName: 'Client Page',
          status: 'manual_action_required',
          recipientType: 'human',
          recipientId: 'person-1',
          requestedTasks: ['MANAGE'],
          verifiedTasks: [],
          nextActor: 'client_admin',
          lastErrorCode: 'MANUAL_SHARE_PENDING',
          lastErrorMessage: 'Share this Page in Meta Business Settings.',
          metadata: null,
          verifiedAt: null,
          updatedAt: new Date('2026-09-22T12:00:00.000Z'),
          authorization: { authorizationEpoch: 2, status: 'active' },
          destination: { businessId: 'business-1', name: 'Agency Portfolio' },
        }],
      }] as any);

      const result = await accessRequestService.getAccessRequestById('request-1');

      expect((result.data as any)?.metaFulfillment).toEqual([expect.objectContaining({
        id: 'grant-1',
        assetName: 'Client Page',
        recipientName: 'Jon High',
        status: 'manual_action_required',
        nextActor: 'client_admin',
        nextAction: 'Share this Page in Meta Business Settings.',
      })]);
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
          shopify: {
            platform: 'shopify',
            shopDomain: 'client-store.myshopify.com',
            collaboratorCode: '1234',
          },
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

  describe('getAccessRequestOwnershipById', () => {
    it('reads only fields needed for cancellation authorization and audit logging', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        agencyId: 'agency-1',
        clientName: 'Jane Client',
        clientEmail: 'jane@example.com',
      } as any);

      const result = await accessRequestService.getAccessRequestOwnershipById('request-1');

      expect(result).toEqual({
        data: {
          agencyId: 'agency-1',
          clientName: 'Jane Client',
          clientEmail: 'jane@example.com',
        },
        error: null,
      });
      expect(prisma.accessRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        select: {
          agencyId: true,
          clientName: true,
          clientEmail: true,
        },
      });
      expect(prisma.clientConnection.findFirst).not.toHaveBeenCalled();
      expect(prisma.clientConnection.findMany).not.toHaveBeenCalled();
    });
  });

  describe('markRequestAuthorized', () => {
    it('locks the request and persists the lifecycle decision in one transaction', async () => {
      const transaction = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: 'request-1' }]),
        accessRequest: {
          findUnique: vi.fn()
            .mockResolvedValueOnce({
              id: 'request-1',
              status: 'partial',
              expiresAt: new Date(Date.now() + 100000),
              platforms: [{ platform: 'beehiiv', accessLevel: 'manage' }],
              metaAccessConfig: null,
            })
            .mockResolvedValueOnce({
              id: 'request-1',
              status: 'partial',
              agencyId: 'agency-1',
              authorizedAt: null,
              clientEmail: 'client@example.com',
              platforms: [{ platform: 'beehiiv', accessLevel: 'manage' }],
            }),
          update: vi.fn().mockResolvedValue({ id: 'request-1', status: 'completed' }),
        },
        clientConnection: {
          findMany: vi.fn().mockResolvedValue([{
            status: 'pending_verification',
            grantedAssets: { beehiiv: { platform: 'beehiiv', verificationStatus: 'verified' } },
            authorizations: [],
            metaAssetGrants: [],
          }]),
        },
      };
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(transaction));

      const result = await accessRequestService.markRequestAuthorized('request-1');

      expect(result).toMatchObject({ data: { status: 'completed' }, error: null, previousStatus: 'partial' });
      expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
      expect(transaction.clientConnection.findMany).toHaveBeenCalledTimes(1);
      expect(transaction.accessRequest.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: { status: 'completed', authorizedAt: expect.any(Date) },
      });
      expect(prisma.accessRequest.update).not.toHaveBeenCalled();
    });

    it.each([
      ['revoked', 'REQUEST_REVOKED'],
      ['expired', 'REQUEST_EXPIRED'],
    ])('does not recalculate a %s request', async (status, errorCode) => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValueOnce({
        id: 'request-1',
        status,
        expiresAt: new Date(Date.now() + 100000),
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
      } as any);

      const result = await accessRequestService.markRequestAuthorized('request-1');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe(errorCode);
      expect(prisma.clientConnection.findMany).not.toHaveBeenCalled();
      expect(prisma.accessRequest.update).not.toHaveBeenCalled();
    });

    it('reopens a completed Meta request after reauthorization makes its grants stale', async () => {
      const previouslyCompletedAt = new Date('2026-09-20T12:00:00.000Z');
      vi.mocked(prisma.accessRequest.findUnique)
        .mockResolvedValueOnce({
          id: 'request-1',
          status: 'completed',
          expiresAt: new Date(Date.now() + 100000),
          platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
          metaAccessConfig: { recipients: [{ type: 'human', id: 'person-1' }], adAccountTasks: ['ANALYZE'] },
        } as any)
        .mockResolvedValueOnce({
          id: 'request-1', status: 'completed', agencyId: 'agency-1', authorizedAt: previouslyCompletedAt,
        } as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([{
        grantedAssets: { meta_ads: { adAccounts: ['act-1'] } },
        authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 2 }],
        metaAssetGrants: [
          { assetKind: 'ad_account', assetId: 'act-1', status: 'stale', recipientType: 'business', recipientId: 'business-1', requestedTasks: [], verifiedTasks: [], verifiedAuthorizationEpoch: null, authorization: { authorizationEpoch: 2, status: 'active' }, destination: { businessId: 'business-1', agencyConnection: { status: 'active', businessId: 'business-1' } } },
          { assetKind: 'ad_account', assetId: 'act-1', status: 'stale', recipientType: 'human', recipientId: 'person-1', requestedTasks: ['ANALYZE'], verifiedTasks: [], verifiedAuthorizationEpoch: null, authorization: { authorizationEpoch: 2, status: 'active' }, destination: { businessId: 'business-1', agencyConnection: { status: 'active', businessId: 'business-1' } } },
        ],
      }] as any);
      vi.mocked(prisma.accessRequest.update).mockResolvedValue({
        id: 'request-1', status: 'partial', authorizedAt: previouslyCompletedAt,
      } as any);

      const result = await accessRequestService.markRequestAuthorized('request-1');

      expect(result.error).toBeNull();
      expect(result.data?.status).toBe('partial');
      expect(prisma.accessRequest.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'request-1' }, data: { status: 'partial' },
      }));
    });

    it('should mark request as completed and emit a completed webhook event once', async () => {
      vi.mocked(prisma.accessRequest.findUnique)
        .mockResolvedValueOnce({
          id: 'request-1',
          platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
          metaAccessConfig: { recipients: [{ type: 'human', id: 'person-1' }] },
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
          authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 1 }],
          metaAssetGrants: [{
            assetKind: 'ad_account',
            assetId: 'act_123',
            status: 'verified',
            recipientType: 'business',
            recipientId: 'business-1',
            requestedTasks: [],
            verifiedTasks: [],
            verifiedAuthorizationEpoch: 1,
            authorization: { authorizationEpoch: 1, status: 'active' },
          }, {
            assetKind: 'ad_account', assetId: 'act_123', status: 'verified',
            recipientType: 'human', recipientId: 'person-1',
            requestedTasks: [], verifiedTasks: [], verifiedAuthorizationEpoch: 1,
            authorization: { authorizationEpoch: 1, status: 'active' },
          }],
        },
      ] as any);
      vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
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
      vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
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
          metaAccessConfig: { recipients: [{ type: 'human', id: 'person-1' }] },
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
          authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 1 }],
          metaAssetGrants: [{
            assetKind: 'ad_account',
            assetId: 'act_123',
            status: 'verified',
            recipientType: 'business',
            recipientId: 'business-1',
            requestedTasks: [],
            verifiedTasks: [],
            verifiedAuthorizationEpoch: 1,
            authorization: { authorizationEpoch: 1, status: 'active' },
          }, {
            assetKind: 'ad_account', assetId: 'act_123', status: 'verified',
            recipientType: 'human', recipientId: 'person-1',
            requestedTasks: [], verifiedTasks: [], verifiedAuthorizationEpoch: 1,
            authorization: { authorizationEpoch: 1, status: 'active' },
          }],
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

  describe('setAccessRequestLifecycleStatus', () => {
    const completedTransitionFixture = (status: string) => ({
      id: 'request-1',
      status,
      agencyId: 'agency-1',
      authorizedAt: null,
      clientEmail: 'client@test.com',
      platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
    });

    it('queues exactly one agency notification when the request first completes', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(
        completedTransitionFixture('partial') as any
      );
      vi.mocked(prisma.accessRequest.update).mockResolvedValue({
        id: 'request-1',
        status: 'completed',
      } as any);

      const result = await accessRequestService.setAccessRequestLifecycleStatus(
        'request-1',
        'completed'
      );

      expect(result.error).toBeNull();
      expect(result.previousStatus).toBe('partial');
      expect(notificationService.queueNotification).toHaveBeenCalledTimes(1);
      expect(notificationService.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          agencyId: 'agency-1',
          accessRequestId: 'request-1',
          clientEmail: 'client@test.com',
          clientName: 'client',
          platforms: ['meta_ads'],
          completedAt: expect.any(Date),
        })
      );
    });

    it('does not notify again when the request is already completed', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(
        completedTransitionFixture('completed') as any
      );

      const result = await accessRequestService.setAccessRequestLifecycleStatus(
        'request-1',
        'completed'
      );

      expect(result.error).toBeNull();
      expect(result.previousStatus).toBe('completed');
      expect(prisma.accessRequest.update).not.toHaveBeenCalled();
      expect(notificationService.queueNotification).not.toHaveBeenCalled();
    });

    it('does not notify on a partial transition', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(
        completedTransitionFixture('pending') as any
      );
      vi.mocked(prisma.accessRequest.update).mockResolvedValue({
        id: 'request-1',
        status: 'partial',
      } as any);

      const result = await accessRequestService.setAccessRequestLifecycleStatus(
        'request-1',
        'partial'
      );

      expect(result.error).toBeNull();
      expect(result.previousStatus).toBe('pending');
      expect(notificationService.queueNotification).not.toHaveBeenCalled();
    });

    it('still completes the transition when the notification queue fails', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue(
        completedTransitionFixture('partial') as any
      );
      vi.mocked(prisma.accessRequest.update).mockResolvedValue({
        id: 'request-1',
        status: 'completed',
      } as any);
      vi.mocked(notificationService.queueNotification).mockRejectedValueOnce(
        new Error('queue down')
      );

      const result = await accessRequestService.setAccessRequestLifecycleStatus(
        'request-1',
        'completed'
      );

      expect(result.error).toBeNull();
      expect(result.data?.status).toBe('completed');
      expect(notificationService.queueNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('excludeMetaGrant', () => {
    it.each([
      ['revoked', new Date(Date.now() + 60_000), 'REQUEST_REVOKED'],
      ['expired', new Date(Date.now() + 60_000), 'REQUEST_EXPIRED'],
      ['pending', new Date(Date.now() - 60_000), 'REQUEST_EXPIRED'],
    ])('rejects exclusion for %s request', async (status, expiresAt, errorCode) => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        agencyId: 'agency-1', status, expiresAt,
      } as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ clerkUserId: 'owner-1' } as any);
      vi.mocked(prisma.metaAssetGrant.findFirst).mockResolvedValue({ id: 'grant-1' } as any);

      const result = await accessRequestService.excludeMetaGrant({
        accessRequestId: 'request-1',
        grantId: 'grant-1',
        agencyId: 'agency-1',
        ownerSubject: 'owner-1',
        actorEmail: 'owner@example.com',
        reason: 'No longer required.',
      });

      expect(result.error?.code).toBe(errorCode);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.metaAssetGrant.update).not.toHaveBeenCalled();
      expect(prisma.accessRequest.update).not.toHaveBeenCalled();
    });

    it('lets the agency owner exclude one named grant and writes the audit in the same transaction', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        agencyId: 'agency-1',
        status: 'partial',
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        metaAccessConfig: { recipients: [{ type: 'human', id: 'person-1' }] },
      } as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ clerkUserId: 'owner-1' } as any);
      vi.mocked(prisma.metaAssetGrant.findFirst).mockResolvedValue({
        id: 'grant-1',
        assetKind: 'ad_account',
        assetId: 'act_1',
        recipientType: 'business',
        recipientId: 'partner-bm-1',
        metadata: {},
      } as any);
      vi.mocked(prisma.metaAssetGrant.update).mockResolvedValue({ id: 'grant-1', status: 'excluded' } as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: 1n } as any);
      vi.mocked(prisma.clientConnection.findMany).mockResolvedValue([{
        grantedAssets: { meta_ads: { adAccounts: ['act_1'] } },
        authorizations: [{ platform: 'meta', status: 'active', authorizationEpoch: 1 }],
        metaAssetGrants: [{
          assetKind: 'ad_account',
          assetId: 'act_1',
          status: 'excluded',
          recipientType: 'business',
          recipientId: 'partner-bm-1',
          verifiedAuthorizationEpoch: null,
          authorization: { authorizationEpoch: 1, status: 'active' },
        }, {
          assetKind: 'ad_account', assetId: 'act_1', status: 'verified',
          recipientType: 'human', recipientId: 'person-1',
          requestedTasks: [], verifiedTasks: [], verifiedAuthorizationEpoch: 1,
          authorization: { authorizationEpoch: 1, status: 'active' },
        }],
      }] as any);
      vi.mocked(prisma.accessRequest.update).mockResolvedValue({ id: 'request-1', status: 'completed' } as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));

      const result = await accessRequestService.excludeMetaGrant({
        accessRequestId: 'request-1',
        grantId: 'grant-1',
        agencyId: 'agency-1',
        ownerSubject: 'owner-1',
        actorEmail: 'owner@example.com',
        reason: 'Client does not use this ad account.',
      });

      expect(result.error).toBeNull();
      expect(prisma.metaAssetGrant.update).toHaveBeenCalledWith({
        where: { id: 'grant-1' },
        data: expect.objectContaining({
          status: 'excluded',
          verifiedAt: null,
          verifiedAuthorizationEpoch: null,
          metadata: expect.objectContaining({
            exclusion: expect.objectContaining({
              reason: 'Client does not use this ad account.',
              excludedBy: 'owner-1',
            }),
          }),
        }),
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'META_GRANT_EXCLUDED', resourceId: 'grant-1' }),
      });
      expect(prisma.accessRequest.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: expect.objectContaining({ status: 'completed' }),
      });
    });

    it('rejects a non-owner before changing the grant', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({ agencyId: 'agency-1' } as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ clerkUserId: 'owner-1' } as any);
      vi.mocked(prisma.metaAssetGrant.findFirst).mockResolvedValue({ id: 'grant-1' } as any);

      const result = await accessRequestService.excludeMetaGrant({
        accessRequestId: 'request-1',
        grantId: 'grant-1',
        agencyId: 'agency-1',
        ownerSubject: 'member-1',
        actorEmail: 'member@example.com',
        reason: 'Client does not use this ad account.',
      });

      expect(result.error?.code).toBe('OWNER_REQUIRED');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a cross-agency request before changing the grant', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({ agencyId: 'agency-2' } as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ clerkUserId: 'owner-1' } as any);
      vi.mocked(prisma.metaAssetGrant.findFirst).mockResolvedValue({ id: 'grant-1' } as any);

      const result = await accessRequestService.excludeMetaGrant({
        accessRequestId: 'request-1',
        grantId: 'grant-1',
        agencyId: 'agency-1',
        ownerSubject: 'owner-1',
        actorEmail: 'owner@example.com',
        reason: 'Client does not use this ad account.',
      });

      expect(result.error?.code).toBe('FORBIDDEN');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('requires verified access to be revoked before excluding the requirement', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        agencyId: 'agency-1', status: 'partial', expiresAt: new Date(Date.now() + 60_000),
      } as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({ clerkUserId: 'owner-1' } as any);
      vi.mocked(prisma.metaAssetGrant.findFirst).mockResolvedValue({ id: 'grant-1', status: 'verified' } as any);

      const result = await accessRequestService.excludeMetaGrant({
        accessRequestId: 'request-1',
        grantId: 'grant-1',
        agencyId: 'agency-1',
        ownerSubject: 'owner-1',
        actorEmail: 'owner@example.com',
        reason: 'This access is no longer required.',
      });

      expect(result.error?.code).toBe('META_GRANT_MUST_BE_REVOKED');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.metaAssetGrant.update).not.toHaveBeenCalled();
    });
  });

  describe('updateAccessRequest', () => {
    it('lets an agency add valid Meta assignees to an existing request', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        status: 'pending',
        agencyId: 'agency-1',
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        metaAccessConfig: null,
      } as any);
      vi.mocked(prisma.accessRequest.update).mockResolvedValue({
        id: 'request-1',
        status: 'pending',
        metaAccessConfig: META_ACCESS_CONFIG,
      } as any);

      const result = await accessRequestService.updateAccessRequest('request-1', {
        metaAccessConfig: META_ACCESS_CONFIG,
      } as any);

      expect(result.error).toBeNull();
      expect(metaAssetsService.getAssignableRecipients).toHaveBeenCalledWith('agency-1', undefined);
      expect(prisma.accessRequest.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: expect.objectContaining({
          metaAccessConfig: expect.objectContaining({ recipients: META_ACCESS_CONFIG.recipients }),
        }),
      });
    });

    it('rejects an unassignable Meta recipient when updating an existing request', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        status: 'pending',
        agencyId: 'agency-1',
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        metaAccessConfig: null,
      } as any);

      const result = await accessRequestService.updateAccessRequest('request-1', {
        metaAccessConfig: {
          ...META_ACCESS_CONFIG,
          recipients: [{ type: 'human', id: 'other-agency-person' }],
        },
      } as any);

      expect(result.error?.code).toBe('INVALID_META_ASSIGNEE');
      expect(prisma.accessRequest.update).not.toHaveBeenCalled();
    });

    it('defaults Meta human recipient on update when no person is supplied', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        status: 'pending',
        agencyId: 'agency-1',
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        metaAccessConfig: null,
      } as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        id: 'agency-1',
        email: 'owner@agency.test',
      } as any);
      vi.mocked(metaAssetsService.getAssignableRecipients).mockResolvedValue({
        data: [
          { type: 'human', id: 'person-1', name: 'Agency Owner', email: 'owner@agency.test' },
          { type: 'system_user', id: 'system-user-1', name: 'Automation' },
        ],
        error: null,
      });
      vi.mocked(prisma.accessRequest.update).mockResolvedValue({ id: 'request-1', status: 'pending' } as any);

      const result = await accessRequestService.updateAccessRequest('request-1', {
        metaAccessConfig: {
          recipients: [],
          pageTasks: [],
          adAccountTasks: [],
          catalogTasks: ['MANAGE'],
        },
      } as any);

      expect(result.error).toBeNull();
      expect(prisma.accessRequest.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: expect.objectContaining({
          metaAccessConfig: expect.objectContaining({
            recipients: [{ type: 'human', id: 'person-1', name: 'Agency Owner' }],
          }),
        }),
      });
    });

    it('keeps an explicit Meta person on update when one is supplied', async () => {
      vi.mocked(prisma.accessRequest.findUnique).mockResolvedValue({
        id: 'request-1',
        status: 'pending',
        agencyId: 'agency-1',
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        metaAccessConfig: null,
      } as any);
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        id: 'agency-1',
        email: 'owner@agency.test',
      } as any);
      vi.mocked(metaAssetsService.getAssignableRecipients).mockResolvedValue({
        data: [
          { type: 'human', id: 'person-1', name: 'Agency Owner', email: 'owner@agency.test' },
          { type: 'human', id: 'person-2', name: 'Teammate' },
        ],
        error: null,
      });
      vi.mocked(prisma.accessRequest.update).mockResolvedValue({ id: 'request-1', status: 'pending' } as any);

      const result = await accessRequestService.updateAccessRequest('request-1', {
        metaAccessConfig: {
          recipients: [{ type: 'human', id: 'person-2', name: 'Teammate' }],
          pageTasks: ['MANAGE'],
          adAccountTasks: ['ANALYZE'],
          catalogTasks: ['MANAGE'],
        },
      } as any);

      expect(result.error).toBeNull();
      expect(prisma.accessRequest.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: expect.objectContaining({
          metaAccessConfig: expect.objectContaining({
            recipients: [{ type: 'human', id: 'person-2', name: 'Teammate' }],
          }),
        }),
      });
    });

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
        platforms: [{ platform: 'meta_ads', accessLevel: 'manage' }],
        metaAccessConfig: META_ACCESS_CONFIG,
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
      vi.mocked(prisma.webhookEndpoint.findFirst).mockResolvedValue({
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

  describe('cancelAccessRequest', () => {
    it('clears dashboard cache before returning after revoke', async () => {
      const key = CacheKeys.dashboard('cache-agency');
      await getCached({ key, fetch: async () => ({ data: { status: 'pending' }, error: null }) });
      const transaction = {
        accessRequest: {
          findUnique: vi.fn().mockResolvedValue({
            agencyId: 'cache-agency', status: 'pending', clientName: 'Client', clientEmail: 'client@example.com',
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        auditLog: { create: vi.fn() },
      };
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(transaction));

      await accessRequestService.cancelAccessRequest('request-cache');

      const fetchFresh = vi.fn().mockResolvedValue({ data: { status: 'revoked' }, error: null });
      const result = await getCached({ key, fetch: fetchFresh });
      expect(result.cached).toBe(false);
      expect(fetchFresh).toHaveBeenCalledOnce();
    });

    it('returns after durable revoke even when webhook delivery stalls', async () => {
      const transaction = {
        accessRequest: {
          findUnique: vi.fn().mockResolvedValue({
            agencyId: 'agency-1', status: 'pending', clientName: 'Client', clientEmail: 'client@example.com',
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        auditLog: { create: vi.fn() },
      };
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(transaction));
      vi.mocked(prisma.webhookEndpoint.findFirst).mockReturnValue(
        new Promise(() => {}) as any
      );

      const result = await accessRequestService.cancelAccessRequest('request-1');

      expect(result).toEqual({ data: { success: true }, error: null });
      expect(transaction.accessRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'request-1', status: { not: 'revoked' } },
        data: { status: 'revoked' },
      });
    });

    it('writes the revoke audit row in the same transaction', async () => {
      const transaction = {
        accessRequest: {
          findUnique: vi.fn().mockResolvedValue({
            agencyId: 'agency-1', status: 'pending', clientName: 'Client', clientEmail: 'client@example.com',
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        auditLog: { create: vi.fn().mockResolvedValue({ id: 1n }) },
      };
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(transaction));

      const result = await accessRequestService.cancelAccessRequest('request-1', {
        userEmail: 'owner@example.com', ipAddress: '127.0.0.1', userAgent: 'test-agent',
      });

      expect(result).toEqual({ data: { success: true }, error: null });
      expect(transaction.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          agencyId: 'agency-1', userEmail: 'owner@example.com', action: 'ACCESS_REQUEST_REVOKED',
          resourceType: 'access_request', resourceId: 'request-1', ipAddress: '127.0.0.1', userAgent: 'test-agent',
        }),
      });
    });

    it('does not report cancellation success when the audit write fails', async () => {
      const transaction = {
        accessRequest: {
          findUnique: vi.fn().mockResolvedValue({
            agencyId: 'agency-1', status: 'pending', clientName: 'Client', clientEmail: 'client@example.com',
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        auditLog: { create: vi.fn().mockRejectedValue(new Error('audit unavailable')) },
      };
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(transaction));

      const result = await accessRequestService.cancelAccessRequest('request-1', {
        userEmail: 'owner@example.com', ipAddress: '127.0.0.1', userAgent: 'test-agent',
      });

      expect(result).toMatchObject({ data: null, error: { code: 'INTERNAL_ERROR' } });
      expect(prisma.webhookEndpoint.findFirst).not.toHaveBeenCalled();
    });

    it('returns database errors instead of starting side effects', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error('database unavailable'));

      const result = await accessRequestService.cancelAccessRequest('request-1');

      expect(result).toEqual({
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to cancel access request',
        },
      });
      expect(prisma.accessRequest.update).not.toHaveBeenCalled();
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
