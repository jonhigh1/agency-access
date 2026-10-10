/**
 * Platform-id walker (DEC-015 Phase 3, 2026-10-09).
 *
 * Scans non-test source under packages/shared/src, apps/api/src, and
 * apps/web/src for hand-typed platform-id sets: runs of >= 3 quoted registry
 * ids separated only by commas/whitespace, and switch dispatches with >= 3
 * distinct `case '<id>'` branches. Every violation must sit in the allowlist
 * below, and every allowlist entry must still have a live violation (the
 * STALE check), so the list shrinks as files migrate to registry derivations.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// scripts/tests -> repo root. Resolve the module's directory URL first, then
// pop two levels; a wrong depth makes the scan vacuously empty, which the
// anti-vacuous guard below catches.
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

// Frozen from PLATFORMS (packages/shared/src/platforms/registry.ts, DEC-015).
// The shared golden (platform-registry.golden.test.ts) pins the same 28 ids.
const KNOWN_PLATFORM_IDS = [
  'google',
  'meta',
  'google_ads',
  'ga4',
  'meta_ads',
  'meta_pages',
  'tiktok',
  'tiktok_ads',
  'linkedin',
  'linkedin_ads',
  'linkedin_pages',
  'snapchat',
  'snapchat_ads',
  'instagram',
  'kit',
  'beehiiv',
  'mailchimp',
  'pinterest',
  'klaviyo',
  'shopify',
  'zapier',
  'google_tag_manager',
  'google_merchant_center',
  'google_search_console',
  'google_business_profile',
  'whatsapp_business',
  'youtube_studio',
  'display_video_360',
];

const SCAN_ROOTS = ['packages/shared/src', 'apps/api/src', 'apps/web/src'];
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'coverage', 'dist', 'evidence']);
const SKIP_SUFFIXES = ['.test.ts', '.test.tsx', '.d.ts'];
// The sanctioned home of set literals, plus the shared barrel that re-exports it.
const SANCTIONED_DIR = 'packages/shared/src/platforms';
const SANCTIONED_FILE = 'packages/shared/src/index.ts';

// Longest-first alternation so google_ads wins over the google prefix.
const ID_ALTERNATION = [...KNOWN_PLATFORM_IDS].sort((a, b) => b.length - a.length).join('|');
const QUOTED_RUN_RE = new RegExp(`['"](?:${ID_ALTERNATION})['"]`, 'g');

/**
 * Blank out comments one character at a time, keeping every newline, so
 * both match offsets and line numbers survive stripping. Approximation:
 * template literals containing `//` get blanked too, acceptable for a
 * heuristic detector.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (match) => match.replace(/[^\n]/g, ' '));
}

/**
 * Detector A — quoted runs: >= 3 consecutive quoted known ids whose gaps
 * hold only commas/whitespace. Returns [{ index, count }]: the first match's
 * offset and the number of ids in the run.
 */
function findQuotedRuns(clean) {
  const matches = [...clean.matchAll(QUOTED_RUN_RE)];
  const runs = [];
  let current = null;
  for (let i = 1; i < matches.length; i++) {
    const previous = matches[i - 1];
    const gap = clean.slice(previous.index + previous[0].length, matches[i].index);
    if (/^\s*,\s*$/.test(gap)) {
      if (!current) current = { index: previous.index, count: 1 };
      current.count += 1;
    } else if (current) {
      runs.push(current);
      current = null;
    }
  }
  if (current) runs.push(current);
  return runs.filter((run) => run.count >= 3);
}

/**
 * Detector B — switch dispatch: >= 3 distinct known ids appearing as
 * `case '<id>'` branches. Returns { index, distinct } or null.
 */
function findSwitchDispatch(clean) {
  const distinct = new Set();
  let firstIndex = Infinity;
  for (const id of KNOWN_PLATFORM_IDS) {
    const caseRe = new RegExp(`\\bcase\\s*['"]${id}['"]`, 'g');
    let match;
    while ((match = caseRe.exec(clean)) !== null) {
      distinct.add(id);
      if (match.index < firstIndex) firstIndex = match.index;
    }
  }
  return distinct.size >= 3 ? { index: firstIndex, distinct: distinct.size } : null;
}

function isSkipped(relPath) {
  const segments = relPath.split(sep);
  if (segments.some((segment) => SKIP_SEGMENTS.has(segment))) return true;
  if (SKIP_SUFFIXES.some((suffix) => relPath.endsWith(suffix))) return true;
  const relForward = segments.join('/');
  if (relForward === SANCTIONED_FILE) return true;
  return relForward.startsWith(`${SANCTIONED_DIR}/`);
}

function collectFiles(relDir, out) {
  const absDir = join(ROOT, relDir);
  for (const entry of readdirSync(absDir)) {
    const absPath = join(absDir, entry);
    const relPath = relative(ROOT, absPath);
    if (isSkipped(relPath)) continue;
    if (statSync(absPath).isDirectory()) {
      collectFiles(relPath, out);
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(relPath);
    }
  }
  return out;
}

function lineOf(clean, index) {
  return 1 + (clean.slice(0, index).match(/\n/g) || []).length;
}

function scanFile(relPath) {
  const clean = stripComments(readFileSync(join(ROOT, relPath), 'utf8'));
  const violations = [];
  for (const run of findQuotedRuns(clean)) {
    violations.push({ kind: 'quoted-run', count: run.count, line: lineOf(clean, run.index) });
  }
  const dispatch = findSwitchDispatch(clean);
  if (dispatch) {
    violations.push({
      kind: 'switch-dispatch',
      count: dispatch.distinct,
      line: lineOf(clean, dispatch.index),
    });
  }
  return violations;
}

/**
 * Allowlist — every live violation, with its ruling. Keys are repo-relative
 * paths with forward slashes. An entry whose file no longer violates fails
 * as STALE, so pruned sets also prune their ruling.
 */
const ALLOWLIST = {
  // Legacy partition home pending registry migration: PLATFORM_CATEGORIES
  // (PQ-other-14, curated), SUPPORTED_CONNECTION_PLATFORMS (curated
  // Connections allowlist), ManualConfirmationPlatformSchema (partition;
  // registry owns it eventually).
  'packages/shared/src/types.ts': 'DEC-015 Phase 3, 2026-10-09',

  // Curated business subset, not a registry projection (includes group
  // tiktok, omits snapchat_ads). Allowlist-until-refactored.
  'apps/api/src/lib/asset-selecting-products.ts': 'DEC-015 Phase 3, 2026-10-09',

  // Curated identity-mode subset; derive only if a named domain flag
  // emerges (F3 ruling). Allowlist-until-refactored.
  'apps/api/src/services/identity-verification.service.ts': 'DEC-015 Phase 3, 2026-10-09',

  // Meta-family stale-grant check; derivable via registry parent refs
  // later. Allowlist-until-refactored.
  'apps/api/src/services/token-lifecycle.service.ts': 'DEC-015 Phase 3, 2026-10-09',

  // GOOGLE_NATIVE_ACCESS_PRODUCTS curated subset + grant dispatch switches.
  // Allowlist-until-refactored.
  'apps/api/src/routes/client-auth/assets.routes.ts': 'DEC-015 Phase 3, 2026-10-09',

  // getSelectedAssetCount + hasNoAssetsSignal live in
  // apps/api/src/lib/product-selection-signals.ts (unquoted-key table; review
  // card 2). LegacyPlatformSchema derives from LEGACY_PAYLOAD_IDS. Both prior
  // allowlist entries for access-request.service.ts and client.service.ts
  // were pruned in the same change.

  // getSelectedAssetCount + getProductSummaryLines + shouldPersistMetaProductSave
  // live in apps/web/src/lib/invite/product-selection-summary.ts (unquoted-key
  // tables; review card 3 U5). Prior allowlist entry for PlatformAuthWizard.tsx
  // was pruned in the same change.

  // EMAIL_INVITE_PLATFORMS curated quartet; semantics parked as
  // PQ-selector-4.
  'apps/web/src/lib/client-invite-platforms.ts': 'DEC-015 Phase 3, 2026-10-09',

  // verifyPlatformAccess lives in apps/api/src/lib/platform-verification-handlers.ts
  // (unquoted-key table; review card 2 U3). Prior allowlist entry for
  // authorization-verification.service.ts was pruned in the same change.

  // getAccountsForProduct lives behind an unquoted-key fetcher map in
  // google.ts (review card 5 U8). Prior allowlist entry pruned same change.

  // Per-product revoke dispatch: each google product has its own
  // offboarding API. Allowlist-until-refactored.
  'apps/api/src/services/google-offboarding-executor.ts': 'DEC-015 Phase 3, 2026-10-09',

  // Client-detail demo fixtures under __fixtures__: platforms[] rows must
  // look like real grants. Allowlist-forever.
  'apps/web/src/components/client-detail/__fixtures__/client-detail-fixtures.ts':
    'DEC-015 Phase 3, 2026-10-09',
};

test('detectors: runs, comments, and switch dispatches behave as specified', () => {
  // A 2-element comma run is NOT a violation.
  assert.deepEqual(findQuotedRuns(stripComments("const two = ['google', 'meta'];")), []);

  // A 3-element comma run IS a violation with count 3.
  const three = findQuotedRuns(stripComments("const three = ['google', 'meta', 'google_ads'];"));
  assert.equal(three.length, 1);
  assert.equal(three[0].count, 3);

  // The same ids inside a line comment are stripped before detection.
  assert.deepEqual(findQuotedRuns(stripComments("// ['google', 'meta', 'google_ads']")), []);

  // A switch over 3 distinct known ids IS flagged.
  const bigSwitch = [
    'function pick(id: string): string {',
    '  switch (id) {',
    "    case 'google': return 'google';",
    "    case 'meta': return 'meta';",
    "    case 'ga4': return 'google';",
    '    default: return id;',
    '  }',
    '}',
  ].join('\n');
  const dispatch = findSwitchDispatch(stripComments(bigSwitch));
  assert.ok(dispatch, 'a 3-case switch should be flagged');
  assert.equal(dispatch.distinct, 3);

  // A switch over 2 distinct known ids is NOT flagged.
  const smallSwitch = [
    'function pick(id: string): string {',
    '  switch (id) {',
    "    case 'google': return 'google';",
    "    case 'meta': return 'meta';",
    '    default: return id;',
    '  }',
    '}',
  ].join('\n');
  assert.equal(findSwitchDispatch(stripComments(smallSwitch)), null);
});

test('repo scan: no unallowlisted platform-id sets and no stale allowlist entries', () => {
  const files = SCAN_ROOTS.reduce((out, root) => collectFiles(root, out), []);

  // Anti-vacuous guard: the walk must actually see the repo. Real count at
  // seeding time was 562 files; roughly half keeps the guard meaningful.
  assert.ok(
    files.length > 250,
    `walker collected only ${files.length} files — the scan is pointing at the wrong root`
  );

  const violationsByFile = new Map();
  for (const relPath of files) {
    const key = relPath.split(sep).join('/');
    const violations = scanFile(relPath);
    if (violations.length > 0) violationsByFile.set(key, violations);
  }

  const unallowlisted = [];
  for (const [key, violations] of violationsByFile) {
    if (ALLOWLIST[key]) continue;
    for (const violation of violations) {
      const label =
        violation.kind === 'quoted-run' ? `run of ${violation.count}` : 'switch dispatch';
      unallowlisted.push(`${key}:${violation.line} (${label})`);
    }
  }

  const stale = Object.keys(ALLOWLIST).filter((key) => !violationsByFile.has(key));

  assert.deepEqual(
    unallowlisted,
    [],
    `Unallowlisted platform-id sets — migrate to a registry derivation or add a ruling:\n  ${unallowlisted.join('\n  ')}`
  );
  assert.deepEqual(
    stale,
    [],
    `STALE allowlist entries — the violation is gone, prune the entry:\n  ${stale.join('\n  ')}`
  );
});
