/**
 * v1 Webhooks Tests (U6: R13–R16, covers AE3).
 *
 * Multi-endpoint CRUD, reconciled taxonomy, rotation overlap, ordering
 * primitives, deliveries log, SSRF guards, cap, idempotent creates.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createHmac, randomBytes } from 'crypto';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn().mockResolvedValue(null),
}));

const prismaMock = vi.hoisted(() => ({
  apiKey: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  agency: { findUnique: vi.fn() },
  subscription: { findUnique: vi.fn() },
  webhookEndpoint: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  webhookEvent: { create: vi.fn(), findMany: vi.fn() },
  webhookDelivery: { findMany: vi.fn(), deleteMany: vi.fn() },
  idempotencyRecord: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/services/audit.service', () => ({
  auditService: { createAuditLog: vi.fn().mockResolvedValue({ data: {}, error: null }) },
}));
vi.mock('@/lib/infisical', () => ({
  infisical: {
    generateSecretName: vi.fn((platform: string, id: string) => `${platform}_token_${id}`),
    storePlainSecret: vi.fn().mockResolvedValue('stored'),
    getPlainSecret: vi.fn().mockResolvedValue('whsec_current_secret'),
    deleteSecret: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('@/lib/queue-helpers', () => ({
  queueWebhookDelivery: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { lookup } from 'node:dns/promises';
import { v1Routes } from '../v1';
import { resetV1RateLimits, resetV1AuthFailures } from '@/middleware/v1-gate';
import {
  signWebhookPayload,
  verifyWebhookSignatureWithRotation,
  verifyWebhookTimestamp,
} from '@/lib/webhook-signature';
import {
  assertEndpointHostResolvable,
  validateEndpointUrlSync,
} from '@/services/webhook-endpoint.service';
import {
  collapseDuplicateWebhookEvents,
  emitWebhookEvents,
  sanitizeWebhookPayload,
  sortWebhookEventsBySequence,
} from '@/services/webhook-event.service';
import { purgeExpiredWebhookDeliveries } from '@/services/webhook-delivery.service';

const PEPPER = 'test-pepper-for-u6-webhooks-tests-only';

function keyRow(scopes: string[] = ['webhooks:read', 'webhooks:write']) {
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

function mockValidKey(row: Record<string, any>) {
  vi.mocked(prismaMock.apiKey.findMany).mockResolvedValue([row]);
  vi.mocked(prismaMock.agency.findUnique).mockResolvedValue({ id: row.agencyId, name: 'Acme' } as any);
  vi.mocked(prismaMock.subscription.findUnique).mockResolvedValue({
    agencyId: row.agencyId,
    tier: 'GROWTH',
    status: 'active',
  } as any);
}

function endpointRow(overrides: Record<string, any> = {}) {
  return {
    id: 'endpoint-1',
    agencyId: 'agency-1',
    url: 'https://example.com/hooks',
    status: 'active',
    subscribedEvents: ['access_request.completed'],
    preferredApiVersion: '2026-03-08',
    failureCount: 0,
    secretId: 'webhook_token_endpoint-1',
    pendingSecretId: null,
    pendingSecretExpiresAt: null,
    lastDeliveredAt: null,
    lastFailedAt: null,
    createdAt: new Date('2026-10-09T08:00:00.000Z'),
    updatedAt: new Date('2026-10-09T08:00:00.000Z'),
    ...overrides,
  };
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  // v1Routes mounts the webhook child routes in its key-gated context.
  await app.register(v1Routes);
  return app;
}

describe('U6 webhook v1: ordering primitives (AE3)', () => {
  it('reconstructs true sequence from out-of-order deliveries via per-endpoint sequence', () => {
    const events = [
      { id: 'e3', endpointId: 'ep', sequenceNumber: 3n, correlationId: 'c1' },
      { id: 'e1', endpointId: 'ep', sequenceNumber: 1n, correlationId: 'c1' },
      { id: 'e2', endpointId: 'ep', sequenceNumber: 2n, correlationId: 'c1' },
    ];
    expect(sortWebhookEventsBySequence(events).map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
  });

  it('collapses duplicate deliveries on the global event ID', () => {
    const events = [
      { id: 'e1', endpointId: 'ep', sequenceNumber: 1n, correlationId: 'c1' },
      { id: 'e1', endpointId: 'ep', sequenceNumber: 1n, correlationId: 'c1' },
      { id: 'e2', endpointId: 'ep', sequenceNumber: 2n, correlationId: 'c1' },
    ];
    expect(collapseDuplicateWebhookEvents(events).map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('copies one correlation ID to each per-endpoint event with distinct sequences', async () => {
    vi.mocked(prismaMock.webhookEndpoint.findMany).mockResolvedValue([
      endpointRow({ id: 'ep-a', subscribedEvents: ['access_request.completed'] }),
      endpointRow({ id: 'ep-b', subscribedEvents: ['access_request.completed'] }),
    ] as any);
    let seq = 100n;
    vi.mocked(prismaMock.$queryRaw).mockImplementation(async () => {
      seq += 1n;
      return [{ next: seq }];
    });
    vi.mocked(prismaMock.webhookEvent.create).mockImplementation(async ({ data }: any) => ({
      ...data,
      id: `evt-${data.endpointId}`,
      createdAt: new Date(),
    }) as any);

    const result = await emitWebhookEvents({
      agencyId: 'agency-1',
      type: 'access_request.completed',
      data: { accessRequest: { id: 'req-1' } },
      correlationId: 'corr-fixed-1',
    });

    expect(result.error).toBeNull();
    expect(result.data?.events).toHaveLength(2);
    const [a, b] = result.data!.events;
    expect(a.correlationId).toBe('corr-fixed-1');
    expect(b.correlationId).toBe('corr-fixed-1');
    expect(a.sequenceNumber).not.toBe(b.sequenceNumber);
  });
});

describe('U6 webhook v1: rotation overlap (new-then-old)', () => {
  const payload = JSON.stringify({ hello: 'world' });
  const ts = Math.floor(Date.now() / 1000).toString();

  it('accepts both secrets during overlap, verifying new (pending) before old (current)', () => {
    const pendingSig = signWebhookPayload(payload, 'new-secret', ts);
    const currentSig = signWebhookPayload(payload, 'old-secret', ts);
    const secrets = {
      currentSecret: 'old-secret',
      pendingSecret: 'new-secret',
      pendingExpiresAt: new Date(Date.now() + 60_000),
    };
    expect(verifyWebhookSignatureWithRotation(payload, pendingSig, ts, secrets).matched).toBe('pending');
    expect(verifyWebhookSignatureWithRotation(payload, currentSig, ts, secrets).matched).toBe('current');
  });

  it('rejects the old pending secret after the window while the current secret still verifies', () => {
    const pendingSig = signWebhookPayload(payload, 'new-secret', ts);
    const currentSig = signWebhookPayload(payload, 'old-secret', ts);
    const secrets = {
      currentSecret: 'old-secret',
      pendingSecret: 'new-secret',
      pendingExpiresAt: new Date(Date.now() - 1000),
    };
    expect(verifyWebhookSignatureWithRotation(payload, pendingSig, ts, secrets).ok).toBe(false);
    expect(verifyWebhookSignatureWithRotation(payload, currentSig, ts, secrets).matched).toBe('current');
  });

  it('rejects tampered bodies and timestamps outside the skew window', () => {
    const sig = signWebhookPayload(payload, 's3cret', ts);
    const secrets = { currentSecret: 's3cret' };
    expect(verifyWebhookSignatureWithRotation(payload + 'x', sig, ts, secrets).ok).toBe(false);
    const stale = (Math.floor(Date.now() / 1000) - 3600).toString();
    const staleSig = signWebhookPayload(payload, 's3cret', stale);
    expect(verifyWebhookTimestamp(stale)).toBe(false);
    expect(verifyWebhookSignatureWithRotation(payload, staleSig, stale, secrets).ok).toBe(false);
  });
});

describe('U6 webhook v1: URL validation', () => {
  it('rejects http, private, metadata, and credentialed URLs at validation', () => {
    expect(validateEndpointUrlSync('http://example.com/hooks').ok).toBe(false);
    expect(validateEndpointUrlSync('https://127.0.0.1/hooks').ok).toBe(false);
    expect(validateEndpointUrlSync('https://10.1.2.3/hooks').ok).toBe(false);
    expect(validateEndpointUrlSync('https://192.168.0.5/hooks').ok).toBe(false);
    expect(validateEndpointUrlSync('https://169.254.169.254/hooks').ok).toBe(false);
    expect(validateEndpointUrlSync('https://metadata.google.internal/hooks').ok).toBe(false);
    expect(validateEndpointUrlSync('https://user:pass@example.com/hooks').ok).toBe(false);
    expect(validateEndpointUrlSync('https://example.com/hooks').ok).toBe(true);
  });

  it('rejects hosts that resolve to private addresses at delivery-time re-check', async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: '10.0.0.7', family: 4 }] as any);
    const result = await assertEndpointHostResolvable('https://evil.example/hooks');
    expect(result.allowed).toBe(false);
  });

  it('denies resolution failures closed (unresolvable hosts never reach fetch)', async () => {
    vi.mocked(lookup).mockRejectedValue(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }));
    const result = await assertEndpointHostResolvable('https://example.com/hooks');
    expect(result.allowed).toBe(false);
  });

  it('denies IPv4-mapped IPv6 private literals (::ffff:0:0/96)', () => {
    expect(validateEndpointUrlSync('https://[::ffff:127.0.0.1]/hooks').ok).toBe(false);
    expect(validateEndpointUrlSync('https://[::ffff:10.1.2.3]/hooks').ok).toBe(false);
    expect(validateEndpointUrlSync('https://[::ffff:169.254.169.254]/hooks').ok).toBe(false);
    expect(validateEndpointUrlSync('https://[::ffff:7f00:1]/hooks').ok).toBe(false);
  });
});

describe('U6 webhook v1: plural CRUD, cap, idempotent creates', () => {
  let app: FastifyInstance;
  let secret: string;

  beforeEach(async () => {
    process.env.API_KEY_PEPPER = PEPPER;
    vi.clearAllMocks();
    resetV1RateLimits();
    resetV1AuthFailures();
    // Creation URL checks fail closed on resolver errors; resolve a public
    // IP so example.com hosts pass the delivery-time re-check.
    vi.mocked(lookup).mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as any);
    const k = keyRow();
    secret = k.secret;
    mockValidKey(k.row);
    // Claim cap + in-transaction key-liveness check: live by default.
    vi.mocked(prismaMock.idempotencyRecord.count).mockResolvedValue(0);
    vi.mocked(prismaMock.apiKey.findUnique).mockResolvedValue({ revokedAt: null, expiresAt: null } as any);
    vi.mocked(prismaMock.$transaction).mockImplementation(async (cb: any) => cb(prismaMock));
    app = await buildApp();
  });

  function auth(headers: Record<string, string> = {}) {
    return { authorization: `Bearer ${secret}`, ...headers };
  }

  it('requires the idempotency header on endpoint creates', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhook-endpoints',
      headers: auth(),
      payload: { url: 'https://example.com/hooks', subscribedEvents: ['access_request.completed'] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('rejects private/metadata URLs at creation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhook-endpoints',
      headers: auth({ 'idempotency-key': 'key-1' }),
      payload: { url: 'https://169.254.169.254/hooks', subscribedEvents: ['webhook.test'] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('UNSAFE_ENDPOINT_URL');
  });

  it('fails the 11th endpoint with the cap code', async () => {
    vi.mocked(prismaMock.webhookEndpoint.count).mockResolvedValue(10);
    vi.mocked(prismaMock.idempotencyRecord.create).mockResolvedValue({ id: 'idem-cap', state: 'in_progress' } as any);
    vi.mocked(prismaMock.idempotencyRecord.updateMany).mockResolvedValue({ count: 1 } as any);
    const res = await app.inject({
      method: 'POST',
      url: '/webhook-endpoints',
      headers: auth({ 'idempotency-key': 'key-1' }),
      payload: { url: 'https://example.com/hooks', subscribedEvents: ['webhook.test'] },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('WEBHOOK_ENDPOINT_CAP_EXCEEDED');
  });

  it('replays retried creates instead of duplicating', async () => {
    vi.mocked(prismaMock.webhookEndpoint.count).mockResolvedValue(0);
    vi.mocked(prismaMock.webhookEndpoint.findFirst).mockResolvedValue(null);
    const payload = { url: 'https://example.com/hooks', subscribedEvents: ['webhook.test'] };
    const { fingerprintRequest: fp } = await import('@/services/idempotency.service');
    const stored = {
      statusCode: 201,
      result: { data: { endpoint: { id: 'endpoint-1' } }, error: null },
    };
    // First call claims, second call collides -> replay.
    vi.mocked(prismaMock.idempotencyRecord.create)
      .mockResolvedValueOnce({ id: 'idem-1', state: 'in_progress' } as any)
      .mockRejectedValueOnce({ code: 'P2002' });
    vi.mocked(prismaMock.webhookEndpoint.create).mockResolvedValue(endpointRow() as any);
    vi.mocked(prismaMock.idempotencyRecord.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prismaMock.idempotencyRecord.findUnique).mockResolvedValue({
      id: 'idem-1',
      state: 'completed',
      fingerprint: fp(payload),
      statusCode: stored.statusCode,
      result: stored.result,
      expiresAt: new Date(Date.now() + 60_000),
    } as any);

    const first = await app.inject({
      method: 'POST', url: '/webhook-endpoints', headers: auth({ 'idempotency-key': 'same-key' }), payload,
    });
    expect(first.statusCode).toBe(201);
    expect(prismaMock.webhookEndpoint.create).toHaveBeenCalledTimes(1);
    expect(first.json().data.signingSecret).toMatch(/^[a-f0-9]{64}$/);

    const retry = await app.inject({
      method: 'POST', url: '/webhook-endpoints', headers: auth({ 'idempotency-key': 'same-key' }), payload,
    });
    expect(retry.statusCode).toBe(201);
    expect(prismaMock.webhookEndpoint.create).toHaveBeenCalledTimes(1);
    // Replay strips the shown-once secret and re-wraps with a fresh request ID.
    expect(retry.json().data.signingSecret).toBeUndefined();
    expect(retry.json().data.endpoint).toEqual({ id: 'endpoint-1' });
    expect(retry.json().meta.requestId).not.toBe(first.json().meta.requestId);
  });

  it('denies out-of-scope keys naming the missing scope', async () => {
    const k = keyRow(['webhooks:read']);
    mockValidKey(k.row);
    const res = await app.inject({
      method: 'POST',
      url: '/webhook-endpoints',
      headers: { authorization: `Bearer ${k.secret}`, 'idempotency-key': 'k' },
      payload: { url: 'https://example.com/hooks', subscribedEvents: ['webhook.test'] },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('MISSING_SCOPE');
    expect(res.json().error.message).toContain('webhooks:write');
  });
});

describe('U6 webhook v1: taxonomy, emit storm, retention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delivers previously unsubscribable events once subscribed', async () => {
    vi.mocked(prismaMock.webhookEndpoint.findMany).mockResolvedValue([
      endpointRow({ subscribedEvents: ['connection.status_changed'] }),
    ] as any);
    vi.mocked(prismaMock.$queryRaw).mockResolvedValue([{ next: 1n }]);
    vi.mocked(prismaMock.webhookEvent.create).mockImplementation(async ({ data }: any) => ({
      ...data, id: 'evt-1', createdAt: new Date(),
    }) as any);

    const result = await emitWebhookEvents({
      agencyId: 'agency-1',
      type: 'connection.status_changed',
      data: { connectionId: 'conn-1' },
    });
    expect(result.error).toBeNull();
    expect(result.data?.events).toHaveLength(1);
    expect(result.data?.events[0].type).toBe('connection.status_changed');
  });

  it('keeps sequences unique with no failed deliveries under a concurrent-emit storm', async () => {
    vi.mocked(prismaMock.webhookEndpoint.findMany).mockResolvedValue([endpointRow()] as any);
    let seq = 0n;
    vi.mocked(prismaMock.$queryRaw).mockImplementation(async () => {
      seq += 1n;
      return [{ next: seq }];
    });
    vi.mocked(prismaMock.webhookEvent.create).mockImplementation(async ({ data }: any) => ({
      ...data, id: `evt-${String(data.sequenceNumber)}`, createdAt: new Date(),
    }) as any);

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        emitWebhookEvents({ agencyId: 'agency-1', type: 'access_request.completed', data: { n: i } }),
      ),
    );
    expect(results.every((r) => r.error === null)).toBe(true);
    const seqs = results.map((r) => String(r.data!.events[0].sequenceNumber));
    expect(new Set(seqs).size).toBe(20);
  });

  it('purges only expired deliveries and strips token pointers from payloads', async () => {
    vi.mocked(prismaMock.webhookDelivery.deleteMany).mockResolvedValue({ count: 7 } as any);
    const purged = await purgeExpiredWebhookDeliveries(new Date('2026-10-09T00:00:00.000Z'));
    expect(purged).toBe(7);
    const args = vi.mocked(prismaMock.webhookDelivery.deleteMany).mock.calls[0]?.[0] as any;
    expect(args?.where?.createdAt?.lte).toEqual(new Date('2026-07-11T00:00:00.000Z'));

    const clean = sanitizeWebhookPayload({
      accessRequest: { id: 'req-1' },
      uniqueToken: 'tok_secret',
      nested: { secretId: 'whsec_x', keep: 'yes' },
    }) as any;
    expect(clean.uniqueToken).toBeUndefined();
    expect(clean.nested.secretId).toBeUndefined();
    expect(clean.accessRequest.id).toBe('req-1');
    expect(clean.nested.keep).toBe('yes');
  });
});
