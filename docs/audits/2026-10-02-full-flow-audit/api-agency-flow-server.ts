import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { prisma } from '@/lib/prisma.js';
import { agencyResolutionService } from '@/services/agency-resolution.service.js';
import { agencyRoutes } from '@/routes/agencies.js';
import { accessRequestRoutes } from '@/routes/access-requests.js';
import { clientRoutes } from '@/routes/clients.js';
import { templateRoutes } from '@/routes/templates.js';
import { dashboardRoutes } from '@/routes/dashboard.js';
import { usageRoutes } from '@/routes/usage.js';
import { quotaRoutes } from '@/routes/quota.routes.js';
import { registerManualRoutes } from '@/routes/client-auth/manual.routes.js';
const requireApi = createRequire(new URL('../../../apps/api/package.json', import.meta.url));
const Fastify = requireApi('fastify');
const cors = requireApi('@fastify/cors');
const database = new URL(process.env.DATABASE_URL!);
if (database.hostname !== '127.0.0.1' || database.port !== '55439' || database.pathname !== '/authhub_public_invites') {
  throw new Error('Only the disposable public invite database is allowed');
}
if (process.env.NODE_ENV !== 'development') throw new Error('Existing development authentication required');
async function start() {
  // Adapt the synthetic development principal; production identity resolution remains untested.
  const resolveAgency = agencyResolutionService.resolveAgency;
  agencyResolutionService.resolveAgency = (identifier, options) =>
    resolveAgency(identifier === 'dev_org_test_987654321' ? 'dev_agency_123456789' : identifier, options);
  const { notificationService } = await import('@/services/notification.service');
  const notifications: unknown[] = [];
  notificationService.queueNotification = async (payload) => {
    notifications.push({ accessRequestId: payload.accessRequestId, platforms: payload.platforms });
    return { data: true, error: null };
  };
  // No outbound requests are allowed in this local fixture server.
  globalThis.fetch = async () => { throw new Error('Outbound requests disabled in local audit'); };
  const agency = await prisma.agency.upsert({
    where: { id: 'dev_agency_123456789' },
    create: { id: 'dev_agency_123456789', clerkUserId: 'dev_org_test_987654321', name: 'Dev Test Agency', email: 'dev-bypass@agency-access.local', subscriptionTier: 'SCALE', notificationEnabled: false, settings: { onboarding: { completedAt: new Date().toISOString() } } },
    update: {},
  });
  const client = await prisma.client.upsert({
    where: { id: 'local-agency-client' },
    create: { id: 'local-agency-client', agencyId: agency.id, name: 'Local Manual Client', company: 'Fixture Company', email: 'client@agency-fixture.invalid' },
    update: {},
  });
  const request = await prisma.accessRequest.upsert({
    where: { uniqueToken: 'local-agency-manual-invite' },
    create: { id: 'local-agency-manual-request', agencyId: agency.id, clientId: client.id, clientName: client.name, clientEmail: client.email, uniqueToken: 'local-agency-manual-invite', platforms: [{ platform: 'beehiiv', accessLevel: 'manage' }, { platform: 'zapier', accessLevel: 'manage' }], status: 'pending', expiresAt: new Date('2030-01-01'), intakeFields: [] },
    update: {},
  });
  for (const platform of ['beehiiv', 'zapier']) {
    const existing = await prisma.agencyPlatformConnection.findFirst({ where: { agencyId: agency.id, platform } });
    if (!existing) await prisma.agencyPlatformConnection.create({ data: { agencyId: agency.id, platform, connectionMode: 'identity', status: 'active', agencyEmail: 'team@agency-fixture.invalid', connectedBy: 'dev-bypass@agency-access.local', verificationStatus: 'pending' } });
  }
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: 'http://localhost:3100' });
  app.addHook('onRequest', async (req, reply) => {
    const path = req.url.split('?')[0];
    const safeRead = req.method === 'GET' && /^\/api\/(health\/local-agency-fixture|agencies(?:\/[^/]+(?:\/(?:access-requests|templates|onboarding-status))?)?|access-requests\/[^/]+|clients(?:\/[^/]+(?:\/detail)?)?|templates\/[^/]+|dashboard(?:\/stats)?|usage|quota|client\/[^/]+)$/.test(path);
    const safeWrite = req.method === 'POST' && (/^\/api\/access-requests\/[^/]+\/manual-confirmations\/(beehiiv|kit|mailchimp|klaviyo|zapier|pinterest|shopify)$/.test(path) || /^\/api\/client\/[^/]+\/(beehiiv|kit|mailchimp|klaviyo|zapier|pinterest|shopify)\/manual-connect$/.test(path) || ['/api/quota/check', '/api/access-requests'].includes(path));
    if (!safeRead && !safeWrite) return reply.code(403).send({ data: null, error: { code: 'FIXTURE_ROUTE_DISABLED', message: 'This action is disabled in the disposable audit environment' } });
  });
  app.get('/api/health/local-agency-fixture', async () => ({ data: { fixtureOnly: true }, error: null }));
  for (const routes of [agencyRoutes, accessRequestRoutes, clientRoutes, templateRoutes, dashboardRoutes, usageRoutes]) await app.register(routes, { prefix: '/api' });
  await app.register(quotaRoutes);
  await app.register(registerManualRoutes, { prefix: '/api' });
  await app.listen({ host: '127.0.0.1', port: 3103 });
  await writeFile(process.env.AGENCY_FIXTURE_MANIFEST!, JSON.stringify({ agencyId: agency.id, clientId: client.id, requestId: request.id, token: request.uniqueToken, simulatedAuthentication: true, providersInvoked: 0, outboundRequestsDisabled: true }, null, 2));
  const shutdown = async () => { await app.close(); await prisma.$disconnect(); process.exit(0); };
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
}
start().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exitCode = 1; });
