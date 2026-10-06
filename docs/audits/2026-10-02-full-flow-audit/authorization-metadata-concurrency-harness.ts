import { writeFile } from 'node:fs/promises';
import { PrismaClient } from '../../../apps/api/node_modules/@prisma/client/index.js';
import { prisma } from '../../../apps/api/src/lib/prisma.ts';
import { updateAuthorizationMetadata } from '../../../apps/api/src/lib/authorization-metadata.ts';

const outputPath = process.env.AUTH_METADATA_REPORT_PATH;
if (!outputPath) throw new Error('AUTH_METADATA_REPORT_PATH required');
const report: { cases: Array<{ name: string; passed: boolean }>; passed?: boolean; error?: string } = { cases: [] };
const check = (name: string, condition: unknown) => {
  if (!condition) throw new Error(name);
  report.cases.push({ name, passed: true });
};

async function run() {
  const lockClient = new PrismaClient();
  try {
    const agency = await prisma.agency.create({ data: { clerkUserId: 'user_auth_metadata_fixture', name: 'Metadata Fixture', email: 'owner@metadata.invalid' } });
    const request = await prisma.accessRequest.create({ data: { agencyId: agency.id, clientName: 'Metadata Fixture', clientEmail: 'client@metadata.invalid', status: 'pending', platforms: [], uniqueToken: 'metadata-fixture', expiresAt: new Date('2030-01-01') } });
    const connection = await prisma.clientConnection.create({ data: { agencyId: agency.id, accessRequestId: request.id, clientEmail: request.clientEmail, status: 'active', grantedAssets: {} } });
    const auth = await prisma.platformAuthorization.create({ data: { connectionId: connection.id, platform: 'meta', status: 'active', secretId: 'fixture-reference-only', metadata: { preserve: 'root', meta: { selection: { clientBusinessId: 'fixture-business' } } } } });
    await Promise.all([
      updateAuthorizationMetadata(auth.id, (current: any) => ({ ...current, selectedAssets: { ...current.selectedAssets, meta_ads: { adAccounts: ['fixture-ad'] } } })),
      updateAuthorizationMetadata(auth.id, (current: any) => ({ ...current, selectedAssets: { ...current.selectedAssets, instagram: { instagramAccounts: ['fixture-ig'] } } })),
      updateAuthorizationMetadata(auth.id, (current: any) => ({ ...current, meta: { ...current.meta, discovery: { availableBusinesses: [{ id: 'fixture-business' }] } } })),
    ]);
    const saved = (await prisma.platformAuthorization.findUniqueOrThrow({ where: { id: auth.id } })).metadata as any;
    check('concurrent_product_saves_preserve_both_selections', saved.selectedAssets.meta_ads.adAccounts[0] === 'fixture-ad' && saved.selectedAssets.instagram.instagramAccounts[0] === 'fixture-ig');
    check('discovery_save_preserves_root_selection_and_saved_assets', saved.preserve === 'root' && saved.meta.selection.clientBusinessId === 'fixture-business' && saved.meta.discovery.availableBusinesses.length === 1);

    let signalLocked!: () => void;
    let releaseLock!: () => void;
    const locked = new Promise<void>((resolve) => { signalLocked = resolve; });
    const release = new Promise<void>((resolve) => { releaseLock = resolve; });
    const held = lockClient.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM platform_authorizations WHERE id = ${auth.id} FOR UPDATE`;
      signalLocked();
      await release;
    });
    await locked;
    let settled = false;
    const pending = updateAuthorizationMetadata(auth.id, (current) => ({ ...current, providerRevokedAt: 'fixture-time' }), 'revoked').finally(() => { settled = true; });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const waitedForLock = !settled;
    releaseLock();
    await Promise.all([held, pending]);
    check('metadata_update_waits_for_real_authorization_row_lock', waitedForLock);
    const revoked = await prisma.platformAuthorization.findUniqueOrThrow({ where: { id: auth.id } });
    check('status_and_metadata_commit_together_without_erasing_selections', revoked.status === 'revoked' && (revoked.metadata as any).providerRevokedAt === 'fixture-time' && (revoked.metadata as any).selectedAssets.instagram.instagramAccounts[0] === 'fixture-ig');
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    await writeFile(outputPath, JSON.stringify({ environment: 'Disposable loopback PostgreSQL 55442; no providers or tokens', ...report }, null, 2) + '\n');
    await lockClient.$disconnect();
    await prisma.$disconnect();
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
