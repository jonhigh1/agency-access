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
    findMany: vi.fn(),
    count: vi.fn(),
  },
  accessRequest: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  agencyPlatformConnection: {
    findMany: vi.fn(),
  },
  agencyMember: { count: vi.fn() },
  accessRequestTemplate: { count: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/services/audit.service', () => ({
  auditService: { createAuditLog: vi.fn().mockResolvedValue({ data: {}, error: null }) },
  createAuditLog: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

import { prisma } from '@/lib/prisma';
import { v1Routes } from '../v1';
import { quotaService } from '@/services/quota.service';
import { resetV1RateLimits, resetV1AuthFailures } from '@/middleware/v1-gate';

const PEPPER = 'test-pepper-for-u3-reads-tests-only';

function hashSecret(secret: string): string {
  return createHmac('sha256', PEPPER).update(secret).digest('hex');
}

function keyRow(scopes: string[] = ['clients:read', 'requests:read', 'catalog:read', 'usage:read']) {
  const secret = `ah_live_${randomBytes(16).toString('base64url')}`;
  return {
    secret,
    row: {
      id: 'key-1',
      agencyId: 'agency-1',
      familyId: 'fam-1',
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

function mockValidKey(row: Record<string, any>) {
  vi.mocked(prismaMock.apiKey.findMany).mockResolvedValue([row]);
  vi.mocked(prismaMock.agency.findUnique).mockImplementation(async (args: any) => {
    if (args?.where?.id === row.agencyId) {
      return { id: row.agencyId, name: 'Acme' } as any;
    }
    return null;
  });
  vi.mocked(prismaMock.subscription.findUnique).mockResolvedValue({
    agencyId: 'agency-1',
    tier: 'GROWTH',
    status: 'active',
  } as any);
}

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString('base64url');
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(v1Routes);
  return app;
}

describe('v1 read slice: catalog, cursor lists, usage (U3)', () => {
  let app: FastifyInstance;
  let secret: string;

  beforeEach(async () => {
    process.env.API_KEY_PEPPER = PEPPER;
    vi.clearAllMocks();
    resetV1RateLimits();
    resetV1AuthFailures();
    vi.mocked(prismaMock.apiKey.count).mockResolvedValue(0);
    const k = keyRow();
    secret = k.secret;
    mockValidKey(k.row);
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('catalog accounts omit every secret pointer and match internal connection state', async () => {
    vi.mocked(prismaMock.agencyPlatformConnection.findMany).mockResolvedValue([
      {
        id: 'conn-1',
        agencyId: 'agency-1',
        platform: 'google_ads',
        connectionMode: 'oauth',
        secretId: 'infisical-secret-pointer-must-never-leak',
        status: 'active',
        scope: 'https://www.googleapis.com/auth/adwords',
        connectedBy: 'admin@acme.co',
        connectedAt: new Date('2026-10-01T00:00:00.000Z'),
      },
    ] as any);

    const res = await app.inject({
      method: 'GET',
      url: '/catalog/accounts',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.error).toBeNull();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].platform).toBe('google_ads');
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/secretId|secret|token|pepper|keyHash/i);
  });

  it('catalog services list every requestable service with roles and grant requirements', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/catalog/services',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.error).toBeNull();
    expect(body.data.length).toBeGreaterThan(0);
    for (const svc of body.data) {
      expect(svc.id).toBeDefined();
      expect(Array.isArray(svc.roles) && svc.roles.length).toBeGreaterThan(0);
      expect(svc.grantRequirements).toBeDefined();
    }
  });

  it('cursor pages stay stable across concurrent inserts via keyset queries (identical timestamps)', async () => {
    const t0 = '2026-10-09T08:00:00.000Z';
    const page1 = [
      { id: 'c-b', agencyId: 'agency-1', name: 'B', company: 'B Co', email: 'b@co.com', createdAt: new Date(t0), updatedAt: new Date(t0) },
      { id: 'c-a', agencyId: 'agency-1', name: 'A', company: 'A Co', email: 'a@co.com', createdAt: new Date(t0), updatedAt: new Date(t0) },
      // Third row (limit+1 fetch) proves a next page exists without an offset.
      { id: 'c-0', agencyId: 'agency-1', name: 'Z', company: 'Z Co', email: 'z@co.com', createdAt: new Date(t0), updatedAt: new Date(t0) },
    ];
    vi.mocked(prismaMock.client.findMany).mockResolvedValueOnce(page1 as any);

    const first = await app.inject({
      method: 'GET',
      url: '/clients?limit=2',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.data.map((c: any) => c.id)).toEqual(['c-b', 'c-a']);
    expect(firstBody.meta.requestId).toBeDefined();
    expect(firstBody.meta.pagination.hasMore).toBe(true);
    const nextCursor = firstBody.meta.pagination.nextCursor as string;
    expect(nextCursor).toBeDefined();

    // Second page must use a keyset tuple comparison, never offset.
    const decoded = JSON.parse(Buffer.from(nextCursor, 'base64url').toString('utf8'));
    expect(decoded).toEqual({ createdAt: t0, id: 'c-a' });
    vi.mocked(prismaMock.client.findMany).mockResolvedValueOnce([] as any);
    const second = await app.inject({
      method: 'GET',
      url: `/clients?limit=2&cursor=${encodeURIComponent(nextCursor)}`,
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(second.statusCode).toBe(200);
    const where = vi.mocked(prismaMock.client.findMany).mock.calls.at(-1)?.[0]?.where;
    expect(where).toBeDefined();
    expect(where.OR).toBeDefined();
    expect(JSON.stringify(where)).not.toMatch(/"skip"|"offset"/);
    expect(second.json().data).toEqual([]);
  });

  it('email and status filters return exactly the matching sets', async () => {
    vi.mocked(prismaMock.client.findMany).mockResolvedValue([
      { id: 'c-1', agencyId: 'agency-1', email: 'exact@co.com', createdAt: new Date(), updatedAt: new Date() },
    ] as any);
    const clients = await app.inject({
      method: 'GET',
      url: '/clients?email=exact%40co.com',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(clients.statusCode).toBe(200);
    const clientWhere = vi.mocked(prismaMock.client.findMany).mock.calls.at(-1)?.[0]?.where;
    expect(clientWhere.email).toBe('exact@co.com');

    vi.mocked(prismaMock.accessRequest.findMany).mockResolvedValue([
      { id: 'r-1', status: 'pending', createdAt: new Date() },
    ] as any);
    const requests = await app.inject({
      method: 'GET',
      url: '/requests?status=pending',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(requests.statusCode).toBe(200);
    const reqWhere = vi.mocked(prismaMock.accessRequest.findMany).mock.calls.at(-1)?.[0]?.where;
    expect(reqWhere.status).toBe('pending');
  });

  it('unknown query parameters fail naming the parameter; limit bounds enforced', async () => {
    const unknown = await app.inject({
      method: 'GET',
      url: '/clients?limit=10&bogusParam=1',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(unknown.statusCode).toBe(400);
    expect(JSON.stringify(unknown.json())).toMatch(/bogusParam/);

    const over = await app.inject({
      method: 'GET',
      url: '/clients?limit=500',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(over.statusCode).toBe(400);
  });

  it('usage reflects tier, limits, used, remaining, and reset', async () => {
    const getUsage = vi.spyOn(quotaService, 'getUsage').mockResolvedValue({
      currentTier: 'GROWTH',
      updatedAt: new Date('2026-10-09T08:00:00.000Z'),
      clients: { limit: 20, used: 7, remaining: 13 },
      members: { limit: 'unlimited', used: 3, remaining: 'unlimited' },
      accessRequests: { limit: 20, used: 5, remaining: 15 },
      templates: { limit: 10, used: 2, remaining: 8 },
    } as any);
    vi.mocked(prismaMock.subscription.findUnique).mockResolvedValue({
      agencyId: 'agency-1',
      tier: 'GROWTH',
      status: 'active',
      currentPeriodEnd: new Date('2026-11-01T00:00:00.000Z'),
    } as any);

    const res = await app.inject({
      method: 'GET',
      url: '/usage',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(getUsage).toHaveBeenCalledWith('agency-1');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.plan).toBe('GROWTH');
    expect(body.data.metrics.clients).toMatchObject({ limit: 20, used: 7, remaining: 13 });
    expect(body.data.resetAt).toBe('2026-11-01T00:00:00.000Z');
  });

  it('missing scope fails naming the missing scope', async () => {
    const k = keyRow(['clients:read']);
    mockValidKey(k.row);
    const res = await app.inject({
      method: 'GET',
      url: '/usage',
      headers: { authorization: `Bearer ${k.secret}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('MISSING_SCOPE');
    expect(res.json().error.message).toMatch(/usage:read/);
  });
});
