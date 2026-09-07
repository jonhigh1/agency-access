import path from 'path';
import { describe, expect, it } from 'vitest';

const readFile = (relativePath: string) => {
  const fs = require('fs');
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8');
};

const FORBIDDEN = [/SOC\s*2/i, /Type\s*II/i, /unlimited clients/i, /authhub\.com\/agency/i];

describe('Marketing honesty guardrails', () => {
  const homepageFiles = [
    'src/components/ui/combined-featured-section.tsx',
    'src/components/marketing/homepage-faq-section.tsx',
    'src/components/marketing/solution-section-new.tsx',
    'src/components/marketing/how-it-works-section.tsx',
    'src/components/marketing/pricing/faq-section.tsx',
    'src/components/programmatic/ComparisonPageTemplate.tsx',
    'src/app/(marketing)/contact/page.tsx',
  ];

  homepageFiles.forEach((file) => {
    it(`removes SOC 2, unlimited clients, and authhub.com illustrative URLs from ${file}`, () => {
      const code = readFile(file);
      FORBIDDEN.forEach((pattern) => {
        expect(code).not.toMatch(pattern);
      });
    });
  });

  it('uses authhub.co in illustrative link previews', () => {
    const code = readFile('src/components/marketing/solution-section-new.tsx');
    expect(code).toMatch(/authhub\.co\/agency/);
  });

  it('clarifies yearly equivalent pricing on tier cards', () => {
    const code = readFile('src/components/marketing/pricing/pricing-tier-card.tsx');
    expect(code).toMatch(/\/mo equiv\./);
    expect(code).toMatch(/billed yearly/);
  });

  it('contact FAQ references 14-day trial instead of free plan', () => {
    const code = readFile('src/app/(marketing)/contact/page.tsx');
    expect(code).toMatch(/14-day free trial/i);
    expect(code).not.toMatch(/Free plan/i);
  });
});
