/**
 * Tests for deploy-repair prompt composition (U4).
 *
 * Pure-function tests only — no filesystem, no CLI, no network.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DENIED_PATHS,
  DEFAULT_GATE_COMMANDS,
  KNOWN_BUILD_FAILURE_CLASSES,
  buildRepairPrompt,
  redactSecretShapedStrings,
} from '../prompt';

describe('redactSecretShapedStrings', () => {
  it('redacts a SECRET=value assignment', () => {
    const redacted = redactSecretShapedStrings('Build env: SECRET=abc123 NODE_ENV=production');
    expect(redacted).not.toContain('abc123');
    expect(redacted).toContain('SECRET=[REDACTED]');
    // Unrelated assignments are left alone.
    expect(redacted).toContain('NODE_ENV=production');
  });

  it('redacts KEY, TOKEN, PASSWORD, and CREDENTIAL assignments, case-insensitively', () => {
    const input = [
      'api_key=sk-live-000111222',
      'AUTH_TOKEN: xyz789',
      'db_password=hunter2',
      'servicecredential = "abcdef"',
    ].join('\n');
    const redacted = redactSecretShapedStrings(input);
    expect(redacted).not.toContain('sk-live-000111222');
    expect(redacted).not.toContain('xyz789');
    expect(redacted).not.toContain('hunter2');
    expect(redacted).not.toContain('abcdef');
    expect(redacted).toContain('[REDACTED]');
  });

  it('redacts an Authorization: Bearer header without mangling the line', () => {
    const redacted = redactSecretShapedStrings('Authorization: Bearer sk-abc123xyz.def456');
    expect(redacted).not.toContain('sk-abc123xyz.def456');
    expect(redacted).toBe('Authorization: Bearer [REDACTED]');
  });

  it('leaves ordinary log lines untouched', () => {
    const input = 'Error: Cannot find module "./missing-file"\n    at Function.Module._resolveFilename';
    expect(redactSecretShapedStrings(input)).toBe(input);
  });

  it('handles empty input', () => {
    expect(redactSecretShapedStrings('')).toBe('');
  });
});

describe('buildRepairPrompt', () => {
  const baseInput = {
    mode: 'repair' as const,
    failureReport: {
      path: '.claude/tasks/deploy-failures/2026-09-11T12-00-00-000Z-abc1234.md',
      logExcerpt: 'Error: Cannot find module "./missing-file"',
    },
  };

  it('includes the failure-report artifact path so the agent reads it', () => {
    const prompt = buildRepairPrompt(baseInput);
    expect(prompt).toContain(baseInput.failureReport.path);
  });

  it('includes every denied path by default', () => {
    const prompt = buildRepairPrompt(baseInput);
    for (const path of DEFAULT_DENIED_PATHS) {
      expect(prompt).toContain(path);
    }
  });

  it('includes every default gate command', () => {
    const prompt = buildRepairPrompt(baseInput);
    for (const command of DEFAULT_GATE_COMMANDS) {
      expect(prompt).toContain(command);
    }
  });

  it('includes all five known build-failure classes as diagnostic hints', () => {
    const prompt = buildRepairPrompt(baseInput);
    expect(KNOWN_BUILD_FAILURE_CLASSES).toHaveLength(5);
    for (const hint of KNOWN_BUILD_FAILURE_CLASSES) {
      expect(prompt).toContain(hint.name);
    }
  });

  it('tells the agent it must not commit, push, or add', () => {
    const prompt = buildRepairPrompt(baseInput);
    const normalized = prompt.replace(/\s+/g, ' ').toLowerCase();
    expect(normalized).toContain('must not run `git commit`');
    expect(normalized).toContain('`git push`');
    expect(normalized).toContain('`git add`');
  });

  it('embeds the redacted excerpt, not the raw secret, when the log excerpt contains a secret', () => {
    const prompt = buildRepairPrompt({
      ...baseInput,
      failureReport: {
        ...baseInput.failureReport,
        logExcerpt: `Building...\nSECRET=abc123\nDone.`,
      },
    });
    expect(prompt).not.toContain('SECRET=abc123');
    expect(prompt).toContain('[REDACTED]');
  });

  it('threads the mode value into the prompt without changing the instructional content', () => {
    const repairPrompt = buildRepairPrompt({ ...baseInput, mode: 'repair' });
    const dryRunPrompt = buildRepairPrompt({ ...baseInput, mode: 'dry-run' });
    const drillPrompt = buildRepairPrompt({ ...baseInput, mode: 'drill' });

    expect(repairPrompt).toContain('`repair`');
    expect(dryRunPrompt).toContain('`dry-run`');
    expect(drillPrompt).toContain('`drill`');

    // Stripping the mode label out, the rest of the prompt is identical —
    // mode is a label, not a behavior switch, per R12's correction.
    const stripMode = (s: string) => s.replace(/`repair`|`dry-run`|`drill`/g, '`MODE`');
    expect(stripMode(repairPrompt)).toBe(stripMode(dryRunPrompt));
    expect(stripMode(repairPrompt)).toBe(stripMode(drillPrompt));
  });

  it('respects custom denied paths and gate commands when provided', () => {
    const prompt = buildRepairPrompt({
      ...baseInput,
      deniedPaths: ['custom/denied/**'],
      gateCommands: ['npm run custom-check'],
    });
    expect(prompt).toContain('custom/denied/**');
    expect(prompt).toContain('npm run custom-check');
  });
});
