/**
 * U4 write-foundations tests (R6, R7, R8, R13 storage half).
 *
 * Covers KTD4 (agency-scoped external ID uniqueness), KTD5 (atomic
 * idempotency claim, fingerprint replay/conflict, expiry, purge of expired
 * rows in every state, failed-state terminal conflict, per-identity live
 * cap, in-progress lease steal), and the KTD7 expand-half migration guards
 * (singleton guard preserved, api_keys table present).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma.js';
import {
  EXTERNAL_ID_CONFLICT_CODE,
  IDEMPOTENCY_CONFLICT_CODE,
  IDEMPOTENCY_EXPIRED_CODE,
  IDEMPOTENCY_IN_PROGRESS_CODE,
  IDEMPOTENCY_LIMIT_CODE,
  IDEMPOTENCY_TTL_MS,
  IdempotencyConflictError,
  IdempotencyExpiredError,
  IdempotencyInProgressError,
  IdempotencyLimitError,
  fingerprintRequest,
  idempotencyService,
  isPrismaUniqueViolation,
} from '@/services/idempotency.service.js';

vi.mock('@/lib/prisma.js', () => ({
  prisma: {
    idempotencyRecord: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const claimInput = {
  agencyId: 'agency-1',
  keyIdentity: 'key-1',
  endpoint: 'POST /api/v1/clients',
  key: 'idem-key-1',
  fingerprint: fingerprintRequest({ name: 'Acme' }),
};

const uniqueWhere = {
  agencyId_keyIdentity_endpoint_idemKey: {
    agencyId: 'agency-1',
    keyIdentity: 'key-1',
    endpoint: 'POST /api/v1/clients',
    idemKey: 'idem-key-1',
  },
};

function p2002() {
  // Prisma surfaces atomic-claim races as a unique-violation on the
  // (agency, key identity, endpoint, key) composite.
  return { code: 'P2002' };
}

describe('fingerprintRequest', () => {
  it('is stable across key order and sensitive to body changes', () => {
    expect(fingerprintRequest({ a: 1, b: 2 })).toBe(fingerprintRequest({ b: 2, a: 1 }));
    expect(fingerprintRequest({ a: 1 })).not.toBe(fingerprintRequest({ a: 2 }));
  });
});

describe('idempotencyService.claim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.idempotencyRecord.count).mockResolvedValue(0);
  });

  it('claims a fresh key as in_progress with the 72h retention window', async () => {
    vi.mocked(prisma.idempotencyRecord.create).mockImplementation(async ({ data }: any) => ({
      id: 'rec-1',
      ...data,
    }));
    const before = Date.now();

    const outcome = await idempotencyService.claim(claimInput);

    expect(outcome.status).toBe('claimed');
    expect(prisma.idempotencyRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agencyId: 'agency-1',
          keyIdentity: 'key-1',
          endpoint: 'POST /api/v1/clients',
          idemKey: 'idem-key-1',
          state: 'in_progress',
        }),
      }),
    );
    const created: any = vi.mocked(prisma.idempotencyRecord.create).mock.calls[0][0];
    expect(created.data.expiresAt.getTime() - before).toBeGreaterThanOrEqual(IDEMPOTENCY_TTL_MS - 1000);
    expect(IDEMPOTENCY_TTL_MS).toBe(72 * 60 * 60 * 1000);
  });

  it('lets concurrent identical claims execute once: loser sees in_progress distinctly', async () => {
    vi.mocked(prisma.idempotencyRecord.create).mockRejectedValue(p2002());
    vi.mocked(prisma.idempotencyRecord.findUnique).mockResolvedValue({
      id: 'rec-1',
      state: 'in_progress',
      fingerprint: claimInput.fingerprint,
      expiresAt: new Date(Date.now() + 60_000),
    } as any);

    await expect(idempotencyService.claim(claimInput)).rejects.toBeInstanceOf(
      IdempotencyInProgressError,
    );
    await expect(idempotencyService.claim(claimInput)).rejects.toMatchObject({
      code: IDEMPOTENCY_IN_PROGRESS_CODE,
    });
    expect(IDEMPOTENCY_IN_PROGRESS_CODE).not.toBe(IDEMPOTENCY_CONFLICT_CODE);
  });

  it('conflicts distinctly when the same key carries a different body', async () => {
    vi.mocked(prisma.idempotencyRecord.create).mockRejectedValue(p2002());
    vi.mocked(prisma.idempotencyRecord.findUnique).mockResolvedValue({
      id: 'rec-1',
      state: 'completed',
      fingerprint: fingerprintRequest({ name: 'Someone else' }),
      expiresAt: new Date(Date.now() + 60_000),
    } as any);

    await expect(idempotencyService.claim(claimInput)).rejects.toBeInstanceOf(
      IdempotencyConflictError,
    );
    await expect(idempotencyService.claim(claimInput)).rejects.toMatchObject({
      code: IDEMPOTENCY_CONFLICT_CODE,
    });
  });

  it('replays the stored result for the same key and body without a duplicate', async () => {
    const stored = { id: 'client-1' };
    vi.mocked(prisma.idempotencyRecord.create).mockRejectedValue(p2002());
    vi.mocked(prisma.idempotencyRecord.findUnique).mockResolvedValue({
      id: 'rec-1',
      state: 'completed',
      fingerprint: claimInput.fingerprint,
      statusCode: 201,
      result: stored,
      expiresAt: new Date(Date.now() + 60_000),
    } as any);

    const outcome = await idempotencyService.claim(claimInput);

    expect(outcome.status).toBe('replay');
    expect(outcome.record.result).toEqual(stored);
    expect(prisma.idempotencyRecord.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: uniqueWhere }),
    );
  });

  it('fails expired keys with a distinct code instead of creating anew', async () => {
    vi.mocked(prisma.idempotencyRecord.create).mockRejectedValue(p2002());
    vi.mocked(prisma.idempotencyRecord.findUnique).mockResolvedValue({
      id: 'rec-1',
      state: 'completed',
      fingerprint: claimInput.fingerprint,
      expiresAt: new Date(Date.now() - 1000),
    } as any);

    await expect(idempotencyService.claim(claimInput)).rejects.toBeInstanceOf(
      IdempotencyExpiredError,
    );
    await expect(idempotencyService.claim(claimInput)).rejects.toMatchObject({
      code: IDEMPOTENCY_EXPIRED_CODE,
    });
    expect(IDEMPOTENCY_EXPIRED_CODE).not.toBe(IDEMPOTENCY_CONFLICT_CODE);
  });

  it('never replays a terminally failed record: failed conflicts distinctly', async () => {
    vi.mocked(prisma.idempotencyRecord.create).mockRejectedValue(p2002());
    vi.mocked(prisma.idempotencyRecord.findUnique).mockResolvedValue({
      id: 'rec-1',
      state: 'failed',
      fingerprint: claimInput.fingerprint,
      statusCode: null,
      result: null,
      expiresAt: new Date(Date.now() + 60_000),
    } as any);

    await expect(idempotencyService.claim(claimInput)).rejects.toBeInstanceOf(
      IdempotencyConflictError,
    );
    await expect(idempotencyService.claim(claimInput)).rejects.toMatchObject({
      code: IDEMPOTENCY_CONFLICT_CODE,
    });
  });

  it('enforces the per-identity live-record cap with the stable over-cap code', async () => {
    vi.mocked(prisma.idempotencyRecord.count).mockResolvedValue(100);

    await expect(idempotencyService.claim(claimInput)).rejects.toBeInstanceOf(
      IdempotencyLimitError,
    );
    await expect(idempotencyService.claim(claimInput)).rejects.toMatchObject({
      code: IDEMPOTENCY_LIMIT_CODE,
    });
    expect(prisma.idempotencyRecord.create).not.toHaveBeenCalled();
    expect(IDEMPOTENCY_LIMIT_CODE).toBe('IDEMPOTENCY_LIMIT_EXCEEDED');
  });

  it('counts only non-expired rows for the identity toward the cap', async () => {
    vi.mocked(prisma.idempotencyRecord.count).mockResolvedValue(0);
    vi.mocked(prisma.idempotencyRecord.create).mockImplementation(async ({ data }: any) => ({
      id: 'rec-1',
      ...data,
    }));

    await idempotencyService.claim(claimInput);

    expect(prisma.idempotencyRecord.count).toHaveBeenCalledWith({
      where: {
        agencyId: 'agency-1',
        keyIdentity: 'key-1',
        expiresAt: { gt: expect.any(Date) },
      },
    });
  });

  it('steals an in-progress claim past the 15-minute lease via delete+fresh-claim in one transaction', async () => {
    vi.mocked(prisma.idempotencyRecord.create).mockRejectedValue(p2002());
    vi.mocked(prisma.idempotencyRecord.findUnique).mockResolvedValue({
      id: 'rec-stuck',
      state: 'in_progress',
      fingerprint: claimInput.fingerprint,
      createdAt: new Date(Date.now() - 16 * 60 * 1000),
      expiresAt: new Date(Date.now() + 60_000),
    } as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      const tx = {
        idempotencyRecord: {
          delete: vi.fn().mockResolvedValue({ id: 'rec-stuck' }),
          create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: 'rec-2', ...data })),
        },
      };
      return cb(tx);
    });

    const outcome = await idempotencyService.claim(claimInput);

    expect(outcome.status).toBe('claimed');
    expect(outcome.record.id).toBe('rec-2');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('keeps a fresh in-progress claim conflicting inside the lease', async () => {
    vi.mocked(prisma.idempotencyRecord.create).mockRejectedValue(p2002());
    vi.mocked(prisma.idempotencyRecord.findUnique).mockResolvedValue({
      id: 'rec-1',
      state: 'in_progress',
      fingerprint: claimInput.fingerprint,
      createdAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60_000),
    } as any);

    await expect(idempotencyService.claim(claimInput)).rejects.toBeInstanceOf(
      IdempotencyInProgressError,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('isolates claims by agency plus key identity, endpoint, and key value', async () => {
    vi.mocked(prisma.idempotencyRecord.create).mockImplementation(async ({ data }: any) => ({
      id: 'rec-1',
      ...data,
    }));

    await idempotencyService.claim(claimInput);

    expect(prisma.idempotencyRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining(uniqueWhere.agencyId_keyIdentity_endpoint_idemKey) }),
    );
  });
});

describe('idempotencyService.complete / purgeExpired', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores the business result on completion', async () => {
    vi.mocked(prisma.idempotencyRecord.updateMany).mockResolvedValue({ count: 1 } as any);

    await idempotencyService.complete({ recordId: 'rec-1', statusCode: 201, result: { id: 'c1' } });

    expect(prisma.idempotencyRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'rec-1', state: 'in_progress' }),
        data: expect.objectContaining({ state: 'completed', statusCode: 201 }),
      }),
    );
  });

  it('collects expired in-progress rows past expiresAt: no state is exempt', async () => {
    vi.mocked(prisma.idempotencyRecord.deleteMany).mockResolvedValue({ count: 3 } as any);

    const deleted = await idempotencyService.purgeExpired(new Date());

    expect(deleted).toBe(3);
    expect(prisma.idempotencyRecord.deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { lte: expect.any(Date) },
      },
    });
  });
});

describe('external-ID violation mapping (KTD4, storage half)', () => {
  it('maps DB unique violations to the stable conflict code', () => {
    expect(isPrismaUniqueViolation({ code: 'P2002' })).toBe(true);
    expect(isPrismaUniqueViolation({ code: 'P2025' })).toBe(false);
    expect(isPrismaUniqueViolation(null)).toBe(false);
    expect(EXTERNAL_ID_CONFLICT_CODE).toBe('EXTERNAL_ID_CONFLICT');
  });
});

describe('U4 expand migration guards (KTD7 expand half)', () => {
  const migrationSql = readFileSync(
    join(process.cwd(), 'prisma/migrations/20261009120000_v1_write_foundations_expand/migration.sql'),
    'utf8',
  );

  it('adds the nullable agency-scoped external ID with a null-tolerant unique guard', () => {
    // Composite (agency, external ID): duplicates fail in-agency, succeed
    // cross-agency; NULLs never conflict so no backfill is required.
    expect(migrationSql).toMatch(/external_client_id/i);
    expect(migrationSql).toMatch(/UNIQUE INDEX[^;]*\(\s*"agency_id"\s*,\s*"external_client_id"\s*\)/);
    const addColumn = migrationSql.match(/ADD COLUMN\s*"external_client_id"[^;]*;/);
    expect(addColumn).not.toBeNull();
    expect(addColumn![0]).not.toMatch(/NOT NULL/);
  });

  it('keeps the webhook singleton guard: expand only, contract lands with U6', () => {
    // Existing singleton row survives untouched as the future first record;
    // no destructive step may run before the service code goes plural.
    expect(migrationSql).not.toMatch(/DROP CONSTRAINT[^;]*webhook_endpoints_agency_id_key/);
    expect(migrationSql).not.toMatch(/DROP TABLE/);
  });

  it('creates the idempotency store with atomic-claim and purge indexes', () => {
    expect(migrationSql).toMatch(/CREATE TABLE[^;]*"idempotency_records"/);
    expect(migrationSql).toMatch(
      /UNIQUE INDEX[^;]*\(\s*"agency_id"\s*,\s*"key_identity"\s*,\s*"endpoint"\s*,\s*"idem_key"\s*\)/,
    );
    expect(migrationSql).toMatch(/"expires_at".*"state"|"state".*"expires_at"/);
  });

  it('creates the per-endpoint ordering sequence with documented gap tolerance', () => {
    expect(migrationSql).toMatch(/CREATE SEQUENCE[^;]*webhook_endpoint_sequence/);
  });

  it('creates the api_keys table with hash uniqueness and lookup indexes', () => {
    expect(migrationSql).toMatch(/CREATE TABLE[^;]*"api_keys"/);
    expect(migrationSql).toMatch(/"key_hash" TEXT NOT NULL/);
    expect(migrationSql).toMatch(/UNIQUE[^;]*\(\s*"key_hash"\s*\)/);
    expect(migrationSql).toMatch(/\(\s*"prefix"\s*\)/);
    expect(migrationSql).toMatch(/\(\s*"agency_id"\s*,\s*"revoked_at"\s*\)/);
    expect(migrationSql).toMatch(/\(\s*"family_id"\s*,\s*"revoked_at"\s*\)/);
  });
});
