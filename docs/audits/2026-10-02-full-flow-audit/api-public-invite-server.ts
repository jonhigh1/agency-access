import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const requireApi = createRequire(new URL('../../../apps/api/package.json', import.meta.url));
const cors = requireApi('@fastify/cors');
const Fastify = requireApi('fastify');
import { prisma } from '@/lib/prisma.js';
import { accessRequestService } from '@/services/access-request.service.js';
import { registerIntakeRoutes } from '@/routes/client-auth/intake.routes.js';
import { registerManualRoutes } from '@/routes/client-auth/manual.routes.js';

const host = '127.0.0.1';
const port = 3101;
const fixturePath = process.env.PUBLIC_INVITE_FIXTURE_PATH;
if (!fixturePath) throw new Error('PUBLIC_INVITE_FIXTURE_PATH is required');

const tokens = {
  pendingGoogle: 'local-pending-google-intake',
  expired: 'local-expired-invite',
  revoked: 'local-revoked-invite',
  fulfilled: 'local-fulfilled-invite',
  manualBeehiiv: 'local-manual-beehiiv',
  manualMulti: 'local-manual-multi',
};

async function seedFixtures() {
  const agency = await prisma.agency.create({
    data: {
      clerkUserId: 'user_fixture_public_invites',
      name: 'Local Invite Fixture Agency',
      email: 'owner@fixture-agency.invalid',
    },
  });
  const client = await prisma.client.create({
    data: {
      agencyId: agency.id,
      name: 'Fixture Client',
      company: 'Fixture Company',
      email: 'client@fixture-client.invalid',
    },
  });
  const base = {
    agencyId: agency.id,
    clientId: client.id,
    clientName: client.name,
    clientEmail: client.email,
    platforms: [{ platform: 'google_ads', accessLevel: 'manage' }] as any,
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
  };

  await prisma.accessRequest.create({
    data: {
      ...base,
      uniqueToken: tokens.pendingGoogle,
      status: 'pending',
      branding: {
        logoUrl: 'https://logo.fixture.invalid/authhub.svg',
        primaryColor: '#2563EB',
        subdomain: 'local-fixture',
      },
      intakeFields: [
        { id: 'contact_name', label: 'Contact name', type: 'text', required: true, order: 0 },
        { id: 'project_url', label: 'Project URL', type: 'url', required: false, order: 1 },
      ],
    },
  });
  await prisma.accessRequest.create({
    data: {
      ...base,
      uniqueToken: tokens.expired,
      status: 'pending',
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      intakeFields: [],
    },
  });
  await prisma.accessRequest.create({
    data: {
      ...base,
      uniqueToken: tokens.revoked,
      status: 'revoked',
      intakeFields: [],
    },
  });
  const fulfilled = await prisma.accessRequest.create({
    data: {
      ...base,
      uniqueToken: tokens.fulfilled,
      status: 'completed',
      authorizedAt: new Date('2026-10-03T00:00:00.000Z'),
      platforms: [{ platform: 'beehiiv', accessLevel: 'manage' }],
      intakeFields: [],
    },
  });
  const fulfilledConnection = await prisma.clientConnection.create({
    data: {
      accessRequestId: fulfilled.id,
      agencyId: agency.id,
      clientEmail: client.email,
      status: 'active',
      grantedAssets: { platform: 'beehiiv' },
    },
  });
  await prisma.platformAuthorization.create({
    data: {
      connectionId: fulfilledConnection.id,
      platform: 'beehiiv',
      status: 'active',
      secretId: 'local-fixture-reference',
    },
  });
  await prisma.agencyPlatformConnection.create({
    data: {
      agencyId: agency.id,
      platform: 'beehiiv',
      connectionMode: 'identity',
      status: 'active',
      agencyEmail: 'team@fixture-agency.invalid',
      connectedBy: 'owner@fixture-agency.invalid',
      verificationStatus: 'pending',
    },
  });
  await prisma.accessRequest.create({
    data: {
      ...base,
      uniqueToken: tokens.manualBeehiiv,
      status: 'pending',
      platforms: [{ platform: 'beehiiv', accessLevel: 'manage' }],
      intakeFields: [],
    },
  });
  await prisma.agencyPlatformConnection.create({
    data: {
      agencyId: agency.id,
      platform: 'zapier',
      connectionMode: 'identity',
      status: 'active',
      agencyEmail: 'team@fixture-agency.invalid',
      connectedBy: 'owner@fixture-agency.invalid',
      verificationStatus: 'pending',
    },
  });
  await prisma.accessRequest.create({
    data: {
      ...base,
      uniqueToken: tokens.manualMulti,
      status: 'pending',
      platforms: [
        { platform: 'beehiiv', accessLevel: 'manage' },
        { platform: 'zapier', accessLevel: 'manage' },
      ],
      intakeFields: [],
      branding: { primaryColor: '#2563EB' },
    },
  });
}

async function start() {
  await seedFixtures();
  const fastify = Fastify({ logger: false });
  await fastify.register(cors, {
    origin: (origin, callback) => callback(null, origin === 'http://localhost:3100'),
  });
  fastify.get('/api/health/local-invite-fixture', async () => ({
    data: { status: 'ok', fixtureOnly: true },
    error: null,
  }));
  fastify.get('/api/client/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const result = await accessRequestService.getAccessRequestByToken(token);
    if (result.error) {
      const statusCode = ['REQUEST_NOT_FOUND', 'REQUEST_EXPIRED', 'REQUEST_REVOKED'].includes(result.error.code)
        ? 404
        : 400;
      return reply.code(statusCode).send({ data: null, error: result.error });
    }
    return reply.send(result);
  });
  await fastify.register(async (routes) => {
    await registerIntakeRoutes(routes);
    await registerManualRoutes(routes);
  }, { prefix: '/api' });
  await fastify.listen({ host, port });
  await writeFile(fixturePath, `${JSON.stringify({
    host,
    port,
    corsOrigin: 'http://localhost:3100',
    routes: [
      'GET /api/client/:token',
      'POST /api/client/:token/intake',
      'POST /api/client/:token/{beehiiv|kit|mailchimp|klaviyo}/manual-connect',
      'POST /api/client/:token/{pinterest|shopify}/manual-connect',
    ],
    fixtureUrls: Object.fromEntries(Object.entries(tokens).map(([name, token]) => [name, `http://${host}:${port}/api/client/${token}`])),
    manuallySeededStates: {
      pendingGoogle: 'pending invitation with intake fields and branding sample',
      expired: 'expired by timestamp',
      revoked: 'cancelled invitation represented by revoked status',
      fulfilled: 'completed invitation with local active Beehiiv authorization',
      manualBeehiiv: 'pending Beehiiv invitation with local agency identity email',
    },
    providerBoundary: 'No OAuth, asset, provider, email, Infisical, Clerk, or worker routes are registered.',
  }, null, 2)}\n`);
  const shutdown = async () => {
    await fastify.close();
    await prisma.$disconnect();
  };
  process.once('SIGTERM', () => void shutdown().finally(() => process.exit(0)));
  process.once('SIGINT', () => void shutdown().finally(() => process.exit(0)));
}

start().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
