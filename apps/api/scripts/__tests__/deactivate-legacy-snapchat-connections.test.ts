/**
 * Tests for the legacy manual-Snapchat connection migration script.
 *
 * The script deactivates agency platform connections that are still marked
 * 'active' but have no Infisical secret (secretId IS NULL) — rows created by
 * the retired manual-invitation flow. Deactivation makes the U4 row-reuse
 * path in agency-platform.service.ts take over on reconnect.
 *
 * All tests run against an in-memory fake Prisma client. No database is
 * touched, matching the script's LOCAL-ONLY scope.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEGACY_MIGRATION_ACTOR,
  LEGACY_MIGRATION_AUDIT_ACTION,
  buildLegacySelectionWhere,
  main,
  parseArgs,
  runLegacyMigration,
  selectLegacyConnections,
  type MigrationPrisma,
} from '../deactivate-legacy-snapchat-connections';

type ConnectionRow = {
  id: string;
  agencyId: string;
  platform: string;
  status: string;
  secretId: string | null;
  connectionMode: string;
  connectedBy: string;
  revokedAt: Date | null;
  revokedBy: string | null;
};

type AuditRow = {
  id: number;
  agencyId: string | null;
  action: string;
  agencyConnectionId: string | null;
  userEmail: string | null;
  metadata: unknown;
  createdAt: Date;
};

type AuditCreateArgs = { data: Record<string, unknown> };

/** Predicate deciding whether an audit insert fails (and with what error). */
type AuditFailurePredicate = ((args: AuditCreateArgs) => Error | null) | null;

/** Predicate deciding which row is reconnected by OAuth mid-run. */
type ReconnectPredicate = ((args: { id: string }) => boolean) | null;

type UpdateWhere = { id: string; status?: string; secretId?: string | null };

type UpdateManyArgs = { where: UpdateWhere; data: Record<string, unknown> };

function legacyRow(overrides: Partial<ConnectionRow> = {}): ConnectionRow {
  return {
    id: overrides.id ?? `conn-${Math.random().toString(36).slice(2, 8)}`,
    agencyId: overrides.agencyId ?? 'agency-1',
    platform: overrides.platform ?? 'snapchat',
    status: overrides.status ?? 'active',
    secretId: overrides.secretId ?? null,
    connectionMode: overrides.connectionMode ?? 'identity',
    connectedBy: overrides.connectedBy ?? 'owner@agency.test',
    revokedAt: overrides.revokedAt ?? null,
    revokedBy: overrides.revokedBy ?? null,
  };
}

function oauthRow(overrides: Partial<ConnectionRow> = {}): ConnectionRow {
  return legacyRow({
    secretId: 'snapchat_agency_agency-1',
    connectionMode: 'oauth',
    ...overrides,
  });
}

/**
 * In-memory Prisma double. $transaction runs the callback against a tx whose
 * writes are reverted when the callback throws — the same rollback semantics
 * Prisma gives an interactive transaction, so tests can assert that a failed
 * audit insert leaves the row untouched.
 */
function createFakePrisma(
  rows: ConnectionRow[],
  existingAudit: Array<Omit<AuditRow, 'id' | 'createdAt'>> = []
) {
  const connectionRows = rows.map((row) => ({ ...row }));
  const auditRows: AuditRow[] = existingAudit.map((row, index) => ({
    ...row,
    id: index + 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  }));

  const calls = {
    findManyWhere: [] as Array<Record<string, unknown>>,
    transactionCallbacks: 0,
    updateManys: [] as UpdateManyArgs[],
    auditCreates: [] as AuditCreateArgs[],
  };

  let auditFailure: AuditFailurePredicate = null;
  let reconnectBeforeRevoke: ReconnectPredicate = null;
  // Writes made inside the current transaction register their reversal here;
  // $transaction points it at that run's undo list. Rows are processed
  // sequentially, so one reference is enough.
  let currentUndo: Array<() => void> = [];

  const rowFor = (id: string) => connectionRows.find((row) => row.id === id);

  const failAudit = (args: AuditCreateArgs) =>
    typeof auditFailure === 'function' ? auditFailure(args) : null;

  /**
   * Compare-and-set update. Matches rows on the full `where` predicate — not
   * just the id — so a row that no longer satisfies the predicate is left
   * alone and reported as count 0, exactly like Prisma's updateMany. Writes
   * register an undo entry so a later throw rolls them back.
   */
  const updateManyRows = async (args: UpdateManyArgs) => {
    calls.updateManys.push(args);
    const matches = connectionRows.filter((row) => matchesWhere(row, args.where));
    for (const row of matches) {
      const before = { ...row };
      currentUndo.push(() => {
        Object.assign(row, before);
      });
      Object.assign(row, args.data);
    }
    return { count: matches.length };
  };

  const prisma = {
    agencyPlatformConnection: {
      findMany: vi.fn(async (args: { where?: Record<string, unknown> } = {}) => {
        const where = args.where ?? {};
        calls.findManyWhere.push(where);
        return connectionRows
          .filter((row) => matchesWhere(row, where))
          .map((row) => ({ ...row }));
      }),
    },
    auditLog: {
      create: vi.fn(async (args: AuditCreateArgs) => {
        const failure = failAudit(args);
        if (failure) throw failure;
        calls.auditCreates.push(args);
        const created: AuditRow = {
          id: auditRows.length + 1,
          createdAt: new Date(),
          ...(args.data as object),
        } as unknown as AuditRow;
        auditRows.push(created);
        return created;
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      calls.transactionCallbacks += 1;
      const undo: Array<() => void> = [];
      currentUndo = undo;
      const tx = {
        agencyPlatformConnection: {
          // A concurrent OAuth reconnect lands before the revoke when the
          // hook matches the row: the row gains a secret, then the CAS
          // predicate is evaluated against the mutated row. The reconnect's
          // write is committed by another transaction, so it is never undone
          // by this script's rollback.
          updateMany: async (args: UpdateManyArgs) => {
            if (typeof reconnectBeforeRevoke === 'function') {
              const row = rowFor(args.where.id);
              if (row && reconnectBeforeRevoke({ id: args.where.id })) {
                Object.assign(row, {
                  secretId: 'snapchat_agency_reconnected',
                  connectionMode: 'oauth',
                });
              }
            }
            return updateManyRows(args);
          },
        },
        auditLog: {
          create: async (args: AuditCreateArgs) => {
            const failure = failAudit(args);
            if (failure) throw failure;
            undo.push(() => {
              auditRows.pop();
            });
            calls.auditCreates.push(args);
            const created: AuditRow = {
              id: auditRows.length + 1,
              createdAt: new Date(),
              ...(args.data as object),
            } as unknown as AuditRow;
            auditRows.push(created);
            return created;
          },
        },
      };
      try {
        return await fn(tx);
      } catch (error) {
        for (const revert of undo.reverse()) revert();
        throw error;
      }
    }),
    $disconnect: vi.fn(async () => undefined),
    // The in-memory double is cast to the migration's real Prisma surface
    // here, once: the script functions are typed against the actual client
    // delegates, and only the test fakes need a cast.
  } as unknown as MigrationPrisma;

  return {
    prisma,
    connectionRows,
    auditRows,
    calls,
    setAuditFailure: (predicate: AuditFailurePredicate) => {
      auditFailure = predicate;
    },
    setReconnectBeforeRevoke: (predicate: ReconnectPredicate) => {
      reconnectBeforeRevoke = predicate;
    },
  };
}

function matchesWhere(row: ConnectionRow, where: Record<string, any>): boolean {
  if (where.id !== undefined && where.id !== row.id) return false;
  if (where.platform) {
    const inList = where.platform.in;
    if (inList) {
      if (!inList.includes(row.platform)) return false;
    } else if (where.platform !== row.platform) {
      return false;
    }
  }
  if (where.status !== undefined && where.status !== row.status) return false;
  if (where.secretId !== undefined) {
    if (where.secretId === null) {
      if (row.secretId !== null) return false;
    } else if (where.secretId !== row.secretId) {
      return false;
    }
  }
  return true;
}

const NOW = new Date('2026-09-09T12:00:00.000Z');

describe('legacy Snapchat connection migration', () => {
  let fake: ReturnType<typeof createFakePrisma>;

  beforeEach(() => {
    fake = createFakePrisma([
      legacyRow({ id: 'conn-snap', platform: 'snapchat' }),
      legacyRow({ id: 'conn-ads', platform: 'snapchat_ads', connectedBy: 'ops@agency.test' }),
      oauthRow({ id: 'conn-oauth', platform: 'snapchat' }),
      legacyRow({ id: 'conn-old', status: 'revoked', revokedAt: new Date('2026-05-01T00:00:00.000Z'), revokedBy: 'owner@agency.test' }),
    ], [
      {
        agencyId: 'agency-1',
        action: 'AGENCY_CONNECTED',
        agencyConnectionId: 'conn-snap',
        userEmail: 'owner@agency.test',
        metadata: { platform: 'snapchat' },
      },
    ]);
  });

  it('selection predicate targets snapchat rows that are active with no secret', async () => {
    await selectLegacyConnections(fake.prisma);

    expect(fake.calls.findManyWhere).toEqual([buildLegacySelectionWhere()]);
    expect(buildLegacySelectionWhere()).toEqual({
      platform: { in: ['snapchat', 'snapchat_ads'] },
      status: 'active',
      secretId: null,
    });
  });

  it('apply deactivates legacy rows and writes one audit entry per row', async () => {
    const report = await runLegacyMigration(fake.prisma, { apply: true, now: NOW });

    expect(report.mode).toBe('apply');
    expect(report.total).toBe(2);
    expect(report.failed).toEqual([]);

    const snap = fake.connectionRows.find((row) => row.id === 'conn-snap');
    const ads = fake.connectionRows.find((row) => row.id === 'conn-ads');
    for (const row of [snap, ads]) {
      expect(row?.status).toBe('revoked');
      expect(row?.revokedAt).toEqual(NOW);
      expect(row?.revokedBy).toBe(LEGACY_MIGRATION_ACTOR);
    }

    // One audit entry per migrated row, following the AGENCY_* convention.
    expect(fake.calls.auditCreates).toHaveLength(2);
    const auditByConnection = new Map(
      fake.auditRows.map((entry) => [entry.agencyConnectionId, entry])
    );
    for (const connectionId of ['conn-snap', 'conn-ads']) {
      const entry = auditByConnection.get(connectionId);
      expect(entry, `audit entry for ${connectionId}`).toBeDefined();
      expect(entry?.action).toBe(LEGACY_MIGRATION_AUDIT_ACTION);
      expect(entry?.agencyId).toBe('agency-1');
      expect(entry?.userEmail).toBe(LEGACY_MIGRATION_ACTOR);
      expect((entry?.metadata as { platform: string }).platform).toBe(
        connectionId === 'conn-snap' ? 'snapchat' : 'snapchat_ads'
      );
    }

    // Audit history is preserved: the pre-existing entry is still first.
    expect(fake.auditRows[0].action).toBe('AGENCY_CONNECTED');
    expect(fake.auditRows).toHaveLength(3);

    // The migration only revokes; it must not rewrite mode or identity fields.
    expect(snap?.connectionMode).toBe('identity');
    expect(snap?.secretId).toBeNull();
    expect(snap?.connectedBy).toBe('owner@agency.test');
  });

  it('dry run changes nothing and reports the same rows apply would migrate', async () => {
    const dryRun = await runLegacyMigration(fake.prisma, { apply: false, now: NOW });

    expect(dryRun.mode).toBe('dry-run');
    expect(dryRun.selected.map((row) => row.id).sort()).toEqual(['conn-ads', 'conn-snap']);
    expect(dryRun.migrated).toEqual([]);
    expect(fake.calls.transactionCallbacks).toBe(0);
    expect(fake.calls.updateManys).toHaveLength(0);
    expect(fake.calls.auditCreates).toHaveLength(0);

    // Every selected row is untouched by a dry run.
    for (const row of fake.connectionRows) {
      expect(row.status).toBe(
        row.id === 'conn-oauth' ? 'active' : row.id === 'conn-old' ? 'revoked' : 'active'
      );
      if (row.id === 'conn-snap' || row.id === 'conn-ads') {
        expect(row.revokedAt).toBeNull();
        expect(row.revokedBy).toBeNull();
      }
    }

    // An apply run over the same seed migrates exactly the dry-run selection.
    const second = createFakePrisma(
      [
        legacyRow({ id: 'conn-snap' }),
        legacyRow({ id: 'conn-ads', connectedBy: 'ops@agency.test' }),
        oauthRow({ id: 'conn-oauth' }),
        legacyRow({ id: 'conn-old', status: 'revoked' }),
      ],
      []
    );
    const applied = await runLegacyMigration(second.prisma, { apply: true, now: NOW });
    expect(applied.migrated.map((row) => row.id).sort()).toEqual(
      dryRun.selected.map((row) => row.id).sort()
    );
    // Dry run reports the connecting user per row.
    expect(dryRun.selected.find((row) => row.id === 'conn-ads')?.connectedBy).toBe('ops@agency.test');
  });

  it('rows that hold an OAuth secret are never selected or modified', async () => {
    const report = await runLegacyMigration(fake.prisma, { apply: true, now: NOW });

    const oauth = fake.connectionRows.find((row) => row.id === 'conn-oauth');
    expect(oauth?.status).toBe('active');
    expect(oauth?.secretId).toBe('snapchat_agency_agency-1');
    expect(oauth?.revokedAt).toBeNull();
    expect(report.selected.some((row) => row.id === 'conn-oauth')).toBe(false);
    expect(report.migrated.some((row) => row.id === 'conn-oauth')).toBe(false);
  });

  it('is idempotent: a second apply selects nothing and writes nothing', async () => {
    const first = await runLegacyMigration(fake.prisma, { apply: true, now: NOW });
    expect(first.total).toBe(2);

    const updatesAfterFirst = fake.calls.updateManys.length;
    const auditCreatesAfterFirst = fake.calls.auditCreates.length;
    const auditCountAfterFirst = fake.auditRows.length;

    const second = await runLegacyMigration(fake.prisma, { apply: true, now: NOW });

    expect(second.mode).toBe('apply');
    expect(second.selected).toEqual([]);
    expect(second.total).toBe(0);
    expect(second.migrated).toEqual([]);
    expect(fake.calls.updateManys).toHaveLength(updatesAfterFirst);
    expect(fake.calls.auditCreates).toHaveLength(auditCreatesAfterFirst);
    expect(fake.auditRows).toHaveLength(auditCountAfterFirst);
  });

  it('uses one transaction per row and rolls the row back when the audit insert fails', async () => {
    // Fail only the audit insert for the snapchat_ads row: the other row must
    // still migrate, proving failure isolation, and the failed row must stay
    // active so a re-run retries it.
    fake.setAuditFailure((args) =>
      (args.data.metadata as { platform?: string })?.platform === 'snapchat_ads'
        ? new Error('audit log write failed')
        : null
    );

    const report = await runLegacyMigration(fake.prisma, { apply: true, now: NOW });

    // Per-row interactive transactions, not one batch transaction.
    expect(fake.calls.transactionCallbacks).toBe(2);

    const snap = fake.connectionRows.find((row) => row.id === 'conn-snap');
    const ads = fake.connectionRows.find((row) => row.id === 'conn-ads');
    expect(snap?.status).toBe('revoked');

    // The failed row's update was rolled back and is retryable.
    expect(ads?.status).toBe('active');
    expect(ads?.revokedAt).toBeNull();
    expect(ads?.revokedBy).toBeNull();

    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]).toMatchObject({ id: 'conn-ads', platform: 'snapchat_ads' });
    expect(report.failed[0].error).toContain('audit log write failed');
    expect(report.migrated.map((row) => row.id)).toEqual(['conn-snap']);

    // No partial audit row exists for the failed connection.
    expect(
      fake.auditRows.some((entry) => entry.agencyConnectionId === 'conn-ads')
    ).toBe(false);
    expect(fake.auditRows).toHaveLength(2); // pre-existing + conn-snap
  });

  it('skips revoke and audit when a row gains a secret between selection and apply', async () => {
    // An OAuth reconnect lands after selection and before the snapchat_ads
    // row's revoke: the row is a working OAuth connection by the time the
    // compare-and-set runs, so it must not be revoked.
    fake.setReconnectBeforeRevoke(({ id }) => id === 'conn-ads');

    const report = await runLegacyMigration(fake.prisma, { apply: true, now: NOW });

    // The revoke still re-checks the selection predicate inside the row's
    // transaction, not just the primary key.
    expect(fake.calls.updateManys).toEqual([
      {
        where: { id: 'conn-snap', status: 'active', secretId: null },
        data: { status: 'revoked', revokedAt: NOW, revokedBy: LEGACY_MIGRATION_ACTOR },
      },
      {
        where: { id: 'conn-ads', status: 'active', secretId: null },
        data: { status: 'revoked', revokedAt: NOW, revokedBy: LEGACY_MIGRATION_ACTOR },
      },
    ]);

    // The changed row is reported as failed/skipped with the reason.
    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]).toMatchObject({
      id: 'conn-ads',
      agencyId: 'agency-1',
      platform: 'snapchat_ads',
      connectedBy: 'ops@agency.test',
    });
    expect(report.failed[0].error).toBe('row changed since selection');
    expect(report.migrated.map((row) => row.id)).toEqual(['conn-snap']);

    // The row keeps the reconnect's state: not revoked, secret preserved.
    const ads = fake.connectionRows.find((row) => row.id === 'conn-ads');
    expect(ads?.status).toBe('active');
    expect(ads?.secretId).toBe('snapchat_agency_reconnected');
    expect(ads?.connectionMode).toBe('oauth');
    expect(ads?.revokedAt).toBeNull();
    expect(ads?.revokedBy).toBeNull();

    // No audit entry for the skipped row; the untouched row still gets one.
    expect(
      fake.auditRows.some((entry) => entry.agencyConnectionId === 'conn-ads')
    ).toBe(false);
    expect(fake.auditRows).toHaveLength(2); // pre-existing + conn-snap
    expect(fake.calls.auditCreates).toHaveLength(1);
  });

  it('leaves non-active legacy rows alone so row reuse stays possible', async () => {
    const rows = [
      legacyRow({ id: 'conn-revoked', status: 'revoked' }),
      legacyRow({ id: 'conn-expired', status: 'expired' }),
      legacyRow({ id: 'conn-invalid', status: 'invalid' }),
    ];
    const store = createFakePrisma(rows);

    const report = await runLegacyMigration(store.prisma, { apply: true, now: NOW });

    expect(report.total).toBe(0);
    expect(store.calls.updateManys).toHaveLength(0);
    expect(store.calls.auditCreates).toHaveLength(0);
    for (const row of store.connectionRows) {
      expect(row.status).not.toBe('active');
      expect(row.revokedBy).toBeNull();
    }
    // A prior revoke keeps its original attribution.
    const revoked = store.connectionRows.find((row) => row.id === 'conn-revoked');
    expect(revoked?.status).toBe('revoked');
  });

  describe('cli', () => {
    const hoisted = vi.hoisted(() => ({ currentPrisma: { current: null as unknown } }));

    vi.mock('@prisma/client', () => ({
      // A class (not a vi.fn arrow) so `new PrismaClient()` can return the
      // current fake prisma instance.
      PrismaClient: class {
        constructor() {
          return hoisted.currentPrisma.current;
        }
      },
    }));

    it('defaults to dry-run and only writes in --apply mode', async () => {
      expect(parseArgs([])).toEqual({ apply: false });
      expect(parseArgs(['--dry-run'])).toEqual({ apply: false });
      expect(parseArgs(['--apply'])).toEqual({ apply: true });

      // Default invocation: dry run, no writes, exit 0.
      hoisted.currentPrisma.current = fake.prisma;
      const dryExit = await main([]);
      expect(dryExit).toBe(0);
      expect(fake.calls.transactionCallbacks).toBe(0);
      expect(fake.calls.updateManys).toHaveLength(0);

      const applyStore = createFakePrisma([
        legacyRow({ id: 'conn-snap' }),
        oauthRow({ id: 'conn-oauth' }),
      ]);
      hoisted.currentPrisma.current = applyStore.prisma;
      const applyExit = await main(['--apply']);
      expect(applyExit).toBe(0);
      expect(applyStore.calls.updateManys).toHaveLength(1);
      expect(applyStore.prisma.$disconnect).toHaveBeenCalled();
    });

    it('exits 1 when a row changed since selection', async () => {
      const store = createFakePrisma([legacyRow({ id: 'conn-only' })]);
      store.setReconnectBeforeRevoke(() => true);
      hoisted.currentPrisma.current = store.prisma;

      const exitCode = await main(['--apply']);

      expect(exitCode).toBe(1);
      expect(store.connectionRows[0].status).toBe('active');
      expect(store.connectionRows[0].secretId).toBe('snapchat_agency_reconnected');
      expect(store.auditRows).toHaveLength(0);
      expect(store.prisma.$disconnect).toHaveBeenCalled();
    });
  });
});
