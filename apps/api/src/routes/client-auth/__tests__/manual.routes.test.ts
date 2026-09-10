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
            platform: 'shopify',
            shopDomain: 'store-example.myshopify.com',
            collaboratorCodeHash: hashCollaboratorCode('1234'),
          }),
        }),
      })
    );

    const createCall = vi.mocked(prisma.clientConnection.create).mock.calls[0]?.[0] as any;
    expect(createCall?.data?.grantedAssets?.collaboratorCode).toBe('1234');

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

  it('updates an existing Shopify submission for the same access request instead of creating a new connection', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
      } as any,
      error: null,
    });
    vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue({
      id: 'conn-existing',
      grantedAssets: {
        platform: 'shopify',
      },
    } as any);
    vi.mocked(prisma.clientConnection.update).mockResolvedValue({
      id: 'conn-existing',
      status: 'pending_verification',
    } as any);
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
    expect(prisma.clientConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conn-existing' },
        data: expect.objectContaining({
          grantedAssets: expect.objectContaining({
            platform: 'shopify',
            shopDomain: 'new-store.myshopify.com',
            collaboratorCodeHash: hashCollaboratorCode('9876'),
          }),
        }),
      })
    );
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
        } as any,
        error: null,
      });
      vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue({
        id: 'conn-existing',
        grantedAssets: null,
      } as any);
      vi.mocked(prisma.clientConnection.update).mockResolvedValue({
        id: 'conn-existing',
        status: 'pending_verification',
      } as any);
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
      expect(prisma.clientConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conn-existing' },
          data: expect.objectContaining({
            status: 'pending_verification',
            grantedAssets: expect.objectContaining({
              platform,
              agencyEmail,
              authMethod: 'manual_team_invitation',
            }),
          }),
        })
      );
    });
  }

  it('reuses an existing client connection for Pinterest manual connect instead of creating a duplicate row', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
      } as any,
      error: null,
    });
    vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue({
      id: 'conn-existing',
      grantedAssets: null,
    } as any);
    vi.mocked(prisma.clientConnection.update).mockResolvedValue({
      id: 'conn-existing',
      status: 'pending_verification',
    } as any);
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
    expect(prisma.clientConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conn-existing' },
        data: expect.objectContaining({
          status: 'pending_verification',
          grantedAssets: expect.objectContaining({
            platform: 'pinterest',
            businessId: '123456789',
            authMethod: 'manual_partnership',
          }),
        }),
      })
    );
  });

  it('creates Mailchimp manual connection with pending verification status', async () => {
    vi.mocked(accessRequestService.getAccessRequestByToken).mockResolvedValue({
      data: {
        id: 'request-1',
        agencyId: 'agency-1',
        clientEmail: 'client@example.com',
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
            platform: 'mailchimp',
            agencyEmail: 'ops@agency.com',
            authMethod: 'manual_team_invitation',
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
            platform: 'klaviyo',
            agencyEmail: 'ops@agency.com',
            authMethod: 'manual_team_invitation',
          }),
        }),
      })
    );
  });
});
