/**
 * Tests for the Clerk subscription-tier backfill script.
 *
 * The SCALE rename (20260911_rename_agency_tier_to_scale) rewrote
 * subscriptions.tier and agencies.subscription_tier, but nothing rewrote
 * Clerk user metadata. Clerk users can still carry publicMetadata
 * .subscriptionTier values that no longer exist in SubscriptionTierSchema
 * ('AGENCY', and — from the pre-20260314 enum — 'PRO' and 'ENTERPRISE'),
 * which makes TIER_LIMITS[tier] undefined in quota code.
 *
 * Everything here runs against an in-memory fake Clerk client, a fake
 * clerk-metadata service, and a fake Prisma client. No network, no database.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKFILL_ACTOR,
  BACKFILL_AUDIT_ACTION,
  STALE_TIER_MAP,
  parseArgs,
  readStaleTier,
  resolveTargetTier,
  runClerkTierBackfill,
  main,
  type BackfillClerkClient,
  type BackfillClerkUser,
  type BackfillPrisma,
  type SetSubscriptionTierFn,
} from '../backfill-clerk-tier-agency-to-scale';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Quota fingerprints as they were written by clerk-metadata.service across
 * both enum eras. clientOnboards never changed meaning, so it identifies the
 * tier a record was actually paying for regardless of the label stored with it.
 */
const ONBOARDS = { starter: 36, growth: 120, scale: 600, enterprise: -1 } as const;

function quotaLimits(clientOnboards: number) {
  return {
    clientOnboards: { limit: clientOnboards, used: 7, resetsAt: '2027-01-01T00:00:00.000Z' },
    platformAudits: { limit: 3000, used: 12, resetsAt: '2027-01-01T00:00:00.000Z' },
    teamSeats: { limit: -1, used: 3 },
  };
}

function clerkUser(
  id: string,
  tier: string | undefined,
  options: {
    clientOnboards?: number;
    subscriptionStatus?: string;
    subscriptionId?: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    trialEndsAt?: string;
    privateMetadata?: Record<string, unknown> | null;
    publicMetadata?: Record<string, unknown> | null;
  } = {}
): BackfillClerkUser {
  const publicMetadata =
    options.publicMetadata !== undefined
      ? options.publicMetadata
      : tier === undefined
        ? {}
        : { subscriptionTier: tier, tierName: 'Agency', features: ['all_platforms'] };

  const privateMetadata =
    options.privateMetadata !== undefined
      ? options.privateMetadata
      : {
          quotaLimits: quotaLimits(options.clientOnboards ?? ONBOARDS.scale),
          subscriptionStatus: options.subscriptionStatus ?? 'active',
          subscriptionId: options.subscriptionId ?? `sub_${id}`,
          currentPeriodStart: options.currentPeriodStart ?? '2026-08-01T00:00:00.000Z',
          currentPeriodEnd: options.currentPeriodEnd ?? '2026-09-01T00:00:00.000Z',
          trialEndsAt: options.trialEndsAt,
        };

  return { id, publicMetadata, privateMetadata };
}

// ---------------------------------------------------------------------------
// Doubles
// ---------------------------------------------------------------------------

/** In-memory Clerk client exposing only users.getUserList, with real paging. */
function createFakeClerk(users: BackfillClerkUser[]) {
  const calls: Array<{ limit: number; offset: number }> = [];

  const clerk: BackfillClerkClient = {
    users: {
      getUserList: vi.fn(async ({ limit, offset }: { limit: number; offset: number }) => {
        calls.push({ limit, offset });
        return { data: users.slice(offset, offset + limit), totalCount: users.length };
      }),
    },
  };

  return { clerk, pageCalls: calls };
}

type ServiceCall = {
  userId: string;
  tier: string;
  options: Parameters<SetSubscriptionTierFn>[2];
};

/** In-memory stand-in for clerkMetadataService.setSubscriptionTier. */
function createFakeService(users: BackfillClerkUser[] = []) {
  const calls: ServiceCall[] = [];
  let failure: ((userId: string) => { code: string; message: string } | Error | null) | null = null;

  const setSubscriptionTier: SetSubscriptionTierFn = vi.fn(async (userId, tier, options = {}) => {
    const outcome = failure?.(userId) ?? null;
    if (outcome instanceof Error) throw outcome;
    if (outcome) return { data: null, error: outcome };

    calls.push({ userId, tier, options });

    // Mirror the real service closely enough for idempotency assertions:
    // the user's stored tier is rewritten in place.
    const user = users.find((entry) => entry.id === userId);
    if (user && user.publicMetadata) {
      (user.publicMetadata as Record<string, unknown>).subscriptionTier = tier;
    }

    return { data: { tier }, error: null };
  });

  return {
    setSubscriptionTier,
    calls,
    setFailure: (predicate: typeof failure) => {
      failure = predicate;
    },
  };
}

type AuditCreateArgs = { data: Record<string, unknown> };

/** In-memory Prisma double covering only agency lookup + audit insert. */
function createFakePrisma(agencies: Array<{ id: string; clerkUserId: string }> = []) {
  const auditRows: Array<Record<string, unknown>> = [];
  const calls = {
    agencyLookups: [] as string[],
    auditCreates: [] as AuditCreateArgs[],
  };
  let auditFailure: ((args: AuditCreateArgs) => Error | null) | null = null;

  const prisma = {
    agency: {
      findUnique: vi.fn(async (args: { where: { clerkUserId: string } }) => {
        calls.agencyLookups.push(args.where.clerkUserId);
        return agencies.find((row) => row.clerkUserId === args.where.clerkUserId) ?? null;
      }),
    },
    auditLog: {
      create: vi.fn(async (args: AuditCreateArgs) => {
        const failure = auditFailure?.(args) ?? null;
        if (failure) throw failure;
        calls.auditCreates.push(args);
        auditRows.push(args.data);
        return { id: BigInt(auditRows.length), ...args.data };
      }),
    },
    $disconnect: vi.fn(async () => undefined),
  } as unknown as BackfillPrisma;

  return {
    prisma,
    auditRows,
    calls,
    setAuditFailure: (predicate: typeof auditFailure) => {
      auditFailure = predicate;
    },
  };
}

function createHarness(users: BackfillClerkUser[], agencies: Array<{ id: string; clerkUserId: string }> = []) {
  const clerk = createFakeClerk(users);
  const service = createFakeService(users);
  const prismaDouble = createFakePrisma(agencies);

  return {
    ...clerk,
    service,
    ...prismaDouble,
    deps: {
      clerk: clerk.clerk,
      setSubscriptionTier: service.setSubscriptionTier,
      prisma: prismaDouble.prisma,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('clerk tier backfill', () => {
  describe('selection', () => {
    it('treats only values outside the live enum as stale', () => {
      expect(readStaleTier(clerkUser('u1', 'AGENCY'))).toBe('AGENCY');
      expect(readStaleTier(clerkUser('u2', 'PRO'))).toBe('PRO');
      expect(readStaleTier(clerkUser('u3', 'ENTERPRISE'))).toBe('ENTERPRISE');

      expect(readStaleTier(clerkUser('u4', 'SCALE'))).toBeNull();
      expect(readStaleTier(clerkUser('u5', 'GROWTH'))).toBeNull();
      expect(readStaleTier(clerkUser('u6', 'STARTER'))).toBeNull();
      expect(readStaleTier(clerkUser('u7', undefined))).toBeNull();
      expect(readStaleTier(clerkUser('u8', undefined, { publicMetadata: null }))).toBeNull();
    });

    it('maps every retired tier label to SCALE by name', () => {
      expect(STALE_TIER_MAP).toEqual({ AGENCY: 'SCALE', PRO: 'SCALE', ENTERPRISE: 'SCALE' });
    });

    it('prefers the quota fingerprint over the retired label', () => {
      // Post-20260314 AGENCY (= the old PRO tier) carries 600 onboards.
      expect(resolveTargetTier(clerkUser('a', 'AGENCY', { clientOnboards: ONBOARDS.scale }))).toEqual({
        tier: 'SCALE',
        basis: 'quota-fingerprint',
      });

      // Pre-20260314 AGENCY was the $79 mid tier: 120 onboards, now GROWTH.
      // Rewriting it to SCALE would hand out a paid upgrade.
      expect(resolveTargetTier(clerkUser('b', 'AGENCY', { clientOnboards: ONBOARDS.growth }))).toEqual({
        tier: 'GROWTH',
        basis: 'quota-fingerprint',
      });

      expect(resolveTargetTier(clerkUser('c', 'PRO', { clientOnboards: ONBOARDS.scale }))).toEqual({
        tier: 'SCALE',
        basis: 'quota-fingerprint',
      });

      // ENTERPRISE had no modern equivalent; 20260314 folded it into the top
      // paid tier, which the SCALE rename then renamed.
      expect(
        resolveTargetTier(clerkUser('d', 'ENTERPRISE', { clientOnboards: ONBOARDS.enterprise }))
      ).toEqual({ tier: 'SCALE', basis: 'quota-fingerprint' });

      expect(resolveTargetTier(clerkUser('e', 'AGENCY', { clientOnboards: ONBOARDS.starter }))).toEqual({
        tier: 'STARTER',
        basis: 'quota-fingerprint',
      });
    });

    it('falls back to the label when no usable fingerprint exists', () => {
      expect(resolveTargetTier(clerkUser('f', 'AGENCY', { privateMetadata: null }))).toEqual({
        tier: 'SCALE',
        basis: 'tier-name',
      });
      expect(resolveTargetTier(clerkUser('g', 'AGENCY', { clientOnboards: 999 }))).toEqual({
        tier: 'SCALE',
        basis: 'tier-name',
      });
      expect(resolveTargetTier(clerkUser('h', 'SCALE'))).toBeNull();
    });

    it('refuses to guess an unknown label with no usable fingerprint', async () => {
      expect(resolveTargetTier(clerkUser('i', 'PLATINUM', { privateMetadata: null }))).toBeNull();

      const harness = createHarness([
        clerkUser('user_unknown', 'PLATINUM', { privateMetadata: null }),
        clerkUser('user_agency', 'AGENCY', { clientOnboards: ONBOARDS.scale }),
      ]);

      const report = await runClerkTierBackfill(harness.deps, { apply: true, pageSize: 10 });

      expect(report.unmapped).toEqual([{ userId: 'user_unknown', currentTier: 'PLATINUM' }]);
      expect(report.changed.map((row) => row.userId)).toEqual(['user_agency']);
      expect(harness.service.calls.map((call) => call.userId)).toEqual(['user_agency']);
    });
  });

  describe('dry run', () => {
    let harness: ReturnType<typeof createHarness>;

    beforeEach(() => {
      harness = createHarness([
        clerkUser('user_agency', 'AGENCY'),
        clerkUser('user_scale', 'SCALE'),
        clerkUser('user_pro', 'PRO'),
      ]);
    });

    it('reports what apply would change and writes nothing', async () => {
      const report = await runClerkTierBackfill(harness.deps, { pageSize: 10 });

      expect(report.mode).toBe('dry-run');
      expect(report.scanned).toBe(3);
      expect(report.total).toBe(2);
      expect(report.selected.map((row) => row.userId).sort()).toEqual(['user_agency', 'user_pro']);
      expect(report.changed).toEqual([]);
      expect(report.failed).toEqual([]);
      expect(report.auditFailed).toEqual([]);

      // No Clerk write, no audit write.
      expect(harness.service.calls).toHaveLength(0);
      expect(harness.service.setSubscriptionTier).not.toHaveBeenCalled();
      expect(harness.calls.auditCreates).toHaveLength(0);
      expect(harness.calls.agencyLookups).toHaveLength(0);

      // The stale values are still stale after a dry run: a second pass
      // selects exactly the same users.
      const report2 = await runClerkTierBackfill(harness.deps, { pageSize: 10 });
      expect(report2.selected.map((row) => row.userId).sort()).toEqual(['user_agency', 'user_pro']);
    });
  });

  describe('apply', () => {
    it('rewrites only the stale users and leaves current tiers untouched', async () => {
      const harness = createHarness(
        [
          clerkUser('user_agency', 'AGENCY', { clientOnboards: ONBOARDS.scale }),
          clerkUser('user_scale', 'SCALE'),
          clerkUser('user_growth', 'GROWTH', { clientOnboards: ONBOARDS.growth }),
          clerkUser('user_starter', 'STARTER', { clientOnboards: ONBOARDS.starter }),
          clerkUser('user_none', undefined),
        ],
        [{ id: 'agency-1', clerkUserId: 'user_agency' }]
      );

      const report = await runClerkTierBackfill(harness.deps, { apply: true, pageSize: 10 });

      expect(report.mode).toBe('apply');
      expect(report.total).toBe(1);
      expect(report.changed.map((row) => row.userId)).toEqual(['user_agency']);
      expect(report.failed).toEqual([]);

      expect(harness.service.calls).toHaveLength(1);
      expect(harness.service.calls[0].userId).toBe('user_agency');
      expect(harness.service.calls[0].tier).toBe('SCALE');

      // A second apply run selects nothing: the script is idempotent.
      const second = await runClerkTierBackfill(harness.deps, { apply: true, pageSize: 10 });
      expect(second.total).toBe(0);
      expect(second.changed).toEqual([]);
      expect(harness.service.calls).toHaveLength(1);
    });

    it('preserves the private metadata fields the service accepts', async () => {
      const harness = createHarness([
        clerkUser('user_agency', 'AGENCY', {
          subscriptionStatus: 'trialing',
          subscriptionId: 'sub_123',
          currentPeriodStart: '2026-08-01T00:00:00.000Z',
          currentPeriodEnd: '2026-09-01T00:00:00.000Z',
          trialEndsAt: '2026-08-15T00:00:00.000Z',
        }),
      ]);

      await runClerkTierBackfill(harness.deps, { apply: true, pageSize: 10 });

      expect(harness.service.calls[0].options).toEqual({
        subscriptionId: 'sub_123',
        subscriptionStatus: 'trialing',
        currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
        trialEndsAt: new Date('2026-08-15T00:00:00.000Z'),
      });
    });

    it('drops unusable private metadata instead of forwarding it', async () => {
      const harness = createHarness([
        clerkUser('user_agency', 'AGENCY', {
          subscriptionStatus: 'something_else',
          currentPeriodStart: 'not-a-date',
          privateMetadata: {
            quotaLimits: quotaLimits(ONBOARDS.scale),
            subscriptionStatus: 'something_else',
            currentPeriodStart: 'not-a-date',
          },
        }),
      ]);

      await runClerkTierBackfill(harness.deps, { apply: true, pageSize: 10 });

      expect(harness.service.calls[0].options).toEqual({});
    });

    it('writes one audit entry per changed user using the AGENCY_* convention', async () => {
      const harness = createHarness(
        [
          clerkUser('user_agency', 'AGENCY', { clientOnboards: ONBOARDS.scale }),
          clerkUser('user_orphan', 'PRO', { clientOnboards: ONBOARDS.scale }),
        ],
        [{ id: 'agency-1', clerkUserId: 'user_agency' }]
      );

      await runClerkTierBackfill(harness.deps, { apply: true, pageSize: 10 });

      expect(harness.auditRows).toHaveLength(2);

      const byResource = new Map(harness.auditRows.map((row) => [row.resourceId, row]));
      const agencyEntry = byResource.get('user_agency');
      expect(agencyEntry).toMatchObject({
        agencyId: 'agency-1',
        action: BACKFILL_AUDIT_ACTION,
        userEmail: BACKFILL_ACTOR,
        resourceType: 'clerk_user',
        resourceId: 'user_agency',
        ipAddress: '0.0.0.0',
        userAgent: 'unknown',
      });
      expect(agencyEntry?.metadata).toMatchObject({
        previousTier: 'AGENCY',
        newTier: 'SCALE',
        basis: 'quota-fingerprint',
      });
      expect(BACKFILL_AUDIT_ACTION.startsWith('AGENCY_')).toBe(true);

      // A Clerk user with no agency row still gets an audit entry, with a
      // null agencyId — AuditLog.agencyId is optional.
      expect(byResource.get('user_orphan')).toMatchObject({
        agencyId: null,
        resourceId: 'user_orphan',
      });
    });

    it('never rewrites a user whose fingerprint says the label meant GROWTH', async () => {
      const harness = createHarness([
        clerkUser('user_legacy_mid', 'AGENCY', { clientOnboards: ONBOARDS.growth }),
      ]);

      const report = await runClerkTierBackfill(harness.deps, { apply: true, pageSize: 10 });

      expect(report.changed[0]).toMatchObject({
        userId: 'user_legacy_mid',
        currentTier: 'AGENCY',
        targetTier: 'GROWTH',
        basis: 'quota-fingerprint',
      });
      expect(harness.service.calls[0].tier).toBe('GROWTH');
    });
  });

  describe('pagination', () => {
    it('pages through every user beyond the first page', async () => {
      const users = Array.from({ length: 7 }, (_, index) =>
        clerkUser(`user_${index}`, index % 2 === 0 ? 'AGENCY' : 'SCALE', {
          clientOnboards: ONBOARDS.scale,
        })
      );
      const harness = createHarness(users);

      const report = await runClerkTierBackfill(harness.deps, { apply: true, pageSize: 3 });

      expect(harness.pageCalls).toEqual([
        { limit: 3, offset: 0 },
        { limit: 3, offset: 3 },
        { limit: 3, offset: 6 },
      ]);
      expect(report.pages).toBe(3);
      expect(report.scanned).toBe(7);
      expect(report.total).toBe(4);
      expect(report.changed.map((row) => row.userId)).toEqual([
        'user_0',
        'user_2',
        'user_4',
        'user_6',
      ]);
    });

    it('stops paging when a page comes back empty', async () => {
      const harness = createHarness([]);

      const report = await runClerkTierBackfill(harness.deps, { pageSize: 5 });

      expect(harness.pageCalls).toEqual([{ limit: 5, offset: 0 }]);
      expect(report.scanned).toBe(0);
      expect(report.total).toBe(0);
    });
  });

  describe('--limit canary', () => {
    it('stops as soon as the requested number of candidates is collected', async () => {
      const users = Array.from({ length: 10 }, (_, index) =>
        clerkUser(`user_${index}`, 'AGENCY', { clientOnboards: ONBOARDS.scale })
      );
      const harness = createHarness(users);

      const report = await runClerkTierBackfill(harness.deps, {
        apply: true,
        limit: 2,
        pageSize: 3,
      });

      expect(report.limit).toBe(2);
      expect(report.limitReached).toBe(true);
      expect(report.total).toBe(2);
      expect(report.changed.map((row) => row.userId)).toEqual(['user_0', 'user_1']);

      // It stopped after the first page rather than enumerating the org.
      expect(harness.pageCalls).toEqual([{ limit: 3, offset: 0 }]);
      expect(harness.service.calls).toHaveLength(2);

      // The remaining stale users are untouched.
      expect(users.slice(2).every((user) => user.publicMetadata?.subscriptionTier === 'AGENCY')).toBe(
        true
      );
    });

    it('reports limitReached false when fewer candidates exist than the limit', async () => {
      const harness = createHarness([clerkUser('user_0', 'AGENCY', { clientOnboards: ONBOARDS.scale })]);

      const report = await runClerkTierBackfill(harness.deps, { limit: 5, pageSize: 10 });

      expect(report.limitReached).toBe(false);
      expect(report.total).toBe(1);
    });
  });

  describe('failure isolation', () => {
    it('reports a failed Clerk update and keeps processing the rest', async () => {
      const harness = createHarness([
        clerkUser('user_a', 'AGENCY', { clientOnboards: ONBOARDS.scale }),
        clerkUser('user_b', 'AGENCY', { clientOnboards: ONBOARDS.scale }),
        clerkUser('user_c', 'AGENCY', { clientOnboards: ONBOARDS.scale }),
      ]);
      harness.service.setFailure((userId) =>
        userId === 'user_b' ? { code: 'CLERK_UPDATE_FAILED', message: 'Clerk rejected the update' } : null
      );

      const report = await runClerkTierBackfill(harness.deps, { apply: true, pageSize: 10 });

      expect(report.changed.map((row) => row.userId)).toEqual(['user_a', 'user_c']);
      expect(report.failed).toHaveLength(1);
      expect(report.failed[0]).toMatchObject({ userId: 'user_b', currentTier: 'AGENCY' });
      expect(report.failed[0].error).toContain('Clerk rejected the update');

      // No audit entry for the failed user.
      expect(harness.auditRows.map((row) => row.resourceId)).toEqual(['user_a', 'user_c']);
    });

    it('reports a thrown Clerk update and keeps processing the rest', async () => {
      const harness = createHarness([
        clerkUser('user_a', 'AGENCY', { clientOnboards: ONBOARDS.scale }),
        clerkUser('user_b', 'AGENCY', { clientOnboards: ONBOARDS.scale }),
      ]);
      harness.service.setFailure((userId) =>
        userId === 'user_a' ? new Error('network unreachable') : null
      );

      const report = await runClerkTierBackfill(harness.deps, { apply: true, pageSize: 10 });

      expect(report.failed).toHaveLength(1);
      expect(report.failed[0].userId).toBe('user_a');
      expect(report.failed[0].error).toContain('network unreachable');
      expect(report.changed.map((row) => row.userId)).toEqual(['user_b']);
    });

    it('separates an audit failure from a Clerk failure and continues', async () => {
      const harness = createHarness(
        [
          clerkUser('user_a', 'AGENCY', { clientOnboards: ONBOARDS.scale }),
          clerkUser('user_b', 'AGENCY', { clientOnboards: ONBOARDS.scale }),
        ],
        [
          { id: 'agency-a', clerkUserId: 'user_a' },
          { id: 'agency-b', clerkUserId: 'user_b' },
        ]
      );
      harness.setAuditFailure((args) =>
        args.data.resourceId === 'user_a' ? new Error('audit insert failed') : null
      );

      const report = await runClerkTierBackfill(harness.deps, { apply: true, pageSize: 10 });

      // The Clerk metadata for user_a was already rewritten, so it counts as
      // changed — but the missing audit row is surfaced, not swallowed.
      expect(report.changed.map((row) => row.userId)).toEqual(['user_a', 'user_b']);
      expect(report.auditFailed).toHaveLength(1);
      expect(report.auditFailed[0].userId).toBe('user_a');
      expect(report.auditFailed[0].error).toContain('audit insert failed');
      expect(report.failed).toEqual([]);
      expect(harness.auditRows.map((row) => row.resourceId)).toEqual(['user_b']);
    });
  });

  describe('cli', () => {
    const hoisted = vi.hoisted(() => ({
      prisma: { current: null as unknown },
      clerk: { current: null as unknown },
      setSubscriptionTier: { current: null as unknown },
    }));

    vi.mock('@prisma/client', () => ({
      PrismaClient: class {
        constructor() {
          return hoisted.prisma.current;
        }
      },
    }));

    vi.mock('@/lib/clerk', () => ({
      getClerkClient: () => hoisted.clerk.current,
    }));

    vi.mock('@/services/clerk-metadata.service', () => ({
      clerkMetadataService: {
        setSubscriptionTier: (...args: unknown[]) =>
          (hoisted.setSubscriptionTier.current as (...a: unknown[]) => unknown)(...args),
      },
    }));

    function installHarness(harness: ReturnType<typeof createHarness>) {
      hoisted.prisma.current = harness.prisma;
      hoisted.clerk.current = harness.clerk;
      hoisted.setSubscriptionTier.current = harness.service.setSubscriptionTier;
    }

    it('parses flags with dry run as the default', () => {
      expect(parseArgs([])).toEqual({ apply: false, limit: null });
      expect(parseArgs(['--dry-run'])).toEqual({ apply: false, limit: null });
      expect(parseArgs(['--apply'])).toEqual({ apply: true, limit: null });
      expect(parseArgs(['--apply', '--limit', '5'])).toEqual({ apply: true, limit: 5 });
      expect(parseArgs(['--limit=5'])).toEqual({ apply: false, limit: 5 });
      expect(parseArgs(['--limit', 'nonsense'])).toEqual({ apply: false, limit: null });
      expect(parseArgs(['--limit', '0'])).toEqual({ apply: false, limit: null });
    });

    it('defaults to dry run, writes only with --apply, and disconnects', async () => {
      const dry = createHarness([clerkUser('user_agency', 'AGENCY', { clientOnboards: ONBOARDS.scale })]);
      installHarness(dry);

      expect(await main([])).toBe(0);
      expect(dry.service.calls).toHaveLength(0);
      expect(dry.calls.auditCreates).toHaveLength(0);
      expect(dry.prisma.$disconnect).toHaveBeenCalled();

      const applied = createHarness(
        [clerkUser('user_agency', 'AGENCY', { clientOnboards: ONBOARDS.scale })],
        [{ id: 'agency-1', clerkUserId: 'user_agency' }]
      );
      installHarness(applied);

      expect(await main(['--apply'])).toBe(0);
      expect(applied.service.calls).toHaveLength(1);
      expect(applied.auditRows).toHaveLength(1);
      expect(applied.prisma.$disconnect).toHaveBeenCalled();
    });

    it('exits 1 when any user failed', async () => {
      const harness = createHarness([
        clerkUser('user_a', 'AGENCY', { clientOnboards: ONBOARDS.scale }),
      ]);
      harness.service.setFailure(() => new Error('boom'));
      installHarness(harness);

      expect(await main(['--apply'])).toBe(1);
      expect(harness.prisma.$disconnect).toHaveBeenCalled();
    });
  });
});
