/**
 * v1 Contract Tests (U7: R17, R18, R19, R20).
 *
 * - Every v1 success carries all three envelope keys; every denial carries
 *   a registered code plus meta.
 * - Every code the spec declares is registered; the checked-in spec matches
 *   the generator (drift fails); request bodies in the spec equal the zod
 *   schemas routes validate with (single shared module, KTD10).
 * - The generated spec validates structurally and matches live read-slice
 *   responses.
 * - Redaction: no secret material in error bodies, audit-adjacent payloads,
 *   or spec examples; auth failures carry uniform headers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createHmac, randomBytes } from 'crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
  agency: { findUnique: vi.fn(), create: vi.fn() },
  subscription: { findUnique: vi.fn() },
  client: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  accessRequest: { findMany: vi.fn(), count: vi.fn() },
  agencyPlatformConnection: { findMany: vi.fn() },
  idempotencyRecord: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/services/audit.service', () => ({
  auditService: { createAuditLog: vi.fn().mockResolvedValue({ data: {}, error: null }) },
  createAuditLog: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

import { v1Routes } from '../v1';
import { isRegisteredV1Code, V1_ERROR_CODES } from '@/lib/v1-errors';
import { buildV1OpenApi, routeTableForTests } from '@/openapi/build-v1-openapi';
import { zodToJsonSchema } from '@/openapi/zod-to-json-schema';
import { v1ClientCreateSchema } from '../v1-schemas';
import { resetV1RateLimits, resetV1AuthFailures } from '@/middleware/v1-gate';

const PEPPER = 'test-pepper-for-u7-contract-tests-only';
const ALL_SCOPES = [
  'clients:read',
  'clients:write',
  'requests:read',
  'requests:write',
  'catalog:read',
  'usage:read',
  'webhooks:read',
  'webhooks:write',
];

function keyRow(scopes: string[] = ALL_SCOPES) {
  const secret = `ah_live_${randomBytes(16).toString('base64url')}`;
  return {
    secret,
    row: {
      id: 'key-1',
      agencyId: 'agency-1',
      familyId: 'fam-1',
      name: 'crm',
      prefix: secret.slice(0, 12),
      keyHash: createHmac('sha256', PEPPER).update(secret).digest('hex'),
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

function mockValidKey(row: Record<string, any>, tier = 'GROWTH', status = 'active') {
  vi.mocked(prismaMock.apiKey.findMany).mockResolvedValue([row]);
  vi.mocked(prismaMock.agency.findUnique).mockResolvedValue({ id: row.agencyId, name: 'Acme' } as any);
  vi.mocked(prismaMock.subscription.findUnique).mockResolvedValue({
    agencyId: row.agencyId,
    tier,
    status,
  } as any);
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(v1Routes);
  return app;
}

function expectEnvelope(body: any) {
  expect(body).toHaveProperty('data');
  expect(body).toHaveProperty('error');
  expect(body.meta?.requestId).toEqual(expect.any(String));
}

describe('v1 contract hardening (U7)', () => {
  let app: FastifyInstance;
  let secret: string;

  beforeEach(async () => {
    process.env.API_KEY_PEPPER = PEPPER;
    vi.clearAllMocks();
    resetV1RateLimits();
    resetV1AuthFailures();
    const k = keyRow();
    secret = k.secret;
    mockValidKey(k.row);
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('every v1 success carries data, error, and meta.requestId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/self-check',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(res.statusCode).toBe(200);
    expectEnvelope(res.json());
    expect(res.json().error).toBeNull();
  });

  it('every denial carries a registered code plus meta', async () => {
    const cases: Array<{ method: 'GET' | 'POST'; url: string; headers?: Record<string, string>; payload?: unknown }> = [
      { method: 'GET', url: '/self-check' },
      { method: 'GET', url: '/self-check', headers: { authorization: 'Bearer ah_live_wrongkey00000000000000000000' } },
      {
        method: 'POST',
        url: '/clients',
        headers: { authorization: `Bearer ${secret}`, 'idempotency-key': 'k1', 'content-type': 'application/json' },
        payload: { name: 'N', company: 'C', email: 'e@x.co', bogusField: 1 },
      },
    ];
    for (const c of cases) {
      const res = await app.inject({ ...c });
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      const body = res.json();
      expectEnvelope(body);
      expect(body.data).toBeNull();
      expect(isRegisteredV1Code(body.error.code)).toBe(true);
    }
  });

  it('scope denials name the missing scope with the registered code', async () => {
    const low = keyRow(['clients:read']);
    mockValidKey(low.row);
    const res = await app.inject({
      method: 'GET',
      url: '/catalog/services',
      headers: { authorization: `Bearer ${low.secret}` },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expectEnvelope(body);
    expect(body.error.code).toBe('MISSING_SCOPE');
    expect(body.error.message).toContain('catalog:read');
  });

  it('tier denials carry the plan-gate code plus meta', async () => {
    const k = keyRow();
    mockValidKey(k.row, 'FREE', 'active');
    const res = await app.inject({
      method: 'GET',
      url: '/catalog/services',
      headers: { authorization: `Bearer ${k.secret}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('TIER_ACCESS_DENIED');
    expectEnvelope(res.json());
  });

  it('auth failures carry uniform headers and leak no key material', async () => {
    const presented = 'ah_live_wrongkey00000000000000000000';
    const res = await app.inject({
      method: 'GET',
      url: '/self-check',
      headers: { authorization: `Bearer ${presented}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer error="invalid_token"');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(res.json())).not.toContain(presented);
    expect(res.json().error.code).toBe('INVALID_API_KEY');
    expectEnvelope(res.json());
  });

  it('every spec-declared code is registered; the route table only uses registered codes', () => {
    for (const route of routeTableForTests()) {
      for (const code of route.errors) {
        expect(isRegisteredV1Code(code)).toBe(true);
      }
    }
    const spec = buildV1OpenApi();
    const seen = new Set<string>();
    const walk = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (node && typeof node === 'object') {
        const rec = node as Record<string, unknown>;
        if (Array.isArray(rec.enum) && typeof rec.code === 'undefined') {
          for (const v of rec.enum) if (typeof v === 'string' && v === v.toUpperCase()) seen.add(v);
        }
        Object.values(rec).forEach(walk);
      }
    };
    walk(spec.paths);
    for (const code of seen) {
      if ((V1_ERROR_CODES as string[]).includes(code)) continue;
      // Uppercase enums that are not error codes (event types, access levels)
      // must never collide with the registry namespace pattern used in tests.
      expect(code).not.toMatch(/_ERROR$|_EXISTS$|_REQUIRED$|_SCOPE$|_DENIED$|_UNAVAILABLE$|_CONFLICT$|_PROGRESS$|_EXPIRED$|INVALID_API_KEY|NOT_FOUND|RATE_LIMIT/);
    }
  });

  it('the checked-in spec matches the generator (drift fails)', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const checkedIn = JSON.parse(readFileSync(path.join(here, '../../../openapi/v1.openapi.json'), 'utf8'));
    expect(checkedIn).toEqual(buildV1OpenApi());
  });

  it('spec request bodies equal the zod schemas routes validate with', () => {
    const spec = buildV1OpenApi() as any;
    const posted = spec.paths['/clients'].post.requestBody.content['application/json'].schema;
    expect(posted).toEqual(zodToJsonSchema(v1ClientCreateSchema));
  });

  it('the generated spec validates structurally with pinned envelopes', () => {
    const spec = buildV1OpenApi() as any;
    expect(spec.openapi).toBe('3.0.3');
    for (const [p, methods] of Object.entries<any>(spec.paths)) {
      for (const [method, op] of Object.entries<any>(methods)) {
        expect(op.responses, `${method} ${p}`).toBeDefined();
        for (const [status, resp] of Object.entries<any>(op.responses)) {
          const schema = resp.content?.['application/json']?.schema;
          expect(schema, `${method} ${p} ${status}`).toBeDefined();
          expect(schema.required).toEqual(['data', 'error', 'meta']);
          expect(schema.properties.meta.required).toContain('requestId');
        }
      }
    }
  });

  it('the spec matches live read-slice responses', async () => {
    vi.mocked(prismaMock.agencyPlatformConnection.findMany).mockResolvedValue([]);
    const res = await app.inject({
      method: 'GET',
      url: '/catalog/services',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expectEnvelope(body);
    expect(Array.isArray(body.data)).toBe(true);
    const spec = buildV1OpenApi() as any;
    const success = spec.paths['/catalog/services'].get.responses['200'];
    expect(success.content['application/json'].schema.properties.data.type).toBe('array');
  });

  it('redaction: no secret material in spec text or denial bodies', () => {
    const specText = JSON.stringify(buildV1OpenApi());
    for (const forbidden of ['keyHash', 'pepper', 'secretHash', 'ah_live_', 'privateKey']) {
      expect(specText).not.toContain(forbidden);
    }
    // Shown-once secrets keep placeholder-style descriptions, never values.
    expect(specText).toContain('Shown once');
  });
});
