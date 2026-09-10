import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { clientAuthRoutes } from '../client-auth.js';
import * as accessRequestService from '@/services/access-request.service';
import { oauthStateService } from '@/services/oauth-state.service';
import { getConnector } from '@/services/connectors/factory';
import { snapchatConnector } from '@/services/connectors/snapchat';
import { env } from '@/lib/env';

// Mock services
vi.mock('@/services/access-request.service');
vi.mock('@/services/oauth-state.service');
vi.mock('@/services/connectors/factory');

// Mock env
vi.mock('@/lib/env', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:3000',
    API_URL: 'http://localhost:3001',
    CORS_ALLOWED_ORIGINS: ['https://app.agencyaccess.example'],
    META_APP_ID: 'test-app-id',
    META_APP_SECRET: 'test-app-secret',
    REDIS_URL: 'redis://localhost:6379',
    LOG_LEVEL: 'silent',
  },
}));

describe('Client Auth Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(clientAuthRoutes);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /client/:token/oauth-url', () => {
    it('should generate an OAuth URL for a valid access request', async () => {
      const mockToken = 'test-token';
      const mockPlatform = 'meta_ads';
      const mockState = 'test-state';
      const mockAuthUrl = 'https://facebook.com/oauth?state=test-state';

      const mockAccessRequest = {
        id: 'req-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
      };

      vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
        data: mockAccessRequest as any,
        error: null,
      });

      vi.mocked(oauthStateService.createState).mockResolvedValue({
        data: mockState,
        error: null,
      });

      const mockConnector = {
        getAuthUrl: vi.fn().mockReturnValue(mockAuthUrl),
      };
      vi.mocked(getConnector).mockReturnValue(mockConnector as any);

      const response = await app.inject({
        method: 'POST',
        url: `/client/${mockToken}/oauth-url`,
        payload: { platform: mockPlatform },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.authUrl).toBe(mockAuthUrl);
      expect(json.data.state).toBe(mockState);

      // Verify connector was called with the correct redirectUri
      expect(mockConnector.getAuthUrl).toHaveBeenCalledWith(
        mockState,
        [
          'ads_management',
          'ads_read',
          'business_management',
          'pages_read_engagement',
        ],
        'http://localhost:3000/invite/oauth-callback'
      );
    });

    it('uses the request origin for the client callback when it is an allowed frontend origin', async () => {
      const mockToken = 'test-token';
      const mockState = 'test-state';
      const mockAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?state=test-state';

      vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
        data: {
          id: 'req-1',
          agencyId: 'agency-1',
          clientEmail: 'client@example.com',
          platforms: [
            {
              platformGroup: 'google',
              products: [{ product: 'google_ads', accessLevel: 'admin' }],
            },
          ],
        } as any,
        error: null,
      });

      vi.mocked(oauthStateService.createState).mockResolvedValue({
        data: mockState,
        error: null,
      });

      const mockConnector = {
        getAuthUrl: vi.fn().mockReturnValue(mockAuthUrl),
      };
      vi.mocked(getConnector).mockReturnValue(mockConnector as any);

      const response = await app.inject({
        method: 'POST',
        url: `/client/${mockToken}/oauth-url`,
        headers: {
          origin: 'https://app.agencyaccess.example',
        },
        payload: { platform: 'google' },
      });

      expect(response.statusCode).toBe(200);
      expect(oauthStateService.createState).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectUrl: 'https://app.agencyaccess.example/invite/oauth-callback',
        })
      );
      expect(mockConnector.getAuthUrl).toHaveBeenCalledWith(
        mockState,
        ['https://www.googleapis.com/auth/adwords', 'https://www.googleapis.com/auth/userinfo.email'],
        'https://app.agencyaccess.example/invite/oauth-callback'
      );
    });

    it('adds GA4 management scopes for native Google Analytics access requests', async () => {
      const mockToken = 'test-token';
      const mockState = 'test-state';
      const mockAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?state=test-state';

      vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
        data: {
          id: 'req-1',
          agencyId: 'agency-1',
          clientEmail: 'client@example.com',
          platforms: [
            {
              platformGroup: 'google',
              products: [{ product: 'ga4', accessLevel: 'admin' }],
            },
          ],
        } as any,
        error: null,
      });

      vi.mocked(oauthStateService.createState).mockResolvedValue({
        data: mockState,
        error: null,
      });

      const mockConnector = {
        getAuthUrl: vi.fn().mockReturnValue(mockAuthUrl),
      };
      vi.mocked(getConnector).mockReturnValue(mockConnector as any);

      const response = await app.inject({
        method: 'POST',
        url: `/client/${mockToken}/oauth-url`,
        payload: { platform: 'google' },
      });

      expect(response.statusCode).toBe(200);
      expect(mockConnector.getAuthUrl).toHaveBeenCalledWith(
        mockState,
        [
          'https://www.googleapis.com/auth/analytics.readonly',
          'https://www.googleapis.com/auth/analytics.manage.users',
          'https://www.googleapis.com/auth/userinfo.email',
        ],
        'http://localhost:3000/invite/oauth-callback'
      );
    });

    it('keeps Search Console requests discovery-only instead of widening to management scopes', async () => {
      const mockToken = 'test-token';
      const mockState = 'test-state';
      const mockAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?state=test-state';

      vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
        data: {
          id: 'req-1',
          agencyId: 'agency-1',
          clientEmail: 'client@example.com',
          platforms: [
            {
              platformGroup: 'google',
              products: [{ product: 'google_search_console', accessLevel: 'admin' }],
            },
          ],
        } as any,
        error: null,
      });

      vi.mocked(oauthStateService.createState).mockResolvedValue({
        data: mockState,
        error: null,
      });

      const mockConnector = {
        getAuthUrl: vi.fn().mockReturnValue(mockAuthUrl),
      };
      vi.mocked(getConnector).mockReturnValue(mockConnector as any);

      const response = await app.inject({
        method: 'POST',
        url: `/client/${mockToken}/oauth-url`,
        payload: { platform: 'google' },
      });

      expect(response.statusCode).toBe(200);
      expect(mockConnector.getAuthUrl).toHaveBeenCalledWith(
        mockState,
        ['https://www.googleapis.com/auth/webmasters', 'https://www.googleapis.com/auth/userinfo.email'],
        'http://localhost:3000/invite/oauth-callback'
      );
    });

    it('adds LinkedIn page admin scopes for linkedin_pages requests', async () => {
      const mockToken = 'test-token';
      const mockState = 'test-state';
      const mockAuthUrl = 'https://www.linkedin.com/oauth/v2/authorization?state=test-state';

      vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
        data: {
          id: 'req-1',
          agencyId: 'agency-1',
          clientEmail: 'client@example.com',
          platforms: [
            {
              platformGroup: 'linkedin',
              products: [{ product: 'linkedin_pages', accessLevel: 'admin' }],
            },
          ],
        } as any,
        error: null,
      });

      vi.mocked(oauthStateService.createState).mockResolvedValue({
        data: mockState,
        error: null,
      });

      const mockConnector = {
        getAuthUrl: vi.fn().mockReturnValue(mockAuthUrl),
      };
      vi.mocked(getConnector).mockReturnValue(mockConnector as any);

      const response = await app.inject({
        method: 'POST',
        url: `/client/${mockToken}/oauth-url`,
        payload: { platform: 'linkedin' },
      });

      expect(response.statusCode).toBe(200);
      expect(mockConnector.getAuthUrl).toHaveBeenCalledWith(
        mockState,
        ['openid', 'profile', 'email', 'rw_organization_admin'],
        'http://localhost:3000/invite/oauth-callback'
      );
    });

    it('unions LinkedIn ads and page scopes without widening ads-only requests', async () => {
      const mockToken = 'test-token';
      const mockState = 'test-state';
      const mockAuthUrl = 'https://www.linkedin.com/oauth/v2/authorization?state=test-state';

      vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
        data: {
          id: 'req-1',
          agencyId: 'agency-1',
          clientEmail: 'client@example.com',
          platforms: [
            {
              platformGroup: 'linkedin',
              products: [
                { product: 'linkedin_ads', accessLevel: 'admin' },
                { product: 'linkedin_pages', accessLevel: 'admin' },
              ],
            },
          ],
        } as any,
        error: null,
      });

      vi.mocked(oauthStateService.createState).mockResolvedValue({
        data: mockState,
        error: null,
      });

      const mockConnector = {
        getAuthUrl: vi.fn().mockReturnValue(mockAuthUrl),
      };
      vi.mocked(getConnector).mockReturnValue(mockConnector as any);

      const response = await app.inject({
        method: 'POST',
        url: `/client/${mockToken}/oauth-url`,
        payload: { platform: 'linkedin' },
      });

      expect(response.statusCode).toBe(200);
      expect(mockConnector.getAuthUrl).toHaveBeenCalledWith(
        mockState,
        ['openid', 'profile', 'email', 'rw_ads', 'r_ads_reporting', 'rw_organization_admin'],
        'http://localhost:3000/invite/oauth-callback'
      );
    });

    it('should return 404 if access request is not found', async () => {
      vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Not found' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/client/invalid-token/oauth-url',
        payload: { platform: 'meta_ads' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 for invalid platform', async () => {
      const mockAccessRequest = {
        id: 'req-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
      };

      vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
        data: mockAccessRequest as any,
        error: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/client/test-token/oauth-url',
        payload: { platform: 'invalid_platform' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('generates a Snapchat OAuth URL against the client invite callback with the marketing scope', async () => {
      const mockToken = 'test-token';
      const mockState = 'snap-state';

      vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
        data: {
          id: 'req-1',
          agencyId: 'agency-1',
          clientEmail: 'client@example.com',
        } as any,
        error: null,
      });

      vi.mocked(oauthStateService.createState).mockResolvedValue({
        data: mockState,
        error: null,
      });

      // Real connector: proves the route's no-override scope handling falls
      // through to the registry defaultScopes for snapchat.
      vi.mocked(getConnector).mockReturnValue(snapchatConnector as any);

      const originalClientId = (env as any).SNAPCHAT_CLIENT_ID;
      (env as any).SNAPCHAT_CLIENT_ID = 'snap-client-id';

      try {
        const response = await app.inject({
          method: 'POST',
          url: `/client/${mockToken}/oauth-url`,
          payload: { platform: 'snapchat' },
        });

        expect(response.statusCode).toBe(200);

        const authUrl = new URL(response.json().data.authUrl);
        expect(`${authUrl.origin}${authUrl.pathname}`).toBe(
          'https://accounts.snapchat.com/login/oauth2/authorize'
        );
        expect(authUrl.searchParams.get('redirect_uri')).toBe(
          'http://localhost:3000/invite/oauth-callback'
        );
        expect(authUrl.searchParams.get('scope')).toBe('snapchat-marketing-api');
        expect(authUrl.searchParams.get('client_id')).toBe('snap-client-id');
        expect(authUrl.searchParams.get('state')).toBe(mockState);
        expect(authUrl.searchParams.get('response_type')).toBe('code');

        expect(oauthStateService.createState).toHaveBeenCalledWith(
          expect.objectContaining({
            platform: 'snapchat',
            accessRequestToken: mockToken,
            redirectUrl: 'http://localhost:3000/invite/oauth-callback',
          })
        );
      } finally {
        if (originalClientId === undefined) {
          delete (env as any).SNAPCHAT_CLIENT_ID;
        } else {
          (env as any).SNAPCHAT_CLIENT_ID = originalClientId;
        }
      }
    });

    it('maps missing Snapchat credentials to a CONNECTOR_ERROR naming SNAPCHAT_CLIENT_ID', async () => {
      vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
        data: {
          id: 'req-1',
          agencyId: 'agency-1',
          clientEmail: 'client@example.com',
        } as any,
        error: null,
      });

      vi.mocked(oauthStateService.createState).mockResolvedValue({
        data: 'snap-state',
        error: null,
      });

      vi.mocked(getConnector).mockReturnValue(snapchatConnector as any);

      const originalClientId = (env as any).SNAPCHAT_CLIENT_ID;
      delete (env as any).SNAPCHAT_CLIENT_ID;

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/client/test-token/oauth-url',
          payload: { platform: 'snapchat' },
        });

        // Documented client-route behavior: unlike the agency initiate route
        // (503 MISSING_CLIENT_ID), the client oauth-url route maps any
        // connector failure to 400 CONNECTOR_ERROR with the raw message.
        expect(response.statusCode).toBe(400);
        expect(response.json().error.code).toBe('CONNECTOR_ERROR');
        expect(response.json().error.message).toContain('SNAPCHAT_CLIENT_ID');
      } finally {
        if (originalClientId === undefined) {
          delete (env as any).SNAPCHAT_CLIENT_ID;
        } else {
          (env as any).SNAPCHAT_CLIENT_ID = originalClientId;
        }
      }
    });
  });

  describe('POST /client/:token/oauth-exchange', () => {
    it('should exchange code for tokens with the correct redirectUri', async () => {
      const mockToken = 'test-token';
      const mockCode = 'test-code';
      const mockState = 'test-state';
      const mockPlatform = 'meta_ads';

      const mockStateData = {
        accessRequestId: 'req-1',
        platform: mockPlatform,
        clientEmail: 'client@example.com',
      };

      vi.mocked(oauthStateService.validateState).mockResolvedValue({
        data: mockStateData as any,
        error: null,
      });

      const mockConnector = {
        exchangeCode: vi.fn().mockResolvedValue({
          accessToken: 'access-123',
          expiresAt: new Date(Date.now() + 3600000),
        }),
        getUserInfo: vi.fn().mockResolvedValue({ id: 'user-1', name: 'Test User' }),
      };
      vi.mocked(getConnector).mockReturnValue(mockConnector as any);

      // Need to mock prisma for this test to pass fully, but we're testing the redirectUri part
      // and it's easier to just mock the connector call for now if we want to be quick,
      // but let's try to mock enough to verify the logic.
      // Actually, since we're testing the route handler, we should mock all dependencies.
      
      // For this MVP test, we'll just verify the connector call
      const response = await app.inject({
        method: 'POST',
        url: `/client/${mockToken}/oauth-exchange`,
        payload: { code: mockCode, state: mockState, platform: mockPlatform },
      });

      // It might return 500 because prisma/infisical aren't mocked, 
      // but we can check if the connector was called correctly before it failed.
      expect(mockConnector.exchangeCode).toHaveBeenCalledWith(
        mockCode,
        'http://localhost:3000/invite/oauth-callback'
      );
    });

    it('reuses the stored client callback URL during OAuth exchange', async () => {
      const mockConnector = {
        exchangeCode: vi.fn().mockRejectedValue(new Error('stop after redirect check')),
      };
      vi.mocked(getConnector).mockReturnValue(mockConnector as any);
      vi.mocked(oauthStateService.validateState).mockResolvedValue({
        data: {
          accessRequestId: 'req-1',
          accessRequestToken: 'token-123',
          platform: 'google',
          clientEmail: 'client@example.com',
          redirectUrl: 'https://app.agencyaccess.example/invite/oauth-callback',
        } as any,
        error: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/client/test-token/oauth-exchange',
        payload: { code: 'oauth-code', state: 'oauth-state', platform: 'google' },
      });

      expect(mockConnector.exchangeCode).toHaveBeenCalledWith(
        'oauth-code',
        'https://app.agencyaccess.example/invite/oauth-callback'
      );
      expect(response.statusCode).toBe(500);
    });

    it('accepts snapchat in the OAuth exchange payload', async () => {
      vi.mocked(oauthStateService.validateState).mockResolvedValue({
        data: {
          accessRequestId: 'req-1',
          platform: 'snapchat',
          clientEmail: 'client@example.com',
        } as any,
        error: null,
      });

      const mockConnector = {
        exchangeCode: vi.fn().mockRejectedValue(new Error('stop after validation')),
      };
      vi.mocked(getConnector).mockReturnValue(mockConnector as any);

      const response = await app.inject({
        method: 'POST',
        url: '/client/test-token/oauth-exchange',
        payload: { code: 'test-code', state: 'test-state', platform: 'snapchat' },
      });

      // Platform validation passed: the request reached state validation and
      // the connector exchange stage with the client invite callback URI.
      expect(oauthStateService.validateState).toHaveBeenCalledWith('test-state');
      expect(mockConnector.exchangeCode).toHaveBeenCalledWith(
        'test-code',
        'http://localhost:3000/invite/oauth-callback'
      );
      expect(response.statusCode).not.toBe(400);
      expect(response.json().error.code).not.toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /client/:token/meta/finalize', () => {
    it('returns 400 for invalid payload (missing required fields)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/client/test-token/meta/finalize',
        payload: { state: 'stateless.xxx.yyy', accessToken: 'token' },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error?.code).toBe('VALIDATION_ERROR');
      expect(json.error?.message).toContain('Invalid Meta finalize payload');
    });

    it('returns 400 for invalid or expired OAuth state', async () => {
      vi.mocked(oauthStateService.validateState).mockResolvedValue({
        data: null,
        error: { code: 'INVALID_STATE', message: 'Invalid or expired' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/client/test-token/meta/finalize',
        payload: {
          state: 'stateless.invalid.signature',
          accessToken: 'fb-token-123',
          userId: 'fb-user-123',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error?.code).toBe('INVALID_STATE');
    });

    it('returns 400 when state platform is not meta or meta_ads', async () => {
      vi.mocked(oauthStateService.validateState).mockResolvedValue({
        data: {
          accessRequestId: 'req-1',
          platform: 'google',
          clientEmail: 'client@example.com',
        } as any,
        error: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/client/test-token/meta/finalize',
        payload: {
          state: 'stateless.valid.state',
          accessToken: 'fb-token-123',
          userId: 'fb-user-123',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error?.code).toBe('PLATFORM_MISMATCH');
      expect(response.json().error?.message).toContain('Meta finalize only supports meta or meta_ads');
    });
  });
});
