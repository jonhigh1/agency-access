// @vitest-environment node
import path from 'path';
import { describe, expect, it } from 'vitest';

const readFile = (relativePath: string) => {
  const fs = require('fs');
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8');
};

describe('Marketing copy claims', () => {
  it('removes all 50+ agencies claims from core marketing pages', () => {
    const files = [
      'src/components/marketing/hero-section.tsx',
      'src/components/marketing/cta-section.tsx',
      'src/components/marketing/how-it-works-section.tsx',
      'src/components/marketing/pricing/final-cta-section.tsx',
      'src/app/(marketing)/blog/[slug]/page.tsx',
      'src/components/blog/blog-content.tsx',
      'src/lib/blog-data.ts',
    ];

    files.forEach((file) => {
      const code = readFile(file);
      expect(code).not.toMatch(/50\+\s*agencies/i);
      expect(code).not.toMatch(/50\+\s*Marketing\s*Agencies/i);
    });
  });

  it('uses value-focused highlights in the scrolling social banner', () => {
    const code = readFile('src/components/marketing/social-proof-section.tsx');

    expect(code).toMatch(/One Link/);
    expect(code).toMatch(/Built-In Token Refresh/);
    expect(code).toMatch(/White-Label/);
    expect(code).toMatch(/Audit Logs Included/);
    expect(code).toMatch(/5-minute flow/);
  });
});
