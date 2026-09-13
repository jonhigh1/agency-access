/**
 * PlatformIcon Design System Compliance Tests
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const COMPONENT_PATH = resolve(__dirname, '../platform-icon.tsx');

function readComponent(): string {
  return readFileSync(COMPONENT_PATH, 'utf-8');
}

describe('PlatformIcon - Static Design Validation', () => {
  it('should not contain slate colors', () => {
    const code = readComponent();
    expect(code).not.toContain('slate-');
  });

  it('should use design tokens for fallback colors', () => {
    const code = readComponent();
    expect(code).toMatch(/text-muted-foreground/);
    expect(code).toMatch(/text-foreground/);
  });

  it('fallback container is square (binary radius)', () => {
    // Brandfetch logos are square assets; the fallback tile must match the
    // binary radius contract (square or circular, nothing between).
    const code = readComponent();
    expect(code).not.toContain('rounded-lg');
    expect(code).toContain('rounded-none');
  });
});
