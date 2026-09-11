/**
 * Restricted repair session (U4, R8-R10, R12, KTD6).
 *
 * Runs ONE headless `claude -p --bare` invocation against a build-time
 * deploy failure and returns a typed, deterministic result. This module
 * never decides whether to retry, never tracks attempt counts or budget
 * across attempts, and never commits or pushes — all of that belongs to a
 * later attempt-loop unit (U5). See the module-level correction below
 * before reading R8/R9's verbatim text elsewhere in the plan.
 *
 * ---------------------------------------------------------------------
 * SECURITY-REVIEW CORRECTION (overrides the plan's original R8 wording):
 * this session is edit-only. It never constructs or executes `git commit`,
 * `git push`, or `git add`. Committing and pushing belongs entirely to
 * U5's attempt-loop script, which also owns the bot commit identity. This
 * file's self-check (see the unit's verification instructions) greps this
 * file for those three strings — the only place they appear is inside the
 * DENIED_BASH_TOOLS list below, as *denial* patterns handed to the CLI's
 * `--disallowedTools` flag, never as a command this module runs itself.
 * ---------------------------------------------------------------------
 *
 * KTD6: `--bare` skips hooks, plugin sync, attribution, auto-memory,
 * background prefetches, keychain reads, and CLAUDE.md auto-discovery —
 * but NOT repo `.claude/settings.json` or skills. That means
 * `--allowedTools`/`--disallowedTools` is the only enforcement layer at
 * the CLI level; this module additionally runs a post-run `git diff
 * --name-only` check (R9's second enforcement layer) because a permission
 * bug in the CLI's tool matcher must not be the only thing standing
 * between the agent and a denied path.
 *
 * Every side effect (spawning the CLI, reading the git diff) is injected,
 * so nothing here spawns a real process in tests — matching the pattern in
 * `apps/api/scripts/__tests__/deactivate-legacy-snapchat-connections.test.ts`
 * and U2/U3's fake-fetch / fake-searchIssues style.
 */

import { spawn } from 'node:child_process';
import { buildRepairPrompt, DEFAULT_DENIED_PATHS, type RepairMode } from './prompt';

export { DEFAULT_DENIED_PATHS } from './prompt';

export type { RepairMode } from './prompt';

// ---------------------------------------------------------------------------
// Process-spawning seam
// ---------------------------------------------------------------------------

export type ExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

/** Injected in place of a real child-process spawn. `input`, if given, is written to stdin. */
export type ExecFn = (invocation: {
  command: string;
  args: string[];
  input?: string;
}) => Promise<ExecResult>;

/** Injected in place of a real `git diff --name-only`. Returns changed file paths. */
export type GitDiffNameOnlyFn = () => Promise<string[]>;

/**
 * Real process-spawning implementation. Not exercised by this unit's own
 * tests (which always inject a fake `ExecFn`) — provided so a caller (U5)
 * has a working default without reimplementing stdin piping.
 */
export function createNodeExecFn(): ExecFn {
  return ({ command, args, input }) =>
    new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf-8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf-8');
      });
      child.on('error', reject);
      child.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code ?? 1 });
      });
      if (input !== undefined) {
        child.stdin.write(input);
      }
      child.stdin.end();
    });
}

/**
 * Real `git diff --name-only` implementation via an injected ExecFn. This
 * is a read-only git command — it does not stage, commit, or push
 * anything; it only lists paths already changed in the working tree.
 */
export function createNodeGitDiffNameOnly(execFn: ExecFn = createNodeExecFn()): GitDiffNameOnlyFn {
  return async () => {
    const result = await execFn({ command: 'git', args: ['diff', '--name-only'] });
    if (result.exitCode !== 0) {
      throw new Error(`git diff --name-only failed (exit ${result.exitCode}): ${result.stderr}`);
    }
    return result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  };
}

// ---------------------------------------------------------------------------
// Allowlist / denylist (R9, KTD6)
// ---------------------------------------------------------------------------

/** Positive allowlist handed to `--allowedTools`. */
export const DEFAULT_ALLOWED_TOOLS: readonly string[] = [
  'Read',
  'Edit',
  'Bash(npm run typecheck)',
  'Bash(npm run build)',
];

/**
 * Git-write commands the agent must never be able to run (per the
 * correction above: this session is edit-only, full stop). These are
 * *denial* patterns passed to `--disallowedTools` — see the module-level
 * comment for why this file's self-check finds these strings here and why
 * that is expected, not a violation.
 */
export const DENIED_BASH_TOOLS: readonly string[] = [
  'Bash(git push*)',
  'Bash(git commit*)',
  'Bash(git add*)',
];

/**
 * Path-scoped Edit/Write denials, generated from DEFAULT_DENIED_PATHS, for
 * the `--allowedTools`/`--disallowedTools` layer (R9's enforcement layer
 * (a); layer (b) is the post-run diff check further down this file).
 */
function pathDenialTools(deniedPaths: readonly string[]): string[] {
  return deniedPaths.flatMap((path) => [`Edit(${path})`, `Write(${path})`]);
}

export function buildDisallowedTools(deniedPaths: readonly string[] = DEFAULT_DENIED_PATHS): string[] {
  return [...DENIED_BASH_TOOLS, ...pathDenialTools(deniedPaths)];
}

// ---------------------------------------------------------------------------
// CLI argument assembly (KTD6)
// ---------------------------------------------------------------------------

export const CLAUDE_CLI_COMMAND = 'claude';
export const DEFAULT_MAX_TURNS = 30;
export const DEFAULT_MAX_BUDGET_USD = 2.0;

export type RepairSessionOptions = {
  mode: RepairMode;
  maxTurns?: number;
  maxBudgetUsd?: number;
  /** Prior session id to resume (attempts 2-3). Omitted on attempt 1. */
  sessionId?: string;
  allowedTools?: readonly string[];
  disallowedTools?: readonly string[];
};

/**
 * Build the argv for `claude -p --bare ...` (KTD6). Pure — no spawning.
 * `--resume <sessionId>` is only appended when a prior session id is
 * passed in; deciding *when* to pass one across attempts 2-3 is U5's job,
 * not this function's.
 */
export function buildClaudeArgs(options: RepairSessionOptions): string[] {
  const allowedTools = options.allowedTools ?? DEFAULT_ALLOWED_TOOLS;
  const disallowedTools = options.disallowedTools ?? buildDisallowedTools();

  const args = [
    '-p',
    '--bare',
    '--output-format',
    'json',
    '--permission-mode',
    'dontAsk',
    '--allowedTools',
    allowedTools.join(','),
    '--disallowedTools',
    disallowedTools.join(','),
    '--permission-prompts',
    'none',
    '--max-turns',
    String(options.maxTurns ?? DEFAULT_MAX_TURNS),
    '--max-budget-usd',
    String(options.maxBudgetUsd ?? DEFAULT_MAX_BUDGET_USD),
  ];

  if (options.sessionId) {
    args.push('--resume', options.sessionId);
  }

  return args;
}

// ---------------------------------------------------------------------------
// `--output-format json` parsing
// ---------------------------------------------------------------------------

export type ClaudeCliJsonResult = {
  result?: unknown;
  session_id?: unknown;
  total_cost_usd?: unknown;
  [key: string]: unknown;
};

export type ClaudeCliParseFailureReason = 'malformed-json' | 'missing-result-field' | 'missing-session-id';

export type ClaudeCliParseResult =
  | { ok: true; result: string; sessionId: string; totalCostUsd: number }
  | { ok: false; reason: ClaudeCliParseFailureReason };

/**
 * Parse `claude -p --bare --output-format json`'s stdout. Never throws —
 * malformed JSON or a missing required field becomes a typed failure, not
 * an exception, so a caller can branch on it without a try/catch (approach
 * step 5).
 */
export function parseClaudeCliOutput(stdout: string): ClaudeCliParseResult {
  let parsed: ClaudeCliJsonResult;
  try {
    parsed = JSON.parse(stdout) as ClaudeCliJsonResult;
  } catch {
    return { ok: false, reason: 'malformed-json' };
  }

  if (typeof parsed.result !== 'string' || parsed.result.length === 0) {
    return { ok: false, reason: 'missing-result-field' };
  }
  if (typeof parsed.session_id !== 'string' || parsed.session_id.length === 0) {
    return { ok: false, reason: 'missing-session-id' };
  }

  const totalCostUsd = typeof parsed.total_cost_usd === 'number' ? parsed.total_cost_usd : 0;

  return { ok: true, result: parsed.result, sessionId: parsed.session_id, totalCostUsd };
}

// ---------------------------------------------------------------------------
// Denied-path diff enforcement (R9, layer (b))
// ---------------------------------------------------------------------------

/**
 * Minimal glob to RegExp: supports `*`, `**`, and a leading `**` immediately
 * followed by a path separator (glob's recursive-prefix form) matching
 * zero-or-more directories.
 */
function globToRegExp(glob: string): RegExp {
  let pattern = glob;
  let prefix = '';
  if (pattern.startsWith('**/')) {
    prefix = '(?:.*/)?';
    pattern = pattern.slice(3);
  }

  const specials = /[.+^${}()|[\]\\]/g;
  let out = prefix;
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      out += '.*';
      i += 2;
      continue;
    }
    if (c === '*') {
      out += '[^/]*';
      i += 1;
      continue;
    }
    out += c.replace(specials, '\\$&');
    i += 1;
  }
  return new RegExp(`^${out}$`);
}

/**
 * Which of `changedPaths` match a denied-path glob. Returns ALL matches,
 * not just the first — the caller must name every violated path, not
 * truncate to one (test scenario: "multiple denied paths ... all are
 * named").
 */
export function findDeniedPathViolations(
  changedPaths: readonly string[],
  deniedPaths: readonly string[] = DEFAULT_DENIED_PATHS
): string[] {
  const regexes = deniedPaths.map((pattern) => globToRegExp(pattern));
  return changedPaths.filter((path) => regexes.some((regex) => regex.test(path)));
}

// ---------------------------------------------------------------------------
// Attempt result
// ---------------------------------------------------------------------------

export type RepairAttemptResult =
  | {
      kind: 'repaired';
      mode: RepairMode;
      diagnosis: string;
      sessionId: string;
      totalCostUsd: number;
      changedPaths: string[];
    }
  | {
      /** CLI ran, returned valid JSON, but the working tree diff is empty. */
      kind: 'no-change-proposed';
      mode: RepairMode;
      diagnosis: string;
      sessionId: string;
      totalCostUsd: number;
    }
  | {
      /** CLI ran, returned valid JSON, but touched a path R9 forbids. */
      kind: 'denied-path-violation';
      mode: RepairMode;
      diagnosis: string;
      sessionId: string;
      totalCostUsd: number;
      violatedPaths: string[];
    }
  | {
      /** Terminal, non-retryable at this unit's level — never silently retried here (U5 owns retry policy). */
      kind: 'terminal-error';
      mode: RepairMode;
      reason: 'non-zero-exit' | ClaudeCliParseFailureReason;
      exitCode?: number;
      stderr?: string;
    };

export type RunRepairSessionInput = {
  mode: RepairMode;
  failureReportPath: string;
  logExcerpt: string;
  /** Prior session id to resume (attempts 2-3, per KTD6). Omitted on attempt 1. */
  sessionId?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  allowedTools?: readonly string[];
  disallowedTools?: readonly string[];
  deniedPaths?: readonly string[];
};

export type RunRepairSessionDeps = {
  execFn: ExecFn;
  gitDiffNameOnly: GitDiffNameOnlyFn;
};

/**
 * Run ONE repair attempt: build the prompt, invoke `claude -p --bare`,
 * parse its JSON result, then enforce the denied-path diff check. This
 * function never loops, never tracks attempts across calls, and never
 * runs `git commit`/`git push`/`git add` — see the module-level
 * correction comment. `mode` is threaded through to the prompt and echoed
 * back on every result variant (R12) but does not otherwise branch this
 * function's behavior — see prompt.ts's "Mode" section for why.
 */
export async function runRepairSession(
  input: RunRepairSessionInput,
  deps: RunRepairSessionDeps
): Promise<RepairAttemptResult> {
  const deniedPaths = input.deniedPaths ?? DEFAULT_DENIED_PATHS;

  const promptContent = buildRepairPrompt({
    mode: input.mode,
    failureReport: { path: input.failureReportPath, logExcerpt: input.logExcerpt },
    deniedPaths,
  });

  const args = buildClaudeArgs({
    mode: input.mode,
    maxTurns: input.maxTurns,
    maxBudgetUsd: input.maxBudgetUsd,
    sessionId: input.sessionId,
    allowedTools: input.allowedTools,
    disallowedTools: input.disallowedTools ?? buildDisallowedTools(deniedPaths),
  });

  const execResult = await deps.execFn({ command: CLAUDE_CLI_COMMAND, args, input: promptContent });

  if (execResult.exitCode !== 0) {
    return {
      kind: 'terminal-error',
      mode: input.mode,
      reason: 'non-zero-exit',
      exitCode: execResult.exitCode,
      stderr: execResult.stderr,
    };
  }

  const parsed = parseClaudeCliOutput(execResult.stdout);
  if (!parsed.ok) {
    return { kind: 'terminal-error', mode: input.mode, reason: parsed.reason, stderr: execResult.stderr };
  }

  const changedPaths = await deps.gitDiffNameOnly();
  const violatedPaths = findDeniedPathViolations(changedPaths, deniedPaths);

  if (violatedPaths.length > 0) {
    return {
      kind: 'denied-path-violation',
      mode: input.mode,
      diagnosis: parsed.result,
      sessionId: parsed.sessionId,
      totalCostUsd: parsed.totalCostUsd,
      violatedPaths,
    };
  }

  if (changedPaths.length === 0) {
    return {
      kind: 'no-change-proposed',
      mode: input.mode,
      diagnosis: parsed.result,
      sessionId: parsed.sessionId,
      totalCostUsd: parsed.totalCostUsd,
    };
  }

  return {
    kind: 'repaired',
    mode: input.mode,
    diagnosis: parsed.result,
    sessionId: parsed.sessionId,
    totalCostUsd: parsed.totalCostUsd,
    changedPaths,
  };
}
