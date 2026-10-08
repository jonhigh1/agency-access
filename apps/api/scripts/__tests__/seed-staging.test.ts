/**
 * Tests for the staging seed: the localhost-only DATABASE_URL guard and
 * idempotency against an in-memory fake Prisma. No database is touched.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  STAGING_SEED,
  UnsafeSeedTargetError,
  assertLocalDatabaseUrl,
  main,
  runStagingSeed,
  type SeedPrisma,
} from '../seed-staging';

describe('assertLocalDatabaseUrl', () => {
  it.each([
    'postgresql://stg:stg@localhost:5433/authhub_staging',
    'postgresql://stg:stg@127.0.0.1:5433/authhub_staging',
    'postgres://stg@LOCALHOST/authhub_staging?sslmode=disable',
  ])('allows %s', (url) => {
    expect(() => assertLocalDatabaseUrl(url)).not.toThrow();
  });

  it.each([
    [undefined, /not set/],
    ['', /not set/],
    ['not a url', /not a valid URL/],
    ['mysql://root@localhost/db', /postgres/],
    ['postgresql://u:p@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require', /not localhost/],
    ['postgresql://u:p@db.example.com:5432/app', /not localhost/],
    ['postgresql://u:p@localhost.evil.com:5432/app', /not localhost/],
    ['postgresql://u:p@127.0.0.1.nip.io:5432/app', /not localhost/],
    ['postgresql://u:p@127.0.0.2:5432/app', /not localhost/],
    ['postgresql://u:p@[::1]:5432/app', /not localhost/],
    ['postgresql://u:p@0.0.0.0:5432/app', /not localhost/],
    ['postgresql://localhost:p@db.example.com/app', /not localhost/],
    ['postgresql://u:p@localhost:5432/app?host=db.example.com', /"host" parameter/],
    ['postgresql://u:p@localhost:5432/app?hostaddr=10.0.0.5', /"hostaddr" parameter/],
  ])('refuses %j', (url, message) => {
    expect(() => assertLocalDatabaseUrl(url as string | undefined)).toThrow(UnsafeSeedTargetError);
    expect(() => assertLocalDatabaseUrl(url as string | undefined)).toThrow(message);
  });
});

describe('main guard', () => {
  it('exits 1 without ever creating a Prisma client for a non-local host', async () => {
    const createPrisma = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const code = await main(
      { DATABASE_URL: 'postgresql://u:p@db.example.com:5432/app' } as NodeJS.ProcessEnv,
      createPrisma
    );
    expect(code).toBe(1);
    expect(createPrisma).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('refusing to seed'));
    errorSpy.mockRestore();
  });

  it('exits 1 when DATABASE_URL is missing', async () => {
    const createPrisma = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await main({} as NodeJS.ProcessEnv, createPrisma)).toBe(1);
    expect(createPrisma).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('seeds through the guarded URL for localhost', async () => {
    const fake = createFakePrisma();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const createPrisma = vi.fn(() => fake);
    const code = await main(
      { DATABASE_URL: 'postgresql://stg:stg@127.0.0.1:5433/authhub_staging' } as NodeJS.ProcessEnv,
      createPrisma
    );
    expect(code).toBe(0);
    expect(createPrisma).toHaveBeenCalledWith('postgresql://stg:stg@127.0.0.1:5433/authhub_staging');
    expect(fake.$disconnect).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});

type Row = Record<string, any>;

function createFakePrisma() {
  const agencies: Row[] = [];
  const members: Row[] = [];
  const clients: Row[] = [];
  const requests: Row[] = [];
  let nextId = 1;
  const id = () => `id-${nextId++}`;

  const fake: SeedPrisma & { $disconnect: ReturnType<typeof vi.fn>; tables: Record<string, Row[]> } = {
    tables: { agencies, members, clients, requests },
    $disconnect: vi.fn(async () => undefined),
    agency: {
      async upsert({ where, update, create }: any) {
        const found = agencies.find((a) => a.email === where.email);
        if (found) return Object.assign(found, update);
        const row = { id: id(), ...create };
        agencies.push(row);
        return row as any;
      },
    },
    agencyMember: {
      async upsert({ where, update, create }: any) {
        const key = where.agencyId_email;
        const found = members.find((m) => m.agencyId === key.agencyId && m.email === key.email);
        if (found) return Object.assign(found, update);
        const row = { id: id(), ...create };
        members.push(row);
        return row;
      },
    },
    client: {
      async upsert({ where, update, create }: any) {
        const key = where.agencyId_email;
        const found = clients.find((c) => c.agencyId === key.agencyId && c.email === key.email);
        if (found) return Object.assign(found, update);
        const row = { id: id(), ...create };
        clients.push(row);
        return row as any;
      },
    },
    accessRequest: {
      async findFirst({ where }: any) {
        return (
          (requests.find(
            (r) => r.agencyId === where.agencyId && r.externalReference === where.externalReference
          ) as any) ?? null
        );
      },
      async update({ where, data }: any) {
        const row = requests.find((r) => r.id === where.id)!;
        return Object.assign(row, data) as any;
      },
      async create({ data }: any) {
        const row = { id: id(), ...data };
        requests.push(row);
        return row as any;
      },
    },
  };
  return fake;
}

describe('runStagingSeed', () => {
  it('creates two agencies, a client, a pending request and a client invite with fake example.com data', async () => {
    const fake = createFakePrisma();
    const result = await runStagingSeed(fake, {
      env: { FRONTEND_URL: 'https://staging.example.com/' } as NodeJS.ProcessEnv,
      now: new Date('2026-10-08T00:00:00Z'),
    });

    expect(fake.tables.agencies.map((a) => a.email)).toEqual([
      STAGING_SEED.agencyOne.email,
      STAGING_SEED.agencyTwo.email,
    ]);
    expect(fake.tables.members).toHaveLength(2);
    expect(fake.tables.clients).toHaveLength(1);
    expect(fake.tables.requests).toHaveLength(2);
    expect(fake.tables.requests.every((r) => r.status === 'pending')).toBe(true);
    expect(fake.tables.requests[0].clientId).toBe(fake.tables.clients[0].id);
    expect(fake.tables.requests[1].clientId).toBeUndefined();
    expect(fake.tables.requests.every((r) => /^[0-9a-f]{12}$/.test(r.uniqueToken))).toBe(true);
    expect(result.pendingRequest.inviteUrl).toMatch(/^https:\/\/staging\.example\.com\/invite\/[0-9a-f]{12}$/);
    expect(result.clientInvite.inviteUrl).toMatch(/^https:\/\/staging\.example\.com\/invite\/[0-9a-f]{12}$/);

    const allEmails = [
      ...fake.tables.agencies.map((a) => a.email),
      ...fake.tables.members.map((m) => m.email),
      ...fake.tables.clients.map((c) => c.email),
      ...fake.tables.requests.map((r) => r.clientEmail),
    ];
    expect(allEmails.every((email) => email.endsWith('@example.com'))).toBe(true);
  });

  it('is idempotent: a second run adds no rows and keeps invite tokens', async () => {
    const fake = createFakePrisma();
    const first = await runStagingSeed(fake, { env: {} as NodeJS.ProcessEnv });
    fake.tables.requests[0].status = 'completed';
    const second = await runStagingSeed(fake, { env: {} as NodeJS.ProcessEnv });

    expect(fake.tables.agencies).toHaveLength(2);
    expect(fake.tables.members).toHaveLength(2);
    expect(fake.tables.clients).toHaveLength(1);
    expect(fake.tables.requests).toHaveLength(2);
    expect(second.pendingRequest.inviteUrl).toBe(first.pendingRequest.inviteUrl);
    expect(second.clientInvite.inviteUrl).toBe(first.clientInvite.inviteUrl);
    expect(fake.tables.requests[0].status).toBe('pending');
    expect(first.pendingRequest.inviteUrl.startsWith('http://localhost:3000/invite/')).toBe(true);
  });

  it('links Clerk dev-instance user ids only when provided', async () => {
    const fake = createFakePrisma();
    await runStagingSeed(fake, {
      env: { STAGING_SEED_CLERK_USER_ID_ONE: 'user_devOne' } as NodeJS.ProcessEnv,
    });
    expect(fake.tables.agencies[0].clerkUserId).toBe('user_devOne');
    expect(fake.tables.agencies[1].clerkUserId).toBeUndefined();
  });
});
