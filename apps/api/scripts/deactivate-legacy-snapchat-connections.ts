#!/usr/bin/env node
/**
 * Deactivate legacy manual-only Snapchat agency connections (R14).
 *
 * Rows created by the retired manual-invitation flow are still marked
 * status 'active' while holding no Infisical secret (secretId IS NULL).
 * They report a healthy connection that cannot work, and they block the
 * (agencyId, platform) slot that the OAuth row-reuse path in
 * agency-platform.service.ts (createConnection) needs in order to
 * reconnect in place.
 *
 * This script marks those rows revoked — status 'revoked' with revokedAt
 * and revokedBy — and writes one audit entry per row. It changes nothing
 * else: connectionMode, connectedBy, metadata, and every prior audit row
 * are preserved. Because the row is no longer 'active', reconnecting
 * through OAuth reuses the same row and flips its mode to 'oauth'.
 *
 * Safety properties:
 *  - Dry run by default. Writes only with --apply.
 *  - Selection takes only ACTIVE rows with no secret, so the predicate is
 *    self-limiting: a second apply run finds nothing and changes nothing.
 *  - Each row's update and its audit insert run in one interactive
 *    transaction. An interrupted or failed row is rolled back completely
 *    and stays active, so re-running the script retries exactly the rows
 *    that did not complete.
 *  - The revoke is a compare-and-set: inside the transaction the update
 *    re-checks the selection predicate (status 'active', secretId null).
 *    A row that changed since selection — an OAuth reconnect added a
 *    secret — matches nothing, writes nothing, and is reported as skipped
 *    instead of being revoked.
 *  - Audit history is append-only here: nothing is updated or deleted.
 *
 * OPERATOR-GATED: this script must never be pointed at staging or
 * production as part of development. Run a --dry-run first, review the
 * printed rows, then run --apply against the target database explicitly
 * with that database's DATABASE_URL.
 *
 * Usage:
 *   npx tsx scripts/deactivate-legacy-snapchat-connections.ts            # dry run
 *   npx tsx scripts/deactivate-legacy-snapchat-connections.ts --dry-run  # dry run
 *   npx tsx scripts/deactivate-legacy-snapchat-connections.ts --apply    # writes
 *
 * Exit code 0 when every selected row completed (or nothing was selected).
 * Exit code 1 when any row failed, listing which rows are retryable.
 */

import { pathToFileURL } from 'node:url';
import { PrismaClient, Prisma } from '@prisma/client';

/** Platforms that previously supported the manual-invitation flow. */
export const LEGACY_SNAPCHAT_PLATFORMS = ['snapchat', 'snapchat_ads'] as const;

/** Actor recorded on the revoked fields and audit entries this script writes. */
export const LEGACY_MIGRATION_ACTOR = 'system:legacy-manual-migration';

/**
 * Audit action for this migration. Naming follows the agency connection
 * lifecycle convention in the AuditLog schema and
 * agency-platform.service.ts (AGENCY_CONNECTED, AGENCY_DISCONNECTED,
 * AGENCY_TOKEN_REFRESHED): agency-scoped actions are UPPERCASE with the
 * AGENCY_ prefix, written through prisma.auditLog.create with
 * agencyConnectionId + platform metadata and placeholder ip/userAgent.
 */
export const LEGACY_MIGRATION_AUDIT_ACTION = 'AGENCY_SNAPCHAT_LEGACY_MIGRATED';

export type LegacyConnectionRow = {
  id: string;
  agencyId: string;
  platform: string;
  status: string;
  secretId: string | null;
  connectionMode: string;
  connectedBy: string;
};

/**
 * The Prisma surface this migration touches: the real client delegates for
 * reads/writes/audit, the interactive-transaction entry point, and disconnect.
 * Both the top-level client and the per-row transaction client satisfy it.
 */
export type MigrationPrisma = Pick<
  PrismaClient,
  'agencyPlatformConnection' | 'auditLog' | '$transaction' | '$disconnect'
>;

/**
 * Selection predicate (from the plan): legacy Snapchat rows that claim to be
 * connected while carrying no secret reference. Rows with a secretId are real
 * OAuth connections and are never touched; rows that are not active are
 * already inert and are left alone.
 */
export function buildLegacySelectionWhere(): Prisma.AgencyPlatformConnectionWhereInput {
  return {
    platform: { in: [...LEGACY_SNAPCHAT_PLATFORMS] },
    status: 'active',
    secretId: null,
  };
}

/** Read the rows this migration would deactivate. Purely read-only. */
export async function selectLegacyConnections(
  prisma: MigrationPrisma
): Promise<LegacyConnectionRow[]> {
  return prisma.agencyPlatformConnection.findMany({
    where: buildLegacySelectionWhere(),
    select: {
      id: true,
      agencyId: true,
      platform: true,
      status: true,
      secretId: true,
      connectionMode: true,
      connectedBy: true,
    },
    orderBy: [{ agencyId: 'asc' }, { platform: 'asc' }],
  });
}

/**
 * The compare-and-set predicate for one row's revoke: the primary key plus
 * the exact predicates the row was selected with. Re-checking them inside
 * the transaction is what makes the migration safe against a concurrent
 * reconnect — without it, an OAuth reconnect that landed between selection
 * and apply would be revoked along with the stale manual rows.
 */
function revokeWhere(row: LegacyConnectionRow): Prisma.AgencyPlatformConnectionWhereInput {
  return { id: row.id, status: 'active', secretId: null };
}

/**
 * Deactivate one row atomically: the status flip and its audit entry commit
 * together or not at all. A throw from either statement rolls back both,
 * leaving the row active and retryable on the next run.
 *
 * Returns true when the row was revoked and audited. Returns false when the
 * row no longer matches the selection predicate — it changed between
 * selection and apply, most often because an OAuth reconnect added a secret.
 * Nothing is written in that case, so the caller must not audit it.
 */
export async function migrateLegacyRow(
  prisma: MigrationPrisma,
  row: LegacyConnectionRow,
  now: Date
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const result = await tx.agencyPlatformConnection.updateMany({
      where: revokeWhere(row),
      data: {
        status: 'revoked',
        revokedAt: now,
        revokedBy: LEGACY_MIGRATION_ACTOR,
      },
    });

    if (result.count !== 1) {
      // The row changed since selection. The update matched nothing, so the
      // transaction writes nothing and commits empty.
      return false;
    }

    await tx.auditLog.create({
      data: {
        agencyId: row.agencyId,
        action: LEGACY_MIGRATION_AUDIT_ACTION,
        userEmail: LEGACY_MIGRATION_ACTOR,
        agencyConnectionId: row.id,
        metadata: {
          platform: row.platform,
          reason: 'legacy-manual-connection-migration',
          previousStatus: row.status,
          connectionMode: row.connectionMode,
          connectedBy: row.connectedBy,
        },
        ipAddress: '0.0.0.0', // No request context for a migration run
        userAgent: 'unknown',
      },
    });

    return true;
  });
}

export type MigrationReportRow = {
  id: string;
  agencyId: string;
  platform: string;
  connectedBy: string;
};

/** The identifying slice of a row printed in every report section. */
function toReportRow(row: LegacyConnectionRow): MigrationReportRow {
  return {
    id: row.id,
    agencyId: row.agencyId,
    platform: row.platform,
    connectedBy: row.connectedBy,
  };
}

export type MigrationReport = {
  mode: 'dry-run' | 'apply';
  selected: MigrationReportRow[];
  migrated: MigrationReportRow[];
  failed: Array<MigrationReportRow & { error: string }>;
  total: number;
};

/**
 * Run the migration. Default (apply: false) is a dry run: it reports exactly
 * the rows apply would migrate and writes nothing.
 */
export async function runLegacyMigration(
  prisma: MigrationPrisma,
  options: { apply?: boolean; now?: Date } = {}
): Promise<MigrationReport> {
  const apply = options.apply === true;
  const now = options.now ?? new Date();

  const rows = await selectLegacyConnections(prisma);
  const selected: MigrationReportRow[] = rows.map(toReportRow);

  const migrated: MigrationReportRow[] = [];
  const failed: Array<MigrationReportRow & { error: string }> = [];

  if (apply) {
    // Sequential on purpose: one row, one transaction, one audit entry.
    for (const row of rows) {
      try {
        const revoked = await migrateLegacyRow(prisma, row, now);
        if (revoked) {
          migrated.push(toReportRow(row));
        } else {
          // The row changed between selection and apply (usually an OAuth
          // reconnect added a secret). It is left exactly as the reconnect
          // left it and is surfaced for the operator instead of being revoked.
          failed.push({ ...toReportRow(row), error: 'row changed since selection' });
        }
      } catch (error) {
        failed.push({
          ...toReportRow(row),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return { mode: apply ? 'apply' : 'dry-run', selected, migrated, failed, total: selected.length };
}

export function parseArgs(argv: string[]): { apply: boolean } {
  // Dry run unless --apply is passed. --dry-run exists so operators can be
  // explicit in runbooks; it never enables writes.
  return { apply: argv.includes('--apply') };
}

function printReport(report: MigrationReport): void {
  console.log(
    `\n[legacy-snapchat-migration] mode=${report.mode} selected=${report.total} migrated=${report.migrated.length} failed=${report.failed.length}`
  );

  if (report.total === 0) {
    console.log('No legacy manual Snapchat connections matched. Nothing to do.');
    return;
  }

  for (const row of report.selected) {
    const outcome = report.failed.find((entry) => entry.id === row.id);
    const status = report.mode === 'dry-run' ? 'would revoke' : outcome ? 'FAILED' : 'revoked';
    const suffix = outcome ? ` — ${outcome.error}` : '';
    console.log(
      `  ${status}: agencyId=${row.agencyId} platform=${row.platform} connectionId=${row.id} connectedBy=${row.connectedBy}${suffix}`
    );
  }

  if (report.mode === 'dry-run') {
    console.log(
      'Dry run only — no rows changed. Re-run with --apply to deactivate the rows above.'
    );
  } else if (report.failed.length > 0) {
    console.log(
      `${report.failed.length} row(s) failed and remain active. They are safe to retry: re-run with --apply.`
    );
  }
}

/**
 * CLI entry point. Returns the process exit code so tests can call it
 * without exiting the vitest process.
 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { apply } = parseArgs(argv);
  const prisma = new PrismaClient({ log: ['error'] });

  try {
    const report = await runLegacyMigration(prisma, { apply, now: new Date() });
    printReport(report);
    return report.failed.length > 0 ? 1 : 0;
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
    .then((code) => {
      process.exit(code);
    })
    .catch((error) => {
      console.error(
        '[legacy-snapchat-migration] Fatal error:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    });
}
