/**
 * Tests for the deploy-repair attempt loop (U5, R1/R8/R11/R13, KTD8,
 * Correction A/B).
 *
 * Every dependency (repair-session runner, gate runner, push, rebase,
 * wait-for-deploy) is a fake injected via `deps`. No test here spawns a
 * real process, runs a real git command, or performs a real network call —
 * `push`/`rebase` fakes below never touch a real remote.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  buildDeployRepairOfTrailer,
  buildRepairCommitMessage,
  createNodeGitPusher,
  createNodeRevertPaths,
  runAttemptLoop,
  type AttemptLoopDeps,
  type GateResult,
  type PushOutcome,
  type RebaseResult,
  type RepairSessionRunner,
} from '../attempt-loop';
import type { ExecFn } from '../repair-session';
import type { RepairAttemptResult } from '../repair-session';
import type { WaitForDeployResult } from '../wait-for-deploy';

const ORIGINAL_SHA = 'abc1234def5678900000000000000000000000';

const BASE_INPUT = {
  startingBudget: 3,
  originalSha: ORIGINAL_SHA,
  mode: 'repair' as const,
  failureReportPath: '.claude/tasks/deploy-failures/x.md',
  logExcerpt: 'Error: Cannot find module',
};

function repaired(overrides: Partial<Extract<RepairAttemptResult, { kind: 'repaired' }>> = {}) {
  return {
    kind: 'repaired' as const,
    mode: 'repair' as const,
    diagnosis: 'Fixed missing Suspense boundary.',
    sessionId: 'sess-1',
    totalCostUsd: 0.1,
    changedPaths: ['apps/web/src/app/page.tsx'],
    ...overrides,
  };
}

function noChangeProposed(): RepairAttemptResult {
  return {
    kind: 'no-change-proposed',
    mode: 'repair',
    diagnosis: 'Could not find a build-time cause.',
    sessionId: 'sess-1',
    totalCostUsd: 0.05,
  };
}

function deniedPathViolation(): RepairAttemptResult {
  return {
    kind: 'denied-path-violation',
    mode: 'repair',
    diagnosis: 'Attempted to edit package.json.',
    sessionId: 'sess-1',
    totalCostUsd: 0.05,
    violatedPaths: ['package.json'],
  };
}

function terminalError(): RepairAttemptResult {
  return { kind: 'terminal-error', mode: 'repair', reason: 'non-zero-exit', exitCode: 1, stderr: 'boom' };
}

function passingGate(): GateResult {
  return { passed: true };
}

function failingGate(): GateResult {
  return { passed: false, output: 'typecheck failed' };
}

function pushed(): PushOutcome {
  return { kind: 'pushed' };
}

function rejected(): PushOutcome {
  return { kind: 'rejected-non-fast-forward' };
}

function rebaseOk(): RebaseResult {
  return { ok: true };
}

function deployed(): WaitForDeployResult {
  return { kind: 'deployed' };
}

function deployFailed(): WaitForDeployResult {
  return { kind: 'failed', classification: 'build-time' };
}

/** Sequenced fake: returns queue[i] on the i-th call, repeating the last entry once exhausted. */
function sequence<T>(queue: T[]): () => Promise<T> {
  let call = 0;
  return async () => {
    const value = queue[Math.min(call, queue.length - 1)];
    call += 1;
    return value;
  };
}

function baseDeps(overrides: Partial<AttemptLoopDeps> = {}): AttemptLoopDeps {
  return {
    runRepairSession: vi.fn(async () => repaired()) as unknown as RepairSessionRunner,
    runGate: vi.fn(async () => passingGate()),
    push: vi.fn(async () => pushed()),
    rebase: vi.fn(async () => rebaseOk()),
    waitForDeploy: vi.fn(async () => deployed()),
    revertPaths: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('runAttemptLoop', () => {
  it('attempt 1 succeeds end to end: success, one attempt record, no further iterations', async () => {
    const deps = baseDeps();
    const result = await runAttemptLoop(BASE_INPUT, deps);

    expect(result.outcome).toBe('success');
    expect(result.attemptsTaken).toBe(1);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({ attemptNumber: 1, sessionKind: 'repaired' });
    expect(deps.runRepairSession).toHaveBeenCalledTimes(1);
    expect(deps.push).toHaveBeenCalledTimes(1);
    expect(deps.waitForDeploy).toHaveBeenCalledTimes(1);
  });

  it('the pushed commit message always carries Deploy-Repair-Of pointing at the ORIGINAL sha, on every attempt', async () => {
    const push = vi.fn(async () => pushed());
    const deps = baseDeps({
      runRepairSession: vi.fn(async () => repaired({ diagnosis: 'Some diagnosis' })) as unknown as RepairSessionRunner,
      push,
      waitForDeploy: sequence<WaitForDeployResult>([deployFailed(), deployed()]),
    });

    await runAttemptLoop(BASE_INPUT, deps);

    expect(push).toHaveBeenCalledTimes(2);
    for (const call of push.mock.calls) {
      expect(call[0].commitMessage).toContain(buildDeployRepairOfTrailer(ORIGINAL_SHA));
    }
  });

  it('own-pushed commit fails redeploy with budget remaining: proceeds to the next attempt within the same run', async () => {
    const runRepairSession = vi.fn(async () => repaired()) as unknown as RepairSessionRunner;
    const waitForDeploy = sequence<WaitForDeployResult>([deployFailed(), deployed()]);
    const deps = baseDeps({ runRepairSession, waitForDeploy });

    const result = await runAttemptLoop(BASE_INPUT, deps);

    expect(result.outcome).toBe('success');
    expect(result.attemptsTaken).toBe(2);
    expect(runRepairSession).toHaveBeenCalledTimes(2);
    expect(result.attempts[0].deploy).toEqual(deployFailed());
    expect(result.attempts[1].deploy).toEqual(deployed());
  });

  it('a chain of own-commit deploy failures caps at startingBudget (3) and ends exhausted, never a 4th attempt', async () => {
    const runRepairSession = vi.fn(async () => repaired()) as unknown as RepairSessionRunner;
    const waitForDeploy = vi.fn(async () => deployFailed());
    const deps = baseDeps({ runRepairSession, waitForDeploy });

    const result = await runAttemptLoop({ ...BASE_INPUT, startingBudget: 3 }, deps);

    expect(result.outcome).toBe('exhausted');
    expect(result.attemptsTaken).toBe(3);
    expect(runRepairSession).toHaveBeenCalledTimes(3);
    expect(waitForDeploy).toHaveBeenCalledTimes(3);
  });

  it('startingBudget: 0 at entry ends immediately exhausted with zero repair-session invocations', async () => {
    const runRepairSession = vi.fn(async () => repaired()) as unknown as RepairSessionRunner;
    const deps = baseDeps({ runRepairSession });

    const result = await runAttemptLoop({ ...BASE_INPUT, startingBudget: 0 }, deps);

    expect(result.outcome).toBe('exhausted');
    expect(result.attemptsTaken).toBe(0);
    expect(result.attempts).toHaveLength(0);
    expect(runRepairSession).not.toHaveBeenCalled();
  });

  it('a single non-fast-forward rejection triggers rebase-and-retry, which then succeeds', async () => {
    const push = sequence<PushOutcome>([rejected(), pushed()]);
    const rebase = vi.fn(async () => rebaseOk());
    const runGate = vi.fn(async () => passingGate());
    const deps = baseDeps({ push, rebase, runGate });

    const result = await runAttemptLoop(BASE_INPUT, deps);

    expect(result.outcome).toBe('success');
    expect(rebase).toHaveBeenCalledTimes(1);
    // Gate runs once before the first push attempt, once more after rebase.
    expect(runGate).toHaveBeenCalledTimes(2);
    expect(result.attempts[0].push).toEqual(pushed());
  });

  it('rejected twice in a row aborts with aborted-push-failure — not a third silent retry', async () => {
    const push = vi.fn(async () => rejected());
    const rebase = vi.fn(async () => rebaseOk());
    const deps = baseDeps({ push, rebase });

    const result = await runAttemptLoop(BASE_INPUT, deps);

    expect(result.outcome).toBe('aborted-push-failure');
    expect(push).toHaveBeenCalledTimes(2);
    expect(rebase).toHaveBeenCalledTimes(1);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].push).toEqual(rejected());
  });

  it('a rebase failure after rejection also aborts with aborted-push-failure, without retrying push', async () => {
    const push = vi.fn(async () => rejected());
    const rebase = vi.fn(async (): Promise<RebaseResult> => ({ ok: false, message: 'conflict' }));
    const deps = baseDeps({ push, rebase });

    const result = await runAttemptLoop(BASE_INPUT, deps);

    expect(result.outcome).toBe('aborted-push-failure');
    expect(push).toHaveBeenCalledTimes(1);
    expect(rebase).toHaveBeenCalledTimes(1);
  });

  it('no-change-proposed consumes an attempt and proceeds to the next attempt when budget remains', async () => {
    const runRepairSession = sequence<RepairAttemptResult>([noChangeProposed(), repaired()]) as unknown as RepairSessionRunner;
    const deps = baseDeps({ runRepairSession });

    const result = await runAttemptLoop(BASE_INPUT, deps);

    expect(result.outcome).toBe('success');
    expect(result.attemptsTaken).toBe(2);
    expect(result.attempts[0].sessionKind).toBe('no-change-proposed');
    expect(result.attempts[1].sessionKind).toBe('repaired');
  });

  it('denied-path-violation consumes an attempt and proceeds to the next attempt when budget remains', async () => {
    const runRepairSession = sequence<RepairAttemptResult>([deniedPathViolation(), repaired()]) as unknown as RepairSessionRunner;
    const deps = baseDeps({ runRepairSession });

    const result = await runAttemptLoop(BASE_INPUT, deps);

    expect(result.outcome).toBe('success');
    expect(result.attemptsTaken).toBe(2);
    expect(result.attempts[0].sessionKind).toBe('denied-path-violation');
  });

  it('no-change-proposed with budget exhausted ends in exhausted, not a further attempt', async () => {
    const runRepairSession = vi.fn(async () => noChangeProposed()) as unknown as RepairSessionRunner;
    const deps = baseDeps({ runRepairSession });

    const result = await runAttemptLoop({ ...BASE_INPUT, startingBudget: 1 }, deps);

    expect(result.outcome).toBe('exhausted');
    expect(result.attemptsTaken).toBe(1);
    expect(runRepairSession).toHaveBeenCalledTimes(1);
  });

  it('terminal-error ends the loop immediately with no-repair-possible, even with budget remaining', async () => {
    const runRepairSession = vi.fn(async () => terminalError()) as unknown as RepairSessionRunner;
    const deps = baseDeps({ runRepairSession });

    const result = await runAttemptLoop({ ...BASE_INPUT, startingBudget: 3 }, deps);

    expect(result.outcome).toBe('no-repair-possible');
    expect(result.attemptsTaken).toBe(1);
    expect(runRepairSession).toHaveBeenCalledTimes(1);
    expect(result.attempts[0].sessionKind).toBe('terminal-error');
  });

  it('a gate failure after repair consumes an attempt and proceeds when budget remains, without pushing', async () => {
    const runGate = sequence<GateResult>([failingGate(), passingGate()]);
    const push = vi.fn(async () => pushed());
    const runRepairSession = vi.fn(async () => repaired()) as unknown as RepairSessionRunner;
    const deps = baseDeps({ runGate, push, runRepairSession });

    const result = await runAttemptLoop(BASE_INPUT, deps);

    expect(result.outcome).toBe('success');
    expect(result.attemptsTaken).toBe(2);
    expect(push).toHaveBeenCalledTimes(1);
    expect(result.attempts[0].gate).toEqual(failingGate());
    expect(result.attempts[0].push).toBeUndefined();
  });
});

describe('buildRepairCommitMessage', () => {
  it('embeds a Deploy-Repair-Of trailer pointing at the given original sha', () => {
    const message = buildRepairCommitMessage(ORIGINAL_SHA, 'Fixed the thing');
    expect(message).toContain(`Deploy-Repair-Of: ${ORIGINAL_SHA}`);
    expect(message).toContain('Fixed the thing');
  });

  it('falls back to a generic subject when no diagnosis is given', () => {
    const message = buildRepairCommitMessage(ORIGINAL_SHA);
    expect(message).toContain('fix(deploy-repair): automated build-failure repair');
    expect(message).toContain(`Deploy-Repair-Of: ${ORIGINAL_SHA}`);
  });
});

describe('buildDeployRepairOfTrailer', () => {
  it('formats exactly as incident.ts.resolveParentShaFromTrailer expects', () => {
    expect(buildDeployRepairOfTrailer(ORIGINAL_SHA)).toBe(`Deploy-Repair-Of: ${ORIGINAL_SHA}`);
  });
});

describe('createNodeGitPusher (SEC-03: scoped staging, never git add -A)', () => {
  function fakeExecFn(exitCodes: Record<string, number> = {}, stderrs: Record<string, string> = {}): ExecFn {
    return vi.fn(async ({ command, args }) => {
      const key = `${command} ${args[0]}`;
      return {
        stdout: '',
        stderr: stderrs[key] ?? '',
        exitCode: exitCodes[key] ?? 0,
      };
    });
  }

  it('stages exactly the given changed paths, never -A', async () => {
    const execFn = fakeExecFn();
    const push = createNodeGitPusher(execFn);

    await push({ commitMessage: 'fix: x', changedPaths: ['apps/api/src/a.ts', 'apps/web/src/b.tsx'] });

    const addCall = (execFn as ReturnType<typeof vi.fn>).mock.calls.find(
      ([invocation]: [{ command: string; args: string[] }]) => invocation.command === 'git' && invocation.args[0] === 'add'
    );
    expect(addCall).toBeDefined();
    const addArgs: string[] = addCall![0].args;
    expect(addArgs).not.toContain('-A');
    expect(addArgs).toEqual(['add', '--', 'apps/api/src/a.ts', 'apps/web/src/b.tsx']);
  });

  it('refuses to commit when changedPaths is empty, without running any git command', async () => {
    const execFn = fakeExecFn();
    const push = createNodeGitPusher(execFn);

    const outcome = await push({ commitMessage: 'fix: x', changedPaths: [] });

    expect(outcome.kind).toBe('error');
    expect(execFn).not.toHaveBeenCalled();
  });

  it('detects a non-fast-forward rejection from push stderr without force-pushing', async () => {
    const execFn = fakeExecFn(
      { 'git push': 1 },
      { 'git push': 'error: failed to push some refs (non-fast-forward)' }
    );
    const push = createNodeGitPusher(execFn);

    const outcome = await push({ commitMessage: 'fix: x', changedPaths: ['a.ts'] });

    expect(outcome.kind).toBe('rejected-non-fast-forward');
    const pushCall = (execFn as ReturnType<typeof vi.fn>).mock.calls.find(
      ([invocation]: [{ command: string; args: string[] }]) => invocation.args[0] === 'push'
    );
    expect(pushCall![0].args).not.toContain('--force');
    expect(pushCall![0].args).not.toContain('-f');
  });
});

describe('createNodeRevertPaths', () => {
  function fakeExecFn(exitCodes: Record<string, number> = {}): ExecFn {
    return vi.fn(async ({ command, args }) => ({
      stdout: '',
      stderr: '',
      exitCode: exitCodes[`${command} ${args[0]}`] ?? 0,
    }));
  }

  it('checks out exactly the given paths, no broader reset', async () => {
    const execFn = fakeExecFn();
    const revertPaths = createNodeRevertPaths(execFn);

    await revertPaths(['package.json', 'render.yaml']);

    expect(execFn).toHaveBeenCalledWith({ command: 'git', args: ['checkout', '--', 'package.json', 'render.yaml'] });
  });

  it('does nothing (no git call) for an empty path list', async () => {
    const execFn = fakeExecFn();
    const revertPaths = createNodeRevertPaths(execFn);

    await revertPaths([]);

    expect(execFn).not.toHaveBeenCalled();
  });
});

describe('runAttemptLoop: mode !== repair never pushes (R12)', () => {
  it('drill mode stops before push and reports the proposed diff, not a real push', async () => {
    const push = vi.fn(async () => pushed());
    const deps = baseDeps({ push });

    const result = await runAttemptLoop({ ...BASE_INPUT, mode: 'drill' }, deps);

    expect(result.outcome).toBe('dry-run-complete');
    expect(push).not.toHaveBeenCalled();
    expect(result.attempts[0].push).toEqual({
      kind: 'dry-run-skipped',
      commitMessage: expect.any(String),
      changedPaths: ['apps/web/src/app/page.tsx'],
    });
  });

  it('dry-run mode stops before push the same way drill does', async () => {
    const push = vi.fn(async () => pushed());
    const rebase = vi.fn(async () => rebaseOk());
    const waitForDeploy = vi.fn(async () => deployed());
    const deps = baseDeps({ push, rebase, waitForDeploy });

    const result = await runAttemptLoop({ ...BASE_INPUT, mode: 'dry-run' }, deps);

    expect(result.outcome).toBe('dry-run-complete');
    expect(push).not.toHaveBeenCalled();
    expect(rebase).not.toHaveBeenCalled();
    expect(waitForDeploy).not.toHaveBeenCalled();
  });

  it('repair mode (the default) still pushes for real', async () => {
    const push = vi.fn(async () => pushed());
    const deps = baseDeps({ push });

    const result = await runAttemptLoop(BASE_INPUT, deps);

    expect(result.outcome).toBe('success');
    expect(push).toHaveBeenCalledTimes(1);
  });
});

describe('runAttemptLoop: denied-path-violation reverts before the next attempt', () => {
  it('calls revertPaths with exactly the violated paths, then continues to the next attempt', async () => {
    const revertPaths = vi.fn(async () => undefined);
    const runRepairSession = vi.fn(
      sequence<RepairAttemptResult>([deniedPathViolation(), repaired()])
    ) as unknown as RepairSessionRunner;
    const deps = baseDeps({ runRepairSession, revertPaths });

    const result = await runAttemptLoop(BASE_INPUT, deps);

    expect(revertPaths).toHaveBeenCalledTimes(1);
    expect(revertPaths).toHaveBeenCalledWith(['package.json']);
    expect(result.outcome).toBe('success');
    expect(result.attemptsTaken).toBe(2);
  });

  it('does not call revertPaths for a no-change-proposed result (nothing to revert)', async () => {
    const revertPaths = vi.fn(async () => undefined);
    const runRepairSession = vi.fn(
      sequence<RepairAttemptResult>([noChangeProposed(), repaired()])
    ) as unknown as RepairSessionRunner;
    const deps = baseDeps({ runRepairSession, revertPaths });

    await runAttemptLoop(BASE_INPUT, deps);

    expect(revertPaths).not.toHaveBeenCalled();
  });
});

describe('runAttemptLoop: totalCostUsd threads onto the attempt record (R10)', () => {
  it('records the repair session totalCostUsd on the attempt', async () => {
    const deps = baseDeps();
    const result = await runAttemptLoop(BASE_INPUT, deps);
    expect(result.attempts[0].totalCostUsd).toBe(0.1);
  });
});
