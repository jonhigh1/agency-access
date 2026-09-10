/**
 * Agency Platforms Routes Tests
 *
 * Tests for OAuth and platform connection management API endpoints.
 * Following TDD - tests written before implementation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { agencyPlatformsRoutes } from '../agency-platforms.js';
import { agencyPlatformService } from '../../services/agency-platform.service.js';
import { oauthStateService } from '../../services/oauth-state.service.js';
import { metaAssetsService } from '../../services/meta-assets.service.js';
import { googleAssetsService } from '../../services/google-assets.service.js';
import { MetaConnector } from '../../services/connectors/meta.js';
import { SnapchatConnector } from '../../services/connectors/snapchat.js';
import { ConnectorError } from '../../services/connectors/base.connector.js';
import { agencyResolutionService } from '../../services/agency-resolution.service.js';
import * as authorization from '../../lib/authorization.js';
import { prisma } from '../../lib/prisma.js';
import { infisical } from '../../lib/infisical.js';
import { env } from '../../lib/env.js';
import { createAuditLog } from '../../services/audit.service.js';

// Mock services
vi.mock('../../services/agency-platform.service.js', () => ({
  agencyPlatformService: {
    getConnections: vi.fn(),
    getConnection: vi.fn(),
    createConnection: vi.fn(),
    revokeConnection: vi.fn(),
    refreshConnection: vi.fn(),
    getValidToken: vi.fn(),
    updateConnectionMetadata: vi.fn(),
  },
}));

vi.mock('../../services/meta-assets.service.js', () => ({
  metaAssetsService: {
    saveBusinessPortfolio: vi.fn(),
    saveAssetSettings: vi.fn(),
    getAssetSettings: vi.fn(),
  },
}));
vi.mock('../../services/google-assets.service.js', () => ({
  googleAssetsService: {
    saveAssetSettings: vi.fn(),
    getAssetSettings: vi.fn(),
    saveAccountSelection: vi.fn(),
  },
}));
vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    agencyPlatformConnection: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));
vi.mock('../../lib/infisical.js', () => ({
  infisical: {
    storeOAuthTokens: vi.fn(),
  },
}));
vi.mock('../../services/audit.service.js', () => ({
  createAuditLog: vi.fn(),
}));

vi.mock('../../services/oauth-state.service.js', () => ({
  oauthStateService: {
    createState: vi.fn(),
    validateState: vi.fn(),
  },
}));
vi.mock('../../services/agency-resolution.service.js', () => ({
  agencyResolutionService: {
    getOrCreateAgency: vi.fn(async (identifier: string) => ({
      data: {
        agencyId: identifier,
        agency: {
          id: identifier,
          name: 'Agency',
          email: 'admin@agency.com',
        },
      },
      error: null,
    })),
    resolveAgency: vi.fn(),
  },
}));
vi.mock('../../lib/authorization.js');
vi.mock('../../middleware/auth.js', () => ({
  authenticate: () => async (request: any) => {
    request.user = { sub: 'user_123' };
  },
}));

// Create shared mock MetaConnector instance for all tests
const mockMetaConnectorInstance = {
  getAuthUrl: vi.fn(),
  exchangeCode: vi.fn(),
  getLongLivedToken: vi.fn(),
  getBusinessAccounts: vi.fn(),
  verifyToken: vi.fn(),
  getUserInfo: vi.fn(),
  getTokenMetadata: vi.fn(),
};

const mockGoogleConnectorInstance = {
  getAllGoogleAccounts: vi.fn(),
};

// Mock MetaConnector class to return shared instance
vi.mock('../../services/connectors/meta.js', () => ({
  MetaConnector: vi.fn(function() {
    return mockMetaConnectorInstance;
  }),
}));

vi.mock('../../services/connectors/google.js', () => ({
  GoogleConnector: vi.fn(function() {
    return mockGoogleConnectorInstance;
  }),
}));

// Mock Redis to prevent connection attempts in tests
vi.mock('../../lib/redis.js', () => ({
  redis: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    quit: vi.fn(),
  },
}));
vi.mock('../../lib/cache.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/cache.js')>('../../lib/cache.js');
  return {
    ...actual,
    getCached: vi.fn(async ({ fetch }: any) => ({ ...(await fetch()), cached: false })),
  };
});
vi.mock('../../middleware/quota-enforcement.js', () => ({
  quotaEnforcementMiddleware: () => async () => undefined,
}));

// Mock env to provide FRONTEND_URL (plus Snapchat OAuth credentials for the real connector)
vi.mock('../../lib/env.js', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:3000',
    NODE_ENV: 'test',
    API_URL: 'http://localhost:3001',
    SNAPCHAT_CLIENT_ID: 'snap-client-id',
    SNAPCHAT_CLIENT_SECRET: 'snap-client-secret',
  },
}));

describe('Agency Platforms Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(agencyPlatformsRoutes);
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
  }, 20000);

  afterEach(async () => {
    await app.close();
  });

  describe('GET /agency-platforms', () => {
    it('should list all agency platform connections', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          agencyId: 'agency-1',
          platform: 'google',
          status: 'active',
          connectedAt: new Date().toISOString(),
        },
        {
          id: 'conn-2',
          agencyId: 'agency-1',
          platform: 'meta',
          status: 'active',
          connectedAt: new Date().toISOString(),
        },
      ];

      vi.mocked(agencyPlatformService.getConnections).mockResolvedValue({
        data: mockConnections as any,
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms?agencyId=agency-1',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: mockConnections,
        error: null,
      });
      expect(agencyPlatformService.getConnections).toHaveBeenCalledWith('agency-1', undefined);
    });

    it('should filter by status if provided', async () => {
      vi.mocked(agencyPlatformService.getConnections).mockResolvedValue({
        data: [] as any,
        error: null,
      });

      await app.inject({
        method: 'GET',
        url: '/agency-platforms?agencyId=agency-1&status=active',
      });

      expect(agencyPlatformService.getConnections).toHaveBeenCalledWith('agency-1', {
        status: 'active',
      });
    });

    it('should fallback to principal agency when agencyId is missing', async () => {
      vi.mocked(agencyPlatformService.getConnections).mockResolvedValue({
        data: [] as any,
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms',
      });

      expect(response.statusCode).toBe(200);
      expect(agencyPlatformService.getConnections).toHaveBeenCalledWith('agency-1', undefined);
    });

    it('should handle service errors', async () => {
      vi.mocked(agencyPlatformService.getConnections).mockResolvedValue({
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve connections',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms?agencyId=agency-1',
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('GET /agency-platforms/available', () => {
    it('should return all supported platforms with categorization', async () => {
      vi.mocked(agencyPlatformService.getConnections).mockResolvedValue({
        data: [] as any,
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms/available?agencyId=agency-1',
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.data.length).toBeGreaterThanOrEqual(11);

      // Check categorization: recommended = google, meta, linkedin
      const recommended = result.data.filter((p: any) => p.category === 'recommended');
      const other = result.data.filter((p: any) => p.category === 'other');

      expect(recommended).toHaveLength(3);
      expect(recommended.map((p: any) => p.platform)).toContain('google');
      expect(recommended.map((p: any) => p.platform)).toContain('meta');
      expect(recommended.map((p: any) => p.platform)).toContain('linkedin');

      // Zapier and other OAuth platforms should be in "other"
      expect(other.map((p: any) => p.platform)).toContain('zapier');
      expect(other.map((p: any) => p.platform)).toContain('tiktok');
    });

    it('should extract email from metadata.email for connected platforms', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          platform: 'meta',
          status: 'active',
          connectedBy: 'fallback@agency.com',
          metadata: { email: 'user@example.com' },
        },
      ];

      vi.mocked(agencyPlatformService.getConnections).mockResolvedValue({
        data: mockConnections as any,
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms/available?agencyId=agency-1',
      });

      const result = response.json();
      const metaPlatform = result.data.find((p: any) => p.platform === 'meta');

      expect(metaPlatform.connected).toBe(true);
      expect(metaPlatform.connectedEmail).toBe('user@example.com');
    });

    it('should fallback to metadata.userEmail if email missing', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          platform: 'linkedin',
          status: 'active',
          connectedBy: 'fallback@agency.com',
          metadata: { userEmail: 'linkedin@example.com' },
        },
      ];

      vi.mocked(agencyPlatformService.getConnections).mockResolvedValue({
        data: mockConnections as any,
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms/available?agencyId=agency-1',
      });

      const result = response.json();
      const linkedinPlatform = result.data.find((p: any) => p.platform === 'linkedin');

      expect(linkedinPlatform.connectedEmail).toBe('linkedin@example.com');
    });

    it('should fallback to metadata.businessEmail if other emails missing', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          platform: 'tiktok',
          status: 'active',
          connectedBy: 'fallback@agency.com',
          metadata: { businessEmail: 'business@example.com' },
        },
      ];

      vi.mocked(agencyPlatformService.getConnections).mockResolvedValue({
        data: mockConnections as any,
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms/available?agencyId=agency-1',
      });

      const result = response.json();
      const tiktokPlatform = result.data.find((p: any) => p.platform === 'tiktok');

      expect(tiktokPlatform.connectedEmail).toBe('business@example.com');
    });

    it('should fallback to connectedBy if metadata is empty', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          platform: 'google',
          status: 'active',
          connectedBy: 'admin@agency.com',
          metadata: {},
        },
      ];

      vi.mocked(agencyPlatformService.getConnections).mockResolvedValue({
        data: mockConnections as any,
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms/available?agencyId=agency-1',
      });

      const result = response.json();
      const googlePlatform = result.data.find((p: any) => p.platform === 'google');

      expect(googlePlatform.connectedEmail).toBe('admin@agency.com');
    });

    it('should mark platforms as not connected if no connection exists', async () => {
      vi.mocked(agencyPlatformService.getConnections).mockResolvedValue({
        data: [] as any,
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms/available?agencyId=agency-1',
      });

      expect(response.statusCode).toBe(200);
      const result = response.json();

      // All platforms should be marked as not connected
      result.data.forEach((platform: any) => {
        expect(platform.connected).toBe(false);
        expect(platform.status).toBeUndefined();
        expect(platform.connectedEmail).toBeUndefined();
      });
    });

    it('should show platform as not connected when status is not active', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          platform: 'zapier',
          status: 'expired',
          connectedBy: 'admin@agency.com',
          metadata: { email: 'expired@example.com' },
        },
      ];

      vi.mocked(agencyPlatformService.getConnections).mockResolvedValue({
        data: mockConnections as any,
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms/available?agencyId=agency-1',
      });

      const result = response.json();
      const zapierPlatform = result.data.find((p: any) => p.platform === 'zapier');

      expect(zapierPlatform.connected).toBe(false); // Not active
      expect(zapierPlatform.status).toBe('expired');
      expect(zapierPlatform.connectedEmail).toBe('expired@example.com'); // Still shows email
    });
  });

  describe('GET /agency-platforms/google/accounts', () => {
    it('returns 401 when Google token is invalid during refresh', async () => {
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: {
          id: 'conn-1',
          agencyId: 'agency-1',
          platform: 'google',
          status: 'active',
          metadata: {},
        } as any,
        error: null,
      });
      vi.mocked(agencyPlatformService.getValidToken).mockResolvedValue({
        data: null,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Google token is invalid. Please reconnect Google.',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms/google/accounts?agencyId=agency-1&refresh=true',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        data: null,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Google token is invalid. Please reconnect Google.',
        },
      });
    });

    it('returns enriched Google Ads metadata and persists it during refresh', async () => {
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: {
          id: 'conn-1',
          agencyId: 'agency-1',
          platform: 'google',
          status: 'active',
          metadata: {},
        } as any,
        error: null,
      });
      vi.mocked(agencyPlatformService.getValidToken).mockResolvedValue({
        data: 'google-access-token',
        error: null,
      });
      vi.mocked(agencyPlatformService.updateConnectionMetadata).mockResolvedValue({
        data: { success: true },
        error: null,
      });
      mockGoogleConnectorInstance.getAllGoogleAccounts.mockResolvedValue({
        adsAccounts: [
          {
            id: '6449142979',
            name: 'Pillar AI Agency MCC',
            formattedId: '644-914-2979',
            isManager: true,
            nameSource: 'hierarchy',
            type: 'google_ads',
            status: 'active',
          },
          {
            id: '5497559774',
            name: 'Google Ads account • 549-755-9774',
            formattedId: '549-755-9774',
            isManager: false,
            nameSource: 'fallback',
            type: 'google_ads',
            status: 'active',
          },
        ],
        analyticsProperties: [],
        businessAccounts: [],
        tagManagerContainers: [],
        searchConsoleSites: [],
        merchantCenterAccounts: [],
        hasAccess: true,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms/google/accounts?agencyId=agency-1&refresh=true',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.adsAccounts).toEqual([
        expect.objectContaining({
          id: '6449142979',
          formattedId: '644-914-2979',
          isManager: true,
          nameSource: 'hierarchy',
        }),
        expect.objectContaining({
          id: '5497559774',
          formattedId: '549-755-9774',
          nameSource: 'fallback',
        }),
      ]);
      expect(agencyPlatformService.updateConnectionMetadata).toHaveBeenCalledWith('agency-1', 'google', {
        googleAccounts: expect.objectContaining({
          adsAccounts: expect.arrayContaining([
            expect.objectContaining({
              id: '6449142979',
              formattedId: '644-914-2979',
              isManager: true,
              nameSource: 'hierarchy',
            }),
            expect.objectContaining({
              id: '5497559774',
              formattedId: '549-755-9774',
              nameSource: 'fallback',
            }),
          ]),
        }),
      });
    });
  });

  describe('GET /agency-platforms/meta/business-accounts', () => {
    it('returns fetch failure when refreshed Meta portfolio discovery fails', async () => {
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: {
          id: 'conn-1',
          agencyId: 'agency-1',
          platform: 'meta',
          status: 'active',
          metadata: {
            metaBusinessAccounts: {
              businesses: [{ id: 'biz-1', name: 'Cached Biz' }],
              hasAccess: true,
            },
          },
        } as any,
        error: null,
      });
      vi.mocked(agencyPlatformService.getValidToken).mockResolvedValue({
        data: 'token-123',
        error: null,
      });
      mockMetaConnectorInstance.getBusinessAccounts.mockRejectedValue(new Error('OAuthException'));

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms/meta/business-accounts?agencyId=agency-1&refresh=true',
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        data: null,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch Meta business accounts',
          details: 'OAuthException',
        },
      });
    });
  });

  describe('POST /agency-platforms/:platform/initiate', () => {
    it('rejects Meta legacy OAuth initiation unless an explicit fallback flag is provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/agency-platforms/meta/initiate',
        payload: {
          agencyId: 'agency-1',
          userEmail: 'admin@agency.com',
          redirectUrl: 'https://app.example.com/settings/platforms',
        },
      });

      expect(response.statusCode).toBe(410);
      expect(response.json()).toEqual({
        data: null,
        error: {
          code: 'LEGACY_META_OAUTH_DISABLED',
          message: 'Meta now uses Business Login via the JS SDK. Reconnect from the app UI or pass useLegacyFallback=true only for rollback.',
        },
      });
      expect(oauthStateService.createState).not.toHaveBeenCalled();
    });

    it('should initiate OAuth flow and return auth URL when Meta legacy fallback is explicitly enabled', async () => {
      const mockStateToken = 'state-token-123';
      const mockAuthUrl = 'https://facebook.com/oauth?state=state-token-123';

      vi.mocked(oauthStateService.createState).mockResolvedValue({
        data: mockStateToken,
        error: null,
      });

      mockMetaConnectorInstance.getAuthUrl.mockReturnValue(mockAuthUrl);

      const response = await app.inject({
        method: 'POST',
        url: '/agency-platforms/meta/initiate',
        payload: {
          agencyId: 'agency-1',
          userEmail: 'admin@agency.com',
          redirectUrl: 'https://app.example.com/settings/platforms',
          useLegacyFallback: true,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: {
          authUrl: mockAuthUrl,
          state: mockStateToken,
        },
        error: null,
      });

      // Verify state token was created with correct data
      expect(oauthStateService.createState).toHaveBeenCalledWith({
        agencyId: 'agency-1',
        platform: 'meta',
        userEmail: 'admin@agency.com',
        redirectUrl: 'https://app.example.com/settings/platforms',
        useLegacyFallback: true,
        timestamp: expect.any(Number),
      });
    });

    it('should return 400 for unsupported platform', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/agency-platforms/unsupported/initiate',
        payload: {
          agencyId: 'agency-1',
          userEmail: 'admin@agency.com',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('UNSUPPORTED_PLATFORM');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/agency-platforms/meta/initiate',
        payload: {
          // Missing agencyId and userEmail
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle state creation errors', async () => {
      vi.mocked(oauthStateService.createState).mockResolvedValue({
        data: null,
        error: {
          code: 'STATE_CREATION_FAILED',
          message: 'Failed to create state token',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/agency-platforms/meta/initiate',
        payload: {
          agencyId: 'agency-1',
          userEmail: 'admin@agency.com',
          useLegacyFallback: true,
        },
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('POST /agency-platforms/meta/business-login/finalize', () => {
    it('returns 400 when required Meta Business Login payload is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/agency-platforms/meta/business-login/finalize',
        payload: {
          agencyId: 'agency-1',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'agencyId, accessToken, and userEmail are required',
        },
      });
    });

    it('stores a Meta connection from Business Login payload without exposing secretId in the response', async () => {
      mockMetaConnectorInstance.verifyToken.mockResolvedValue(true);
      mockMetaConnectorInstance.getUserInfo.mockResolvedValue({
        id: 'meta-user-1',
        name: 'Jon High',
      });
      mockMetaConnectorInstance.getTokenMetadata.mockResolvedValue({
        scopes: ['ads_management', 'ads_read', 'business_management'],
        dataAccessExpiresAt: new Date('2026-07-01T00:00:00.000Z'),
      });
      mockMetaConnectorInstance.getLongLivedToken.mockResolvedValue({
        accessToken: 'long-lived-token',
        tokenType: 'bearer',
        expiresAt: new Date('2026-05-10T00:00:00.000Z'),
      });
      mockMetaConnectorInstance.getBusinessAccounts.mockResolvedValue({
        businesses: [
          { id: 'biz-1', name: 'Jon High', verificationStatus: 'not_verified' },
          { id: 'biz-2', name: 'Outdoor DIY', verificationStatus: 'verified' },
        ],
        hasAccess: true,
      });

      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: null,
        error: null,
      });
      vi.mocked(agencyPlatformService.createConnection).mockResolvedValue({
        data: {
          id: 'conn-meta-1',
          agencyId: 'agency-1',
          platform: 'meta',
          status: 'active',
          secretId: 'meta_agency_agency-1',
          metadata: {},
          connectedBy: 'jon.highmu@gmail.com',
        } as any,
        error: null,
      });
      vi.mocked(createAuditLog).mockResolvedValue({
        data: {} as any,
        error: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/agency-platforms/meta/business-login/finalize',
        payload: {
          agencyId: 'agency-1',
          userEmail: 'jon.highmu@gmail.com',
          accessToken: 'short-lived-token',
          userId: 'meta-user-1',
          expiresIn: 3600,
          dataAccessExpirationTime: 1781044454,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(agencyPlatformService.createConnection).toHaveBeenCalledWith({
        agencyId: 'agency-1',
        platform: 'meta',
        accessToken: 'long-lived-token',
        refreshToken: undefined,
        expiresAt: new Date('2026-05-10T00:00:00.000Z'),
        scope: 'ads_management,ads_read,business_management',
        connectedBy: 'jon.highmu@gmail.com',
        metadata: {
          tokenType: 'bearer',
          metaBusinessLogin: {
            authSource: 'js_sdk',
            userId: 'meta-user-1',
            userName: 'Jon High',
            expiresIn: 3600,
            dataAccessExpirationTime: 1781044454,
            dataAccessExpiresAt: '2026-07-01T00:00:00.000Z',
            grantedScopes: ['ads_management', 'ads_read', 'business_management'],
          },
          metaBusinessAccounts: {
            businesses: [
              { id: 'biz-1', name: 'Jon High', verificationStatus: 'not_verified' },
              { id: 'biz-2', name: 'Outdoor DIY', verificationStatus: 'verified' },
            ],
            hasAccess: true,
          },
        },
      });
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          agencyId: 'agency-1',
          userEmail: 'jon.highmu@gmail.com',
          action: 'META_BUSINESS_LOGIN_FINALIZED',
        })
      );
      expect(response.json().data.secretId).toBeUndefined();
    });
  });

  describe('GET /agency-platforms/:platform/callback', () => {
    it('should handle OAuth callback and create connection', async () => {
      const mockStateData = {
        agencyId: 'agency-1',
        platform: 'meta',
        userEmail: 'admin@agency.com',
        redirectUrl: 'https://app.example.com/settings/platforms',
        timestamp: Date.now(),
      };

      const mockTokens = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      };

      const mockConnection = {
        id: 'conn-1',
        agencyId: 'agency-1',
        platform: 'meta',
        status: 'active',
      };

      vi.mocked(oauthStateService.validateState).mockImplementation(async (state) => {
        return {
          data: mockStateData,
          error: null,
        };
      });

      mockMetaConnectorInstance.exchangeCode.mockResolvedValue(mockTokens as any);
      mockMetaConnectorInstance.getLongLivedToken.mockResolvedValue(mockTokens as any);

      // Debug: log when mocks are called
      mockMetaConnectorInstance.exchangeCode.mockImplementation(async (code) => {
        return mockTokens as any;
      });
      mockMetaConnectorInstance.getLongLivedToken.mockImplementation(async (token) => {
        return mockTokens as any;
      });

      vi.mocked(agencyPlatformService.createConnection).mockImplementation(async (data) => {
        return {
          data: mockConnection as any,
          error: null,
        };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms/meta/callback?code=auth-code-123&state=state-token-123',
      });

      if (response.statusCode !== 302) {
        console.log('Response status:', response.statusCode);
        console.log('Response body:', response.json());
      }

      expect(response.statusCode).toBe(302); // Redirect
      expect(response.headers.location).toContain('/platforms/callback?success=true&platform=meta');

      // Verify state was validated
      expect(oauthStateService.validateState).toHaveBeenCalledWith('state-token-123');

      // Verify tokens were exchanged
      expect(mockMetaConnectorInstance.exchangeCode).toHaveBeenCalledWith('auth-code-123');

      // Verify connection was created
      expect(agencyPlatformService.createConnection).toHaveBeenCalledWith({
        agencyId: 'agency-1',
        platform: 'meta',
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        expiresAt: mockTokens.expiresAt,
        connectedBy: 'admin@agency.com',
        metadata: expect.any(Object),
      });
    });

    it('should return error if state validation fails', async () => {
      vi.mocked(oauthStateService.validateState).mockResolvedValue({
        data: null,
        error: {
          code: 'STATE_EXPIRED',
          message: 'State token has expired',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms/meta/callback?code=auth-code-123&state=invalid-state',
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toContain('error=STATE_EXPIRED');
    });

    it('should return error if code exchange fails', async () => {
      vi.mocked(oauthStateService.validateState).mockResolvedValue({
        data: {
          agencyId: 'agency-1',
          platform: 'meta',
          userEmail: 'admin@agency.com',
          timestamp: Date.now(),
        },
        error: null,
      });

      mockMetaConnectorInstance.exchangeCode.mockRejectedValue(
        new Error('Invalid authorization code')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms/meta/callback?code=invalid-code&state=state-token-123',
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toContain('error=TOKEN_EXCHANGE_FAILED');
    });

    it('should return error if connection creation fails', async () => {
      vi.mocked(oauthStateService.validateState).mockResolvedValue({
        data: {
          agencyId: 'agency-1',
          platform: 'meta',
          userEmail: 'admin@agency.com',
          timestamp: Date.now(),
        },
        error: null,
      });

      mockMetaConnectorInstance.exchangeCode.mockResolvedValue({
        accessToken: 'token',
      } as any);

      mockMetaConnectorInstance.getLongLivedToken.mockResolvedValue({
        accessToken: 'token',
      } as any);

      vi.mocked(agencyPlatformService.createConnection).mockResolvedValue({
        data: null,
        error: {
          code: 'PLATFORM_ALREADY_CONNECTED',
          message: 'Platform already connected',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms/meta/callback?code=auth-code-123&state=state-token-123',
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toContain('error=PLATFORM_ALREADY_CONNECTED');
    });
  });

  describe('Snapchat agency OAuth flow', () => {
    let exchangeCodeSpy: ReturnType<typeof vi.spyOn>;
    let getUserInfoSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // Use the REAL connector so registration (PLATFORM_CONNECTORS.snapchat)
      // and the registry-driven auth URL are under test. Only the network
      // boundary is spied.
      exchangeCodeSpy = vi.spyOn(SnapchatConnector.prototype, 'exchangeCode');
      getUserInfoSpy = vi.spyOn(SnapchatConnector.prototype, 'getUserInfo');
    });

    afterEach(() => {
      exchangeCodeSpy.mockRestore();
      getUserInfoSpy.mockRestore();
    });

    describe('POST /agency-platforms/snapchat/initiate', () => {
      it('starts Snapchat OAuth with the API callback redirect and the single marketing scope', async () => {
        const mockStateToken = 'snap-state-token-123';

        vi.mocked(oauthStateService.createState).mockResolvedValue({
          data: mockStateToken,
          error: null,
        });

        const response = await app.inject({
          method: 'POST',
          url: '/agency-platforms/snapchat/initiate',
          payload: {
            agencyId: 'agency-1',
            userEmail: 'admin@agency.com',
            redirectUrl: 'https://app.example.com/settings/platforms',
          },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
          data: {
            authUrl: expect.stringContaining('https://accounts.snapchat.com/login/oauth2/authorize'),
            state: mockStateToken,
          },
          error: null,
        });

        expect(oauthStateService.createState).toHaveBeenCalledWith({
          agencyId: 'agency-1',
          platform: 'snapchat',
          userEmail: 'admin@agency.com',
          redirectUrl: 'https://app.example.com/settings/platforms',
          timestamp: expect.any(Number),
        });

        const authUrl = new URL(response.json().data.authUrl);
        expect(authUrl.searchParams.get('client_id')).toBe('snap-client-id');
        expect(authUrl.searchParams.get('redirect_uri')).toBe(
          'http://localhost:3001/agency-platforms/snapchat/callback'
        );
        expect(authUrl.searchParams.get('state')).toBe(mockStateToken);
        expect(authUrl.searchParams.get('scope')).toBe('snapchat-marketing-api');
        expect(authUrl.searchParams.get('response_type')).toBe('code');
      });

      it('returns 503 naming the missing Snapchat environment variables', async () => {
        const originalClientId = (env as any).SNAPCHAT_CLIENT_ID;
        const originalSecret = (env as any).SNAPCHAT_CLIENT_SECRET;
        delete (env as any).SNAPCHAT_CLIENT_ID;
        delete (env as any).SNAPCHAT_CLIENT_SECRET;

        try {
          vi.mocked(oauthStateService.createState).mockResolvedValue({
            data: 'snap-state-token-123',
            error: null,
          });

          const response = await app.inject({
            method: 'POST',
            url: '/agency-platforms/snapchat/initiate',
            payload: {
              agencyId: 'agency-1',
              userEmail: 'admin@agency.com',
            },
          });

          expect(response.statusCode).toBe(503);
          expect(response.json().error.code).toBe('MISSING_CLIENT_ID');
          expect(response.json().error.message).toContain('SNAPCHAT_CLIENT_ID');
          expect(response.json().error.message).toContain('SNAPCHAT_CLIENT_SECRET');
        } finally {
          (env as any).SNAPCHAT_CLIENT_ID = originalClientId;
          (env as any).SNAPCHAT_CLIENT_SECRET = originalSecret;
        }
      });

      it('blocks initiation for an agency outside the caller principal', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/agency-platforms/snapchat/initiate',
          payload: {
            agencyId: 'agency-9',
            userEmail: 'admin@agency.com',
          },
        });

        expect(response.statusCode).toBe(403);
        expect(response.json().error.code).toBe('FORBIDDEN');
        expect(oauthStateService.createState).not.toHaveBeenCalled();
      });
    });

    describe('GET /agency-platforms/snapchat/callback', () => {
      const mockStateData = {
        agencyId: 'agency-1',
        platform: 'snapchat',
        userEmail: 'admin@agency.com',
        redirectUrl: 'https://app.example.com/settings/platforms',
        timestamp: Date.now(),
      };

      const mockTokens = {
        accessToken: 'snap-access-token',
        refreshToken: 'snap-refresh-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        tokenType: 'Bearer',
      };

      function mockSuccessfulCallbackPrerequisites() {
        vi.mocked(oauthStateService.validateState).mockResolvedValue({
          data: mockStateData,
          error: null,
        });
        exchangeCodeSpy.mockResolvedValue(mockTokens as any);
        vi.mocked(agencyPlatformService.createConnection).mockResolvedValue({
          data: { id: 'conn-snap-1', agencyId: 'agency-1', platform: 'snapchat' } as any,
          error: null,
        });
      }

      it('records Snapchat organization discovery and redirects with connection identifiers', async () => {
        mockSuccessfulCallbackPrerequisites();

        const organizations = [
          {
            id: 'org-1',
            name: 'Agency Org',
            state: 'ACTIVE',
            roles: ['ORGANIZATION_ADMIN'],
            isAgency: true,
            adAccounts: [
              {
                id: 'acc-1',
                name: 'Main Ad Account',
                status: 'ACTIVE',
                currency: 'USD',
                timezone: 'America/Los_Angeles',
                roles: ['AD_ACCOUNT_ADMIN'],
              },
              {
                id: 'acc-2',
                name: 'Second Ad Account',
                status: 'ACTIVE',
                roles: [],
              },
            ],
          },
        ];

        getUserInfoSpy.mockResolvedValue({
          id: 'snap-user-1',
          email: 'agency@snap.com',
          name: 'Snap Admin',
          organizations,
          adAccountCount: 2,
          role: 'ORGANIZATION_ADMIN',
          discoveryFailed: false,
          orgStatus: 'SUCCESS',
        } as any);

        const response = await app.inject({
          method: 'GET',
          url: '/agency-platforms/snapchat/callback?code=snap-auth-code&state=snap-state-token-123',
        });

        expect(response.statusCode).toBe(302);
        expect(response.headers.location).toBe(
          'https://app.example.com/settings/platforms?success=true&platform=snapchat&connectionId=conn-snap-1&agencyId=agency-1'
        );

        expect(exchangeCodeSpy).toHaveBeenCalledWith('snap-auth-code');
        expect(getUserInfoSpy).toHaveBeenCalledWith('snap-access-token');

        expect(agencyPlatformService.createConnection).toHaveBeenCalledWith(
          expect.objectContaining({
            agencyId: 'agency-1',
            platform: 'snapchat',
            accessToken: mockTokens.accessToken,
            refreshToken: mockTokens.refreshToken,
            expiresAt: mockTokens.expiresAt,
            connectedBy: 'admin@agency.com',
            metadata: expect.objectContaining({
              tokenType: 'Bearer',
              snapchatOrganizations: {
                organizations,
                adAccountCount: 2,
                role: 'ORGANIZATION_ADMIN',
                discoveryFailed: false,
                orgStatus: 'SUCCESS',
              },
            }),
          })
        );
      });

      it('records discoveryFailed metadata when Snapchat organization discovery fails', async () => {
        mockSuccessfulCallbackPrerequisites();

        getUserInfoSpy.mockResolvedValue({
          id: 'snap-user-1',
          organizations: [],
          adAccountCount: 0,
          discoveryFailed: true,
        } as any);

        const response = await app.inject({
          method: 'GET',
          url: '/agency-platforms/snapchat/callback?code=snap-auth-code&state=snap-state-token-123',
        });

        expect(response.statusCode).toBe(302);
        expect(response.headers.location).toContain('success=true');
        expect(agencyPlatformService.createConnection).toHaveBeenCalledWith(
          expect.objectContaining({
            platform: 'snapchat',
            metadata: expect.objectContaining({
              snapchatOrganizations: {
                organizations: [],
                adAccountCount: 0,
                discoveryFailed: true,
              },
            }),
          })
        );
      });

      it('still creates the connection when Snapchat identity lookup throws', async () => {
        mockSuccessfulCallbackPrerequisites();

        getUserInfoSpy.mockRejectedValue(
          new ConnectorError('snapchat', 'USER_INFO_FAILED', 'Snapchat user info request failed')
        );

        const response = await app.inject({
          method: 'GET',
          url: '/agency-platforms/snapchat/callback?code=snap-auth-code&state=snap-state-token-123',
        });

        expect(response.statusCode).toBe(302);
        expect(response.headers.location).toContain('success=true');
        expect(agencyPlatformService.createConnection).toHaveBeenCalledTimes(1);
        expect(agencyPlatformService.createConnection).toHaveBeenCalledWith(
          expect.objectContaining({
            platform: 'snapchat',
            metadata: expect.objectContaining({
              snapchatOrganizations: {
                organizations: [],
                adAccountCount: 0,
                discoveryFailed: true,
              },
            }),
          })
        );
      });

      it('blocks the callback and creates no connection when agency resolution fails', async () => {
        vi.mocked(oauthStateService.validateState).mockResolvedValue({
          data: mockStateData,
          error: null,
        });
        vi.mocked(agencyResolutionService.getOrCreateAgency).mockResolvedValueOnce({
          data: null,
          error: {
            code: 'AGENCY_RESOLUTION_FAILED',
            message: 'Agency resolution failed',
          },
        } as any);

        const response = await app.inject({
          method: 'GET',
          url: '/agency-platforms/snapchat/callback?code=snap-auth-code&state=snap-state-token-123',
        });

        expect(response.statusCode).toBe(302);
        expect(response.headers.location).toContain('error=AGENCY_RESOLUTION_FAILED');
        expect(exchangeCodeSpy).not.toHaveBeenCalled();
        expect(agencyPlatformService.createConnection).not.toHaveBeenCalled();
      });
    });
  });

  describe('DELETE /agency-platforms/:platform', () => {
    it('should revoke platform connection', async () => {
      const mockConnection = {
        id: 'conn-1',
        status: 'revoked',
        revokedAt: new Date().toISOString(), // Use ISO string to match JSON serialization
      };

      vi.mocked(agencyPlatformService.revokeConnection).mockResolvedValue({
        data: mockConnection as any,
        error: null,
      });

      const response = await app.inject({
        method: 'DELETE',
        url: '/agency-platforms/meta',
        payload: {
          agencyId: 'agency-1',
          revokedBy: 'admin@agency.com',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: mockConnection,
        error: null,
      });

      expect(agencyPlatformService.revokeConnection).toHaveBeenCalledWith(
        'agency-1',
        'meta',
        'admin@agency.com'
      );
    });

    it('should return 404 if connection not found', async () => {
      vi.mocked(agencyPlatformService.revokeConnection).mockResolvedValue({
        data: null,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Connection not found',
        },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: '/agency-platforms/meta',
        payload: {
          agencyId: 'agency-1',
          revokedBy: 'admin@agency.com',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /agency-platforms/:platform/refresh', () => {
    it('should refresh platform tokens', async () => {
      const mockConnection = {
        id: 'conn-1',
        lastRefreshedAt: new Date().toISOString(),
      };

      const mockNewTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      };

      // Mock getConnection - checked first in route
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: { id: 'conn-1', platform: 'meta' } as any,
        error: null,
      });

      // Mock getValidToken - called to get current token
      vi.mocked(agencyPlatformService.getValidToken).mockResolvedValue({
        data: 'current-access-token',
        error: null,
      });

      // Mock connector's getLongLivedToken
      mockMetaConnectorInstance.getLongLivedToken.mockResolvedValue(mockNewTokens as any);

      // Mock refreshConnection - called to update connection
      vi.mocked(agencyPlatformService.refreshConnection).mockResolvedValue({
        data: mockConnection as any,
        error: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/agency-platforms/meta/refresh',
        payload: {
          agencyId: 'agency-1',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: mockConnection,
        error: null,
      });
    });

    it('should return 404 if connection not found', async () => {
      // Mock getConnection to return error - this is checked first in the route
      vi.mocked(agencyPlatformService.getConnection).mockResolvedValue({
        data: null,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Connection not found',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/agency-platforms/meta/refresh',
        payload: {
          agencyId: 'agency-1',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /agency-platforms/meta/complete-oauth', () => {
    it('should return a sanitized connection payload without secretId', async () => {
      vi.mocked(metaAssetsService.saveBusinessPortfolio).mockResolvedValue({
        data: { success: true },
        error: null,
      } as any);

      vi.mocked(prisma.agencyPlatformConnection.findUnique).mockResolvedValue({
        id: 'conn-1',
        agencyId: 'agency-1',
        platform: 'meta',
        status: 'active',
        secretId: 'meta_secret_agency_1',
      } as any);
      vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue({
        id: 'conn-1',
        agencyId: 'agency-1',
        platform: 'meta',
        status: 'active',
        secretId: 'meta_secret_agency_1',
      } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/agency-platforms/meta/complete-oauth',
        payload: {
          agencyId: 'agency-1',
          businessId: 'biz-123',
          businessName: 'My Business',
          connectionId: 'conn-1',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.id).toBe('conn-1');
      expect(response.json().data.secretId).toBeUndefined();
    });
  });

  describe('PATCH /agency-platforms/meta/business', () => {
    it('should save selected business portfolio', async () => {
      vi.mocked(metaAssetsService.saveBusinessPortfolio).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/agency-platforms/meta/business',
        payload: {
          agencyId: 'agency-1',
          businessId: 'biz-123',
          businessName: 'My Business',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(metaAssetsService.saveBusinessPortfolio).toHaveBeenCalledWith(
        'agency-1',
        'biz-123',
        'My Business'
      );
    });

    it('should return 400 if businessId is missing', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/agency-platforms/meta/business',
        payload: {
          agencyId: 'agency-1',
          businessName: 'My Business',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /agency-platforms/meta/asset-settings', () => {
    it('should save asset settings', async () => {
      const settings = {
        adAccount: { enabled: true, permissionLevel: 'advertise' },
        page: { enabled: true, permissionLevel: 'analyze' },
        catalog: { enabled: false, permissionLevel: 'analyze' },
        dataset: { enabled: true, requestFullAccess: false },
        instagramAccount: { enabled: true, requestFullAccess: true }
      };

      vi.mocked(metaAssetsService.saveAssetSettings).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/agency-platforms/meta/asset-settings',
        payload: {
          agencyId: 'agency-1',
          settings,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(metaAssetsService.saveAssetSettings).toHaveBeenCalledWith('agency-1', settings);
    });
  });

  describe('GET /agency-platforms/meta/asset-settings', () => {
    it('should return current asset settings', async () => {
      const mockSettings = {
        adAccount: { enabled: true, permissionLevel: 'analyze' },
      };

      vi.mocked(metaAssetsService.getAssetSettings).mockResolvedValue({
        data: mockSettings as any,
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms/meta/asset-settings?agencyId=agency-1',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(mockSettings);
    });
  });

  describe('GET /agency-platforms/google/asset-settings', () => {
    it('should return current Google asset settings', async () => {
      const mockSettings = {
        googleAdsManagement: {
          preferredGrantMode: 'user_invite',
          inviteEmail: 'jon.highmu@gmail.com',
        },
        googleAds: { enabled: true, requestManageUsers: false },
        googleAnalytics: { enabled: true, requestManageUsers: false },
        googleBusinessProfile: { enabled: false, requestManageUsers: false },
        googleTagManager: { enabled: false, requestManageUsers: false },
        googleSearchConsole: { enabled: false, requestManageUsers: false },
        googleMerchantCenter: { enabled: false, requestManageUsers: false },
      };

      vi.mocked(googleAssetsService.getAssetSettings).mockResolvedValue({
        data: mockSettings as any,
        error: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/agency-platforms/google/asset-settings?agencyId=agency-1',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual(mockSettings);
    });
  });

  describe('PATCH /agency-platforms/google/asset-settings', () => {
    it('should return 400 for invalid MCC settings', async () => {
      vi.mocked(googleAssetsService.saveAssetSettings).mockResolvedValue({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Select an eligible Google Ads manager account before defaulting to MCC linking.',
        },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/agency-platforms/google/asset-settings',
        payload: {
          agencyId: 'agency-1',
          settings: {
            googleAdsManagement: {
              preferredGrantMode: 'manager_link',
              managerCustomerId: '549-755-9774',
            },
            googleAds: { enabled: true, requestManageUsers: false },
            googleAnalytics: { enabled: true, requestManageUsers: false },
            googleBusinessProfile: { enabled: false, requestManageUsers: false },
            googleTagManager: { enabled: false, requestManageUsers: false },
            googleSearchConsole: { enabled: false, requestManageUsers: false },
            googleMerchantCenter: { enabled: false, requestManageUsers: false },
          },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Select an eligible Google Ads manager account before defaulting to MCC linking.',
        },
      });
    });
  });
});
