#!/usr/bin/env node
/**
 * Backfill stale subscription tiers in Clerk user metadata.
 *
 * The SCALE rename shipped as a SQL migration
 * (prisma/migrations/20260911_rename_agency_tier_to_scale) that rewrote
 * subscriptions.tier and agencies.subscription_tier. Nothing rewrote Clerk.
 *
 * clerk-metadata.service.ts stores publicMetadata.subscriptionTier (plus
 * tierName and features) and privateMetadata.quotaLimits, all derived from
 * TIER_LIMITS. getSubscriptionTier reads that value straight back, and quota
 * code then does TIER_LIMITS[tier]. SubscriptionTierSchema is now
 * ['STARTER','GROWTH','SCALE'], so any Clerk user still holding a retired
 * label makes that lookup undefined and the quota path throws.
 *
 * Retired labels this script can encounter, and why:
 *   - 'AGENCY'     — the top tier until 20260911 renamed it to SCALE.
 *   - 'PRO'        — from the pre-20260314 enum
 *                    ['STARTER','AGENCY','PRO','ENTERPRISE'], which was live
 *                    while this service was already writing Clerk metadata
 *                    (service added 2026-01-27, enum replaced 2026-03-14).
 *                    20260314_rename_subscription_tiers mapped PRO → AGENCY
 *                    in the database only.
 *   - 'ENTERPRISE' — same era; that migration folded it into AGENCY.
 *
 * WHY 'AGENCY' IS NOT UNCONDITIONALLY 'SCALE'
 * The label 'AGENCY' meant two different products either side of 20260314:
 *   - before: the $79 mid tier (120 client onboards)  → today's GROWTH
 *   - after:  the $149 top tier (600 client onboards) → today's SCALE
 * The database never had to disambiguate, because 20260314 rewrote its rows
 * at the time. Clerk was skipped, so both eras can still be sitting there.
 * Rewriting every 'AGENCY' record to SCALE would silently promote pre-March
 * users from a $79 plan's quota to a $149 plan's quota.
 *
 * So the target tier is resolved from the quota fingerprint first —
 * privateMetadata.quotaLimits.clientOnboards.limit, whose meaning never
 * changed across either rename:
 *     36 → STARTER   120 → GROWTH   600 → SCALE   -1 → SCALE (retired
 *     ENTERPRISE, folded into the top paid tier by 20260314)
 * Only when no usable fingerprint exists does it fall back to the label map
 * (AGENCY/PRO/ENTERPRISE → SCALE). Every selected user prints its basis, so
 * a dry run shows exactly which rule decided each rewrite.
 *
 * SIDE EFFECT TO EXPECT
 * The rewrite goes through clerkMetadataService.setSubscriptionTier so that
 * tierName, features and quotaLimits are recomputed from one source. That
 * function resets quotaLimits.*.used to 0 (teamSeats to 1). The five-minute
 * syncQuotaUsage job restores real usage from AgencyUsageCounter, so the
 * reset is self-healing, but a run does briefly zero the Clerk-side counters.
 *
 * Safety properties:
 *  - Dry run by default. Writes only with --apply.
 *  - Selection is self-limiting: a rewritten user now holds a live tier and
 *    is not selected again, so a second apply run changes nothing.
 *  - One user at a time. A failed Clerk update or audit insert is recorded
 *    and the run continues with the next user.
 *  - A user whose label is not in the retired map and has no usable quota
 *    fingerprint is reported as unmapped and never guessed at.
 *  - Clerk and PostgreSQL cannot share a transaction. The Clerk write happens
 *    first; if its audit insert then fails, the user is reported under
 *    auditFailed with the tier it was moved to, because re-running will not
 *    re-select it.
 *
 * OPERATOR-GATED: this script must never be pointed at staging or production
 * as part of development. Run a dry run first, read the printed users and
 * their basis, then run a small --limit canary, then the full --apply, each
 * time with that environment's credentials set explicitly.
 *
 * Usage:
 *   npx tsx scripts/backfill-clerk-tier-agency-to-scale.ts                      # dry run
 *   npx tsx scripts/backfill-clerk-tier-agency-to-scale.ts --dry-run            # dry run
 *   npx tsx scripts/backfill-clerk-tier-agency-to-scale.ts --limit 5            # dry run, first 5
 *   npx tsx scripts/backfill-clerk-tier-agency-to-scale.ts --apply --limit 5    # canary: writes 5
 *   npx tsx scripts/backfill-clerk-tier-agency-to-scale.ts --apply              # writes all
 *
 * Flags:
 *   --apply       Perform writes. Without it nothing is written.
 *   --dry-run     Explicit no-op default, for runbooks. Never enables writes.
 *   --limit N     Stop after N candidates are collected. N must be > 0.
 *
 * Environment (read through apps/api/src/lib/env.ts, Zod-validated):
 *   CLERK_SECRET_KEY   the Clerk backend client is built from this
 *   DATABASE_URL       agency lookup for audit attribution, and the audit write
 * The full env schema is validated on import, so any other required var must
 * be present too. Nothing secret is ever printed: the report contains Clerk
 * user ids, agency ids and tier labels only.
 *
 * Exit code 0 when every selected user completed (or nothing was selected).
 * Exit code 1 when any user failed its Clerk update or its audit insert.
 */

import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { SubscriptionTierSchema, type SubscriptionTier } from '@agency-platform/shared';
import { getClerkClient } from '@/lib/clerk';
import { clerkMetadataService } from '@/services/clerk-metadata.service';

/** Actor recorded on the audit entries this backfill writes. */
export const BACKFILL_ACTOR = 'system:clerk-tier-scale-backfill';

/**
 * Audit action for this backfill. Naming follows the agency lifecycle
 * convention in the AuditLog schema and agency-platform.service.ts
 * (AGENCY_CONNECTED, AGENCY_DISCONNECTED, AGENCY_TOKEN_REFRESHED): agency
 * scoped actions are UPPERCASE with the AGENCY_ prefix, written through
 * prisma.auditLog.create with metadata and placeholder ip/userAgent.
 */
export const BACKFILL_AUDIT_ACTION = 'AGENCY_SUBSCRIPTION_TIER_BACKFILLED';

/** Retired tier labels, mapped by name. Used only when no fingerprint exists. */
export const STALE_TIER_MAP: Record<string, SubscriptionTier> = {
  AGENCY: 'SCALE',
  PRO: 'SCALE',
  ENTERPRISE: 'SCALE',
};

/**
 * clientOnboards limits as written by clerk-metadata.service from TIER_LIMITS,
 * across both enum eras. These numbers identify the tier a record was actually
 * provisioned for, independently of the label stored beside them.
 */
export const QUOTA_FINGERPRINT_TO_TIER = new Map<number, SubscriptionTier>([
  [36, 'STARTER'],
  [120, 'GROWTH'],
  [600, 'SCALE'],
  [-1, 'SCALE'], // retired ENTERPRISE (unlimited onboards), folded in by 20260314
]);

/** Clerk's maximum page size for users.getUserList. */
export const CLERK_PAGE_SIZE = 100;

const LIVE_TIERS: readonly string[] = SubscriptionTierSchema.options;

/** The slice of a Clerk user this backfill reads. */
export type BackfillClerkUser = {
  id: string;
  publicMetadata?: Record<string, unknown> | null;
  privateMetadata?: Record<string, unknown> | null;
};

/**
 * The Clerk surface this backfill touches. The real backend client from
 * lib/clerk.ts satisfies it; tests pass an in-memory double.
 */
export type BackfillClerkClient = {
  users: {
    getUserList(params: { limit: number; offset: number }): Promise<{
      data: BackfillClerkUser[];
      totalCount: number;
    }>;
  };
};

/** clerkMetadataService.setSubscriptionTier, narrowed to what is injected. */
export type SetSubscriptionTierFn = (
  clerkUserId: string,
  tier: SubscriptionTier,
  options?: {
    subscriptionId?: string;
    subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'trialing';
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    trialEndsAt?: Date;
  }
) => Promise<{ data: unknown; error: { code: string; message: string } | null }>;

/** The Prisma surface this backfill touches: agency lookup, audit, disconnect. */
export type BackfillPrisma = Pick<PrismaClient, 'agency' | 'auditLog' | '$disconnect'>;

export type BackfillDeps = {
  clerk: BackfillClerkClient;
  setSubscriptionTier: SetSubscriptionTierFn;
  prisma: BackfillPrisma;
};

/** How a target tier was decided. Printed per user so a dry run is auditable. */
export type ResolutionBasis = 'quota-fingerprint' | 'tier-name';

export type BackfillCandidate = {
  userId: string;
  currentTier: string;
  targetTier: SubscriptionTier;
  basis: ResolutionBasis;
  /**
   * Subscription facts read off the user at selection time. setSubscriptionTier
   * rebuilds privateMetadata from scratch, so these are handed back to it.
   */
  preservedOptions: Parameters<SetSubscriptionTierFn>[2];
};

export type BackfillReport = {
  mode: 'dry-run' | 'apply';
  scanned: number;
  pages: number;
  limit: number | null;
  limitReached: boolean;
  selected: BackfillCandidate[];
  changed: BackfillCandidate[];
  failed: Array<BackfillCandidate & { error: string }>;
  auditFailed: Array<BackfillCandidate & { error: string }>;
  unmapped: Array<{ userId: string; currentTier: string }>;
  total: number;
};

/**
 * Return the user's subscriptionTier when it is no longer a member of
 * SubscriptionTierSchema, otherwise null. A user with no tier set is not
 * stale — it has never been provisioned and quota code treats it as free.
 */
export function readStaleTier(user: BackfillClerkUser): string | null {
  const tier = user.publicMetadata?.subscriptionTier;
  if (typeof tier !== 'string' || tier.length === 0) return null;
  return LIVE_TIERS.includes(tier) ? null : tier;
}

/** Read privateMetadata.quotaLimits.clientOnboards.limit, when present. */
function readOnboardsFingerprint(user: BackfillClerkUser): number | null {
  const quotaLimits = (user.privateMetadata as { quotaLimits?: unknown } | null | undefined)
    ?.quotaLimits as { clientOnboards?: { limit?: unknown } } | undefined;
  const limit = quotaLimits?.clientOnboards?.limit;
  return typeof limit === 'number' && Number.isFinite(limit) ? limit : null;
}

/**
 * Decide which live tier a stale record should become.
 *
 * The quota fingerprint wins because 'AGENCY' is ambiguous across the
 * 20260314 rename (see the file header). The label map is the fallback for
 * records whose privateMetadata is missing or unrecognised.
 *
 * Returns null when the user is not stale, or when neither rule applies —
 * an unknown label with no usable fingerprint is reported, never guessed.
 */
export function resolveTargetTier(
  user: BackfillClerkUser
): { tier: SubscriptionTier; basis: ResolutionBasis } | null {
  const currentTier = readStaleTier(user);
  if (!currentTier) return null;

  const fingerprint = readOnboardsFingerprint(user);
  if (fingerprint !== null) {
    const byFingerprint = QUOTA_FINGERPRINT_TO_TIER.get(fingerprint);
    if (byFingerprint) return { tier: byFingerprint, basis: 'quota-fingerprint' };
  }

  const byName = STALE_TIER_MAP[currentTier];
  return byName ? { tier: byName, basis: 'tier-name' } : null;
}

const VALID_SUBSCRIPTION_STATUSES = ['active', 'past_due', 'canceled', 'trialing'] as const;
type ValidSubscriptionStatus = (typeof VALID_SUBSCRIPTION_STATUSES)[number];

function readStatus(value: unknown): ValidSubscriptionStatus | undefined {
  return typeof value === 'string' &&
    (VALID_SUBSCRIPTION_STATUSES as readonly string[]).includes(value)
    ? (value as ValidSubscriptionStatus)
    : undefined;
}

function readDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Carry the subscription facts forward. setSubscriptionTier rebuilds
 * privateMetadata from scratch, so anything not passed here is lost; every
 * field the service accepts is read back off the existing record, and any
 * value that does not parse is dropped so the service applies its own default
 * rather than persisting garbage.
 */
export function readPreservedOptions(
  user: BackfillClerkUser
): Parameters<SetSubscriptionTierFn>[2] {
  const priv = (user.privateMetadata ?? {}) as Record<string, unknown>;
  const options: NonNullable<Parameters<SetSubscriptionTierFn>[2]> = {};

  if (typeof priv.subscriptionId === 'string' && priv.subscriptionId.length > 0) {
    options.subscriptionId = priv.subscriptionId;
  }

  const status = readStatus(priv.subscriptionStatus);
  if (status) options.subscriptionStatus = status;

  const currentPeriodStart = readDate(priv.currentPeriodStart);
  if (currentPeriodStart) options.currentPeriodStart = currentPeriodStart;

  const currentPeriodEnd = readDate(priv.currentPeriodEnd);
  if (currentPeriodEnd) options.currentPeriodEnd = currentPeriodEnd;

  const trialEndsAt = readDate(priv.trialEndsAt);
  if (trialEndsAt) options.trialEndsAt = trialEndsAt;

  return options;
}

/**
 * Page through every Clerk user and collect the stale ones. Purely read-only.
 *
 * `limit` stops the scan as soon as that many candidates are collected, so a
 * canary run does not enumerate the whole org.
 */
export async function selectStaleUsers(
  clerk: BackfillClerkClient,
  options: { limit?: number | null; pageSize?: number } = {}
): Promise<{
  candidates: BackfillCandidate[];
  unmapped: Array<{ userId: string; currentTier: string }>;
  scanned: number;
  pages: number;
  limitReached: boolean;
}> {
  const limit = options.limit ?? null;
  const pageSize = options.pageSize ?? CLERK_PAGE_SIZE;

  const candidates: BackfillCandidate[] = [];
  const unmapped: Array<{ userId: string; currentTier: string }> = [];
  let scanned = 0;
  let pages = 0;
  let offset = 0;
  let limitReached = false;

  for (;;) {
    const page = await clerk.users.getUserList({ limit: pageSize, offset });
    pages += 1;

    const users = page.data ?? [];
    for (const user of users) {
      scanned += 1;

      const currentTier = readStaleTier(user);
      if (!currentTier) continue;

      const resolved = resolveTargetTier(user);
      if (!resolved) {
        unmapped.push({ userId: user.id, currentTier });
        continue;
      }

      candidates.push({
        userId: user.id,
        currentTier,
        targetTier: resolved.tier,
        basis: resolved.basis,
        preservedOptions: readPreservedOptions(user),
      });

      if (limit !== null && candidates.length >= limit) {
        limitReached = true;
        break;
      }
    }

    if (limitReached) break;
    // A short page is the last page; an empty page ends an exact-multiple run.
    if (users.length < pageSize) break;
    offset += users.length;
  }

  return { candidates, unmapped, scanned, pages, limitReached };
}

/**
 * Record one rewrite in the audit log.
 *
 * AuditLog.agencyId is optional, so a Clerk user with no Agency row is still
 * audited — with a null agencyId rather than being dropped.
 */
export async function writeBackfillAudit(
  prisma: BackfillPrisma,
  candidate: BackfillCandidate
): Promise<void> {
  const agency = await prisma.agency.findUnique({
    where: { clerkUserId: candidate.userId },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: {
      agencyId: agency?.id ?? null,
      action: BACKFILL_AUDIT_ACTION,
      userEmail: BACKFILL_ACTOR,
      resourceType: 'clerk_user',
      resourceId: candidate.userId,
      metadata: {
        previousTier: candidate.currentTier,
        newTier: candidate.targetTier,
        basis: candidate.basis,
        reason: 'clerk-subscription-tier-scale-rename-backfill',
      },
      ipAddress: '0.0.0.0', // No request context for a backfill run
      userAgent: 'unknown',
    },
  });
}

/**
 * Run the backfill. Default (apply: false) is a dry run: it reports exactly
 * the users apply would rewrite, and to which tier, and writes nothing.
 */
export async function runClerkTierBackfill(
  deps: BackfillDeps,
  options: { apply?: boolean; limit?: number | null; pageSize?: number } = {}
): Promise<BackfillReport> {
  const apply = options.apply === true;
  const limit = options.limit ?? null;

  const { candidates, unmapped, scanned, pages, limitReached } = await selectStaleUsers(
    deps.clerk,
    { limit, pageSize: options.pageSize }
  );

  const changed: BackfillCandidate[] = [];
  const failed: Array<BackfillCandidate & { error: string }> = [];
  const auditFailed: Array<BackfillCandidate & { error: string }> = [];

  if (apply) {
    // Sequential on purpose: one user, one Clerk write, one audit entry.
    for (const candidate of candidates) {
      let rewritten = false;

      try {
        const result = await deps.setSubscriptionTier(
          candidate.userId,
          candidate.targetTier,
          candidate.preservedOptions
        );

        if (result.error) {
          failed.push({ ...candidate, error: result.error.message });
          continue;
        }
        rewritten = true;
      } catch (error) {
        failed.push({
          ...candidate,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      if (!rewritten) continue;
      changed.push(candidate);

      try {
        await writeBackfillAudit(deps.prisma, candidate);
      } catch (error) {
        // The Clerk write already landed and will not be re-selected, so this
        // is surfaced separately rather than as a retryable failure.
        auditFailed.push({
          ...candidate,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return {
    mode: apply ? 'apply' : 'dry-run',
    scanned,
    pages,
    limit,
    limitReached,
    selected: candidates,
    changed,
    failed,
    auditFailed,
    unmapped,
    total: candidates.length,
  };
}

export function parseArgs(argv: string[]): { apply: boolean; limit: number | null } {
  // Dry run unless --apply is passed. --dry-run exists so operators can be
  // explicit in runbooks; it never enables writes.
  const apply = argv.includes('--apply');

  let rawLimit: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--limit') {
      rawLimit = argv[index + 1];
    } else if (arg.startsWith('--limit=')) {
      rawLimit = arg.slice('--limit='.length);
    }
  }

  const parsed = rawLimit === undefined ? Number.NaN : Number(rawLimit);
  const limit = Number.isInteger(parsed) && parsed > 0 ? parsed : null;

  return { apply, limit };
}

function printReport(report: BackfillReport): void {
  console.log(
    `\n[clerk-tier-backfill] mode=${report.mode} scanned=${report.scanned} pages=${report.pages} ` +
      `selected=${report.total} changed=${report.changed.length} failed=${report.failed.length} ` +
      `auditFailed=${report.auditFailed.length} unmapped=${report.unmapped.length}`
  );

  if (report.limit !== null) {
    console.log(
      `Limit ${report.limit}${report.limitReached ? ' reached — more users may remain' : ' not reached'}.`
    );
  }

  if (report.total === 0 && report.unmapped.length === 0) {
    console.log('No Clerk users carry a retired subscription tier. Nothing to do.');
    return;
  }

  for (const candidate of report.selected) {
    const failure = report.failed.find((entry) => entry.userId === candidate.userId);
    const auditFailure = report.auditFailed.find((entry) => entry.userId === candidate.userId);
    const status =
      report.mode === 'dry-run'
        ? 'would rewrite'
        : failure
          ? 'FAILED'
          : auditFailure
            ? 'rewritten (AUDIT FAILED)'
            : 'rewritten';
    const suffix = failure ? ` — ${failure.error}` : auditFailure ? ` — ${auditFailure.error}` : '';
    console.log(
      `  ${status}: userId=${candidate.userId} ${candidate.currentTier} -> ${candidate.targetTier} ` +
        `basis=${candidate.basis}${suffix}`
    );
  }

  for (const entry of report.unmapped) {
    console.log(
      `  SKIPPED (unmapped): userId=${entry.userId} tier=${entry.currentTier} — ` +
        'not a known retired tier and no usable quota fingerprint. Resolve by hand.'
    );
  }

  if (report.mode === 'dry-run') {
    console.log(
      'Dry run only — nothing changed. Review the basis of each row above, then ' +
        're-run with --apply (start with --limit for a canary).'
    );
    return;
  }

  if (report.failed.length > 0) {
    console.log(
      `${report.failed.length} user(s) were not rewritten and are safe to retry: re-run with --apply.`
    );
  }

  if (report.auditFailed.length > 0) {
    console.log(
      `${report.auditFailed.length} user(s) were rewritten in Clerk but their audit entry failed. ` +
        'Re-running will NOT re-select them; record those entries manually.'
    );
  }
}

/**
 * CLI entry point. Returns the process exit code so tests can call it
 * without exiting the vitest process.
 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { apply, limit } = parseArgs(argv);
  const prisma = new PrismaClient({ log: ['error'] }) as BackfillPrisma;

  try {
    const report = await runClerkTierBackfill(
      {
        clerk: getClerkClient(),
        setSubscriptionTier: (userId, tier, options) =>
          clerkMetadataService.setSubscriptionTier(userId, tier, options),
        prisma,
      },
      { apply, limit }
    );
    printReport(report);
    return report.failed.length > 0 || report.auditFailed.length > 0 ? 1 : 0;
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
        '[clerk-tier-backfill] Fatal error:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    });
}
