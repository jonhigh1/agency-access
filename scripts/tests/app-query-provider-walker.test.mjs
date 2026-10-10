/**
 * App Router QueryClient provider-ancestry walker (plan:
 * docs/plans/2026-10-09-fix-queryclient-provider-boundary-gates-plan.md U2).
 *
 * Scans apps/web/src/app for pages/layouts that import React Query hooks or
 * useUserAgency. Each consumer must sit under a layout that wraps
 * AppProviders, or self-provide QueryClientProvider / AppProviders.
 *
 * Catches the #155 failure mode: useUserAgency on /invite after the March
 * provider split, with no layout AppProviders wrap.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const APP_ROOT = 'apps/web/src/app';
const APP_PROVIDERS_FILE = `${APP_ROOT}/app-providers.tsx`;

const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'coverage', 'dist', 'evidence']);
const SKIP_SUFFIXES = ['.test.ts', '.test.tsx', '.d.ts'];

/**
 * Allowlist — empty on the green tree. Keys are repo-relative paths with
 * forward slashes. An entry whose file is no longer a consumer (or is now
 * covered by ancestry) fails as STALE.
 */
const ALLOWLIST = {};

function toForward(relPath) {
  return relPath.split(sep).join('/');
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (match) => match.replace(/[^\n]/g, ' '));
}

/**
 * Over-inclusive consumer detector: useUserAgency value import, or any
 * non-type-only @tanstack/react-query import (hooks or QueryClient).
 */
function isQueryConsumer(cleanSource) {
  if (/\bimport\s+(?:type\s+)?\{[^}]*\buseUserAgency\b[^}]*\}\s+from\s+['"]@\/hooks\/use-user-agency['"]/.test(
    cleanSource
  )) {
    return true;
  }
  if (/\bimport\s+\{[^}]*\buseUserAgency\b[^}]*\}\s+from\s+['"]@\/hooks\/use-user-agency['"]/.test(
    cleanSource
  )) {
    return true;
  }
  // Any value import from @tanstack/react-query (not `import type`).
  if (
    /\bimport\s+(?!type\b)(?:[\w*{].*?\s+from\s+)?['"]@tanstack\/react-query['"]/.test(cleanSource) ||
    /\bimport\s+(?!type\b)\{[^}]*\}\s+from\s+['"]@tanstack\/react-query['"]/.test(cleanSource)
  ) {
    return true;
  }
  return false;
}

function providesOwnQueryClient(cleanSource) {
  return (
    /\bQueryClientProvider\b/.test(cleanSource) ||
    (/\bAppProviders\b/.test(cleanSource) && /\bapp-providers\b/.test(cleanSource))
  );
}

function layoutProvidesAppProviders(layoutAbsPath) {
  if (!existsSync(layoutAbsPath)) return false;
  const clean = stripComments(readFileSync(layoutAbsPath, 'utf8'));
  return /\bAppProviders\b/.test(clean) && /\bapp-providers\b/.test(clean);
}

/**
 * Walk dirname(file) up through APP_ROOT looking for layout.tsx/ts that
 * imports AppProviders. The file's own directory is included (route-group
 * layout next to page.tsx).
 */
function hasAncestorAppProviders(relForwardPath) {
  let dir = dirname(relForwardPath);
  const appRootForward = APP_ROOT;
  while (dir === appRootForward || dir.startsWith(`${appRootForward}/`)) {
    for (const name of ['layout.tsx', 'layout.ts']) {
      const layoutRel = `${dir}/${name}`;
      if (layoutProvidesAppProviders(join(ROOT, layoutRel))) {
        return layoutRel;
      }
    }
    if (dir === appRootForward) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function isSkipped(relForward) {
  const segments = relForward.split('/');
  if (segments.some((segment) => SKIP_SEGMENTS.has(segment))) return true;
  if (SKIP_SUFFIXES.some((suffix) => relForward.endsWith(suffix))) return true;
  if (relForward === APP_PROVIDERS_FILE) return true;
  return false;
}

function collectAppFiles(relDir, out) {
  const absDir = join(ROOT, relDir);
  for (const entry of readdirSync(absDir)) {
    const absPath = join(absDir, entry);
    const relPath = relative(ROOT, absPath);
    const relForward = toForward(relPath);
    if (isSkipped(relForward)) continue;
    if (statSync(absPath).isDirectory()) {
      collectAppFiles(relForward, out);
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(relForward);
    }
  }
  return out;
}

function findUncoveredConsumers(files) {
  const uncovered = [];
  const covered = [];
  for (const relForward of files) {
    const clean = stripComments(readFileSync(join(ROOT, relForward), 'utf8'));
    if (!isQueryConsumer(clean)) continue;
    if (providesOwnQueryClient(clean)) {
      covered.push({ file: relForward, via: 'self-provider' });
      continue;
    }
    const ancestor = hasAncestorAppProviders(relForward);
    if (ancestor) {
      covered.push({ file: relForward, via: ancestor });
      continue;
    }
    uncovered.push(relForward);
  }
  return { uncovered, covered };
}

test('detectors: consumer, self-provider, and ancestry helpers', () => {
  assert.equal(
    isQueryConsumer(stripComments(`import { useUserAgency } from '@/hooks/use-user-agency';`)),
    true
  );
  assert.equal(
    isQueryConsumer(
      stripComments(`import { fetchActiveAgencyPlatformConnections } from '@/hooks/use-user-agency';`)
    ),
    false
  );
  assert.equal(
    isQueryConsumer(stripComments(`import { useQuery } from '@tanstack/react-query';`)),
    true
  );
  assert.equal(
    isQueryConsumer(stripComments(`import type { QueryClient } from '@tanstack/react-query';`)),
    false
  );
  assert.equal(
    providesOwnQueryClient(
      stripComments(`import { QueryClient, QueryClientProvider } from '@tanstack/react-query';`)
    ),
    true
  );
  assert.equal(
    providesOwnQueryClient(
      stripComments(`import { AppProviders } from '../app-providers';\nreturn <AppProviders>{c}</AppProviders>;`)
    ),
    true
  );
});

test('repo scan: every App Router RQ consumer has AppProviders ancestry', () => {
  const files = collectAppFiles(APP_ROOT, []);

  assert.ok(
    files.length > 40,
    `walker collected only ${files.length} app files — scan root is wrong`
  );

  const { uncovered, covered } = findUncoveredConsumers(files);

  const unallowlisted = uncovered.filter((file) => !ALLOWLIST[file]);
  const stale = Object.keys(ALLOWLIST).filter((key) => !uncovered.includes(key));

  assert.deepEqual(
    unallowlisted,
    [],
    `Uncovered QueryClient consumers — wrap an ancestor layout in AppProviders or self-provide:\n  ${unallowlisted.join('\n  ')}`
  );
  assert.deepEqual(
    stale,
    [],
    `STALE allowlist entries — the consumer is covered or gone, prune the entry:\n  ${stale.join('\n  ')}`
  );

  // Characterization: invite page is covered via invite/layout.tsx (the #155 fix).
  const inviteCover = covered.find((entry) =>
    entry.file.endsWith('invite/[token]/client-invite-page.tsx')
  );
  assert.ok(inviteCover, 'invite client page must be a covered RQ consumer');
  assert.equal(
    inviteCover.via,
    `${APP_ROOT}/invite/layout.tsx`,
    'invite coverage must come from invite/layout.tsx AppProviders wrap'
  );
});

test('characterization: invite layout without AppProviders would uncover the page', () => {
  const invitePage = `${APP_ROOT}/invite/[token]/client-invite-page.tsx`;
  const inviteLayout = `${APP_ROOT}/invite/layout.tsx`;
  const pageSource = stripComments(readFileSync(join(ROOT, invitePage), 'utf8'));
  const layoutSource = readFileSync(join(ROOT, inviteLayout), 'utf8');

  assert.equal(isQueryConsumer(pageSource), true);
  assert.match(layoutSource, /AppProviders/);
  assert.match(layoutSource, /app-providers/);

  // Simulate removing the wrap: ancestry from invite/[token] would miss AppProviders.
  // Root app layout does not provide it (March split).
  const rootLayout = join(ROOT, APP_ROOT, 'layout.tsx');
  assert.ok(existsSync(rootLayout));
  assert.equal(
    layoutProvidesAppProviders(rootLayout),
    false,
    'root layout must not wrap AppProviders (route-level split)'
  );
});
