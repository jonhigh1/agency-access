import { describe, it, expect } from 'vitest';

describe('PlanComparison layout classes', () => {
  it('uses responsive grid without horizontal scroll', () => {
    const fs = require('fs');
    const componentCode = fs.readFileSync(
      'src/components/settings/billing/plan-comparison.tsx',
      'utf-8'
    );

    expect(componentCode).toContain('lg:grid-cols-2 xl:grid-cols-3');
    expect(componentCode).not.toContain('overflow-x-auto');
    expect(componentCode).not.toContain('min-w-[280px]');
  });

  it('keeps most popular badge inside card bounds', () => {
    const fs = require('fs');
    const componentCode = fs.readFileSync(
      'src/components/settings/billing/plan-comparison.tsx',
      'utf-8'
    );

    expect(componentCode).not.toContain('-top-3');
    expect(componentCode).not.toContain('-right-3');
  });

  it('carries no resting shadows, hero font, or generic greys (KTD8)', () => {
    const fs = require('fs');
    const componentCode = fs.readFileSync(
      'src/components/settings/billing/plan-comparison.tsx',
      'utf-8'
    );

    expect(componentCode).not.toContain('shadow-brutalist');
    expect(componentCode).not.toContain('font-dela');
    expect(componentCode).not.toContain('gray-');
    expect(componentCode).not.toContain('indigo-');
    expect(componentCode).not.toContain('slate-');
  });

  it('keeps tier names and prices sourced from shared pricing constants', () => {
    const fs = require('fs');
    const componentCode = fs.readFileSync(
      'src/components/settings/billing/plan-comparison.tsx',
      'utf-8'
    );

    expect(componentCode).toContain('PRICING_DISPLAY_TIER_ORDER');
    expect(componentCode).toContain('PRICING_DISPLAY_TIER_DETAILS');
    expect(componentCode).not.toMatch(/'\$\d+\/mo'/);
  });
});
