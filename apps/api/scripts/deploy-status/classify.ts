/**
 * Deploy-failure classification (U2, R6).
 *
 * Every detected failure is classified before repair is attempted:
 *   - 'build-time' failures are the only repair target — the self-healing
 *     agent spends an attempt on these.
 *   - 'runtime', 'platform', and 'transient' failures route to a human and
 *     spend zero repair attempts (R6). This module does not currently
 *     produce 'runtime' or 'transient' from a platform status enum — those
 *     exist so callers built on top of this one (health-check-driven
 *     runtime detection, network/timeout classification around the fetch
 *     clients in vercel.ts/render.ts) have a home for them without a type
 *     change here.
 *   - 'non-actionable' is a deliberate cancellation (Vercel CANCELED,
 *     Render canceled/deactivated) or an in-progress state. It is not a
 *     failure at all, so it must never be treated as a repair target NOR
 *     routed to a human as if something broke — R5 says free-plan states
 *     like `canceled`/`deactivated` never count as failures. The plan's
 *     approach note asked for "whatever your enum's non-actionable value
 *     is"; this module defines that value explicitly rather than
 *     overloading 'platform' or 'transient', which would otherwise cause a
 *     human-review issue to be filed for a deploy nobody needs to look at.
 *   - 'platform' is also the fail-safe default for any readyState/status
 *     this module does not recognize, per R6: never guess an unfamiliar
 *     enum value is repairable.
 *   - 'success' means Vercel READY / Render live (R13).
 */

import type { VercelReadyState } from './vercel';
import type { RenderDeployStatus } from './render';

export type DeployClassification =
  | 'success'
  | 'build-time'
  | 'runtime'
  | 'platform'
  | 'transient'
  | 'non-actionable';

export type VercelStatusInput = {
  platform: 'vercel';
  /** String, not the literal union: real API responses may add new states. */
  readyState: VercelReadyState | (string & {});
  errorCode?: string | null;
};

export type RenderStatusInput = {
  platform: 'render';
  status: RenderDeployStatus | (string & {});
};

export type DeployStatusInput = VercelStatusInput | RenderStatusInput;

const VERCEL_IN_PROGRESS_STATES = new Set<string>([
  'BLOCKED',
  'BUILDING',
  'INITIALIZING',
  'QUEUED',
]);

const RENDER_IN_PROGRESS_STATES = new Set<string>([
  'created',
  'queued',
  'build_in_progress',
  'update_in_progress',
  'pre_deploy_in_progress',
]);

function classifyVercel(input: VercelStatusInput): DeployClassification {
  switch (input.readyState) {
    case 'READY':
      return 'success';
    case 'ERROR':
      // The readyState is the authoritative failure signal; errorCode is
      // present on ERROR per the plan but its absence must not downgrade a
      // real build failure to something a human has to notice on their own.
      return 'build-time';
    case 'CANCELED':
      return 'non-actionable';
    case 'DELETED':
      // A deleted deployment is gone, not a code failure to repair; route
      // to a human rather than guessing.
      return 'platform';
    default:
      if (VERCEL_IN_PROGRESS_STATES.has(input.readyState)) return 'platform';
      // Unrecognized readyState: fail safe, never guess repairable.
      return 'platform';
  }
}

function classifyRender(input: RenderStatusInput): DeployClassification {
  switch (input.status) {
    case 'live':
      return 'success';
    case 'build_failed':
    case 'update_failed':
    case 'pre_deploy_failed':
      return 'build-time';
    case 'canceled':
    case 'deactivated':
      return 'non-actionable';
    default:
      if (RENDER_IN_PROGRESS_STATES.has(input.status)) return 'platform';
      // Unrecognized status: fail safe, never guess repairable.
      return 'platform';
  }
}

/**
 * Classify a normalized deploy status into a repair-routing decision.
 * Pure and platform-agnostic at the call site: pass whichever platform's
 * normalized status you have.
 */
export function classifyDeployStatus(input: DeployStatusInput): DeployClassification {
  return input.platform === 'vercel' ? classifyVercel(input) : classifyRender(input);
}

/**
 * True only for the single classification that should spend a repair
 * attempt. A type predicate (not a plain boolean) so callers narrowing on
 * this check — e.g. `incident.ts`'s `routeByClassification` — get real
 * type-level exhaustiveness on the non-repair-target branch, instead of a
 * narrowing gap that only surfaces once `apps/api/scripts/**` is added to
 * `apps/api/tsconfig.json`'s include (see U2's own documented finding on
 * that gap).
 */
export function isRepairTarget(classification: DeployClassification): classification is 'build-time' {
  return classification === 'build-time';
}
