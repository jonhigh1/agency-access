// @vitest-environment node
import path from 'path';
import { describe, expect, it } from 'vitest';

const readFile = (relativePath: string) => {
  const fs = require('fs');
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8');
};

describe('Pricing page copy claims', () => {
  it('removes agency-count social proof language in pricing surfaces', () => {
    const files = [
      'src/components/marketing/pricing/metric-banner.tsx',
      'src/components/marketing/success-stories-section.tsx',
      'src/components/marketing/pricing/savings-calculator.tsx',
      'src/components/marketing/pricing/pricing-tiers.tsx',
      'src/components/marketing/pricing/faq-section.tsx',
      'src/app/(marketing)/pricing/page.tsx',
    ];

    files.forEach((file) => {
      const code = readFile(file);
      expect(code).not.toMatch(/Agencies Onboarded/);
      expect(code).not.toMatch(/agencies like yours/i);
      expect(code).not.toMatch(/Most agencies/i);
    });
  });

  it('uses value-focused language and real production counters (no estimates)', () => {
    const metricCode = readFile('src/components/marketing/pricing/metric-banner.tsx');
    const tiersCode = readFile('src/components/marketing/pricing/pricing-tiers.tsx');
    const toggleCode = readFile('src/components/marketing/pricing/pricing-toggle.tsx');

    expect(metricCode).toMatch(/OAuth Success Rate/);
    expect(metricCode).toMatch(/99\.9/);
    // Counters are props-driven from the production aggregate (getMarketingStats).
    expect(metricCode).toMatch(/stats\?/);
    expect(metricCode).toMatch(/Active Platform Connections/);
    expect(metricCode).toMatch(/Tokens Auto-Refreshed/);
    // Estimated ranges are gone for good.
    expect(metricCode).not.toMatch(/Estimated Hours Saved/i);
    expect(metricCode).not.toMatch(/Estimated Emails Reduced/i);
    expect(metricCode).not.toMatch(/displayValue:\s*'2-4'/);
    expect(metricCode).not.toMatch(/displayValue:\s*'15-30'/);
    expect(metricCode).not.toMatch(/Saved for Clients/);
    expect(metricCode).not.toMatch(/Hours Reclaimed/);
    expect(tiersCode).toMatch(/fits your team/i);
    expect(toggleCode).toMatch(/Save ~17%/);
    expect(toggleCode).not.toMatch(/Save 25%/);
  });
});
