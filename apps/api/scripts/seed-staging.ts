/**
 * Seed a LOCAL staging database with obviously fake data:
 *   - two staging agencies (each with an admin member)
 *   - a client and a pending access request for agency one
 *   - a fresh client invite (pending access request, no client record yet) for agency two
 *
 * Idempotent: rows are keyed on fixed example.com emails and fixed
 * `externalReference` markers, so re-running refreshes expiry instead of
 * creating duplicates. Existing invite tokens are kept.
 *
 * Safety: refuses to run unless the DATABASE_URL host is exactly `localhost`
 * or `127.0.0.1` (staging Postgres runs on the box; prod is Neon).
 *
 * Usage (from repo root):
 *   DATABASE_URL=postgresql://user:pass@127.0.0.1:5433/authhub_staging \
 *     npm run seed:staging --workspace=apps/api
 *
 * Optional: STAGING_SEED_CLERK_USER_ID_ONE / STAGING_SEED_CLERK_USER_ID_TWO link the
 * agencies to Clerk *development-instance* user ids so those users land on them.
 * FRONTEND_URL (default http://localhost:3000) is only used to print invite links.
 */

import 'dotenv/config';
import { randomBytes } from 'crypto';
import { pathToFileURL } from 'url';
import { PrismaClient } from '@prisma/client';

export const ALLOWED_SEED_DB_HOSTS = ['localhost', '127.0.0.1'] as const;

export class UnsafeSeedTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeSeedTargetError';
  }
}

/**
 * Throws unless `databaseUrl` is a postgres URL whose host is exactly localhost
 * or 127.0.0.1. Also rejects a `host` query parameter, which libpq/Prisma would
 * use to redirect the connection elsewhere.
 */
export function assertLocalDatabaseUrl(databaseUrl: string | undefined): URL {
  if (!databaseUrl || databaseUrl.trim() === '') {
    throw new UnsafeSeedTargetError('DATABASE_URL is not set; refusing to seed.');
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new UnsafeSeedTargetError('DATABASE_URL is not a valid URL; refusing to seed.');
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new UnsafeSeedTargetError('DATABASE_URL must be a postgres:// or postgresql:// URL; refusing to seed.');
  }

  const host = parsed.hostname.toLowerCase();
  if (!(ALLOWED_SEED_DB_HOSTS as readonly string[]).includes(host)) {
    throw new UnsafeSeedTargetError(
      `DATABASE_URL host "${host || '(empty)'}" is not localhost or 127.0.0.1; refusing to seed.`
    );
  }

  for (const key of parsed.searchParams.keys()) {
    if (key.toLowerCase() === 'host' || key.toLowerCase() === 'hostaddr') {
      throw new UnsafeSeedTargetError(`DATABASE_URL sets a "${key}" parameter; refusing to seed.`);
    }
  }

  return parsed;
}

export const STAGING_SEED = {
  agencyOne: {
    name: 'Staging Agency One',
    email: 'staging-agency-one@example.com',
    clerkUserIdEnv: 'STAGING_SEED_CLERK_USER_ID_ONE',
  },
  agencyTwo: {
    name: 'Staging Agency Two',
    email: 'staging-agency-two@example.com',
    clerkUserIdEnv: 'STAGING_SEED_CLERK_USER_ID_TWO',
  },
  client: {
    name: 'Test Client Contact',
    company: 'Example Client Co (staging)',
    email: 'staging-client@example.com',
  },
  inviteClient: {
    name: 'Test Invite Contact',
    email: 'staging-invite@example.com',
  },
  pendingRequestRef: 'staging-seed:pending-access-request',
  inviteRef: 'staging-seed:client-invite',
} as const;

const SEED_PLATFORMS = [
  { platform: 'meta_ads', accessLevel: 'manage' },
  { platform: 'google_ads', accessLevel: 'manage' },
];

const SEED_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

function newInviteToken(): string {
  return randomBytes(6).toString('hex');
}

/** Minimal Prisma surface used by the seed (lets tests pass an in-memory fake). */
export interface SeedPrisma {
  agency: {
    upsert(args: any): Promise<{ id: string; name: string }>;
  };
  agencyMember: {
    upsert(args: any): Promise<unknown>;
  };
  client: {
    upsert(args: any): Promise<{ id: string }>;
  };
  accessRequest: {
    findFirst(args: any): Promise<{ id: string; uniqueToken: string } | null>;
    update(args: any): Promise<{ id: string; uniqueToken: string }>;
    create(args: any): Promise<{ id: string; uniqueToken: string }>;
  };
}

export interface SeedResult {
  agencies: Array<{ id: string; name: string }>;
  pendingRequest: { id: string; inviteUrl: string };
  clientInvite: { id: string; inviteUrl: string };
}

async function upsertAgency(
  prisma: SeedPrisma,
  agency: { name: string; email: string; clerkUserIdEnv: string },
  env: NodeJS.ProcessEnv
) {
  const clerkUserId = env[agency.clerkUserIdEnv]?.trim() || undefined;
  const record = await prisma.agency.upsert({
    where: { email: agency.email },
    update: { name: agency.name, ...(clerkUserId ? { clerkUserId } : {}) },
    create: {
      name: agency.name,
      email: agency.email,
      ...(clerkUserId ? { clerkUserId } : {}),
    },
  });
  await prisma.agencyMember.upsert({
    where: { agencyId_email: { agencyId: record.id, email: agency.email } },
    update: { role: 'admin' },
    create: {
      agencyId: record.id,
      email: agency.email,
      role: 'admin',
      invitedAt: new Date(),
      joinedAt: new Date(),
    },
  });
  return record;
}

async function upsertPendingRequest(
  prisma: SeedPrisma,
  input: {
    agencyId: string;
    clientId?: string;
    clientName: string;
    clientEmail: string;
    externalReference: string;
  },
  now: Date
) {
  const expiresAt = new Date(now.getTime() + SEED_EXPIRY_MS);
  const existing = await prisma.accessRequest.findFirst({
    where: { agencyId: input.agencyId, externalReference: input.externalReference },
    select: { id: true, uniqueToken: true },
  });

  if (existing) {
    return prisma.accessRequest.update({
      where: { id: existing.id },
      data: { status: 'pending', expiresAt, authorizedAt: null },
      select: { id: true, uniqueToken: true },
    });
  }

  return prisma.accessRequest.create({
    data: {
      agencyId: input.agencyId,
      clientId: input.clientId,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      externalReference: input.externalReference,
      uniqueToken: newInviteToken(),
      platforms: SEED_PLATFORMS,
      status: 'pending',
      expiresAt,
    },
    select: { id: true, uniqueToken: true },
  });
}

export async function runStagingSeed(
  prisma: SeedPrisma,
  options: { env?: NodeJS.ProcessEnv; now?: Date } = {}
): Promise<SeedResult> {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const frontendUrl = (env.FRONTEND_URL?.trim() || 'http://localhost:3000').replace(/\/$/, '');

  const agencyOne = await upsertAgency(prisma, STAGING_SEED.agencyOne, env);
  const agencyTwo = await upsertAgency(prisma, STAGING_SEED.agencyTwo, env);

  const client = await prisma.client.upsert({
    where: { agencyId_email: { agencyId: agencyOne.id, email: STAGING_SEED.client.email } },
    update: { name: STAGING_SEED.client.name, company: STAGING_SEED.client.company },
    create: {
      agencyId: agencyOne.id,
      name: STAGING_SEED.client.name,
      company: STAGING_SEED.client.company,
      email: STAGING_SEED.client.email,
    },
  });

  const pending = await upsertPendingRequest(
    prisma,
    {
      agencyId: agencyOne.id,
      clientId: client.id,
      clientName: STAGING_SEED.client.name,
      clientEmail: STAGING_SEED.client.email,
      externalReference: STAGING_SEED.pendingRequestRef,
    },
    now
  );

  const invite = await upsertPendingRequest(
    prisma,
    {
      agencyId: agencyTwo.id,
      clientName: STAGING_SEED.inviteClient.name,
      clientEmail: STAGING_SEED.inviteClient.email,
      externalReference: STAGING_SEED.inviteRef,
    },
    now
  );

  return {
    agencies: [
      { id: agencyOne.id, name: agencyOne.name },
      { id: agencyTwo.id, name: agencyTwo.name },
    ],
    pendingRequest: { id: pending.id, inviteUrl: `${frontendUrl}/invite/${pending.uniqueToken}` },
    clientInvite: { id: invite.id, inviteUrl: `${frontendUrl}/invite/${invite.uniqueToken}` },
  };
}

/** CLI entry point. Returns the exit code so tests can call it. */
export async function main(
  env: NodeJS.ProcessEnv = process.env,
  createPrisma: (url: string) => SeedPrisma & { $disconnect(): Promise<void> } = (url) =>
    new PrismaClient({ datasources: { db: { url } }, log: ['error'] }) as any
): Promise<number> {
  let databaseUrl: URL;
  try {
    databaseUrl = assertLocalDatabaseUrl(env.DATABASE_URL);
  } catch (error) {
    console.error(`[seed-staging] ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  const prisma = createPrisma(databaseUrl.toString());
  try {
    const result = await runStagingSeed(prisma, { env });
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error('[seed-staging] Fatal error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
