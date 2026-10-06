/**
 * OAuth platform gate.
 *
 * Klaviyo, Mailchimp, and Pinterest are manual-invitation platforms
 * (PLATFORM_TOKEN_CAPABILITIES classifies them manual). The client OAuth
 * endpoints must reject them at schema validation so no OAuth flow can start
 * for a platform whose credentials no longer exist.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerOAuthStateRoutes } from '../oauth-state.routes.js';
import { registerOAuthExchangeRoutes } from '../oauth-exchange.routes.js';
import { oauthStateService } from '@/services/oauth-state.service';
import { auditService } from '@/services/audit.service';
import { getConnector } from '@/services/connectors/factory';
import { infisical } from '@/lib/infisical';
import { prisma } from '@/lib/prisma';
import { accessRequestService } from '@/services/access-request.service';

vi.mock('@/services/access-request.service', () => ({
  accessRequestService: {
    getAccessRequestByToken: vi.fn(),
    markRequestAuthorized: vi.fn().mockResolvedValue({ data: {}, error: null }),
    setAccessRequestLifecycleStatus: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
}));

vi.mock('@/services/oauth-state.service', () => ({
  oauthStateService: {
    createState: vi.fn(),
    validateState: vi.fn(),
  },
}));

vi.mock('@/services/audit.service', () => ({
  auditService: { createAuditLog: vi.fn() },
}));

vi.mock('@/services/connectors/factory', () => ({
  getConnector: vi.fn(),
}));

vi.mock('@/lib/infisical', () => ({
  infisical: {
    generateSecretName: vi.fn(() => 'secret/agency-access/test-platform/conn-1'),
    storeOAuthTokens: vi.fn(),
    deleteOAuthTokens: vi.fn(),
    deleteSecret: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    accessRequest: { findUnique: vi.fn() },
    clientConnection: { findFirst: vi.fn(), create: vi.fn() },
    platformAuthorization: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    metaAssetGrant: { updateMany: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/env', () => ({
  env: { FRONTEND_URL: 'http://localhost:3000' },
}));

const GATED_PLATFORMS = ['mailchimp', 'pinterest', 'klaviyo'] as const;

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(registerOAuthStateRoutes);
  await app.register(registerOAuthExchangeRoutes);
  await app.ready();
  return app;
}

describe('client OAuth platform gate', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'req-1',
        agencyId: 'agency-1',
        uniqueToken: 'unique-token-1',
        status: 'active',
        platforms: [],
      },
      error: null,
    } as any);
    app = await buildApp();
  });

  it.each(GATED_PLATFORMS)(
    'rejects OAuth state creation for manual platform %s',
    async (platform) => {
      const res = await app.inject({
        method: 'POST',
        url: '/client/token-123/oauth-state',
        payload: { platform },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error?.code).toBe('VALIDATION_ERROR');
      expect(oauthStateService.createState).not.toHaveBeenCalled();
      expect(getConnector).not.toHaveBeenCalled();
    },
  );

  it.each(GATED_PLATFORMS)(
    'rejects OAuth exchange for manual platform %s',
    async (platform) => {
      const res = await app.inject({
        method: 'POST',
        url: '/client/token-123/oauth-exchange',
        payload: { code: 'code-1', state: 'state-1', platform },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error?.code).toBe('VALIDATION_ERROR');
      expect(oauthStateService.validateState).not.toHaveBeenCalled();
      expect(getConnector).not.toHaveBeenCalled();
    },
  );
});
