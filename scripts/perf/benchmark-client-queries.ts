/** Run only against the disposable local authhub_perf PostgreSQL database. */
import { existsSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import { performance } from 'node:perf_hooks';

const apiRequire = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { PrismaClient } = apiRequire('@prisma/client') as typeof import('../../apps/api/node_modules/@prisma/client');

const rawUrl = process.env.PERF_DATABASE_URL;
if (!rawUrl) throw new Error('PERF_DATABASE_URL is required');
const url = new URL(rawUrl);
const socket = url.searchParams.get('host');
const socketPath = socket && existsSync(socket) ? realpathSync(socket) : '';
if (
  !['postgres:', 'postgresql:'].includes(url.protocol) ||
  url.username !== 'authhub_perf' ||
  url.pathname !== '/authhub_perf' ||
  url.hostname !== 'localhost' ||
  !socketPath.includes('/authhub-performance-db-') ||
  basename(socketPath) !== 'socket' ||
  !existsSync(join(socketPath, `.s.PGSQL.${url.port}`))
) throw new Error('PERF_DATABASE_URL must target private authhub_perf user/database over its Unix socket');

// Set this before importing the application service or Prisma singleton.
process.env.DATABASE_URL = rawUrl;
process.env.NODE_ENV = 'test';
for (const [key, value] of Object.entries({
  FRONTEND_URL: 'http://localhost:3000', API_URL: 'http://localhost:3001',
  CLERK_PUBLISHABLE_KEY: 'pk_test_perf', CLERK_SECRET_KEY: 'sk_test_perf',
  INFISICAL_CLIENT_ID: 'perf', INFISICAL_CLIENT_SECRET: 'perf',
  INFISICAL_PROJECT_ID: 'perf', INFISICAL_ENVIRONMENT: 'test',
  META_APP_ID: 'perf', META_APP_SECRET: 'perf',
  CREEM_API_KEY: 'perf', CREEM_WEBHOOK_SECRET: 'perf',
})) process.env[key] = value;

const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
(globalThis as unknown as { prisma: PrismaClient }).prisma = prisma;
let observed: number[] | null = null;
prisma.$on('query', (event) => { observed?.push(event.duration); });

const sizes = [50, 500, 5000] as const;
const ids = sizes.map((size) => `perf-agency-${size}`);
const phase = process.env.PERF_PHASE;
if (phase !== 'before' && phase !== 'after') throw new Error('PERF_PHASE must be before or after');
const output = `docs/audits/2026-10-01-authhub-performance/client-query-measurements-${phase}.json`;
const platforms = ['google_ads'];
const now = Date.now();

function batches<T>(items: T[], size = 500): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

async function seed() {
  await prisma.agency.deleteMany({ where: { id: { in: ids } } });
  for (const size of sizes) {
    const agencyId = `perf-agency-${size}`;
    await prisma.agency.create({ data: { id: agencyId, name: 'Synthetic performance agency', email: `${agencyId}@example.invalid` } });
    const clients = Array.from({ length: size }, (_, i) => ({
      id: `perf-client-${size}-${i}`, agencyId,
      name: i % 100 === 0 ? `Needle Client ${i}` : `Client ${i}`,
      company: `Company ${i}`, email: `client-${size}-${i}@example.invalid`,
      createdAt: new Date(now - i * 1000),
    }));
    for (const batch of batches(clients)) await prisma.client.createMany({ data: batch });

    const requests = clients.filter((_, i) => i % 4 === 0).map((client, i) => ({
      id: `perf-request-${size}-${i}`, agencyId, clientId: client.id,
      clientName: client.name, clientEmail: client.email,
      uniqueToken: `perf-token-${size}-${i}`, platforms,
      status: 'pending', expiresAt: new Date(now + 86_400_000),
      createdAt: client.createdAt,
    }));
    if (size === 5000) {
      for (let i = 0; i < 100; i++) requests.push({
        id: `perf-heavy-request-${i}`, agencyId, clientId: clients[0].id,
        clientName: clients[0].name, clientEmail: clients[0].email,
        uniqueToken: `perf-heavy-token-${i}`, platforms,
        status: 'pending', expiresAt: new Date(now + 86_400_000),
        createdAt: new Date(now - (i + 1) * 1000),
      });
      for (let i = 0; i < 1000; i++) requests.push({
        id: `perf-long-request-${i}`, agencyId, clientId: clients[1].id,
        clientName: clients[1].name, clientEmail: clients[1].email,
        uniqueToken: `perf-long-token-${i}`, platforms,
        status: 'pending', expiresAt: new Date(now + 86_400_000),
        createdAt: new Date(now - (i + 1) * 1000),
      });
    }
    for (const batch of batches(requests)) await prisma.accessRequest.createMany({ data: batch });
    const connections = requests.filter((_, i) => i % 2 === 0).map((request, i) => ({
      id: `perf-connection-${size}-${i}`, accessRequestId: request.id,
      agencyId, clientEmail: request.clientEmail, status: 'active',
    }));
    for (const batch of batches(connections)) await prisma.clientConnection.createMany({ data: batch });
    const authorizations = connections.map((connection, i) => ({
      id: `perf-authorization-${size}-${i}`, connectionId: connection.id,
      platform: 'google_ads', secretId: 'synthetic-reference', status: 'active',
    }));
    for (const batch of batches(authorizations)) await prisma.platformAuthorization.createMany({ data: batch });
  }
}

async function measure<T>(name: string, read: () => Promise<T>) {
  for (let i = 0; i < 5; i++) await read();
  const samples: Array<{ wallMs: number; queries: number; summedQueryMs: number; returned?: number }> = [];
  for (let i = 0; i < 30; i++) {
    observed = [];
    const started = performance.now();
    const result = await read();
    await new Promise<void>((resolve) => setImmediate(resolve));
    samples.push({ wallMs: +(performance.now() - started).toFixed(2), queries: observed.length,
      summedQueryMs: +observed.reduce((sum, ms) => sum + ms, 0).toFixed(2),
      returned: Array.isArray((result as { data?: unknown[] })?.data) ? (result as { data: unknown[] }).data.length : undefined });
    observed = null;
  }
  const sorted = samples.map((sample) => sample.wallMs).sort((a, b) => a - b);
  return { name, warmups: 5, samples, p50WallMs: sorted[14], p95WallMs: sorted[28] };
}

async function explain(sql: string, agencyId: string, search?: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': unknown }>>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, agencyId, ...(search ? [search] : [])
  );
  return rows[0]?.['QUERY PLAN'];
}

async function main() {
  await prisma.$connect();
  try {
    await seed();
    // The service imports the existing global Prisma client set above.
    const { getClientsWithConnections, getClientDetail } = await import('../../apps/api/src/services/client.service.ts');
    const measurements = [];
    for (const size of sizes) {
      const agencyId = `perf-agency-${size}`;
      measurements.push({ size, runs: [
        await measure('list-first-page', () => getClientsWithConnections({ agencyId, limit: 50 })),
        await measure('search-selective', () => getClientsWithConnections({ agencyId, search: 'Needle', limit: 50 })),
        await measure('search-no-match', () => getClientsWithConnections({ agencyId, search: 'NeverPresent', limit: 50 })),
        await measure('detail-one-client', () => getClientDetail({ agencyId, clientId: `perf-client-${size}-4` })),
        ...(size === 5000 ? [
          await measure('detail-101-requests', () => getClientDetail({ agencyId, clientId: `perf-client-${size}-0` })),
          await measure('detail-foreign-101-requests', () => getClientDetail({ agencyId: 'perf-agency-50', clientId: `perf-client-${size}-0` })),
          await measure('detail-1000-requests', () => getClientDetail({ agencyId, clientId: `perf-client-${size}-1` })),
          await measure('detail-foreign-1000-requests', () => getClientDetail({ agencyId: 'perf-agency-50', clientId: `perf-client-${size}-1` })),
          await measure('detail-missing', () => getClientDetail({ agencyId, clientId: 'perf-client-missing' })),
        ] : []),
      ] });
    }
    const agencyId = 'perf-agency-5000';
    const searchSql = 'SELECT id FROM clients WHERE agency_id = $1 AND (name ILIKE $2 OR company ILIKE $2 OR email ILIKE $2) ORDER BY created_at DESC LIMIT 50';
    const report = { fixture: 'private synthetic authhub_perf database; one request per four clients, one connection/authorization per eight clients; 101 requests on one heavy client, 1000 on another',
      methodology: 'Local service calls only. Clerk authentication, HTTP transport, production network, and browser rendering excluded. Five warmups precede 30 timed reads per case. Prisma query event durations are integer milliseconds; wall time is more precise.',
      sizes, runsPerCase: 30, measurements,
      explain: {
        firstPage: await explain('SELECT id FROM clients WHERE agency_id = $1 ORDER BY created_at DESC LIMIT 50', agencyId),
        selectiveSearch: await explain(searchSql, agencyId, '%Needle%'),
        noMatchSearch: await explain(searchSql, agencyId, '%NeverPresent%'),
        selectiveCount: await explain('SELECT count(*) FROM clients WHERE agency_id = $1 AND (name ILIKE $2 OR company ILIKE $2 OR email ILIKE $2)', agencyId, '%Needle%'),
      } };
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Wrote ${output}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error('Benchmark failed:', error instanceof Error ? error.name : 'unknown error');
  process.exitCode = 1;
});
