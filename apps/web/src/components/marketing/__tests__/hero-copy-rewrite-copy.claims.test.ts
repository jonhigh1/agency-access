// @vitest-environment node
import path from 'path';
import { describe, expect, it } from 'vitest';

const readFile = (relativePath: string) => {
  const fs = require('fs');
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8');
};

describe('Hero copy rewrite preview copy guardrails', () => {
  it('states the audience, product, use case, supported platforms, and CTA hierarchy in the hero', () => {
    const code = readFile(
      'src/components/marketing/hero-copy-rewrite/hero-copy-rewrite-hero-section.tsx'
    );

    expect(code).toMatch(/small agency owners and operators/i);
    expect(code).toMatch(/client onboarding/i);
    expect(code).toMatch(/one branded link/i);
    expect(code).toMatch(/Meta/i);
    expect(code).toMatch(/Google Ads/i);
    expect(code).toMatch(/GA4/i);
    expect(code).toMatch(/LinkedIn/i);
    expect(code).toMatch(/Start Free Trial/);
    expect(code).toMatch(/Schedule Demo/);
    expect(code.indexOf('Start Free Trial')).toBeLessThan(code.indexOf('Schedule Demo'));
  });

  it('preserves the existing Pillar AI case study proof points', () => {
    const code = readFile(
      'src/components/marketing/hero-copy-rewrite/hero-copy-rewrite-case-study-section.tsx'
    );

    expect(code).toMatch(/Pillar AI Agency/);
    expect(code).toMatch(/AJ S\./);
    expect(code).toMatch(/Co-Founder/);
    expect(code).toMatch(/2-3 days/);
    expect(code).toMatch(/< 5 min/);
    expect(code).toMatch(/1 week/);
    expect(code).toMatch(/Same day/);
    expect(code).toMatch(/12/);
    expect(code).toMatch(/38/);
  });

  it('removes unsupported hype, compliance, and weak proof claims from the preview components', () => {
    const files = [
      'src/components/marketing/hero-copy-rewrite/hero-copy-rewrite-hero-section.tsx',
      'src/components/marketing/hero-copy-rewrite/hero-copy-rewrite-social-proof-section.tsx',
      'src/components/marketing/hero-copy-rewrite/hero-copy-rewrite-problem-section.tsx',
      'src/components/marketing/hero-copy-rewrite/hero-copy-rewrite-solution-section.tsx',
      'src/components/marketing/hero-copy-rewrite/hero-copy-rewrite-value-props-section.tsx',
      'src/components/marketing/hero-copy-rewrite/hero-copy-rewrite-integrations-section.tsx',
      'src/components/marketing/hero-copy-rewrite/hero-copy-rewrite-how-it-works-section.tsx',
      'src/components/marketing/hero-copy-rewrite/hero-copy-rewrite-case-study-section.tsx',
      'src/components/marketing/hero-copy-rewrite/hero-copy-rewrite-final-cta-section.tsx',
    ];

    files.forEach((file) => {
      const code = readFile(file);

      expect(code).not.toMatch(/#1/i);
      expect(code).not.toMatch(/hundreds of hours/i);
      expect(code).not.toMatch(/10x\s*faster/i);
      expect(code).not.toMatch(/30\+\s*Emails/i);
      expect(code).not.toMatch(/100%\s*Completion/i);
      expect(code).not.toMatch(/99\.9%/i);
      expect(code).not.toMatch(/SOC\s*2/i);
      expect(code).not.toMatch(/Type II/i);
      expect(code).not.toMatch(/\$600\+/i);
    });
  });
});
