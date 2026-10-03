import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const requireApiPackage = createRequire(new URL('../../../apps/api/package.json', import.meta.url));
const { PrismaClient } = requireApiPackage('@prisma/client');

const databaseUrl = process.env.DATABASE_URL;
const outputPath = process.env.PERSISTENCE_REPORT_PATH;

if (!databaseUrl || !outputPath) {
  throw new Error('DATABASE_URL and PERSISTENCE_REPORT_PATH are required');
}

const parsedUrl = new URL(databaseUrl);
if (parsedUrl.hostname !== '127.0.0.1') {
  throw new Error('Persistence harness only accepts a 127.0.0.1 database');
}

const prisma = new PrismaClient();
const report = {
  database: { host: parsedUrl.hostname, port: Number(parsedUrl.port) },
  cases: []
};

try {
  const agency = await prisma.agency.create({
    data: {
      clerkUserId: 'user_local_persistence',
      name: 'Local Persistence Agency',
      email: 'owner@local-persistence.test'
    }
  });

  const client = await prisma.client.create({
    data: {
      agencyId: agency.id,
      name: 'Local Client',
      company: 'Local Company',
      email: 'client@local-persistence.test',
      language: 'en'
    }
  });
  const listedClients = await prisma.client.findMany({ where: { agencyId: agency.id } });
  const updatedClient = await prisma.client.update({
    where: { id: client.id },
    data: { company: 'Updated Local Company' }
  });
  let duplicateRejected = false;
  try {
    await prisma.client.create({
      data: {
        agencyId: agency.id,
        name: 'Duplicate Local Client',
        company: 'Local Company',
        email: client.email,
        language: 'en'
      }
    });
  } catch (error) {
    duplicateRejected = (error && typeof error === 'object' && error.code === 'P2002');
  }
  if (listedClients.length !== 1 || updatedClient.company !== 'Updated Local Company' || !duplicateRejected) {
    throw new Error('Client persistence contract failed');
  }
  report.cases.push({ name: 'client_crud_and_unique_constraint', passed: true });

  const template = await prisma.accessRequestTemplate.create({
    data: {
      agencyId: agency.id,
      name: 'Local default template',
      description: 'Disposable local fixture',
      platforms: { google: ['google_ads'] },
      intakeFields: [],
      isDefault: true,
      createdBy: 'owner@local-persistence.test'
    }
  });
  const defaultTemplate = await prisma.accessRequestTemplate.findFirst({
    where: { agencyId: agency.id, isDefault: true }
  });
  await prisma.accessRequestTemplate.update({
    where: { id: template.id },
    data: { isDefault: false, name: 'Updated local template' }
  });
  await prisma.accessRequestTemplate.delete({ where: { id: template.id } });
  if (defaultTemplate?.id !== template.id) {
    throw new Error('Template default persistence contract failed');
  }
  report.cases.push({ name: 'template_crud_and_default_query', passed: true });

  const accessRequest = await prisma.accessRequest.create({
    data: {
      agencyId: agency.id,
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      platforms: { google: ['google_ads'] },
      status: 'pending',
      uniqueToken: 'local-persistence-only-token',
      expiresAt: new Date('2030-01-01T00:00:00.000Z')
    }
  });
  const readRequest = await prisma.accessRequest.findUnique({ where: { id: accessRequest.id } });
  const updatedRequest = await prisma.accessRequest.update({
    where: { id: accessRequest.id },
    data: { status: 'partial', authorizedAt: new Date('2026-10-03T00:00:00.000Z') }
  });
  if (readRequest?.status !== 'pending' || updatedRequest.status !== 'partial') {
    throw new Error('Access request persistence contract failed');
  }
  report.cases.push({ name: 'access_request_create_read_update_status', passed: true });

  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = error instanceof Error ? error.message : 'Unknown harness error';
  throw error;
} finally {
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  await prisma.$disconnect();
}
