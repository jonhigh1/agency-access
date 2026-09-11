/**
 * Tests for the restricted repair session (U4, R8-R10, R12, KTD6).
 *
 * Everything here runs against injected fakes for both the CLI spawn
 * (`ExecFn`) and `git diff --name-only` (`GitDiffNameOnlyFn`) — no real
 * process is ever spawned by these tests.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DENIED_PATHS,
  DEFAULT_MAX_BUDGET_USD,
  DEFAULT_MAX_TURNS,
  REPAIR_SESSION_ALLOWED_ENV_KEYS,
  type ExecFn,
  type ExecResult,
  type GitDiffNameOnlyFn,
  buildClaudeArgs,
  buildDisallowedTools,
  buildRepairSessionEnv,
  findDeniedPathViolations,
  parseClaudeCliOutput,
  runRepairSession,
} from '../repair-session';

function jsonResult(overrides: Partial<{ result: string; session_id: string; total_cost_usd: number }> = {}) {
  return JSON.stringify({
    result: 'Fixed missing Suspense boundary around useSearchParams in pricing page.',
    session_id: 'sess-abc123',
    total_cost_usd: 0.42,
    ...overrides,
  });
}

function fakeExecFn(result: ExecResult): ExecFn {
  return async () => result;
}

function recordingExecFn(result: ExecResult): {
  execFn: ExecFn;
  calls: Array<{ command: string; args: string[]; input?: string; env?: NodeJS.ProcessEnv }>;
} {
  const calls: Array<{ command: string; args: string[]; input?: string; env?: NodeJS.ProcessEnv }> = [];
  const execFn: ExecFn = async (invocation) => {
    calls.push(invocation);
    return result;
  };
  return { execFn, calls };
}

function fakeGitDiff(paths: string[]): GitDiffNameOnlyFn {
  return async () => paths;
}

const BASE_INPUT = {
  mode: 'repair' as const,
  failureReportPath: '.claude/tasks/deploy-failures/2026-09-11T12-00-00-000Z-abc1234.md',
  logExcerpt: 'Error: Cannot find module "./missing-file"',
};

describe('buildClaudeArgs', () => {
  it('assembles the KTD6 argument shape with defaults', () => {
    const args = buildClaudeArgs({ mode: 'repair' });
    expect(args).toContain('-p');
    expect(args).toContain('--bare');
    expect(args.join(' ')).toContain('--output-format json');
    expect(args.join(' ')).toContain('--permission-mode dontAsk');
    expect(args.join(' ')).toContain('--permission-prompts none');
    expect(args.join(' ')).toContain(`--max-turns ${DEFAULT_MAX_TURNS}`);
    expect(args.join(' ')).toContain(`--max-budget-usd ${DEFAULT_MAX_BUDGET_USD}`);
  });

  it('does not include --resume when no sessionId is given', () => {
    const args = buildClaudeArgs({ mode: 'repair' });
    expect(args).not.toContain('--resume');
  });

  it('includes --resume <sessionId> when a prior session id is passed in', () => {
    const args = buildClaudeArgs({ mode: 'repair', sessionId: 'sess-abc123' });
    const resumeIndex = args.indexOf('--resume');
    expect(resumeIndex).toBeGreaterThan(-1);
    expect(args[resumeIndex + 1]).toBe('sess-abc123');
  });

  it('the --allowedTools value never grants a git write command', () => {
    const args = buildClaudeArgs({ mode: 'repair' });
    const allowedIndex = args.indexOf('--allowedTools');
    const allowedValue = args[allowedIndex + 1];
    expect(allowedValue).not.toMatch(/git (commit|push|add)/);
  });

  it('the --disallowedTools value explicitly excludes git push/commit/add', () => {
    const args = buildClaudeArgs({ mode: 'repair' });
    const disallowedIndex = args.indexOf('--disallowedTools');
    const disallowedValue = args[disallowedIndex + 1];
    expect(disallowedValue).toContain('Bash(git push*)');
    expect(disallowedValue).toContain('Bash(git commit*)');
    expect(disallowedValue).toContain('Bash(git add*)');
  });
});

describe('buildDisallowedTools', () => {
  it('includes an Edit and Write denial for every denied path', () => {
    const tools = buildDisallowedTools(DEFAULT_DENIED_PATHS);
    for (const path of DEFAULT_DENIED_PATHS) {
      expect(tools).toContain(`Edit(${path})`);
      expect(tools).toContain(`Write(${path})`);
    }
  });
});

describe('parseClaudeCliOutput', () => {
  it('parses a valid --output-format json result', () => {
    const parsed = parseClaudeCliOutput(jsonResult());
    expect(parsed).toEqual({
      ok: true,
      result: 'Fixed missing Suspense boundary around useSearchParams in pricing page.',
      sessionId: 'sess-abc123',
      totalCostUsd: 0.42,
    });
  });

  it('defaults total_cost_usd to 0 when absent', () => {
    const raw = JSON.stringify({ result: 'diagnosis', session_id: 'sess-1' });
    const parsed = parseClaudeCliOutput(raw);
    expect(parsed).toEqual({ ok: true, result: 'diagnosis', sessionId: 'sess-1', totalCostUsd: 0 });
  });

  it('returns a typed error for malformed JSON, without throwing', () => {
    const parsed = parseClaudeCliOutput('not json at all {{{');
    expect(parsed).toEqual({ ok: false, reason: 'malformed-json' });
  });

  it('returns a typed error when the result field is missing', () => {
    const raw = JSON.stringify({ session_id: 'sess-1', total_cost_usd: 0.1 });
    expect(parseClaudeCliOutput(raw)).toEqual({ ok: false, reason: 'missing-result-field' });
  });

  it('returns a typed error when the session_id field is missing', () => {
    const raw = JSON.stringify({ result: 'diagnosis', total_cost_usd: 0.1 });
    expect(parseClaudeCliOutput(raw)).toEqual({ ok: false, reason: 'missing-session-id' });
  });
});

describe('findDeniedPathViolations', () => {
  it('matches a nested file under a denied directory glob', () => {
    const violations = findDeniedPathViolations(['.github/workflows/foo.yml'], DEFAULT_DENIED_PATHS);
    expect(violations).toEqual(['.github/workflows/foo.yml']);
  });

  it('matches a workspace package.json via the **/ prefix glob', () => {
    const violations = findDeniedPathViolations(['apps/web/package.json'], DEFAULT_DENIED_PATHS);
    expect(violations).toEqual(['apps/web/package.json']);
  });

  it('matches root-level literal deploy config files', () => {
    const violations = findDeniedPathViolations(['render.yaml', 'vercel.json'], DEFAULT_DENIED_PATHS);
    expect(violations).toEqual(['render.yaml', 'vercel.json']);
  });

  it('names every violation, not just the first, when multiple denied paths are touched', () => {
    const violations = findDeniedPathViolations(
      ['.github/workflows/foo.yml', 'prisma/schema.prisma', 'apps/web/src/page.tsx'],
      DEFAULT_DENIED_PATHS
    );
    expect(violations).toEqual(['.github/workflows/foo.yml', 'prisma/schema.prisma']);
  });

  it('does not flag an ordinary source file', () => {
    const violations = findDeniedPathViolations(['apps/web/src/app/pricing/page.tsx'], DEFAULT_DENIED_PATHS);
    expect(violations).toEqual([]);
  });
});

describe('runRepairSession — happy path', () => {
  it('returns a repaired result with diagnosis, session id, and cost', async () => {
    const execFn = fakeExecFn({ stdout: jsonResult(), stderr: '', exitCode: 0 });
    const gitDiffNameOnly = fakeGitDiff(['apps/web/src/app/pricing/page.tsx']);

    const result = await runRepairSession(BASE_INPUT, { execFn, gitDiffNameOnly });

    expect(result).toEqual({
      kind: 'repaired',
      mode: 'repair',
      diagnosis: 'Fixed missing Suspense boundary around useSearchParams in pricing page.',
      sessionId: 'sess-abc123',
      totalCostUsd: 0.42,
      changedPaths: ['apps/web/src/app/pricing/page.tsx'],
    });
  });

  it('passes the prompt content on stdin, not as a positional CLI arg', async () => {
    const { execFn, calls } = recordingExecFn({ stdout: jsonResult(), stderr: '', exitCode: 0 });
    const gitDiffNameOnly = fakeGitDiff([]);

    await runRepairSession(BASE_INPUT, { execFn, gitDiffNameOnly });

    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe('claude');
    expect(calls[0].input).toContain(BASE_INPUT.failureReportPath);
    expect(calls[0].args).not.toContain(calls[0].input);
  });

  it('a second call with a sessionId passed in includes --resume <that id> in the constructed args', async () => {
    const { execFn, calls } = recordingExecFn({ stdout: jsonResult({ session_id: 'sess-attempt-2' }), stderr: '', exitCode: 0 });
    const gitDiffNameOnly = fakeGitDiff([]);

    await runRepairSession({ ...BASE_INPUT, sessionId: 'sess-abc123' }, { execFn, gitDiffNameOnly });

    expect(calls).toHaveLength(1);
    const resumeIndex = calls[0].args.indexOf('--resume');
    expect(resumeIndex).toBeGreaterThan(-1);
    expect(calls[0].args[resumeIndex + 1]).toBe('sess-abc123');
  });

  it('scopes the spawned env down to the allowlist, dropping workflow secrets the CLI does not need (security-review finding)', async () => {
    const { execFn, calls } = recordingExecFn({ stdout: jsonResult(), stderr: '', exitCode: 0 });
    const gitDiffNameOnly = fakeGitDiff([]);

    await runRepairSession(BASE_INPUT, { execFn, gitDiffNameOnly });

    expect(calls).toHaveLength(1);
    expect(calls[0].env).toBeDefined();
    const passedKeys = Object.keys(calls[0].env ?? {});
    expect(passedKeys.every((key) => REPAIR_SESSION_ALLOWED_ENV_KEYS.includes(key))).toBe(true);
    for (const secretKey of ['GH_TOKEN', 'VERCEL_TOKEN', 'RENDER_API_KEY']) {
      expect(passedKeys).not.toContain(secretKey);
    }
  });
});

describe('buildRepairSessionEnv', () => {
  it('keeps only allowlisted keys present in the source env', () => {
    const scoped = buildRepairSessionEnv({
      PATH: '/usr/bin',
      ANTHROPIC_API_KEY: 'sk-test',
      GH_TOKEN: 'ghp_should_not_leak',
      VERCEL_TOKEN: 'vercel_should_not_leak',
    });

    expect(scoped).toEqual({ PATH: '/usr/bin', ANTHROPIC_API_KEY: 'sk-test' });
  });

  it('omits an allowlisted key entirely when the source env does not have it', () => {
    const scoped = buildRepairSessionEnv({ PATH: '/usr/bin' });
    expect(scoped).toEqual({ PATH: '/usr/bin' });
    expect('ANTHROPIC_API_KEY' in scoped).toBe(false);
  });
});

describe('runRepairSession — edge cases', () => {
  it('returns a distinct "no change proposed" result for an empty diff, not conflated with success or failure', async () => {
    const execFn = fakeExecFn({ stdout: jsonResult(), stderr: '', exitCode: 0 });
    const gitDiffNameOnly = fakeGitDiff([]);

    const result = await runRepairSession(BASE_INPUT, { execFn, gitDiffNameOnly });

    expect(result.kind).toBe('no-change-proposed');
    expect(result.kind).not.toBe('repaired');
    if (result.kind === 'no-change-proposed') {
      expect(result.sessionId).toBe('sess-abc123');
      expect(result.diagnosis).toContain('Fixed');
    }
  });

  it('fails the attempt and names the path when a denied path is in the diff', async () => {
    const execFn = fakeExecFn({ stdout: jsonResult(), stderr: '', exitCode: 0 });
    const gitDiffNameOnly = fakeGitDiff(['.github/workflows/deploy.yml']);

    const result = await runRepairSession(BASE_INPUT, { execFn, gitDiffNameOnly });

    expect(result.kind).toBe('denied-path-violation');
    if (result.kind === 'denied-path-violation') {
      expect(result.violatedPaths).toEqual(['.github/workflows/deploy.yml']);
    }
  });

  it('names every denied path, not just the first, when multiple appear in the diff', async () => {
    const execFn = fakeExecFn({ stdout: jsonResult(), stderr: '', exitCode: 0 });
    const gitDiffNameOnly = fakeGitDiff([
      '.github/workflows/deploy.yml',
      '.claude/settings.json',
      'apps/web/package.json',
      'apps/web/src/app/page.tsx',
    ]);

    const result = await runRepairSession(BASE_INPUT, { execFn, gitDiffNameOnly });

    expect(result.kind).toBe('denied-path-violation');
    if (result.kind === 'denied-path-violation') {
      expect(result.violatedPaths).toEqual([
        '.github/workflows/deploy.yml',
        '.claude/settings.json',
        'apps/web/package.json',
      ]);
    }
  });
});

describe('runRepairSession — error paths', () => {
  it('returns a terminal, non-retryable result when the CLI exits non-zero', async () => {
    const execFn = fakeExecFn({ stdout: '', stderr: 'fatal: budget exceeded', exitCode: 1 });
    const gitDiffNameOnly = fakeGitDiff([]);

    const result = await runRepairSession(BASE_INPUT, { execFn, gitDiffNameOnly });

    expect(result).toEqual({
      kind: 'terminal-error',
      mode: 'repair',
      reason: 'non-zero-exit',
      exitCode: 1,
      stderr: 'fatal: budget exceeded',
    });
  });

  it('returns a typed error, not a thrown exception, when the CLI returns malformed JSON', async () => {
    const execFn = fakeExecFn({ stdout: 'not valid json {{{', stderr: '', exitCode: 0 });
    const gitDiffNameOnly = fakeGitDiff([]);

    await expect(runRepairSession(BASE_INPUT, { execFn, gitDiffNameOnly })).resolves.toEqual({
      kind: 'terminal-error',
      mode: 'repair',
      reason: 'malformed-json',
      stderr: '',
    });
  });

  it('returns a typed error, not a thrown exception, when the result field is missing', async () => {
    const execFn = fakeExecFn({ stdout: JSON.stringify({ session_id: 'sess-1' }), stderr: '', exitCode: 0 });
    const gitDiffNameOnly = fakeGitDiff([]);

    const result = await runRepairSession(BASE_INPUT, { execFn, gitDiffNameOnly });
    expect(result).toEqual({
      kind: 'terminal-error',
      mode: 'repair',
      reason: 'missing-result-field',
      stderr: '',
    });
  });

  it('never calls gitDiffNameOnly when the CLI itself failed terminally', async () => {
    let gitDiffCalled = false;
    const execFn = fakeExecFn({ stdout: '', stderr: 'boom', exitCode: 1 });
    const gitDiffNameOnly: GitDiffNameOnlyFn = async () => {
      gitDiffCalled = true;
      return [];
    };

    await runRepairSession(BASE_INPUT, { execFn, gitDiffNameOnly });
    expect(gitDiffCalled).toBe(false);
  });
});

describe('runRepairSession — mode threading (R12)', () => {
  it.each(['repair', 'dry-run', 'drill'] as const)(
    'echoes mode %s on the result without changing observable behavior',
    async (mode) => {
      const execFn = fakeExecFn({ stdout: jsonResult(), stderr: '', exitCode: 0 });
      const gitDiffNameOnly = fakeGitDiff(['apps/web/src/app/page.tsx']);

      const result = await runRepairSession({ ...BASE_INPUT, mode }, { execFn, gitDiffNameOnly });

      expect(result.mode).toBe(mode);
      expect(result.kind).toBe('repaired');
    }
  );
});

describe('runRepairSession — redaction integration (risk-table item)', () => {
  it('does not leak a secret from the log excerpt into the prompt sent to the CLI', async () => {
    const { execFn, calls } = recordingExecFn({ stdout: jsonResult(), stderr: '', exitCode: 0 });
    const gitDiffNameOnly = fakeGitDiff([]);

    await runRepairSession(
      { ...BASE_INPUT, logExcerpt: 'Building...\nSECRET=abc123\nDone.' },
      { execFn, gitDiffNameOnly }
    );

    expect(calls[0].input).not.toContain('SECRET=abc123');
    expect(calls[0].input).toContain('[REDACTED]');
  });
});
