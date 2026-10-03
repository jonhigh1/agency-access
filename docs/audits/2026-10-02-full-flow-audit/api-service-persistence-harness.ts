import { writeFile } from 'node:fs/promises';
import { prisma } from '@/lib/prisma.js';
import { ClientError, createClient, getClients, updateClient } from '@/services/client.service.js';
import {
  createTemplate,
  deleteTemplate,
  getAgencyTemplates,
  setDefaultTemplate,
  updateTemplate,
} from '@/services/template.service.js';
import {
  createAccessRequest,
  getAccessRequestById,
  updateAccessRequest,
} from '@/services/access-request.service.js';

const outputPath = process.env.SERVICE_PERSISTENCE_REPORT_PATH;
if (!outputPath) throw new Error('SERVICE_PERSISTENCE_REPORT_PATH is required');

const report: {
  cases: Array<{ name: string; passed: boolean }>;
  externalDependenciesMocked: string[];
  externalDependenciesInvoked: string[];
  passed?: boolean;
  error?: string;
} = {
  cases: [],
  externalDependenciesMocked: [],
  externalDependenciesInvoked: [],
};

async function run() {
  try {
  const agency = await prisma.agency.create({
    data: {
      clerkUserId: 'user_local_service_persistence',
      name: 'Local Service Persistence Agency',
      email: 'owner@local-service-persistence.test',
    },
  });

  const client = await createClient({
    agencyId: agency.id,
    name: 'Service Client',
    company: 'Service Company',
    email: 'client@local-service-persistence.test',
  });
  const listedClients = await getClients({ agencyId: agency.id, search: 'Service Client' });
  const updatedClient = await updateClient(client.id, agency.id, {
    company: 'Updated Service Company',
  });
  let duplicateError: string | undefined;
  try {
    await createClient({
      agencyId: agency.id,
      name: 'Duplicate Client',
      company: 'Service Company',
      email: client.email,
    });
  } catch (error) {
    duplicateError = error instanceof Error ? error.message : undefined;
  }
  if (
    listedClients.pagination.total !== 1 ||
    listedClients.data[0]?.id !== client.id ||
    updatedClient?.company !== 'Updated Service Company' ||
    duplicateError !== ClientError.EMAIL_EXISTS
  ) {
    throw new Error('Client service policy or persistence contract failed');
  }
  report.cases.push({ name: 'client_service_crud_search_update_and_duplicate_policy', passed: true });

  const firstTemplate = await createTemplate({
    agencyId: agency.id,
    name: 'First service template',
    platforms: { google: ['google_ads'] },
    createdBy: 'owner@local-service-persistence.test',
    isDefault: true,
  });
  const secondTemplate = await createTemplate({
    agencyId: agency.id,
    name: 'Second service template',
    platforms: { google: ['ga4'] },
    createdBy: 'owner@local-service-persistence.test',
    isDefault: true,
  });
  if (!firstTemplate.data || !secondTemplate.data) {
    throw new Error('Template service did not create fixture templates');
  }
  const updatedTemplate = await updateTemplate(firstTemplate.data.id, {
    name: 'Updated first service template',
  });
  const defaultTemplate = await setDefaultTemplate(firstTemplate.data.id);
  const templates = await getAgencyTemplates(agency.id);
  const deletion = await deleteTemplate(secondTemplate.data.id);
  if (
    updatedTemplate.data?.name !== 'Updated first service template' ||
    defaultTemplate.data?.isDefault !== true ||
    templates.data?.filter((template) => template.isDefault).length !== 1 ||
    templates.data?.find((template) => template.isDefault)?.id !== firstTemplate.data.id ||
    !deletion.data?.success
  ) {
    throw new Error('Template service default or CRUD policy failed');
  }
  report.cases.push({ name: 'template_service_crud_and_single_default_policy', passed: true });

  const createdRequest = await createAccessRequest({
    agencyId: agency.id,
    clientId: client.id,
    clientName: client.name,
    clientEmail: client.email,
    platforms: [{ platform: 'google_ads', accessLevel: 'manage' }],
  });
  if (!createdRequest.data || createdRequest.error) {
    throw new Error(`Access request service create failed: ${createdRequest.error?.code}`);
  }
  const readRequest = await getAccessRequestById(createdRequest.data.id, agency.id);
  const updatedRequest = await updateAccessRequest(createdRequest.data.id, {
    status: 'partial',
    externalReference: 'local-service-persistence',
  });
  if (
    readRequest.data?.status !== 'pending' ||
    readRequest.data?.platforms?.[0]?.platformGroup !== 'google' ||
    updatedRequest.data?.status !== 'partial' ||
    updatedRequest.data?.externalReference !== 'local-service-persistence'
  ) {
    throw new Error('Access request service lifecycle or persistence contract failed');
  }
  report.cases.push({ name: 'access_request_service_create_read_transform_and_update', passed: true });

  report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = error instanceof Error ? error.message : 'Unknown service harness error';
    throw error;
  } finally {
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
