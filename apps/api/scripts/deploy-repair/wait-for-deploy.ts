/**
 * Redeploy verification (U5, R13).
 *
 * After the attempt loop pushes a repair commit, this module polls the
 * deploy-status clients already committed in U2
 * (`../deploy-status/vercel.ts`'s `getVercelDeployment`,
 * `../deploy-status/render.ts`'s `listRenderDeploys`) until the pushed
 * commit's deploy reaches a terminal state, or a bounded poll budget runs
 * out. Success means Vercel `READY` / Render `live` (R13).
 *
 * `classifyDeployStatus` (U2, `../deploy-status/classify.ts`) collapses
 * both "in progress" and "unrecognized" states into the same 'platform'
 * classification — a fine simplification for a single webhook-fired event,
 * but not enough on its own to drive a poll loop's stop condition (a loop
 * that can't tell "still building" from "a real platform failure" would
 * either stop too early or spin past its own budget). So this module keeps
 * its own small terminal-state set (mirroring classify.ts's private
 * `VERCEL_IN_PROGRESS_STATES`/`RENDER_IN_PROGRESS_STATES`, which are not
 * exported) purely to decide when to stop polling; once a state is
 * terminal, `classifyDeployStatus` is still the single source of truth for
 * WHICH classification that terminal state maps to.
 *
 * Every dependency — the two deploy-status clients and the sleep/clock
 * function — is injected, so no test here ever spawns a real network call
 * or waits in real time.
 */

import {
  classifyDeployStatus,
  type DeployClassification,
  type DeployStatusInput,
} from '../deploy-status/classify';
import {
  getVercelDeployment,
  type GetVercelDeploymentOptions,
  type VercelDeployment,
} from '../deploy-status/vercel';
import {
  listRenderDeploys,
  type ListRenderDeploysOptions,
  type RenderDeploy,
} from '../deploy-status/render';

// ---------------------------------------------------------------------------
// Poll targets + injected clients
// ---------------------------------------------------------------------------

export type VercelWaitTarget = {
  platform: 'vercel';
  /** Forwarded to `getVercelDeployment` on every poll. */
  options: GetVercelDeploymentOptions;
};

export type RenderWaitTarget = {
  platform: 'render';
  /** Forwarded to `listRenderDeploys` on every poll. */
  options: ListRenderDeploysOptions;
  /** The specific deploy id to track among the listed deploys. */
  deployId: string;
};

export type WaitTarget = VercelWaitTarget | RenderWaitTarget;

export type GetVercelDeploymentFn = (
  options: GetVercelDeploymentOptions
) => Promise<VercelDeployment | null>;

export type ListRenderDeploysFn = (options: ListRenderDeploysOptions) => Promise<RenderDeploy[]>;

export type SleepFn = (ms: number) => Promise<void>;

export type WaitForDeployDeps = {
  getVercelDeployment?: GetVercelDeploymentFn;
  listRenderDeploys?: ListRenderDeploysFn;
  /** Injected in place of a real timer — tests must never actually wait. */
  sleep?: SleepFn;
};

export type WaitForDeployOptions = {
  /** Milliseconds between polls. Default 10s. */
  pollIntervalMs?: number;
  /** Total wait budget before giving up as `timeout`. Default 5 minutes. */
  timeoutMs?: number;
};

export const DEFAULT_POLL_INTERVAL_MS = 10_000;
export const DEFAULT_TIMEOUT_MS = 300_000;

// ---------------------------------------------------------------------------
// Terminal-state detection (see module doc comment for why this is local)
// ---------------------------------------------------------------------------

const VERCEL_TERMINAL_STATES = new Set<string>(['READY', 'ERROR', 'CANCELED', 'DELETED']);
const RENDER_TERMINAL_STATES = new Set<string>([
  'live',
  'build_failed',
  'update_failed',
  'pre_deploy_failed',
  'canceled',
  'deactivated',
]);

function isTerminalState(platform: 'vercel' | 'render', raw: string): boolean {
  return platform === 'vercel' ? VERCEL_TERMINAL_STATES.has(raw) : RENDER_TERMINAL_STATES.has(raw);
}

function toClassifyInput(platform: 'vercel' | 'render', raw: string): DeployStatusInput {
  return platform === 'vercel' ? { platform: 'vercel', readyState: raw } : { platform: 'render', status: raw };
}

/** Returns the raw readyState/status, or null if the deploy isn't visible yet (keep polling). */
async function fetchRawState(
  target: WaitTarget,
  clients: { getVercel: GetVercelDeploymentFn; listRender: ListRenderDeploysFn }
): Promise<string | null> {
  if (target.platform === 'vercel') {
    const deployment = await clients.getVercel(target.options);
    return deployment ? deployment.readyState : null;
  }
  const deploys = await clients.listRender(target.options);
  const match = deploys.find((deploy) => deploy.id === target.deployId);
  return match ? match.status : null;
}

// ---------------------------------------------------------------------------
// Result + poll loop
// ---------------------------------------------------------------------------

export type WaitForDeployResult =
  | { kind: 'deployed' }
  | { kind: 'failed'; classification: DeployClassification }
  | {
      /** Never resolved within the wait budget — unverifiable, NOT a confirmed failure. */
      kind: 'timeout';
    };

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll until the target deploy reaches a terminal state or the wait budget
 * (`pollIntervalMs` * bounded iteration count, capped by `timeoutMs`) is
 * exhausted. The first check runs immediately (no leading sleep); every
 * subsequent check waits `pollIntervalMs` first.
 */
export async function waitForDeploy(
  target: WaitTarget,
  options: WaitForDeployOptions = {},
  deps: WaitForDeployDeps = {}
): Promise<WaitForDeployResult> {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const sleep = deps.sleep ?? defaultSleep;
  const clients = {
    getVercel: deps.getVercelDeployment ?? getVercelDeployment,
    listRender: deps.listRenderDeploys ?? listRenderDeploys,
  };

  const maxPolls = Math.max(1, Math.floor(timeoutMs / pollIntervalMs) + 1);

  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    if (attempt > 0) {
      await sleep(pollIntervalMs);
    }

    const raw = await fetchRawState(target, clients);
    if (raw === null) continue;
    if (!isTerminalState(target.platform, raw)) continue;

    const classification = classifyDeployStatus(toClassifyInput(target.platform, raw));
    if (classification === 'success') {
      return { kind: 'deployed' };
    }
    return { kind: 'failed', classification };
  }

  return { kind: 'timeout' };
}
