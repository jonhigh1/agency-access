import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

vi.mock('../../lib/infisical.js', () => ({
  infisical: {
    getOAuthTokens: vi.fn(),
  },
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    platformAuthorization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    clientConnection: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    metaAssetCreation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('../audit.service.js', () => ({
  auditService: {
    createAuditLog: vi.fn(),
  },
}));

vi.mock('../connectors/meta.js', () => ({
  MetaGraphMutationError: class MetaGraphMutationError extends Error {
    constructor(message: string, readonly status: number, readonly metaCode?: number, readonly metaSubcode?: number) {
      super(message);
    }
  },
  metaConnector: {
    getUserPages: vi.fn(),
    createBusiness: vi.fn(),
    createAdAccount: vi.fn(),
    createProductCatalog: vi.fn(),
  },
}));

import { infisical } from '../../lib/infisical.js';
import { prisma } from '../../lib/prisma.js';
import { auditService } from '../audit.service.js';
import { MetaGraphMutationError, metaConnector } from '../connectors/meta.js';
import { metaAssetCreationService } from '../meta-asset-creation.service.js';

const connectionId = 'conn-1';
const userEmail = 'client@acme.com';
const agencyId = 'agency-1';

function activePlatformAuth(metadata: unknown = {}) {
  return {
    id: 'auth-1',
    secretId: 'secret-1',
    platform: 'meta',
    status: 'active',
    expiresAt: null,
    metadata,
  };
}

describe('MetaAssetCreationService.createBusiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.metaAssetCreation.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.metaAssetCreation.create).mockImplementation(async (args: any) => ({ id: 'creation-1', ...args.data }) as never);
    vi.mocked(prisma.metaAssetCreation.update).mockResolvedValue({} as never);
    vi.mocked(prisma.metaAssetCreation.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { id: connectionId, granted_assets: { meta: { createdAdAccounts: [{ id: 'act-1' }] } } },
    ] as never);
    vi.mocked(infisical.getOAuthTokens).mockResolvedValue({
      accessToken: 'client-token',
      refreshToken: null,
      expiresAt: null,
    } as never);
  });

  it('creates the business, persists selection with source "created", merges discovery, appends grantedAssets, and audits', async () => {
    const existingMetadata = {
      other: 'preserved',
      meta: {
        discovery: {
          availableBusinesses: [{ id: 'biz-existing', name: 'Existing Business' }],
          discoveredAt: '2026-09-01T00:00:00.000Z',
        },
        selection: {
          clientBusinessId: 'biz-existing',
          clientBusinessName: 'Existing Business',
          selectedAt: '2026-09-01T00:00:00.000Z',
          source: 'user_selection',
        },
      },
    };
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(
      activePlatformAuth(existingMetadata) as never
    );
    vi.mocked(metaConnector.createBusiness).mockResolvedValue({
      id: 'biz-new',
      name: 'Acme Business',
      timezoneId: '25',
    });
    vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue({
      id: connectionId,
      grantedAssets: { meta: { createdAdAccounts: [{ id: 'act-1' }] } },
    } as never);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({} as never);
    vi.mocked(prisma.clientConnection.update).mockResolvedValue({} as never);

    const result = await metaAssetCreationService.createBusiness(
      connectionId,
      { accessRequestId: 'request-1', name: 'Acme Business', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '25' },
      userEmail,
      agencyId
    );

    expect(result.data).toEqual({ id: 'biz-new', name: 'Acme Business', timezoneId: '25' });
    expect(result.error).toBeNull();
    expect(metaConnector.createBusiness).toHaveBeenCalledWith('client-token', {
      name: 'Acme Business',
      vertical: 'OTHER',
      primaryPageId: 'page-1',
      timezoneId: '25',
    });

    // PlatformAuthorization.metadata: selection points at the created business
    const authUpdate = vi.mocked(prisma.platformAuthorization.update).mock.calls[0][0];
    expect(authUpdate.where).toEqual({ id: 'auth-1' });
    const nextMeta = (authUpdate.data as { metadata: Record<string, unknown> }).metadata.meta as {
      discovery: { availableBusinesses: Array<{ id: string }> };
      selection: { clientBusinessId: string; clientBusinessName: string; source: string; selectedAt: string };
    };
    expect(nextMeta.selection.clientBusinessId).toBe('biz-new');
    expect(nextMeta.selection.clientBusinessName).toBe('Acme Business');
    expect(nextMeta.selection.source).toBe('created');
    expect(typeof nextMeta.selection.selectedAt).toBe('string');

    // discovery merge: existing business preserved, created business appended
    expect(nextMeta.discovery.availableBusinesses.map((b) => b.id)).toEqual([
      'biz-existing',
      'biz-new',
    ]);

    // unrelated root metadata preserved
    expect((authUpdate.data as { metadata: Record<string, unknown> }).metadata.other).toBe('preserved');

    // ClientConnection.grantedAssets append
    const connectionUpdate = vi.mocked(prisma.clientConnection.update).mock.calls[0][0];
    const grantedMeta = (connectionUpdate.data as { grantedAssets: Record<string, any> })
      .grantedAssets.meta;
    expect(grantedMeta.createdAdAccounts).toEqual([{ id: 'act-1' }]);
    expect(grantedMeta.createdBusinesses).toHaveLength(1);
    expect(grantedMeta.createdBusinesses[0]).toMatchObject({
      id: 'biz-new',
      name: 'Acme Business',
      timezoneId: '25',
      vertical: 'OTHER',
      primaryPageId: 'page-1',
    });

    expect(auditService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId,
        userEmail,
        action: 'META_BUSINESS_CREATED',
        resourceId: connectionId,
        metadata: expect.objectContaining({
          platform: 'meta',
          businessId: 'biz-new',
          businessName: 'Acme Business',
        }),
      })
    );
  });

  it('initializes an empty meta metadata block when none exists yet', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(
      activePlatformAuth(null) as never
    );
    vi.mocked(metaConnector.createBusiness).mockResolvedValue({
      id: 'biz-first',
      name: 'First Business',
      timezoneId: '45',
    });
    vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue({
      id: connectionId,
      grantedAssets: null,
    } as never);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({} as never);
    vi.mocked(prisma.clientConnection.update).mockResolvedValue({} as never);

    const result = await metaAssetCreationService.createBusiness(
      connectionId,
      { accessRequestId: 'request-1', name: 'First Business', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '45' },
      userEmail,
      agencyId
    );

    expect(result.error).toBeNull();
    const authUpdate = vi.mocked(prisma.platformAuthorization.update).mock.calls[0][0];
    const metadata = (authUpdate.data as { metadata: Record<string, any> }).metadata;
    expect(metadata.meta.discovery.availableBusinesses).toEqual([
      expect.objectContaining({ id: 'biz-first' }),
    ]);
    expect(metadata.meta.selection.clientBusinessId).toBe('biz-first');
  });

  it('replays a stored creation result without calling Meta again', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(activePlatformAuth() as never);
    const intentHash = createHash('sha256')
      .update(JSON.stringify({
        assetType: 'business',
        parentAssetId: 'page-1',
        intent: { name: 'Acme', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '25' },
      }))
      .digest('hex');
    vi.mocked(prisma.metaAssetCreation.findUnique).mockResolvedValue({
      id: 'creation-1', accessRequestId: 'request-1', connectionId, authorizationId: 'auth-1',
      assetType: 'business', parentAssetId: 'page-1', idempotencyKey: intentHash, intentHash,
      status: 'created', result: { id: 'biz-existing', name: 'Acme', timezoneId: '25' },
    } as never);

    const result = await metaAssetCreationService.createBusiness(
      connectionId,
      { accessRequestId: 'request-1', name: 'Acme', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '25' },
      userEmail,
      agencyId
    );

    expect(result.data).toEqual({ id: 'biz-existing', name: 'Acme', timezoneId: '25' });
    expect(metaConnector.createBusiness).not.toHaveBeenCalled();
  });

  it('treats a concurrent unique-claim conflict as in progress without calling Meta', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(activePlatformAuth() as never);
    const intentHash = createHash('sha256')
      .update(JSON.stringify({
        assetType: 'business',
        parentAssetId: 'page-1',
        intent: { name: 'Acme', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '25' },
      }))
      .digest('hex');
    vi.mocked(prisma.metaAssetCreation.findUnique)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({
        id: 'creation-winner', accessRequestId: 'request-1', connectionId,
        authorizationId: 'auth-1',
        assetType: 'business', parentAssetId: 'page-1',
        idempotencyKey: intentHash, intentHash, status: 'in_progress', updatedAt: new Date(),
      } as never);
    vi.mocked(prisma.metaAssetCreation.create).mockRejectedValue({ code: 'P2002' });

    const result = await metaAssetCreationService.createBusiness(
      connectionId,
      { accessRequestId: 'request-1', name: 'Acme', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '25' },
      userEmail,
      agencyId
    );

    expect(result.error?.code).toBe('CREATION_IN_PROGRESS');
    expect(metaConnector.createBusiness).not.toHaveBeenCalled();
  });

  it('marks an abandoned in-progress claim unknown and requires asset discovery', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(activePlatformAuth() as never);
    const intentHash = createHash('sha256')
      .update(JSON.stringify({
        assetType: 'business',
        parentAssetId: 'page-1',
        intent: { name: 'Acme', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '25' },
      }))
      .digest('hex');
    vi.mocked(prisma.metaAssetCreation.findUnique).mockResolvedValue({
      id: 'creation-abandoned', accessRequestId: 'request-1', connectionId, authorizationId: 'auth-1',
      assetType: 'business', parentAssetId: 'page-1', idempotencyKey: intentHash, intentHash,
      status: 'in_progress', updatedAt: new Date(Date.now() - 6 * 60 * 1000),
    } as never);
    vi.mocked(prisma.metaAssetCreation.updateMany).mockResolvedValue({ count: 1 } as never);

    const result = await metaAssetCreationService.createBusiness(
      connectionId,
      { accessRequestId: 'request-1', name: 'Acme', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '25' },
      userEmail,
      agencyId
    );

    expect(result.error?.code).toBe('CREATION_OUTCOME_UNKNOWN');
    expect(prisma.metaAssetCreation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'creation-abandoned', status: 'in_progress' }),
      data: { status: 'outcome_unknown', lastErrorCode: 'CREATION_WORKER_ABANDONED' },
    }));
    expect(metaConnector.createBusiness).not.toHaveBeenCalled();
  });

  it('does not retry a Meta creation with unknown outcome', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(activePlatformAuth() as never);
    let creation: Record<string, any> | null = null;
    vi.mocked(prisma.metaAssetCreation.findUnique).mockImplementation(async () => creation as never);
    vi.mocked(prisma.metaAssetCreation.create).mockImplementation(async ({ data }: any) => {
      creation = { id: 'creation-1', ...data };
      return creation as never;
    });
    vi.mocked(prisma.metaAssetCreation.updateMany).mockImplementation(async ({ data }: any) => {
      creation = { ...creation, ...data };
      return { count: 1 } as never;
    });
    vi.mocked(metaConnector.createBusiness).mockRejectedValue(new Error('fetch failed'));

    const params = { accessRequestId: 'request-1', name: 'Acme', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '25' };
    const first = await metaAssetCreationService.createBusiness(connectionId, params, userEmail, agencyId);
    const retry = await metaAssetCreationService.createBusiness(connectionId, params, userEmail, agencyId);

    expect(first.error?.code).toBe('CREATION_OUTCOME_UNKNOWN');
    expect(retry.error?.code).toBe('CREATION_OUTCOME_UNKNOWN');
    expect(metaConnector.createBusiness).toHaveBeenCalledTimes(1);
    expect(creation?.status).toBe('outcome_unknown');
  });

  it('does not retry after Meta returns a 5xx creation response', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(activePlatformAuth() as never);
    let creation: Record<string, any> | null = null;
    vi.mocked(prisma.metaAssetCreation.findUnique).mockImplementation(async () => creation as never);
    vi.mocked(prisma.metaAssetCreation.create).mockImplementation(async ({ data }: any) => {
      creation = { id: 'creation-1', ...data };
      return creation as never;
    });
    vi.mocked(prisma.metaAssetCreation.updateMany).mockImplementation(async ({ data }: any) => {
      creation = { ...creation, ...data };
      return { count: 1 } as never;
    });
    vi.mocked(metaConnector.createBusiness).mockRejectedValue(
      new MetaGraphMutationError('Meta business creation failed: Internal Server Error', 500, 2),
    );

    const params = { accessRequestId: 'request-1', name: 'Acme', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '25' };
    const first = await metaAssetCreationService.createBusiness(connectionId, params, userEmail, agencyId);
    const retry = await metaAssetCreationService.createBusiness(connectionId, params, userEmail, agencyId);

    expect(first.error?.code).toBe('CREATION_OUTCOME_UNKNOWN');
    expect(retry.error?.code).toBe('CREATION_OUTCOME_UNKNOWN');
    expect(metaConnector.createBusiness).toHaveBeenCalledTimes(1);
    expect(creation?.status).toBe('outcome_unknown');
  });

  it('does not retry after Meta creates a business but local persistence fails', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(activePlatformAuth() as never);
    let creation: Record<string, any> | null = null;
    vi.mocked(prisma.metaAssetCreation.findUnique).mockImplementation(async () => creation as never);
    vi.mocked(prisma.metaAssetCreation.create).mockImplementation(async ({ data }: any) => {
      creation = { id: 'creation-1', ...data };
      return creation as never;
    });
    vi.mocked(prisma.metaAssetCreation.updateMany).mockImplementation(async ({ data }: any) => {
      creation = { ...creation, ...data };
      return { count: 1 } as never;
    });
    vi.mocked(metaConnector.createBusiness).mockResolvedValue({ id: 'biz-new', name: 'Acme', timezoneId: '25' });
    vi.mocked(prisma.platformAuthorization.update).mockRejectedValue(new Error('database unavailable'));

    const params = { accessRequestId: 'request-1', name: 'Acme', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '25' };
    const first = await metaAssetCreationService.createBusiness(connectionId, params, userEmail, agencyId);
    const retry = await metaAssetCreationService.createBusiness(connectionId, params, userEmail, agencyId);

    expect(first.error?.code).toBe('CREATION_OUTCOME_UNKNOWN');
    expect(retry.error?.code).toBe('CREATION_OUTCOME_UNKNOWN');
    expect(metaConnector.createBusiness).toHaveBeenCalledTimes(1);
    expect(creation?.status).toBe('outcome_unknown');
    expect(prisma.metaAssetCreation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'outcome_unknown', lastErrorCode: 'PROVIDER_OUTCOME_UNKNOWN' },
    }));
  });

  it('does not replay an idempotency claim under a different Meta authorization', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(
      { ...activePlatformAuth(), id: 'auth-2' } as never
    );
    vi.mocked(prisma.metaAssetCreation.findUnique).mockResolvedValue({
      id: 'creation-1',
      accessRequestId: 'request-1',
      connectionId,
      authorizationId: 'auth-1',
      assetType: 'business',
      parentAssetId: 'none',
      intentHash: createHash('sha256').update(JSON.stringify({
        assetType: 'business',
        parentAssetId: 'none',
        intent: { name: 'Acme', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '25' },
      })).digest('hex'),
      status: 'outcome_unknown',
    } as never);

    const result = await metaAssetCreationService.createBusiness(
      connectionId,
      { accessRequestId: 'request-1', name: 'Acme', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '25' },
      userEmail,
      agencyId
    );

    expect(result.error?.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(metaConnector.createBusiness).not.toHaveBeenCalled();
  });

  it('retries after Meta clearly rejects creation', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(activePlatformAuth() as never);
    let creation: Record<string, any> | null = null;
    vi.mocked(prisma.metaAssetCreation.findUnique).mockImplementation(async () => creation as never);
    vi.mocked(prisma.metaAssetCreation.create).mockImplementation(async ({ data }: any) => {
      creation = { id: 'creation-1', ...data };
      return creation as never;
    });
    vi.mocked(prisma.metaAssetCreation.updateMany).mockImplementation(async ({ where, data }: any) => {
      if (creation?.id === where.id && creation.status === where.status) {
        creation = { ...creation, ...data };
        return { count: 1 } as never;
      }
      return { count: 0 } as never;
    });
    vi.mocked(prisma.metaAssetCreation.update).mockImplementation(async ({ data }: any) => {
      creation = { ...creation, ...data };
      return creation as never;
    });
    vi.mocked(metaConnector.createBusiness)
      .mockRejectedValueOnce(new MetaGraphMutationError('Meta business creation failed: permissions error', 400, 200))
      .mockResolvedValueOnce({ id: 'biz-new', name: 'Acme', timezoneId: '25' });
    vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue({ id: connectionId, grantedAssets: null } as never);
    vi.mocked(prisma.clientConnection.update).mockResolvedValue({} as never);
    vi.mocked(prisma.platformAuthorization.update).mockResolvedValue({} as never);

    const params = { accessRequestId: 'request-1', name: 'Acme', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '25' };
    const first = await metaAssetCreationService.createBusiness(connectionId, params, userEmail, agencyId);
    const retry = await metaAssetCreationService.createBusiness(connectionId, params, userEmail, agencyId);

    expect(first.error?.code).toBe('INSUFFICIENT_PERMISSIONS');
    expect(retry.data?.id).toBe('biz-new');
    expect(metaConnector.createBusiness).toHaveBeenCalledTimes(2);
    expect(creation?.status).toBe('created');
  });

  it.each([
    ['AUTHORIZATION_NOT_FOUND', () => vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(null as never)],
    [
      'AUTHORIZATION_INACTIVE',
      () =>
        vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue({
          ...activePlatformAuth(),
          status: 'expired',
        } as never),
    ],
  ])('returns %s before touching Meta', async (code, setup) => {
    setup();
    const result = await metaAssetCreationService.createBusiness(
      connectionId,
      { accessRequestId: 'request-1', name: 'Acme', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '25' },
      userEmail,
      agencyId
    );
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe(code);
    expect(metaConnector.createBusiness).not.toHaveBeenCalled();
  });

  it('returns TOKEN_NOT_FOUND when Infisical retrieval fails', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(
      activePlatformAuth() as never
    );
    vi.mocked(infisical.getOAuthTokens).mockRejectedValue(new Error('boom'));

    const result = await metaAssetCreationService.createBusiness(
      connectionId,
      { accessRequestId: 'request-1', name: 'Acme', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '25' },
      userEmail,
      agencyId
    );

    expect(result.error?.code).toBe('TOKEN_NOT_FOUND');
  });

  it('returns TOKEN_EXPIRED when the token expiry is in the past', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(
      activePlatformAuth() as never
    );
    vi.mocked(infisical.getOAuthTokens).mockResolvedValue({
      accessToken: 'client-token',
      refreshToken: null,
      expiresAt: new Date('2020-01-01T00:00:00Z'),
    } as never);

    const result = await metaAssetCreationService.createBusiness(
      connectionId,
      { accessRequestId: 'request-1', name: 'Acme', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '25' },
      userEmail,
      agencyId
    );

    expect(result.error?.code).toBe('TOKEN_EXPIRED');
  });

  it.each([
    [
      'Meta business creation failed: You have reached the limit of businesses you can create',
      'LIMIT_EXCEEDED',
    ],
    [
      'Meta business creation failed: (#100) Invalid parameter: primary_page is not a Page you administer',
      'INVALID_PRIMARY_PAGE',
    ],
    [
      'Meta business creation failed: (#200) Permissions error',
      'INSUFFICIENT_PERMISSIONS',
    ],
  ])('maps a Meta error to the right code', async (message, code) => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(
      activePlatformAuth() as never
    );
    vi.mocked(metaConnector.createBusiness).mockRejectedValue(new MetaGraphMutationError(message, 400, 200));

    const result = await metaAssetCreationService.createBusiness(
      connectionId,
      { accessRequestId: 'request-1', name: 'Acme', vertical: 'OTHER', primaryPageId: 'page-1', timezoneId: '25' },
      userEmail,
      agencyId
    );

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe(code);
  });
});

describe('MetaAssetCreationService.getUserPages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the pages the client user administers', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(
      activePlatformAuth() as never
    );
    vi.mocked(infisical.getOAuthTokens).mockResolvedValue({
      accessToken: 'client-token',
      refreshToken: null,
      expiresAt: null,
    } as never);
    vi.mocked(metaConnector.getUserPages).mockResolvedValue([
      { id: 'page-1', name: 'Acme Main', category: 'Retail' },
    ]);

    const result = await metaAssetCreationService.getUserPages(connectionId);

    expect(result.data).toEqual([{ id: 'page-1', name: 'Acme Main', category: 'Retail' }]);
    expect(result.error).toBeNull();
    expect(metaConnector.getUserPages).toHaveBeenCalledWith('client-token');
  });

  it('returns an empty list when the user owns no pages (valid state for the guided check)', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(
      activePlatformAuth() as never
    );
    vi.mocked(infisical.getOAuthTokens).mockResolvedValue({
      accessToken: 'client-token',
      refreshToken: null,
      expiresAt: null,
    } as never);
    vi.mocked(metaConnector.getUserPages).mockResolvedValue([]);

    const result = await metaAssetCreationService.getUserPages(connectionId);

    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('returns an error when the Graph call fails (distinct from owning no pages)', async () => {
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(
      activePlatformAuth() as never
    );
    vi.mocked(infisical.getOAuthTokens).mockResolvedValue({
      accessToken: 'client-token',
      refreshToken: null,
      expiresAt: null,
    } as never);
    vi.mocked(metaConnector.getUserPages).mockRejectedValue(
      new Error('Failed to fetch user pages: token expired')
    );

    const result = await metaAssetCreationService.getUserPages(connectionId);

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe('USER_PAGES_FETCH_FAILED');
  });
});

describe('MetaAssetCreationService.createProductCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.platformAuthorization.findUnique).mockResolvedValue(activePlatformAuth() as never);
    vi.mocked(infisical.getOAuthTokens).mockResolvedValue({
      accessToken: 'client-token',
      refreshToken: null,
      expiresAt: null,
    } as never);
    vi.mocked(prisma.metaAssetCreation.findUnique)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({
        id: 'creation-1',
        accessRequestId: 'request-1',
        connectionId,
        authorizationId: 'auth-1',
        assetType: 'catalog',
        parentAssetId: 'business-1',
        intentHash: createHash('sha256')
          .update(JSON.stringify({ assetType: 'catalog', parentAssetId: 'business-1', intent: { name: 'Spring catalog' } }))
          .digest('hex'),
        status: 'in_progress',
        updatedAt: new Date(),
      } as never);
    vi.mocked(prisma.metaAssetCreation.create).mockImplementation(async (args: any) => ({
      id: 'creation-1',
      ...args.data,
    }) as never);
    vi.mocked(prisma.metaAssetCreation.update).mockResolvedValue({} as never);
    vi.mocked(prisma.clientConnection.findUnique).mockResolvedValue({
      id: connectionId,
      grantedAssets: { meta: { createdProductCatalogs: [] } },
    } as never);
    vi.mocked(prisma.clientConnection.update).mockResolvedValue({} as never);
  });

  it('creates one Meta catalog and stores one result for overlapping duplicate requests', async () => {
    let releaseMetaCreate!: () => void;
    let notifyMetaCreateStarted!: () => void;
    const metaCreateStarted = new Promise<void>((resolve) => { notifyMetaCreateStarted = resolve; });
    const waitForMetaCreate = new Promise<void>((resolve) => { releaseMetaCreate = resolve; });
    vi.mocked(metaConnector.createProductCatalog).mockImplementation(async () => {
      notifyMetaCreateStarted();
      await waitForMetaCreate;
      return { id: 'catalog-1', name: 'Spring catalog', catalogType: 'commerce' };
    });

    const firstRequest = metaAssetCreationService.createProductCatalog(
      connectionId, 'business-1', { accessRequestId: 'request-1', name: 'Spring catalog' }, userEmail, agencyId
    );
    await metaCreateStarted;
    const duplicateRequest = await metaAssetCreationService.createProductCatalog(
      connectionId, 'business-1', { accessRequestId: 'request-1', name: 'Spring catalog' }, userEmail, agencyId
    );

    expect(duplicateRequest.error?.code).toBe('CREATION_IN_PROGRESS');
    expect(metaConnector.createProductCatalog).toHaveBeenCalledTimes(1);
    releaseMetaCreate();
    const firstResult = await firstRequest;

    expect(firstResult).toEqual({
      data: { id: 'catalog-1', name: 'Spring catalog', catalogType: 'commerce' },
      error: null,
    });
    expect(prisma.metaAssetCreation.create).toHaveBeenCalledTimes(1);
    expect(prisma.metaAssetCreation.update).toHaveBeenCalledTimes(1);
  });
});
