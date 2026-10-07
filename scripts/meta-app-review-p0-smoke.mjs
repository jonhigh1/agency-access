#!/usr/bin/env node
/**
 * Ticket 12 — scoped Meta App Review P0 smoke (no live Meta).
 * Wired into `npm run test:run` so CI fails on OAuth contract or zero-portfolio regressions.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(label, cwd, script, args) {
  const result = spawnSync(script, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });
  if (result.status !== 0) {
    console.error(`Meta App Review P0 smoke failed: ${label} (exit ${result.status ?? 'unknown'})`);
    process.exit(result.status ?? 1);
  }
}

run('shared OAuth contract', join(root, 'packages/shared'), 'npm', [
  'test',
  '--',
  '--runInBand',
  'meta-app-review-p0-smoke',
]);

run('api OAuth URL + user Pages edge', join(root, 'apps/api'), 'npm', [
  'run',
  'test:run',
  '--',
  'src/__tests__/meta-app-review-p0-smoke.test.ts',
]);

run('web zero-portfolio invite branch', join(root, 'apps/web'), 'npm', [
  'run',
  'test:run',
  '--',
  'src/components/client-auth/__tests__/MetaAssetSelector.business-creation.test.tsx',
  '-t',
  'zero Business Portfolio',
]);

run('web ZeroPortfolioPageDiscovery component', join(root, 'apps/web'), 'npm', [
  'run',
  'test:run',
  '--',
  'src/components/client-auth/__tests__/ZeroPortfolioPageDiscovery.test.tsx',
]);

run('review-demo recording harness wiring', root, 'node', [
  '--test',
  'scripts/tests/review-demo-recording.test.mjs',
]);

console.log('Meta App Review P0 smoke: all gates passed');
