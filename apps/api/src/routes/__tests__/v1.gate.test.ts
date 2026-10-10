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
import { apiKeyPreHandler } from '@/middleware/api-key-auth';
import {
  V1_TIER_DENIED_CODE,
  V1_TIER_UNAVAILABLE_CODE,
  V1_ENTITLED_SUBSCRIPTION_STATUSES,
  V1_RATE_LIMIT_MAX_REQUESTS,
  V1_AUTH_FAILURE_MAX_REQUESTS,
  shouldSkipGlobalLimiter,
  v1TierGate,
  v1RateLimitPreHandler,
  recordV1AuthFailure,
  isV1AuthThrottled,
  resetV1RateLimits,
  resetV1AuthFailures,
} from '@/middleware/v1-gate';
import { v1Routes } from '../v1';

const PEPPER = 'test-pepper-for-u2-gate-tests-only';

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
      createdAt: new Date('2026-10-09T08:00:00.000Z'),
      updatedAt: new Date('2026-10-09T08:00:00.000Z'),
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      revokedBy: null,
      ...overrides,
    },
  };
}

function mockValidKey(secret: string, row: Record<string, any>) {
  vi.mocked(prismaMock.apiKey.findMany).mockResolvedValue([row]);
  vi.mocked(prismaMock.agency.findUnique).mockImplementation(async (args: any) => {
    if (args?.where?.id === row.agencyId) {
      return { id: row.agencyId, name: 'Acme' } as any;
    }
    return null;
  });
  void secret;
}

async function buildGatedApp(): Promise<FastifyInstance> {
  const app = Fastify();
  app.addHook('onRequest', apiKeyPreHandler());
  app.addHook('preHandler', v1TierGate());
  app.addHook('preHandler', v1RateLimitPreHandler());
  app.get('/probe', async (_request, reply) => {
    return reply.send({ data: { ok: true }, error: null });
  });
  return app;
}

describe('v1 read-aware tier gate and per-key rate limits (U2)', () => {
  beforeEach(() => {
    process.env.API_KEY_PEPPER = PEPPER;
    vi.clearAllMocks();
    resetV1RateLimits();
    resetV1AuthFailures();
    vi.mocked(prismaMock.apiKey.count).mockResolvedValue(0);
  });

  it('pins its own entitled-status set: trialing and past_due entitled, free/expired denied', () => {
    expect(V1_ENTITLED_SUBSCRIPTION_STATUSES).toEqual(
      expect.arrayContaining(['trialing', 'past_due'])
    );
    expect(V1_ENTITLED_SUBSCRIPTION_STATUSES).not.toContain('expired');
  });

  it('GET under a free-tier key fails with the tier denial code; trialing/past_due pass', async () => {
    const app = await buildGatedApp();
    try {
      const { secret, row } = keyRow();

      // trialing passes
      mockValidKey(secret, row);
      vi.mocked(prismaMock.subscription.findUnique).mockResolvedValue({
        agencyId: 'agency-1',
        tier: 'GROWTH',
        status: 'trialing',
      } as any);
      const trialing = await app.inject({
        method: 'GET',
        url: '/probe',
        headers: { authorization: `Bearer ${secret}` },
      });
      expect(trialing.statusCode).toBe(200);

      // past_due passes
      vi.mocked(prismaMock.subscription.findUnique).mockResolvedValue({
        agencyId: 'agency-1',
        tier: 'GROWTH',
        status: 'past_due',
      } as any);
      const pastDue = await app.inject({
        method: 'GET',
        url: '/probe',
        headers: { authorization: `Bearer ${secret}` },
      });
      expect(pastDue.statusCode).toBe(200);

      // free (no subscription) denied with tier code
      vi.mocked(prismaMock.subscription.findUnique).mockResolvedValue(null);
      const free = await app.inject({
        method: 'GET',
        url: '/probe',
        headers: { authorization: `Bearer ${secret}` },
      });
      expect(free.statusCode).toBe(403);
      expect(free.json().error.code).toBe(V1_TIER_DENIED_CODE);

      // expired denied with tier code
      vi.mocked(prismaMock.subscription.findUnique).mockResolvedValue({
        agencyId: 'agency-1',
        tier: 'GROWTH',
        status: 'expired',
      } as any);
      const expired = await app.inject({
        method: 'GET',
        url: '/probe',
        headers: { authorization: `Bearer ${secret}` },
      });
      expect(expired.statusCode).toBe(403);
      expect(expired.json().error.code).toBe(V1_TIER_DENIED_CODE);
    } finally {
      await app.close();
    }
  });

  it('tier resolution fails closed on store outage; downgrade denies the next request', async () => {
    const app = await buildGatedApp();
    try {
      const { secret, row } = keyRow();
      mockValidKey(secret, row);
      const headers = { authorization: `Bearer ${secret}` };

      // active passes
      vi.mocked(prismaMock.subscription.findUnique).mockResolvedValue({
        agencyId: 'agency-1',
        tier: 'GROWTH',
        status: 'active',
      } as any);
      expect((await app.inject({ method: 'GET', url: '/probe', headers })).statusCode).toBe(200);

      // store outage fails closed (never passes)
      vi.mocked(prismaMock.subscription.findUnique).mockRejectedValue(new Error('db down'));
      const outage = await app.inject({ method: 'GET', url: '/probe', headers });
      expect(outage.statusCode).toBe(503);
      expect(outage.json().error.code).toBe(V1_TIER_UNAVAILABLE_CODE);

      // downgrade during an active key denies the next request (per-request re-check)
      vi.mocked(prismaMock.subscription.findUnique).mockResolvedValue({
        agencyId: 'agency-1',
        tier: 'GROWTH',
        status: 'canceled',
      } as any);
      const downgraded = await app.inject({ method: 'GET', url: '/probe', headers });
      expect(downgraded.statusCode).toBe(403);
      expect(downgraded.json().error.code).toBe(V1_TIER_DENIED_CODE);
    } finally {
      await app.close();
    }
  });

  it('over-limit key gets 429 with Retry-After and remaining headers; v1 skips the global limiter', async () => {
    const app = await buildGatedApp();
    try {
      const { secret, row } = keyRow();
      mockValidKey(secret, row);
      vi.mocked(prismaMock.subscription.findUnique).mockResolvedValue({
        agencyId: 'agency-1',
        tier: 'GROWTH',
        status: 'active',
      } as any);
      const headers = { authorization: `Bearer ${secret}` };

      // standard headers present on success
      const first = await app.inject({ method: 'GET', url: '/probe', headers });
      expect(first.statusCode).toBe(200);
      expect(first.headers['x-ratelimit-limit']).toBe(String(V1_RATE_LIMIT_MAX_REQUESTS));
      expect(first.headers['x-ratelimit-remaining']).toBeDefined();

      // exhaust the per-key budget
      for (let i = 1; i < V1_RATE_LIMIT_MAX_REQUESTS; i++) {
        await app.inject({ method: 'GET', url: '/probe', headers });
      }
      const over = await app.inject({ method: 'GET', url: '/probe', headers });
      expect(over.statusCode).toBe(429);
      expect(over.headers['retry-after']).toBeDefined();
      expect(over.headers['x-ratelimit-remaining']).toBe('0');

      // v1 traffic carries its own authoritative limit: skip the global IP limiter
      expect(shouldSkipGlobalLimiter('/api/v1/self-check')).toBe(true);
      expect(shouldSkipGlobalLimiter('/api/dashboard')).toBe(false);
    } finally {
      await app.close();
    }
  });

  it('repeated bad-key attempts throttle harder than valid-key traffic, keyed by IP plus prefix', () => {
    const ip = '203.0.113.7';
    const prefix = 'ah_live_abcd';
    expect(isV1AuthThrottled(ip, prefix)).toBe(false);
    for (let i = 0; i < V1_AUTH_FAILURE_MAX_REQUESTS; i++) {
      recordV1AuthFailure(ip, prefix);
    }
    expect(isV1AuthThrottled(ip, prefix)).toBe(true);
    // isolation: other IPs and other prefixes are unaffected
    expect(isV1AuthThrottled('198.51.100.9', prefix)).toBe(false);
    expect(isV1AuthThrottled(ip, 'ah_live_zzzz')).toBe(false);
    // brute-force bucket is stricter than the per-key budget
    expect(V1_AUTH_FAILURE_MAX_REQUESTS).toBeLessThan(V1_RATE_LIMIT_MAX_REQUESTS);
  });

  it('self-check discloses the minimum viable set with no plan details', async () => {
    const app = Fastify();
    await app.register(v1Routes);
    try {
      const { secret, row } = keyRow();
      mockValidKey(secret, row);
      vi.mocked(prismaMock.subscription.findUnique).mockResolvedValue({
        agencyId: 'agency-1',
        tier: 'GROWTH',
        status: 'trialing',
      } as any);
      const res = await app.inject({
        method: 'GET',
        url: '/self-check',
        headers: { authorization: `Bearer ${secret}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.agency).toBeDefined();
      expect(body.data.keyPrefix).toBeDefined();
      expect(body.data.scopes).toEqual(['clients:read']);
      expect(body.data.tier).toBeDefined();
      const serialized = JSON.stringify(body);
      expect(serialized).not.toMatch(/keyHash|pepper|secret|plan|price|card|invoice/i);
    } finally {
      await app.close();
    }
  });
});
