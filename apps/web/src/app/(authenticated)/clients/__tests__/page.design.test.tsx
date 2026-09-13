/**
 * Clients Page Design System Compliance Tests
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const COMPONENT_PATH = resolve(__dirname, '../page.tsx');

function readComponent(): string {
  return readFileSync(COMPONENT_PATH, 'utf-8');
}

describe('Clients Page - Static Design Validation', () => {
  it('should not have double-negative translate (hover:-translate-y-[-Npx])', () => {
    const code = readComponent();
    expect(code).not.toMatch(/hover:-translate-y-\[-/);
  });

  it('should not use rgb(var()) inside Tailwind arbitrary values', () => {
    const code = readComponent();
    expect(code).not.toMatch(/shadow-\[.*rgb\(var\(/);
  });

  it('should keep client cards border-only and static (feedback on controls, not containers)', () => {
    const code = readComponent();
    // Craft plan P1: list containers are border-led with no resting shadow
    // or hover motion; interaction feedback lives on links and buttons.
    expect(code).toMatch(/border border-black\/10 bg-card p-6/);
    expect(code).not.toMatch(/hover:(?:-)?translate-y/);
    expect(code).not.toMatch(/transition-all/);
  });
});
