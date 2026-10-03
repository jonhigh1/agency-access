import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';
import { registerManualRoutes } from '../manual.routes.js';
import { accessRequestService } from '@/services/access-request.service';
import { auditService } from '@/services/audit.service';
import { prisma } from '@/lib/prisma';

vi.mock('@/services/access-request.service', () => ({
  accessRequestService: {
    getAccessRequestByToken: vi.fn(),
  },
}));

vi.mock('@/services/audit.service', () => ({
  auditService: {
    createAuditLog: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    clientConnection: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

function hashCollaboratorCode(code: string): string {
  return createHash('sha256')
    .update(`shopify-collaborator-code:${code}`)
    .digest('hex');
}

describe('Client Auth Manual Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
    app = Fastify();
    await registerManualRoutes(app);
  });

  afterEach(async () => {
    await app.close();
  });

  it('normalizes Shopify shop domain and stores collaborator code hash only', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        platforms: [{ platform: 'shopify', accessLevel: 'manage' }],
      } as any,
      error: null,
    });
    vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.clientConnection.create).mockResolvedValue({
      id: 'conn-1',
      status: 'pending_verification',
    } as any);
    vi.mocked(auditService.createAuditLog).mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/shopify/manual-connect',
      payload: {
        platform: 'shopify',
        shopDomain: 'HTTPS://Store-Example.MyShopify.com/',
        collaboratorCode: '1234',
      },
    });

    expect(response.statusCode).toBe(200);

    expect(prisma.clientConnection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          grantedAssets: expect.objectContaining({
            shopify: expect.objectContaining({
              platform: 'shopify',
              shopDomain: 'store-example.myshopify.com',
              collaboratorCodeHash: hashCollaboratorCode('1234'),
            }),
          }),
        }),
      })
    );

    const createCall = vi.mocked(prisma.clientConnection.create).mock.calls[0]?.[0] as any;
    expect(createCall?.data?.grantedAssets?.shopify?.collaboratorCode).toBe('1234');

    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          shopDomain: 'store-example.myshopify.com',
          collaboratorCodeHash: hashCollaboratorCode('1234'),
        }),
      })
    );

    const auditCall = vi.mocked(auditService.createAuditLog).mock.calls[0]?.[0] as any;
    expect(auditCall?.metadata?.collaboratorCode).toBeUndefined();

    const body = response.json() as any;
    expect(body?.data?.shopDomain).toBe('store-example.myshopify.com');
    expect(body?.data?.collaboratorCode).toBeUndefined();
  });

  it('does not include the invite bearer in manual connection error logs', async () => {
    const rawInviteToken = 'invite-bearer-secret';
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        platforms: [{ platform: 'beehiiv', accessLevel: 'manage' }],
      } as any,
      error: null,
    });
    vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.clientConnection.create).mockRejectedValue(new Error('database write failed'));
    const errorLog = vi.spyOn(app.log, 'error');

    const response = await app.inject({
      method: 'POST',
      url: `/client/${rawInviteToken}/beehiiv/manual-connect`,
      payload: { platform: 'beehiiv', agencyEmail: 'ops@example.com' },
    });

    expect(response.statusCode).toBe(500);
    expect(errorLog).toHaveBeenCalled();
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(rawInviteToken);
  });

  it('updates an existing Shopify submission for the same access request instead of creating a new connection', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        platforms: [{ platform: 'shopify', accessLevel: 'manage' }],
      } as any,
      error: null,
    });
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: 'conn-existing', status: 'pending_verification' }] as never);
    vi.mocked(auditService.createAuditLog).mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/shopify/manual-connect',
      payload: {
        platform: 'shopify',
        shopDomain: 'https://new-store.myshopify.com/',
        collaboratorCode: '9876',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.clientConnection.create).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  for (const { platform, agencyEmail } of [
    { platform: 'beehiiv', agencyEmail: 'ops@agency.com' },
    { platform: 'kit', agencyEmail: 'ops@agency.com' },
    { platform: 'mailchimp', agencyEmail: 'ops@agency.com' },
    { platform: 'klaviyo', agencyEmail: 'ops@agency.com' },
  ] as const) {
    it(`reuses an existing client connection for ${platform} manual connect instead of creating a duplicate row`, async () => {
      vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
        data: {
          id: 'request-1',
          agencyId: 'agency-1',
          clientEmail: 'client@example.com',
          platforms: [{ platform, accessLevel: 'manage' }],
        } as any,
        error: null,
      });
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: 'conn-existing', status: 'pending_verification' }] as never);
      vi.mocked(auditService.createAuditLog).mockResolvedValue({} as any);

      const response = await app.inject({
        method: 'POST',
        url: `/client/token-1/${platform}/manual-connect`,
        payload: {
          platform,
          agencyEmail,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(prisma.clientConnection.create).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  }

  it('reuses an existing client connection for Pinterest manual connect instead of creating a duplicate row', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        platforms: [{ platform: 'pinterest', accessLevel: 'manage' }],
      } as any,
      error: null,
    });
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: 'conn-existing', status: 'pending_verification' }] as never);
    vi.mocked(auditService.createAuditLog).mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/pinterest/manual-connect',
      payload: {
        platform: 'pinterest',
        businessId: '123456789',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.clientConnection.create).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('creates Mailchimp manual connection with pending verification status', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        platforms: [{ platform: 'mailchimp', accessLevel: 'manage' }],
      } as any,
      error: null,
    });
    vi.mocked(prisma.clientConnection.create).mockResolvedValue({
      id: 'conn-mailchimp-1',
      status: 'pending_verification',
    } as any);
    vi.mocked(auditService.createAuditLog).mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/mailchimp/manual-connect',
      payload: {
        platform: 'mailchimp',
        agencyEmail: 'ops@agency.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.clientConnection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'pending_verification',
          grantedAssets: expect.objectContaining({
            mailchimp: expect.objectContaining({
              platform: 'mailchimp',
              agencyEmail: 'ops@agency.com',
              authMethod: 'manual_team_invitation',
            }),
          }),
        }),
      })
    );
  });

  it('creates Klaviyo manual connection with pending verification status', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        platforms: [{ platform: 'klaviyo', accessLevel: 'manage' }],
      } as any,
      error: null,
    });
    vi.mocked(prisma.clientConnection.create).mockResolvedValue({
      id: 'conn-klaviyo-1',
      status: 'pending_verification',
    } as any);
    vi.mocked(auditService.createAuditLog).mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/klaviyo/manual-connect',
      payload: {
        platform: 'klaviyo',
        agencyEmail: 'ops@agency.com',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.clientConnection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'pending_verification',
          grantedAssets: expect.objectContaining({
            klaviyo: expect.objectContaining({
              platform: 'klaviyo',
              agencyEmail: 'ops@agency.com',
              authMethod: 'manual_team_invitation',
            }),
          }),
        }),
      })
    );
  });

  it('rejects a manual platform that the invite did not request', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        platforms: [{ platform: 'beehiiv', accessLevel: 'manage' }],
      } as any,
      error: null,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/zapier/manual-connect',
      payload: { platform: 'zapier', agencyEmail: 'ops@agency.com' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      data: null,
      error: {
        code: 'PLATFORM_NOT_REQUESTED',
        message: 'Platform was not requested in this access request',
      },
    });
    expect(prisma.clientConnection.create).not.toHaveBeenCalled();
  });

  it('keeps prior manual platform records when another manual platform is submitted', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        platforms: [{ platform: 'beehiiv', accessLevel: 'manage' }, { platform: 'zapier', accessLevel: 'manage' }],
      } as any,
      error: null,
    });
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: 'conn-existing', status: 'pending_verification' }] as never);
    vi.mocked(auditService.createAuditLog).mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/zapier/manual-connect',
      payload: { platform: 'zapier', agencyEmail: 'ops@agency.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('creates a Zapier manual connection with pending verification status', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        platforms: [{ platform: 'zapier', accessLevel: 'manage' }],
      } as any,
      error: null,
    });
    vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.clientConnection.create).mockResolvedValue({
      id: 'conn-zapier-1',
      status: 'pending_verification',
    } as any);
    vi.mocked(auditService.createAuditLog).mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/zapier/manual-connect',
      payload: { platform: 'zapier', agencyEmail: 'ops@agency.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.clientConnection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'pending_verification',
          grantedAssets: expect.objectContaining({
            zapier: expect.objectContaining({ platform: 'zapier', agencyEmail: 'ops@agency.com' }),
          }),
        }),
      })
    );
  });

  it('keeps an active sibling authorization active while recording a pending manual platform', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
        platforms: [{ platform: 'beehiiv', accessLevel: 'manage' }, { platform: 'zapier', accessLevel: 'manage' }],
      } as any,
      error: null,
    });
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: 'conn-active', status: 'active' }] as never);
    vi.mocked(auditService.createAuditLog).mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/client/token-1/zapier/manual-connect',
      payload: { platform: 'zapier', agencyEmail: 'ops@agency.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
