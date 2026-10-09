import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createHmac, randomBytes } from 'crypto';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn().mockResolvedValue(null),
}));

const prismaMock = vi.hoisted(() => ({
  apiKey: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  agency: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
  },
  client: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  accessRequest: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  idempotencyRecord: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/services/audit.service', () => ({
  auditService: { createAuditLog: vi.fn().mockResolvedValue({ data: {}, error: null }) },
  createAuditLog: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

import { prisma } from '@/lib/prisma';
import { v1WritesRoutes } from '../v1-writes';
import { apiKeyPreHandler } from '@/middleware/api-key-auth';
import { fingerprintRequest } from '@/services/idempotency.service';
import { clientService, ClientError } from '@/services/client.service';
import { resetV1RateLimits, resetV1AuthFailures } from '@/middleware/v1-gate';

const PEPPER = 'test-pepper-for-u5-writes-tests-only';

function hashSecret(secret: string): string {
  return createHmac('sha256', PEPPER).update(secret).digest('hex');
}

let keyFamilySeq = 0;

function keyRow(scopes: string[] = ['clients:read', 'clients:write', 'requests:read', 'requests:write']) {
  const secret = `ah_live_${randomBytes(16).toString('base64url')}`;
  keyFamilySeq += 1;
  return {
    secret,
    row: {
      id: `key-${secret.slice(8, 14)}`,
      agencyId: 'agency-1',
      familyId: `fam-${keyFamilySeq}`,
      name: 'crm',
      prefix: secret.slice(0, 12),
      keyHash: hashSecret(secret),
      pepperVersion: 1,
      scopes,
      createdBy: 'admin@acme.co',
      createdAt: new Date('2026-10-09T08:00:00.000Z'),
      updatedAt: new Date('2026-10-09T08:00:00.000Z'),
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      revokedBy: null,
    },
  };
}

const keyRows: Array<{ secret: string; row: Record<string, any> }> = [];

function mockValidKeys() {
  vi.mocked(prismaMock.apiKey.findMany).mockImplementation(async (args: any) => {
    const found = keyRows.find((k) => k.row.prefix === args?.where?.prefix);
    return (found ? [found.row] : []) as any;
  });
  // In-transaction liveness re-check (revoke-vs-commit race): live by default.
  vi.mocked(prismaMock.apiKey.findUnique).mockImplementation(async (args: any) => {
    const found = keyRows.find((k) => k.row.id === args?.where?.id);
    if (!found) return null as any;
    return { revokedAt: found.row.revokedAt, expiresAt: found.row.expiresAt } as any;
  });
  vi.mocked(prismaMock.agency.findUnique).mockImplementation(async (args: any) => {
    if (args?.where?.id === 'agency-1') return { id: 'agency-1', name: 'Acme' } as any;
    return null;
  });
  vi.mocked(prismaMock.subscription.findUnique).mockResolvedValue({
    tier: 'GROWTH',
    status: 'active',
  } as any);
}

const CLIENT_BODY = {
  name: 'Jane Buyer',
  company: 'Buyer Co',
  email: 'jane@buyer.co',
  externalClientId: 'crm-123',
};

function createdClientRow() {
  const now = new Date('2026-10-09T08:10:00.000Z');
  return {
    id: 'client-1',
    agencyId: 'agency-1',
    name: CLIENT_BODY.name,
    company: CLIENT_BODY.company,
    email: CLIENT_BODY.email,
    website: null,
    language: 'en',
    externalClientId: CLIENT_BODY.externalClientId,
    createdAt: now,
    updatedAt: now,
  };
}

/** First claim wins; every later claim loses the atomic insert race. */
function mockClaimRace() {
  let calls = 0;
  vi.mocked(prismaMock.idempotencyRecord.create).mockImplementation(async (args: any) => {
    calls += 1;
    if (calls === 1) {
      return { id: 'idem-1', state: 'in_progress', statusCode: null, result: null } as any;
    }
    throw Object.assign(new Error('Unique constraint'), { code: 'P2002' });
    void args;
  });
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  app.addHook('onRequest', apiKeyPreHandler());
  await app.register(v1WritesRoutes);
  return app;
}

describe('v1 idempotent writes (U5)', () => {
  let app: FastifyInstance;
  let secret: string;

  beforeEach(async () => {
    process.env.API_KEY_PEPPER = PEPPER;
    vi.clearAllMocks();
    resetV1RateLimits();
    resetV1AuthFailures();
    keyRows.length = 0;
    const k = keyRow();
    keyRows.push(k);
    secret = k.secret;
    mockValidKeys();
    // Live-record cap: empty by default.
    vi.mocked(prismaMock.idempotencyRecord.count).mockResolvedValue(0);
    // Default: claim wins, transaction runs the callback against the mock.
    vi.mocked(prismaMock.idempotencyRecord.create).mockResolvedValue({
      id: 'idem-1',
      state: 'in_progress',
      statusCode: null,
      result: null,
    } as any);
    vi.mocked(prismaMock.idempotencyRecord.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prismaMock.$transaction).mockImplementation(async (cb: any) => cb(prismaMock));
    vi.mocked(prismaMock.client.findFirst).mockResolvedValue(null);
    vi.mocked(prismaMock.client.create).mockResolvedValue(createdClientRow() as any);
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  function postClients(body: unknown, key = 'idem-key-1', bearer: string = secret) {
    return app.inject({
      method: 'POST',
      url: '/clients',
      headers: { authorization: `Bearer ${bearer}`, 'idempotency-key': key },
      payload: body,
    });
  }

  it('AE1: timed-out create retried with same key and body returns the original without a second write', async () => {
    const first = await postClients(CLIENT_BODY);
    expect(first.statusCode).toBe(201);
    const firstBody = first.json();
    expect(firstBody.error).toBeNull();
    expect(firstBody.data.id).toBe('client-1');

    // Retry loses the claim race; the winner's stored result replays.
    vi.mocked(prismaMock.idempotencyRecord.create).mockRejectedValue(
      Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
    );
    vi.mocked(prismaMock.idempotencyRecord.findUnique).mockResolvedValue({
      id: 'idem-1',
      state: 'completed',
      statusCode: 201,
      fingerprint: fingerprintRequest(CLIENT_BODY),
      result: JSON.parse(JSON.stringify(createdClientRow())),
      expiresAt: new Date(Date.now() + 60_000),
    } as any);

    const retry = await postClients(CLIENT_BODY);
    expect(retry.statusCode).toBe(201);
    expect(retry.json().data.id).toBe('client-1');
    // Exactly-once: one business write, one usage-counted row.
    expect(vi.mocked(prismaMock.client.create)).toHaveBeenCalledTimes(1);
  });

  it('same key with a different body conflicts distinctly', async () => {
    await postClients(CLIENT_BODY);
    vi.mocked(prismaMock.idempotencyRecord.create).mockRejectedValue(
      Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
    );
    vi.mocked(prismaMock.idempotencyRecord.findUnique).mockResolvedValue({
      id: 'idem-1',
      state: 'completed',
      statusCode: 201,
      fingerprint: fingerprintRequest(CLIENT_BODY),
      result: { id: 'client-1' },
      expiresAt: new Date(Date.now() + 60_000),
    } as any);

    const res = await postClients({ ...CLIENT_BODY, name: 'Someone Else' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(vi.mocked(prismaMock.client.create)).toHaveBeenCalledTimes(1);
  });

  it('retry storm under concurrency yields exactly-once effects with one write', async () => {
    mockClaimRace();
    vi.mocked(prismaMock.idempotencyRecord.findUnique).mockResolvedValue({
      id: 'idem-1',
      state: 'in_progress',
      statusCode: null,
      fingerprint: fingerprintRequest(CLIENT_BODY),
      result: null,
      expiresAt: new Date(Date.now() + 60_000),
    } as any);

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => postClients(CLIENT_BODY, 'storm-key', secret).then((r) => ({ i, r }))),
    );
    const created = results.filter(({ r }) => r.statusCode === 201);
    const busy = results.filter(({ r }) => r.statusCode === 409);
    expect(created).toHaveLength(1);
    expect(busy).toHaveLength(4);
    expect(busy[0].r.json().error.code).toBe('IDEMPOTENCY_IN_PROGRESS');
    expect(vi.mocked(prismaMock.$transaction)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prismaMock.client.create)).toHaveBeenCalledTimes(1);
  });

  it('cross-family replay isolation: one family never reads another family’s stored result', async () => {
    const other = keyRow();
    keyRows.push(other);
    mockValidKeys();

    await postClients(CLIENT_BODY, 'shared-key', secret);
    expect(vi.mocked(prismaMock.client.create)).toHaveBeenCalledTimes(1);

    // Same key value under a different family claims fresh (no P2002).
    vi.mocked(prismaMock.idempotencyRecord.create).mockResolvedValue({
      id: 'idem-2',
      state: 'in_progress',
      statusCode: null,
      result: null,
    } as any);
    vi.mocked(prismaMock.client.create).mockResolvedValue({
      ...createdClientRow(),
      id: 'client-2',
    } as any);

    const res = await postClients(CLIENT_BODY, 'shared-key', other.secret);
    expect(res.statusCode).toBe(201);
    expect(res.json().data.id).toBe('client-2');
    const claimCall = vi.mocked(prismaMock.idempotencyRecord.create).mock.calls.at(-1)?.[0] as any;
    expect(claimCall.data.keyIdentity).toBe(other.row.familyId);
    expect(claimCall.data.keyIdentity).not.toBe(keyRows[0].row.familyId);
  });

  it('rotation retry replays: same family, same key and body returns the original without a second write', async () => {
    const sibling = keyRow();
    // Rotation sibling: same family, different key id.
    sibling.row.familyId = keyRows[0].row.familyId;
    keyRows.push(sibling);
    mockValidKeys();

    await postClients(CLIENT_BODY, 'rotation-key', secret);
    expect(vi.mocked(prismaMock.client.create)).toHaveBeenCalledTimes(1);

    // Sibling loses the claim race; the winner's stored result replays.
    vi.mocked(prismaMock.idempotencyRecord.create).mockRejectedValue(
      Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
    );
    vi.mocked(prismaMock.idempotencyRecord.findUnique).mockResolvedValue({
      id: 'idem-1',
      state: 'completed',
      statusCode: 201,
      fingerprint: fingerprintRequest(CLIENT_BODY),
      result: JSON.parse(JSON.stringify(createdClientRow())),
      expiresAt: new Date(Date.now() + 60_000),
    } as any);

    const res = await postClients(CLIENT_BODY, 'rotation-key', sibling.secret);
    expect(res.statusCode).toBe(201);
    expect(res.json().data.id).toBe('client-1');
    expect(vi.mocked(prismaMock.client.create)).toHaveBeenCalledTimes(1);
  });

  it('expired idempotency keys fail with the distinct expired code', async () => {
    vi.mocked(prismaMock.idempotencyRecord.create).mockRejectedValue(
      Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
    );
    vi.mocked(prismaMock.idempotencyRecord.findUnique).mockResolvedValue({
      id: 'idem-1',
      state: 'completed',
      statusCode: 201,
      fingerprint: fingerprintRequest(CLIENT_BODY),
      result: { id: 'client-1' },
      expiresAt: new Date(Date.now() - 1_000),
    } as any);

    const res = await postClients(CLIENT_BODY);
    expect(res.statusCode).toBe(410);
    expect(res.json().error.code).toBe('IDEMPOTENCY_KEY_EXPIRED');
    expect(vi.mocked(prismaMock.client.create)).not.toHaveBeenCalled();
  });

  it('missing idempotency header fails without consuming the key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/clients',
      headers: { authorization: `Bearer ${secret}` },
      payload: CLIENT_BODY,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(vi.mocked(prismaMock.idempotencyRecord.create)).not.toHaveBeenCalled();
    expect(vi.mocked(prismaMock.client.create)).not.toHaveBeenCalled();
  });

  it('AE5: unknown field fails naming the field and never consumes the key', async () => {
    const res = await postClients({ ...CLIENT_BODY, internalTier: 'free' });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toMatch(/internalTier/);
    expect(vi.mocked(prismaMock.idempotencyRecord.create)).not.toHaveBeenCalled();
  });

  it('AE2: client get by external ID resolves the row directly', async () => {
    vi.mocked(prismaMock.client.findFirst).mockResolvedValue(createdClientRow() as any);
    const res = await app.inject({
      method: 'GET',
      url: `/clients/external/${CLIENT_BODY.externalClientId}`,
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe('client-1');
    expect(vi.mocked(prismaMock.client.findFirst)).toHaveBeenCalledWith({
      where: { agencyId: 'agency-1', externalClientId: CLIENT_BODY.externalClientId },
    });
  });

  it('AE2: request filter by external ID returns exactly that client’s requests', async () => {
    vi.mocked(prismaMock.client.findFirst).mockResolvedValue(createdClientRow() as any);
    vi.mocked(prismaMock.accessRequest.findMany).mockResolvedValue([
      { id: 'req-1', clientId: 'client-1', clientName: 'Jane Buyer' },
      { id: 'req-2', clientId: 'client-1', clientName: 'Jane Buyer' },
    ] as any);
    const res = await app.inject({
      method: 'GET',
      url: `/clients/external/${CLIENT_BODY.externalClientId}/requests?limit=50`,
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.map((r: any) => r.id)).toEqual(['req-1', 'req-2']);
    const where = vi.mocked(prismaMock.accessRequest.findMany).mock.calls[0]?.[0] as any;
    expect(where.where.clientId).toBe('client-1');
    expect(where.where.agencyId).toBe('agency-1');
  });

  it('request create resolves clientExternalId and replays idempotently', async () => {
    const requestBody = {
      clientExternalId: CLIENT_BODY.externalClientId,
      clientName: 'Jane Buyer',
      clientEmail: 'jane@buyer.co',
      platforms: [{ platform: 'google_ads', accessLevel: 'manage' }],
    };
    vi.mocked(prismaMock.client.findFirst).mockResolvedValue(createdClientRow() as any);
    const createdRequest = {
      id: 'req-9',
      agencyId: 'agency-1',
      clientId: 'client-1',
      status: 'pending',
    };
    vi.mocked(prismaMock.accessRequest.create).mockResolvedValue(createdRequest as any);

    const first = await app.inject({
      method: 'POST',
      url: '/requests',
      headers: { authorization: `Bearer ${secret}`, 'idempotency-key': 'req-key-1' },
      payload: requestBody,
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().data.id).toBe('req-9');

    vi.mocked(prismaMock.idempotencyRecord.create).mockRejectedValue(
      Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
    );
    vi.mocked(prismaMock.idempotencyRecord.findUnique).mockResolvedValue({
      id: 'idem-9',
      state: 'completed',
      statusCode: 201,
      fingerprint: fingerprintRequest(requestBody),
      result: createdRequest,
      expiresAt: new Date(Date.now() + 60_000),
    } as any);

    const retry = await app.inject({
      method: 'POST',
      url: '/requests',
      headers: { authorization: `Bearer ${secret}`, 'idempotency-key': 'req-key-1' },
      payload: requestBody,
    });
    expect(retry.statusCode).toBe(201);
    expect(vi.mocked(prismaMock.accessRequest.create)).toHaveBeenCalledTimes(1);
  });

  it('duplicate external ID within the agency maps to the stable conflict code', async () => {
    vi.mocked(prismaMock.client.create).mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: ['agencyId', 'externalClientId'] },
      }),
    );
    const res = await postClients(CLIENT_BODY);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('EXTERNAL_ID_CONFLICT');
  });

  it('service: createClient maps external-ID unique violations distinctly from email duplicates', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.client.create).mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: ['agencyId', 'externalClientId'] },
      }),
    );
    await expect(
      clientService.createClient({ agencyId: 'agency-1', ...CLIENT_BODY }),
    ).rejects.toThrow(ClientError.EXTERNAL_ID_CONFLICT);
  });

  it('service: updateClient rejects external-ID mutation with the immutability code', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValue(createdClientRow() as any);
    await expect(
      clientService.updateClient('client-1', 'agency-1', {
        externalClientId: 'crm-999',
      } as any),
    ).rejects.toThrow(ClientError.EXTERNAL_ID_IMMUTABLE);
    expect(vi.mocked(prisma.client.update)).not.toHaveBeenCalled();
  });
});
