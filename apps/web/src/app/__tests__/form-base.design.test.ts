import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Design contract for the global form-control base (DESIGN_SYSTEM.md,
 * "Forms & Inputs"): the base input style lives in globals.css and must be a
 * 1px ink border, square, with the documented two-ring focus. The v2 walker
 * tests walk component sources, not globals.css, so this pins the one rule
 * block where a raw <input> gets its visibility from.
 *
 * Regression: the base carried `border-border` (color only) with no border
 * width, so Tailwind preflight's border-width: 0 left every raw input with no
 * visible edge — invisible on the paper card (intake form, 2026-09-29).
 */
const GLOBALS_PATH = join(__dirname, '..', 'globals.css');

function readFormBaseBlock(): string {
  const css = readFileSync(GLOBALS_PATH, 'utf8');
  const start = css.indexOf('input[type="text"]');
  expect(start, 'globals.css must style input[type="text"]').toBeGreaterThan(-1);
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

describe('globals form-control base matches the v2 Forms & Inputs spec', () => {
  it('draws a 1px ink border so raw inputs are visible', () => {
    const block = readFormBaseBlock();
    // Width+style: `border` (1px solid) with the ink edge color.
    expect(block).toMatch(/@apply[^;]*\bborder\b/);
    expect(block).toMatch(/@apply[^;]*border-black\b/);
  });

  it('is square — binary radius, no rounded-world values', () => {
    const block = readFormBaseBlock();
    expect(block).toMatch(/rounded-none/);
    expect(block).not.toMatch(/rounded-md|rounded-lg|rounded-xl/);
  });
});
