import { writeFile } from 'node:fs/promises';
import { Prisma } from '../../../apps/api/node_modules/@prisma/client';
import { prisma } from '../../../apps/api/src/lib/prisma.ts';
import { updateGrantedAssets } from '../../../apps/api/src/lib/granted-assets.ts';

const outputPath = process.env.GRANTED_ASSETS_CONCURRENCY_REPORT_PATH;
if (!outputPath) throw new Error('GRANTED_ASSETS_CONCURRENCY_REPORT_PATH is required');

const report: {
  environment: string;
  cases: Array<{ name: string; passed: boolean; observed: Record<string, unknown> }>;
  passed?: boolean;
  error?: string;
} = { environment: 'Disposable loopback PostgreSQL on port 55440; no providers', cases: [] };

async function manualPatch(connectionId: string, platform: string, value: Record<string, unknown>) {
  const patch = JSON.stringify({ [platform]: value });
  await prisma.$executeRaw(Prisma.sql`
    UPDATE client_connections
    SET granted_assets = COALESCE(granted_assets, '{}'::jsonb) || ${patch}::jsonb
    WHERE id = ${connectionId}
  `);
}

async function main() {
  try {
    const agency = await prisma.agency.create({
    data: { clerkUserId: 'local-granted-assets', name: 'Local Granted Assets', email: 'owner@local.invalid' },
    });
    const client = await prisma.client.create({
    data: { agencyId: agency.id, name: 'Local Client', company: 'Local', email: 'client@local.invalid', language: 'en' },
    });
    const accessRequest = await prisma.accessRequest.create({
    data: {
      agencyId: agency.id,
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      platforms: [],
      status: 'pending',
      uniqueToken: 'local-granted-assets-token',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    },
    });
    const connection = await prisma.clientConnection.create({
    data: {
      accessRequestId: accessRequest.id,
      agencyId: agency.id,
      clientEmail: client.email,
      status: 'active',
      grantedAssets: {},
    },
    });

    await Promise.all([
    updateGrantedAssets(connection.id, (current) => ({
      ...current,
      google_ads: { selectedAccounts: ['google-1'] },
    })),
    manualPatch(connection.id, 'beehiiv', { verificationStatus: 'pending' }),
    ]);
    const mixed = await prisma.clientConnection.findUniqueOrThrow({ where: { id: connection.id } });
    const mixedAssets = mixed.grantedAssets as Record<string, unknown>;
    if (!mixedAssets.google_ads || !mixedAssets.beehiiv) {
      throw new Error('Mixed helper and manual SQL writes did not preserve both platform records');
    }
    report.cases.push({
    name: 'helper_and_manual_sql_patch_preserve_both_platform_records',
    passed: true,
    observed: { platforms: Object.keys(mixedAssets).sort() },
    });

    await Promise.all([
    updateGrantedAssets(connection.id, (current) => {
      const meta = (current.meta as Record<string, unknown> | undefined) || {};
      const createdAdAccounts = Array.isArray(meta.createdAdAccounts) ? meta.createdAdAccounts : [];
      return { ...current, meta: { ...meta, createdAdAccounts: [...createdAdAccounts, { id: 'act-1' }] } };
    }),
    updateGrantedAssets(connection.id, (current) => {
      const meta = (current.meta as Record<string, unknown> | undefined) || {};
      const createdAdAccounts = Array.isArray(meta.createdAdAccounts) ? meta.createdAdAccounts : [];
      return { ...current, meta: { ...meta, createdAdAccounts: [...createdAdAccounts, { id: 'act-2' }] } };
    }),
    ]);
    const appended = await prisma.clientConnection.findUniqueOrThrow({ where: { id: connection.id } });
    const appendedAssets = appended.grantedAssets as Record<string, unknown>;
    const createdAdAccounts = ((appendedAssets.meta as Record<string, unknown>)?.createdAdAccounts || []) as Array<{ id: string }>;
    const accountIds = createdAdAccounts.map((account) => account.id).sort();
    if (accountIds.join(',') !== 'act-1,act-2') {
      throw new Error(`Concurrent append lost an asset: ${accountIds.join(',')}`);
    }
    report.cases.push({
    name: 'two_concurrent_same_platform_appends_preserve_both_assets',
    passed: true,
    observed: { accountIds },
    });
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  } finally {
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
