/**
 * Replay + drill-mode verification (U6, R12, SC1, SC2).
 *
 * Two independent things live in this one file rather than two, per the
 * unit's own guidance to avoid duplicating test-file setup unnecessarily:
 *
 * 1. Replay (SC2): a stored, real-shaped Vercel build-log excerpt
 *    (`__tests__/fixtures/known-vercel-failure.md`) is fed through U2's
 *    `classifyDeployStatus`, U3's `composeFailureReport` /
 *    `buildDedupeSearchQuery`, and U4's `buildRepairPrompt`, proving the
 *    diagnosis-input path end to end without a live Vercel API call.
 *
 * 2. Drill/dry-run wiring (SC1): proves `runAttemptLoop` invokes the SAME
 *    real dependency-wiring helpers (`createRepairSessionRunner`,
 *    `createGateRunner`, `createNodeGitPusher`) for `mode: 'drill'` and
 *    `mode: 'dry-run'` as it does for `mode: 'repair'` — i.e. there is no
 *    special-cased "drill path" bypassing the real gate inside these TS
 *    modules. See the describe block below for the documented residual
 *    gap this proves: enforcement of "a drill must never touch main" is
 *    NOT done by this code — it depends entirely on the operator running a
 *    drill against a `repair-drill/*` branch.
 *
 * No test in this file spawns a real process, runs a real git command, or
 * performs a real network call — every side effect is a fake injected via
 * `deps`, matching every other test in this directory.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import { classifyDeployStatus } from '../../deploy-status/classify';
import { buildDedupeSearchQuery, composeFailureReport } from '../incident';
import { buildRepairPrompt } from '../prompt';
import {
  createGateRunner,
  createNodeGitPusher,
  createRepairSessionRunner,
  runAttemptLoop,
  type AttemptLoopDeps,
} from '../attempt-loop';
import { createNodeGitDiffNameOnly, type ExecFn, type ExecResult } from '../repair-session';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// 1. Replay (SC2)
// ---------------------------------------------------------------------------

/** Pulls the fenced ```...``` log excerpt out of the fixture markdown file. */
function readFixtureLogExcerpt(): string {
  const raw = readFileSync(join(__dirname, 'fixtures/known-vercel-failure.md'), 'utf-8');
  const match = /```\n([\s\S]*?)```/.exec(raw);
  if (!match) throw new Error('fixture is missing its fenced log-excerpt block');
  return match[1].trimEnd();
}

const REPLAY_SHA = 'deadbee123456789000000000000000000000000';

describe('replay: stored Vercel build-log excerpt (SC2)', () => {
  const logExcerpt = readFixtureLogExcerpt();

  it('the fixture actually contains the real, quotable Next.js build error', () => {
    // Guards the fixture itself against silent drift/paraphrase.
    expect(logExcerpt).toContain(
      'useSearchParams() should be wrapped in a suspense boundary at page "/checkout/success"'
    );
  });

  it("classifies as 'build-time' via U2's classifyDeployStatus given a Vercel ERROR readyState", () => {
    const classification = classifyDeployStatus({ platform: 'vercel', readyState: 'ERROR' });
    expect(classification).toBe('build-time');
  });

  it('the dedupe search query is scoped to this SHA (U3)', () => {
    expect(buildDedupeSearchQuery(REPLAY_SHA)).toBe('deadbee in:title is:issue is:open');
  });

  it('composeFailureReport embeds the literal fixture error text, not a paraphrase (U3)', () => {
    const classification = classifyDeployStatus({ platform: 'vercel', readyState: 'ERROR' });
    const report = composeFailureReport({
      sha: REPLAY_SHA,
      platform: 'vercel',
      deploymentUrl: 'my-app-deadbee.vercel.app',
      logExcerpt,
      triggerSource: 'repository_dispatch:vercel.deployment.error',
      classification,
      now: new Date('2026-09-11T12:00:00.000Z'),
    });

    expect(report).toContain(
      'useSearchParams() should be wrapped in a suspense boundary at page "/checkout/success"'
    );
    expect(report).toContain('Error occurred prerendering page "/checkout/success"');
    expect(report).toContain('**Classification:** build-time');
  });

  it("buildRepairPrompt embeds the same literal error text (not truncated) and the matching known-failure-class hint (U4)", () => {
    const prompt = buildRepairPrompt({
      mode: 'repair',
      failureReport: {
        path: '.claude/tasks/deploy-failures/2026-09-11T12-00-00-000Z-deadbee.md',
        logExcerpt,
      },
    });

    expect(prompt).toContain(
      'useSearchParams() should be wrapped in a suspense boundary at page "/checkout/success"'
    );
    // Not truncated away: the tail of the excerpt must also survive.
    expect(prompt).toContain('Error: Command "npm run build:web" exited with 1');
    // Matching known-failure-class hint (prompt.ts's KNOWN_BUILD_FAILURE_CLASSES).
    expect(prompt).toContain('missing-suspense-around-usesearchparams');
    expect(prompt).toContain('useSearchParams()');
  });
});

// ---------------------------------------------------------------------------
// 2. Drill/dry-run wiring (SC1)
// ---------------------------------------------------------------------------

/**
 * A fake `ExecFn` that answers every command the real wiring helpers issue
 * during one successful attempt-loop pass: the `claude` CLI invocation
 * (repair-session), `git diff --name-only`, `npm run typecheck` / `npm run
 * build` (the gate), and `git add` / `git commit` / `git push`. Recording
 * every call lets the assertions below prove these exact real functions —
 * not a drill-only stub — were what actually ran.
 */
function createRecordingExecFn(): { execFn: ExecFn; calls: Array<{ command: string; args: string[] }> } {
  const calls: Array<{ command: string; args: string[] }> = [];

  const execFn: ExecFn = async ({ command, args }) => {
    calls.push({ command, args });

    if (command === 'claude') {
      const result: ExecResult = {
        exitCode: 0,
        stdout: JSON.stringify({
          result: 'Wrapped the useSearchParams() call in a Suspense boundary.',
          session_id: 'sess-drill-1',
          total_cost_usd: 0.02,
        }),
        stderr: '',
      };
      return result;
    }

    if (command === 'git' && args[0] === 'diff') {
      return { exitCode: 0, stdout: 'apps/web/src/app/checkout/success/page.tsx\n', stderr: '' };
    }

    // npm run typecheck / npm run build / git add / git commit / git push
    return { exitCode: 0, stdout: '', stderr: '' };
  };

  return { execFn, calls };
}

function buildRealWiredDeps(execFn: ExecFn): AttemptLoopDeps {
  const gitDiffNameOnly = createNodeGitDiffNameOnly(execFn);
  return {
    runRepairSession: createRepairSessionRunner(execFn, gitDiffNameOnly),
    runGate: createGateRunner(execFn),
    push: createNodeGitPusher(execFn),
    rebase: vi.fn(async () => ({ ok: true })),
    waitForDeploy: vi.fn(async () => ({ kind: 'deployed' as const })),
  };
}

describe.each(['drill', 'dry-run'] as const)("mode: '%s' wiring (SC1)", (mode) => {
  it('threads through the real createRepairSessionRunner/createGateRunner/createNodeGitPusher — no special-cased bypass', async () => {
    const { execFn, calls } = createRecordingExecFn();
    const deps = buildRealWiredDeps(execFn);

    const result = await runAttemptLoop(
      {
        startingBudget: 3,
        originalSha: 'deadbee123456789000000000000000000000000',
        mode,
        failureReportPath: '.claude/tasks/deploy-failures/deadbee.md',
        logExcerpt: 'Error: useSearchParams() should be wrapped in a suspense boundary',
      },
      deps
    );

    // The real session runner was invoked: it shells out to the `claude` CLI.
    expect(calls.some((c) => c.command === 'claude')).toBe(true);
    // The real gate runner was invoked: typecheck then build, via `npm`.
    expect(calls.some((c) => c.command === 'npm' && c.args.includes('typecheck'))).toBe(true);
    expect(calls.some((c) => c.command === 'npm' && c.args.includes('build'))).toBe(true);
    // The real git pusher was invoked: add, commit, push — the same commands
    // a real `repair` run would issue. Nothing here special-cases drill/dry-run
    // to skip staging or committing.
    expect(calls.some((c) => c.command === 'git' && c.args[0] === 'add')).toBe(true);
    expect(calls.some((c) => c.command === 'git' && c.args[0] === 'commit')).toBe(true);
    expect(calls.some((c) => c.command === 'git' && c.args[0] === 'push')).toBe(true);

    expect(result.outcome).toBe('success');
  });
});

// Residual gap (reported, not asserted): the test above proves the POSITIVE
// half of SC1 — the real dependency-wiring helpers run unmodified for
// drill/dry-run. There is no corresponding NEGATIVE assertion here (e.g.
// "pushing to main is blocked in drill mode") because no such code path
// exists to assert against: neither `runAttemptLoop` nor
// `createNodeGitPusher` branches on `mode` to skip commit/push. The only
// real guarantee that a drill never touches `main` is operator discipline —
// running the drill against a `repair-drill/*` branch and dispatching the
// workflow with `mode: drill` themselves. See this unit's final report for
// the explicit callout.
