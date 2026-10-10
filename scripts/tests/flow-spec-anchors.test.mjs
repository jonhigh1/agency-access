/**
 * Flow-spec anchor walker (2026-10-09).
 *
 * docs/flows/*.md are the agent-facing flow specs. Every load-bearing claim
 * ends in a Sources bullet of the form:
 *
 *   - path/to/file.ts:LINE — "quoted fragment from that line"
 *
 * This walker fails when a spec rots: a missing file, a line number out of
 * range, or a fragment that no longer appears within +-5 lines of its anchor.
 * It also carries an anti-vacuous guard: the spec set must exist and hold a
 * minimum number of anchors, so an empty or renamed docs/flows/ cannot pass
 * vacuously. Run: node --test scripts/tests/flow-spec-anchors.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SPEC_DIR = join(ROOT, 'docs', 'flows');

// +-5 lines of tolerance: anchors record where a fact lived when written; a
// few edited lines above it must not flip the spec to red, but a moved
// function or a rewritten line must.
const LINE_TOLERANCE = 5;

// Anchors are written in Sources sections as:
//   - <repo-relative path>:<line> — "<fragment>"
const ANCHOR_RE =
  /^- ([\w@./[\]-]+\.(?:ts|tsx|mts|mjs|json|md)):(\d+) — "(.+)"\s*$/;

function loadSpecFiles() {
  if (!existsSync(SPEC_DIR)) return [];
  return readdirSync(SPEC_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((name) => ({
      name,
      path: join(SPEC_DIR, name),
      text: readFileSync(join(SPEC_DIR, name), 'utf8'),
    }));
}

function parseAnchors(spec) {
  const anchors = [];
  spec.text.split('\n').forEach((line, idx) => {
    const m = line.match(ANCHOR_RE);
    if (!m) return;
    anchors.push({
      spec: spec.name,
      specLine: idx + 1,
      file: m[1],
      line: Number(m[2]),
      fragment: m[3],
    });
  });
  return anchors;
}

test('flow specs exist and are non-empty (anti-vacuous)', () => {
  const specs = loadSpecFiles();
  assert.ok(specs.length >= 3, `expected >=3 specs in docs/flows, found ${specs.length}: ${specs.map((s) => s.name).join(', ')}`);
  const total = specs.reduce((n, s) => n + parseAnchors(s).length, 0);
  assert.ok(total >= 25, `expected >=25 anchors across flow specs, found ${total}`);
});

test('every flow-spec Sources anchor resolves to live source', () => {
  const specs = loadSpecFiles();
  const failures = [];

  for (const spec of specs) {
    for (const a of parseAnchors(spec)) {
      const abs = join(ROOT, a.file);
      if (!existsSync(abs)) {
        failures.push(`${a.spec}:${a.specLine} -> missing file ${a.file}`);
        continue;
      }
      const lines = readFileSync(abs, 'utf8').split('\n');
      if (a.line < 1 || a.line > lines.length) {
        failures.push(`${a.spec}:${a.specLine} -> ${a.file}:${a.line} out of range (file has ${lines.length} lines)`);
        continue;
      }
      const from = Math.max(0, a.line - 1 - LINE_TOLERANCE);
      const to = Math.min(lines.length, a.line + LINE_TOLERANCE);
      const window = lines.slice(from, to).join('\n');
      if (!window.includes(a.fragment)) {
        failures.push(
          `${a.spec}:${a.specLine} -> fragment not found near ${a.file}:${a.line}: "${a.fragment}"`
        );
      }
    }
  }

  assert.deepEqual(failures, [], `stale flow-spec anchors:\n${failures.join('\n')}`);
});

test('every spec carries a Sources section; README owns the ground-truth ordering', () => {
  const specs = loadSpecFiles();
  const readme = specs.find((s) => s.name === 'README.md');
  assert.ok(readme, 'docs/flows/README.md is required (index + ground-truth ordering)');
  assert.match(readme.text, /## Ground-truth ordering/, 'README must state the ground-truth ordering');
  for (const spec of specs) {
    if (spec.name === 'README.md') continue;
    assert.match(spec.text, /## Sources/, `${spec.name} is missing a Sources section`);
  }
});
