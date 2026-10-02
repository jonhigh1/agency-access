import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const hooks = resolve('.githooks');

function runHook(ref, { entireExit = 0, npmExit = 0 } = {}) {
  const fixture = mkdtempSync(join(tmpdir(), 'authhub-hook-test-'));
  const bin = join(fixture, 'bin');
  const hookDir = join(fixture, '.githooks');
  const log = join(fixture, 'calls.log');
  mkdirSync(bin);
  mkdirSync(hookDir);
  for (const name of ['pre-push', 'pre-push.pre-entire']) {
    cpSync(join(hooks, name), join(hookDir, name));
  }
  writeFileSync(join(bin, 'entire'), '#!/bin/sh\ncat >/dev/null\necho entire >> "$CALL_LOG"\nexit "$ENTIRE_EXIT"\n', { mode: 0o755 });
  writeFileSync(join(bin, 'git'), '#!/bin/sh\necho "git $*" >> "$CALL_LOG"\n', { mode: 0o755 });
  writeFileSync(join(bin, 'npm'), '#!/bin/sh\necho "npm $*" >> "$CALL_LOG"\nexit "$NPM_EXIT"\n', { mode: 0o755 });

  try {
    const result = spawnSync(join(hookDir, 'pre-push'), ['origin'], {
      input: `${ref}\n`,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        TMPDIR: fixture,
        CALL_LOG: log,
        ENTIRE_EXIT: String(entireExit),
        NPM_EXIT: String(npmExit),
      },
    });
    return { ...result, calls: readFileSync(log, 'utf8').trim().split('\n') };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

const main = 'refs/heads/main abc123 refs/heads/main def456';

test('main ref reaches build gate after Entire consumes stdin, and Entire runs once', () => {
  const result = runHook(main);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.filter((line) => line === 'entire').length, 1);
  assert.ok(result.calls.some((line) => line === 'npm run typecheck'));
  assert.ok(result.calls.some((line) => line === 'npm run build --workspace=apps/web'));
});

test('Entire failure stops gate and preserves exit code', () => {
  const result = runHook(main, { entireExit: 23 });
  assert.equal(result.status, 23);
  assert.deepEqual(result.calls, ['entire']);
});

test('build failure stops push', () => {
  const result = runHook(main, { npmExit: 17 });
  assert.equal(result.status, 17);
  assert.equal(result.calls.filter((line) => line === 'entire').length, 1);
});

test('feature branch and main deletion skip build', () => {
  for (const ref of [
    'refs/heads/topic abc123 refs/heads/topic def456',
    `refs/heads/main ${'0'.repeat(40)} refs/heads/main def456`,
  ]) {
    const result = runHook(ref);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.calls, ['entire']);
  }
});
