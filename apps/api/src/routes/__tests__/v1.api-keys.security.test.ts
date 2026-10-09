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
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/services/audit.service', () => ({
  auditService: { createAuditLog: vi.fn().mockResolvedValue({ data: {}, error: null }) },
  createAuditLog: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

import { prisma } from '@/lib/prisma';
import {
  issueApiKey,
  verifyApiKey,
  rotateApiKey,
  revokeApiKeyFamily,
  assertKeyScope,
  MAX_API_KEYS_PER_AGENCY,
} from '@/services/api-key.service';
import { apiKeyPreHandler, requireKeyScope } from '@/middleware/api-key-auth';
import { v1Routes } from '../v1';

const PEPPER = 'test-pepper-for-u1-security-tests-only';
const NOW = new Date('2026-10-09T08:00:00.000Z');

function hashSecret(secret: string): string {
  return createHmac('sha256', PEPPER).update(secret).digest('hex');
}

function keyRow(overrides: Record<string, any> = {}) {
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
      scopes: ['clients:read'],
      createdBy: 'admin@acme.co',
      createdAt: NOW,
      updatedAt: NOW,
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      revokedBy: null,
      ...overrides,
    },
  };
}

describe('v1 API key security', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    process.env.API_KEY_PEPPER = PEPPER;
    vi.clearAllMocks();
    vi.mocked(prismaMock.subscription.findUnique).mockResolvedValue(null);
    vi.mocked(prismaMock.apiKey.count).mockResolvedValue(0);

    app = Fastify();
    await app.register(v1Routes);
  });

  afterEach(async () => {
    await app.close();
  });

  it('missing, invalid, expired, and revoked keys collapse to one external code', async () => {
    const { secret, row } = keyRow();

    // invalid: prefix matches nothing
    vi.mocked(prismaMock.apiKey.findMany).mockResolvedValue([]);
    const invalid = await app.inject({
      method: 'GET',
      url: '/self-check',
      headers: { authorization: 'Bearer ah_live_doesnotexist000000000000000000' },
    });
    expect(invalid.statusCode).toBe(401);
    expect(invalid.json().error.code).toBe('INVALID_API_KEY');

    // revoked
    vi.mocked(prismaMock.apiKey.findMany).mockResolvedValue([{ ...row, revokedAt: NOW }]);
    const revoked = await app.inject({
      method: 'GET',
      url: '/self-check',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(revoked.statusCode).toBe(401);
    expect(revoked.json().error.code).toBe('INVALID_API_KEY');
    expect(revoked.json().error.message).toBe(invalid.json().error.message);

    // expired
    vi.mocked(prismaMock.apiKey.findMany).mockResolvedValue([
      { ...row, revokedAt: null, expiresAt: new Date('2026-10-08T00:00:00.000Z') },
    ]);
    const expired = await app.inject({
      method: 'GET',
      url: '/self-check',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(expired.statusCode).toBe(401);
    expect(expired.json().error.code).toBe('INVALID_API_KEY');

    // missing
    const missing = await app.inject({ method: 'GET', url: '/self-check' });
    expect(missing.statusCode).toBe(401);
    expect(missing.json().error.code).toBe('INVALID_API_KEY');
  });

  it('service layer keeps distinct internal reasons', async () => {
    const { secret, row } = keyRow();
    vi.mocked(prismaMock.apiKey.findMany).mockResolvedValue([]);
    expect((await verifyApiKey('ah_live_nope00000000000000000000000000')).reason).toBe('no-match');

    vi.mocked(prismaMock.apiKey.findMany).mockResolvedValue([{ ...row, revokedAt: NOW }]);
    expect((await verifyApiKey(secret)).reason).toBe('revoked');

    vi.mocked(prismaMock.apiKey.findMany).mockResolvedValue([
      { ...row, revokedAt: null, expiresAt: new Date('2020-01-01T00:00:00.000Z') },
    ]);
    expect((await verifyApiKey(secret)).reason).toBe('expired');
  });

  it('a key lacking the route scope fails naming the missing scope', async () => {
    const scoped = Fastify();
    scoped.addHook('onRequest', apiKeyPreHandler());
    scoped.get('/guarded', { onRequest: [requireKeyScope('webhooks:write')] }, async () => ({ ok: true }));

    const { secret, row } = keyRow({ scopes: ['clients:read'] });
    vi.mocked(prismaMock.apiKey.findMany).mockResolvedValue([row]);
    vi.mocked(prismaMock.agency.findUnique).mockResolvedValue({
      id: 'agency-1',
      name: 'Acme',
      email: 'a@acme.co',
    } as any);

    const response = await scoped.inject({
      method: 'GET',
      url: '/guarded',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('MISSING_SCOPE');
    expect(response.json().error.message).toContain('webhooks:write');
    await scoped.close();
  });

  it('deny-by-default: empty scopes pass self-check but fail every guarded route', async () => {
    expect(assertKeyScope({ scopes: [] } as any, 'clients:read')?.code).toBe('MISSING_SCOPE');

    const { secret, row } = keyRow({ scopes: [] });
    vi.mocked(prismaMock.apiKey.findMany).mockResolvedValue([row]);
    vi.mocked(prismaMock.agency.findUnique).mockResolvedValue({
      id: 'agency-1',
      name: 'Acme',
      email: 'a@acme.co',
    } as any);
    const response = await app.inject({
      method: 'GET',
      url: '/self-check',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.scopes).toEqual([]);
  });

  it('cross-auth replay fails both directions', async () => {
    // Clerk JWT on v1 collapses to the key failure code
    const jwtOnV1 = await app.inject({
      method: 'GET',
      url: '/self-check',
      headers: { authorization: 'Bearer eyJhbGciOiJSUzI1NiJ9.clerk-jwt-body.sig' },
    });
    expect(jwtOnV1.statusCode).toBe(401);
    expect(jwtOnV1.json().error.code).toBe('INVALID_API_KEY');

    // API key on a Clerk dashboard path is rejected by Clerk verification
    const { authenticate } = await import('@/middleware/auth.js');
    const dash = Fastify();
    dash.get('/dashboard-probe', { onRequest: [authenticate()] }, async () => ({ ok: true }));
    const { secret } = keyRow();
    const keyOnDash = await dash.inject({
      method: 'GET',
      url: '/dashboard-probe',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(keyOnDash.statusCode).toBe(401);
    await dash.close();
  });

  it('rotation keeps the old key valid through overlap, then rejects it', async () => {
    const oldSecret = `ah_live_${randomBytes(16).toString('base64url')}`;
    const oldRow = {
      id: 'key-old',
      agencyId: 'agency-1',
      familyId: 'fam-1',
      name: 'crm',
      prefix: oldSecret.slice(0, 12),
      keyHash: hashSecret(oldSecret),
      pepperVersion: 1,
      scopes: ['clients:read'],
      createdBy: 'admin@acme.co',
      createdAt: NOW,
      updatedAt: NOW,
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      revokedBy: null,
    };
    vi.mocked(prismaMock.apiKey.findFirst).mockResolvedValue(oldRow as any);
    vi.mocked(prismaMock.apiKey.findMany).mockResolvedValue([oldRow] as any);
    vi.mocked(prismaMock.apiKey.create).mockImplementation(async (args: any) => ({
      id: 'key-new',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      revokedBy: null,
      ...args.data,
    }));
    vi.mocked(prismaMock.apiKey.update).mockImplementation(async (args: any) => ({
      ...oldRow,
      ...args.data,
    }));

    const rotated = await rotateApiKey({ agencyId: 'agency-1', keyId: 'key-old', rotatedBy: 'a@acme.co' });
    expect(rotated.error).toBeNull();
    expect(rotated.data!.key.familyId).toBe('fam-1');
    expect(typeof rotated.data!.apiKey).toBe('string');
    // old key carries a 24h overlap expiry
    const updateCall = vi.mocked(prismaMock.apiKey.update).mock.calls[0][0] as any;
    const overlapMs = new Date(updateCall.data.expiresAt).getTime() - Date.now();
    expect(overlapMs).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(overlapMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 60 * 1000);

    // after overlap expiry the old key is rejected
    vi.mocked(prismaMock.apiKey.findMany).mockResolvedValue([
      { ...oldRow, expiresAt: new Date('2020-01-01T00:00:00.000Z') },
    ]);
    expect((await verifyApiKey(oldSecret)).reason).toBe('expired');
  });

  it('family revoke kills all actives and a third active is refused', async () => {
    vi.mocked(prismaMock.apiKey.findFirst).mockResolvedValue({ id: 'x', familyId: 'fam-1' } as any);
    vi.mocked(prismaMock.apiKey.updateMany).mockResolvedValue({ count: 2 } as any);
    const killed = await revokeApiKeyFamily({ agencyId: 'agency-1', familyId: 'fam-1', revokedBy: 'a@acme.co' });
    expect(killed.error).toBeNull();
    expect(killed.data!.revokedCount).toBe(2);

    // two actives already: replacement refused
    vi.mocked(prismaMock.apiKey.findMany).mockResolvedValue([{}, {}] as any);
    const third = await rotateApiKey({ agencyId: 'agency-1', keyId: 'key-old', rotatedBy: 'a@acme.co' });
    expect(third.data).toBeNull();
    expect(third.error!.code).toBe('API_KEY_FAMILY_LIMIT');
  });

  it('scope re-check at service entry rejects a replayed low-scope principal', async () => {
    const err = assertKeyScope({ scopes: ['clients:read'] } as any, 'webhooks:write');
    expect(err).not.toBeNull();
    expect(err!.code).toBe('MISSING_SCOPE');
    expect(err!.message).toContain('webhooks:write');
    expect(assertKeyScope({ scopes: ['webhooks:write'] } as any, 'webhooks:write')).toBeNull();
  });

  it('a valid-signature key for an unknown agency never creates an agency row', async () => {
    const { secret, row } = keyRow();
    vi.mocked(prismaMock.apiKey.findMany).mockResolvedValue([row]);
    vi.mocked(prismaMock.agency.findUnique).mockResolvedValue(null);

    const result = await verifyApiKey(secret);
    expect(result.principal).toBeNull();
    expect(result.reason).toBe('unknown-agency');
    expect(vi.mocked(prismaMock.agency.create)).not.toHaveBeenCalled();
  });

  it('eleventh key issuance fails with the cap code', async () => {
    vi.mocked(prismaMock.apiKey.count).mockResolvedValue(MAX_API_KEYS_PER_AGENCY);
    const result = await issueApiKey({
      agencyId: 'agency-1',
      name: 'extra',
      scopes: [],
      createdBy: 'a@acme.co',
    });
    expect(result.data).toBeNull();
    expect(result.error!.code).toBe('API_KEY_LIMIT_EXCEEDED');
  });

  it('self-check returns agency, prefix, scopes, tier, and limit hints with no scope required', async () => {
    const { secret, row } = keyRow({ scopes: ['clients:read'] });
    vi.mocked(prismaMock.apiKey.findMany).mockResolvedValue([row]);
    vi.mocked(prismaMock.agency.findUnique).mockResolvedValue({
      id: 'agency-1',
      name: 'Acme',
      email: 'a@acme.co',
    } as any);
    vi.mocked(prismaMock.subscription.findUnique).mockResolvedValue({ tier: 'GROWTH' } as any);
    vi.mocked(prismaMock.apiKey.count).mockResolvedValue(3);

    const response = await app.inject({
      method: 'GET',
      url: '/self-check',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.agency.id).toBe('agency-1');
    expect(data.keyPrefix).toBe(secret.slice(0, 12));
    expect(data.scopes).toEqual(['clients:read']);
    expect(data.tier).toBe('GROWTH');
    expect(data.limits.maxKeys).toBe(MAX_API_KEYS_PER_AGENCY);
    expect(data.limits.activeKeys).toBe(3);
  });

  it('never touches request.user on the key path', async () => {
    const probe = Fastify();
    const { apiKeyPreHandler: pre } = await import('@/middleware/api-key-auth');
    probe.addHook('onRequest', pre());
    probe.get('/whoami', async (request) => ({
      user: (request as any).user ?? null,
      apiKey: (request as any).apiKey ?? null,
    }));

    const { secret, row } = keyRow();
    vi.mocked(prismaMock.apiKey.findMany).mockResolvedValue([row]);
    vi.mocked(prismaMock.agency.findUnique).mockResolvedValue({
      id: 'agency-1',
      name: 'Acme',
      email: 'a@acme.co',
    } as any);

    const response = await probe.inject({
      method: 'GET',
      url: '/whoami',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(response.json().user).toBeNull();
    expect(response.json().apiKey.agencyId).toBe('agency-1');
    await probe.close();
  });
});
