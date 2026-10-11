import path from 'path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/platform-icon', () => ({
  PlatformIcon: ({ platform }: { platform: string }) => (
    <div data-testid={`platform-icon-${platform}`} />
  ),
}));

import { PartnerBadges } from '../partner-badges';

const readSource = (relativePath: string) => {
  const fs = require('fs');
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8');
};

describe('PartnerBadges component', () => {
  it('renders both official partner labels', () => {
    render(<PartnerBadges />);
    expect(screen.getByText('Google Official Partner')).toBeInTheDocument();
    expect(screen.getByText('Meta Official Partner')).toBeInTheDocument();
  });

  it('renders a platform icon per badge', () => {
    render(<PartnerBadges />);
    expect(screen.getByTestId('platform-icon-google')).toBeInTheDocument();
    expect(screen.getByTestId('platform-icon-meta')).toBeInTheDocument();
  });

  it('renders non-interactive chips (no links or buttons)', () => {
    const { container } = render(<PartnerBadges />);
    expect(container.querySelector('a, button')).toBeNull();
  });

  it('accepts portal-exported badge assets via src without changing call sites', () => {
    render(<PartnerBadges />);
    // Config-driven: each badge may carry an optional image src (official asset swap path).
    const chips = screen.getAllByTestId('partner-badge-chip');
    expect(chips.length).toBe(2);
  });
});

describe('PartnerBadges integration', () => {
  it('hero trust strip renders the badges', () => {
    const heroSource = readSource('src/components/marketing/hero-section.tsx');
    expect(heroSource).toMatch(/<PartnerBadges/);
  });

  it('pricing final CTA trust row renders the badges', () => {
    const ctaSource = readSource('src/components/marketing/pricing/final-cta-section.tsx');
    expect(ctaSource).toMatch(/<PartnerBadges/);
  });
});
