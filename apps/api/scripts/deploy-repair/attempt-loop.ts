#!/usr/bin/env node
/**
 * Deploy-repair attempt loop (U5, R1/R8/R11/R13, KTD8, Correction A/B).
 *
 * Owns the one thing every other module in this plan was deliberately kept
 * away from: `git commit` / `git push`. U4's `repair-session.ts` is
 * edit-only by design (see its module doc comment); this module is the
 * exclusive place in the whole repair pipeline where a commit is made and
 * pushed, using the `github-actions[bot]` identity (Correction A).
 *
 * It is also where the SHA-cascade budget bug (Correction B) is closed on
 * the push side: every commit this loop makes carries a
 * `Deploy-Repair-Of: <original-incident-sha>` trailer pointing at the ONE
 * sha the tracking issue is titled with — regardless of how many repair
 * commits have accumulated in this run — so a downstream
 * `deploy-repair.yml` run that resolves a child commit's failure (via
 * `incident.ts`'s `resolveParentShaFromTrailer` + `parentSha` dedupe) always
 * attributes it back to the same incident.
 *
 * Implemented as a state machine over injected dependencies — the repair
 * session runner (U4), a gate runner (typecheck + build), git push/rebase,
 * and the redeploy waiter (this unit's `wait-for-deploy.ts`) — so the
 * budget-counting and trailer logic are unit-testable without ever spawning
 * a real process or touching a real remote. Matches U3/U4's injected-
 * dependency, typed-result-union conventions.
 */

import { promises as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  createNodeExecFn,
  createNodeGitDiffNameOnly,
  runRepairSession,
  type ExecFn,
  type GitDiffNameOnlyFn,
  type RepairAttemptResult,
  type RepairMode,
} from './repair-session';
import {
  waitForDeploy,
  type WaitForDeployOptions,
  type WaitForDeployResult,
  type WaitTarget,
} from './wait-for-deploy';

// ---------------------------------------------------------------------------
// Injected dependency shapes
// ---------------------------------------------------------------------------

export type RepairSessionRunnerInput = {
  mode: RepairMode;
  failureReportPath: string;
  logExcerpt: string;
  /** Prior session id to resume (attempts 2-3, KTD6). Omitted on attempt 1. */
  sessionId?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
};

/** Injected in place of a direct `runRepairSession` (U4) call. */
export type RepairSessionRunner = (input: RepairSessionRunnerInput) => Promise<RepairAttemptResult>;

export type GateResult = { passed: boolean; output?: string };

/**
 * Runs `npm run typecheck && npm run build` (KTD10/U1's local gate
 * composition) — the in-loop check before an attempt is allowed to push.
 * The full CI gate JOB (tests, Clerk env mapping, etc.) is a separate
 * workflow job per KTD10; this function intentionally stays scoped to what
 * one attempt needs to verify, not a re-implementation of that job.
 */
export type GateRunnerFn = () => Promise<GateResult>;

export type PushOutcome =
  | { kind: 'pushed' }
  | { kind: 'rejected-non-fast-forward' }
  | { kind: 'error'; message: string };

/**
 * Commits (bot identity is configured once by the caller, outside this fn)
 * and pushes. Never force-pushes. `changedPaths` must be exactly the files
 * the repair session actually changed (from U4's post-run diff check) —
 * staging is scoped to those paths only, never `git add -A`, so a stray
 * build artifact or the KTD7 failure-report file under
 * `.claude/tasks/deploy-failures/` can never ride along into a production
 * commit (see the SEC-03 review finding this closes).
 */
export type PushFn = (params: { commitMessage: string; changedPaths: string[] }) => Promise<PushOutcome>;

export type RebaseResult = { ok: boolean; message?: string };

/** Rebases the local branch onto the latest remote once (KTD8's non-fast-forward recovery). */
export type RebaseFn = () => Promise<RebaseResult>;

/** Injected in place of a direct `waitForDeploy` call — the target/options are already bound by the caller. */
export type WaitForDeployFn = () => Promise<WaitForDeployResult>;

export type AttemptLoopDeps = {
  runRepairSession: RepairSessionRunner;
  runGate: GateRunnerFn;
  push: PushFn;
  rebase: RebaseFn;
  waitForDeploy: WaitForDeployFn;
};

// ---------------------------------------------------------------------------
// Commit message composition (Correction B trailer)
// ---------------------------------------------------------------------------

/** `Deploy-Repair-Of: <sha>` — see `incident.ts`'s `resolveParentShaFromTrailer`, which parses this exact shape. */
export function buildDeployRepairOfTrailer(originalSha: string): string {
  return `Deploy-Repair-Of: ${originalSha}`;
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

/**
 * Compose the repair commit message. `originalSha` is always the ONE sha
 * the tracking issue was opened for (Correction B) — the caller must pass
 * the same value on every attempt within a run, never a prior attempt's own
 * repair-commit sha, so the trailer always points back to the root incident.
 */
export function buildRepairCommitMessage(originalSha: string, diagnosis?: string): string {
  const firstLine = (diagnosis ?? '').split('\n').find((line) => line.trim().length > 0)?.trim();
  const subject = firstLine
    ? `fix(deploy-repair): ${truncate(firstLine, 72)}`
    : 'fix(deploy-repair): automated build-failure repair';
  const body = diagnosis ? `\n\n${diagnosis}` : '';
  return `${subject}${body}\n\n${buildDeployRepairOfTrailer(originalSha)}\n`;
}

// ---------------------------------------------------------------------------
// Per-attempt record + loop result
// ---------------------------------------------------------------------------

export type AttemptRecord = {
  attemptNumber: number;
  sessionKind: RepairAttemptResult['kind'];
  diagnosis?: string;
  gate?: GateResult;
  push?: PushOutcome;
  deploy?: WaitForDeployResult;
};

export type AttemptLoopOutcome =
  | 'success'
  | 'exhausted'
  | 'aborted-push-failure'
  | 'no-repair-possible';

export type AttemptLoopResult = {
  outcome: AttemptLoopOutcome;
  attemptsTaken: number;
  attempts: AttemptRecord[];
};

export type AttemptLoopInput = {
  /** Number of attempts left to spend this run. May already be partially spent per Correction B's cross-run attribution — this unit just counts it down. */
  startingBudget: number;
  /** The sha the tracking issue is titled with (Correction B trailer value) — constant for the whole run. */
  originalSha: string;
  mode: RepairMode;
  failureReportPath: string;
  logExcerpt: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
};

function isPushRejectedOrErrored(outcome: PushOutcome): boolean {
  return outcome.kind === 'rejected-non-fast-forward' || outcome.kind === 'error';
}

/**
 * Run the bounded attempt loop for one incident (R8: max 3 total per
 * incident, though the actual starting number is the caller's call per
 * Correction B). Pure aside from the five injected functions above — no
 * process is spawned, no git command runs, and no real clock is read here.
 */
export async function runAttemptLoop(
  input: AttemptLoopInput,
  deps: AttemptLoopDeps
): Promise<AttemptLoopResult> {
  const attempts: AttemptRecord[] = [];
  let budget = input.startingBudget;
  let sessionId: string | undefined;

  if (budget <= 0) {
    return { outcome: 'exhausted', attemptsTaken: 0, attempts };
  }

  let attemptNumber = 0;

  while (budget > 0) {
    attemptNumber += 1;
    budget -= 1;

    const sessionResult = await deps.runRepairSession({
      mode: input.mode,
      failureReportPath: input.failureReportPath,
      logExcerpt: input.logExcerpt,
      sessionId,
      maxTurns: input.maxTurns,
      maxBudgetUsd: input.maxBudgetUsd,
    });

    const record: AttemptRecord = { attemptNumber, sessionKind: sessionResult.kind };
    if ('diagnosis' in sessionResult) record.diagnosis = sessionResult.diagnosis;
    if ('sessionId' in sessionResult) sessionId = sessionResult.sessionId;

    // A CLI crash / malformed output is a different failure class than a
    // bad diagnosis — it is never retried, regardless of remaining budget.
    if (sessionResult.kind === 'terminal-error') {
      attempts.push(record);
      return { outcome: 'no-repair-possible', attemptsTaken: attemptNumber, attempts };
    }

    if (sessionResult.kind === 'no-change-proposed' || sessionResult.kind === 'denied-path-violation') {
      attempts.push(record);
      if (budget <= 0) {
        return { outcome: 'exhausted', attemptsTaken: attemptNumber, attempts };
      }
      continue;
    }

    // sessionResult.kind === 'repaired'
    let gateResult = await deps.runGate();
    record.gate = gateResult;

    if (!gateResult.passed) {
      attempts.push(record);
      if (budget <= 0) {
        return { outcome: 'exhausted', attemptsTaken: attemptNumber, attempts };
      }
      continue;
    }

    const commitMessage = buildRepairCommitMessage(input.originalSha, sessionResult.diagnosis);
    const changedPaths = sessionResult.changedPaths;
    let pushOutcome = await deps.push({ commitMessage, changedPaths });

    if (pushOutcome.kind === 'rejected-non-fast-forward') {
      // KTD8: rebase once, re-run the gate, retry the push once, then
      // abort-with-notify. Never a silent third attempt.
      const rebaseResult = await deps.rebase();
      if (!rebaseResult.ok) {
        pushOutcome = { kind: 'error', message: rebaseResult.message ?? 'rebase failed' };
      } else {
        gateResult = await deps.runGate();
        record.gate = gateResult;
        pushOutcome = gateResult.passed
          ? await deps.push({ commitMessage, changedPaths })
          : { kind: 'error', message: 'gate failed after rebase; push retry skipped' };
      }
    }

    record.push = pushOutcome;

    if (isPushRejectedOrErrored(pushOutcome)) {
      attempts.push(record);
      return { outcome: 'aborted-push-failure', attemptsTaken: attemptNumber, attempts };
    }

    const deployResult = await deps.waitForDeploy();
    record.deploy = deployResult;
    attempts.push(record);

    if (deployResult.kind === 'deployed') {
      return { outcome: 'success', attemptsTaken: attemptNumber, attempts };
    }

    // 'failed' or 'timeout': the agent's own pushed commit didn't verify.
    // This is Correction B's in-run case — continue within the SAME budget
    // counter, no incident re-resolution needed.
    if (budget <= 0) {
      return { outcome: 'exhausted', attemptsTaken: attemptNumber, attempts };
    }
  }

  return { outcome: 'exhausted', attemptsTaken: attemptNumber, attempts };
}

// ---------------------------------------------------------------------------
// Real dependency wiring (not exercised by unit tests — see incident.ts's
// own "CLI wiring" section for why this split exists)
// ---------------------------------------------------------------------------

export function createRepairSessionRunner(
  execFn: ExecFn,
  gitDiffNameOnly: GitDiffNameOnlyFn
): RepairSessionRunner {
  return (input) => runRepairSession(input, { execFn, gitDiffNameOnly });
}

export function createGateRunner(execFn: ExecFn): GateRunnerFn {
  return async () => {
    const typecheck = await execFn({ command: 'npm', args: ['run', 'typecheck'] });
    if (typecheck.exitCode !== 0) {
      return { passed: false, output: typecheck.stderr || typecheck.stdout };
    }
    const build = await execFn({ command: 'npm', args: ['run', 'build'] });
    if (build.exitCode !== 0) {
      return { passed: false, output: build.stderr || build.stdout };
    }
    return { passed: true };
  };
}

const NON_FAST_FORWARD_RE = /non-fast-forward|fetch first|rejected/i;

/**
 * Never force-pushes (KTD8). Detects a non-fast-forward rejection from
 * git's stderr text. Stages exactly `changedPaths` — never `git add -A` —
 * so nothing outside the repair session's own verified diff can enter the
 * commit (SEC-03).
 */
export function createNodeGitPusher(execFn: ExecFn): PushFn {
  return async ({ commitMessage, changedPaths }) => {
    if (changedPaths.length === 0) {
      return { kind: 'error', message: 'no changed paths to stage; refusing to commit' };
    }

    const add = await execFn({ command: 'git', args: ['add', '--', ...changedPaths] });
    if (add.exitCode !== 0) return { kind: 'error', message: `git add failed: ${add.stderr}` };

    const commit = await execFn({ command: 'git', args: ['commit', '-m', commitMessage] });
    if (commit.exitCode !== 0) return { kind: 'error', message: `git commit failed: ${commit.stderr}` };

    const push = await execFn({ command: 'git', args: ['push'] });
    if (push.exitCode === 0) return { kind: 'pushed' };
    if (NON_FAST_FORWARD_RE.test(push.stderr)) return { kind: 'rejected-non-fast-forward' };
    return { kind: 'error', message: `git push failed: ${push.stderr}` };
  };
}

export function createNodeGitRebaser(execFn: ExecFn): RebaseFn {
  return async () => {
    const fetch = await execFn({ command: 'git', args: ['fetch', 'origin'] });
    if (fetch.exitCode !== 0) return { ok: false, message: `git fetch failed: ${fetch.stderr}` };

    const rebase = await execFn({ command: 'git', args: ['rebase', 'origin/main'] });
    if (rebase.exitCode !== 0) return { ok: false, message: `git rebase failed: ${rebase.stderr}` };

    return { ok: true };
  };
}

export function createWaitForDeployFn(
  target: WaitTarget,
  options?: WaitForDeployOptions
): WaitForDeployFn {
  return () => waitForDeploy(target, options);
}

// ---------------------------------------------------------------------------
// CLI wiring (thin — not exercised by unit tests, matching incident.ts)
// ---------------------------------------------------------------------------
//
// This CLI wires the real dependencies and runs the loop end to end,
// including the actual `git commit`/`git push` calls (Correction A — this
// is the one place in the plan authorized to do that). The workflow step
// is responsible for `git config user.name`/`user.email` (bot identity)
// before invoking this, and for supplying enough platform/deployment
// context to build the `WaitTarget` this run should poll — resolving the
// NEW deployment created by this loop's own push is a documented follow-up
// (the same kind of interface boundary `incident.ts`'s `ShaTrigger` doc
// comment already accepts for Vercel workflow_dispatch replay): U2's
// `VercelDeployment` type carries no commit-sha field to correlate against,
// so a precise "find the deployment for the commit I just pushed" lookup
// is left to a later unit rather than guessed at here.

type CliEnv = {
  STARTING_BUDGET?: string;
  ORIGINAL_SHA?: string;
  MODE?: string;
  FAILURE_REPORT_PATH?: string;
  LOG_EXCERPT?: string;
  MAX_TURNS?: string;
  MAX_BUDGET_USD?: string;
  GITHUB_OUTPUT?: string;
};

async function writeGithubOutput(env: CliEnv, entries: Record<string, string>): Promise<void> {
  if (!env.GITHUB_OUTPUT) return;
  const lines = Object.entries(entries)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  await fs.appendFile(env.GITHUB_OUTPUT, `${lines}\n`, 'utf-8');
}

/** CLI entry point. Returns the process exit code so tests could call it directly. */
export async function main(env: CliEnv = process.env as CliEnv): Promise<number> {
  const originalSha = env.ORIGINAL_SHA;
  if (!originalSha) {
    console.error('[deploy-repair] Missing ORIGINAL_SHA — cannot attempt a repair without an incident sha.');
    return 1;
  }

  const startingBudget = env.STARTING_BUDGET ? Number.parseInt(env.STARTING_BUDGET, 10) : 3;
  const mode: RepairMode = env.MODE === 'dry-run' || env.MODE === 'drill' ? env.MODE : 'repair';

  const execFn = createNodeExecFn();
  const gitDiffNameOnly = createNodeGitDiffNameOnly(execFn);

  // No real Vercel/Render target is wired here yet (see the doc comment
  // above) — a deploy verification result of 'timeout' is the safe default
  // until a later unit supplies the concrete WaitTarget.
  const waitForDeployFn: WaitForDeployFn = async () => ({ kind: 'timeout' });

  const result = await runAttemptLoop(
    {
      startingBudget,
      originalSha,
      mode,
      failureReportPath: env.FAILURE_REPORT_PATH ?? '',
      logExcerpt: env.LOG_EXCERPT ?? '',
      maxTurns: env.MAX_TURNS ? Number.parseInt(env.MAX_TURNS, 10) : undefined,
      maxBudgetUsd: env.MAX_BUDGET_USD ? Number.parseFloat(env.MAX_BUDGET_USD) : undefined,
    },
    {
      runRepairSession: createRepairSessionRunner(execFn, gitDiffNameOnly),
      runGate: createGateRunner(execFn),
      push: createNodeGitPusher(execFn),
      rebase: createNodeGitRebaser(execFn),
      waitForDeploy: waitForDeployFn,
    }
  );

  console.log(JSON.stringify(result, null, 2));
  await writeGithubOutput(env, {
    outcome: result.outcome,
    attempts_taken: String(result.attemptsTaken),
  });

  return 0;
}

const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error('[deploy-repair] Fatal error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
