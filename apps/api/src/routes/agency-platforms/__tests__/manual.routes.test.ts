import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerManualRoutes } from '../manual.routes.js';
import { CacheKeys, deleteCache, invalidateDashboardCache } from '@/lib/cache';
import { prisma } from '@/lib/prisma';
import { agencyResolutionService } from '@/services/agency-resolution.service';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agencyPlatformConnection: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/services/agency-resolution.service', () => ({
  agencyResolutionService: {
    resolveAgency: vi.fn(),
  },
}));

vi.mock('@/lib/authorization', () => ({
  assertAgencyAccess: vi.fn(() => null),
}));

vi.mock('@/lib/cache', () => ({
  CacheKeys: {
    agencyConnections: (agencyId: string) => `agency:${agencyId}:connections`,
  },
  deleteCache: vi.fn(async () => true),
  invalidateDashboardCache: vi.fn(async () => {}),
}));

describe('Manual Agency Platform Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.addHook('preHandler', async (request) => {
      (request as any).principalAgencyId = 'agency-1';
    });
    await app.register(registerManualRoutes);
  });

  afterEach(async () => {
    await app.close();
  });

  it('invalidates platform caches after manual connect succeeds', async () => {
    vi.mocked(agencyResolutionService.resolveAgency).mockResolvedValue({
      data: { agencyId: 'agency-1' },
      error: null,
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.agencyPlatformConnection.create).mockResolvedValue({
      id: 'conn-1',
      platform: 'beehiiv',
      agencyEmail: 'ops@agency.com',
      status: 'active',
      connectedAt: new Date(),
    } as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/agency-platforms/beehiiv/manual-connect',
      payload: {
        agencyId: 'agency-1',
        invitationEmail: 'ops@agency.com',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(deleteCache).toHaveBeenCalledWith(CacheKeys.agencyConnections('agency-1'));
    expect(invalidateDashboardCache).toHaveBeenCalledWith('agency-1');
  });

  it('invalidates platform caches after manual invitation update succeeds', async () => {
    vi.mocked(agencyResolutionService.resolveAgency).mockResolvedValue({
      data: { agencyId: 'agency-1' },
      error: null,
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue({
      id: 'conn-1',
      agencyId: 'agency-1',
      platform: 'beehiiv',
      agencyEmail: 'old@agency.com',
      metadata: {},
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.update).mockResolvedValue({
      id: 'conn-1',
      platform: 'beehiiv',
      agencyEmail: 'new@agency.com',
      status: 'active',
      connectedAt: new Date(),
    } as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'PATCH',
      url: '/agency-platforms/beehiiv/manual-invitation',
      payload: {
        agencyId: 'agency-1',
        invitationEmail: 'new@agency.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(deleteCache).toHaveBeenCalledWith(CacheKeys.agencyConnections('agency-1'));
    expect(invalidateDashboardCache).toHaveBeenCalledWith('agency-1');
  });

  it('rejects Snapchat manual connect because Snapchat is an OAuth platform', async () => {
    vi.mocked(agencyResolutionService.resolveAgency).mockResolvedValue({
      data: { agencyId: 'agency-1' },
      error: null,
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.agencyPlatformConnection.create).mockResolvedValue({} as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/agency-platforms/snapchat/manual-connect',
      payload: {
        agencyId: 'agency-1',
        invitationEmail: 'Snap@Agency.com',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('UNSUPPORTED_PLATFORM');
    expect(prisma.agencyPlatformConnection.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('creates Shopify manual connection as enablement only', async () => {
    vi.mocked(agencyResolutionService.resolveAgency).mockResolvedValue({
      data: { agencyId: 'agency-1' },
      error: null,
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue(null as any);
    vi.mocked(prisma.agencyPlatformConnection.create).mockResolvedValue({
      id: 'conn-shopify-1',
      platform: 'shopify',
      agencyEmail: null,
      status: 'active',
      connectedAt: new Date(),
    } as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/agency-platforms/shopify/manual-connect',
      payload: {
        agencyId: 'agency-1',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(prisma.agencyPlatformConnection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platform: 'shopify',
          metadata: expect.objectContaining({
            authMethod: 'manual_collaborator_request',
          }),
        }),
      })
    );
  });

  it('rejects Shopify detail updates via manual invitation endpoint', async () => {
    vi.mocked(agencyResolutionService.resolveAgency).mockResolvedValue({
      data: { agencyId: 'agency-1' },
      error: null,
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.findFirst).mockResolvedValue({
      id: 'conn-shopify-1',
      agencyId: 'agency-1',
      platform: 'shopify',
      agencyEmail: null,
      metadata: {
        shopDomain: 'old-shop.myshopify.com',
        collaboratorCode: '1111',
      },
    } as any);
    vi.mocked(prisma.agencyPlatformConnection.update).mockResolvedValue({
      id: 'conn-shopify-1',
      platform: 'shopify',
      agencyEmail: null,
      status: 'active',
      connectedAt: new Date(),
    } as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'PATCH',
      url: '/agency-platforms/shopify/manual-invitation',
      payload: {
        agencyId: 'agency-1',
        shopDomain: 'new-shop.myshopify.com',
        collaboratorCode: '5678',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('UNSUPPORTED_OPERATION');
    expect(prisma.agencyPlatformConnection.update).not.toHaveBeenCalled();
  });
});
