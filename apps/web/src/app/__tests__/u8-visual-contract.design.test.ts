import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('U8 visual consistency contracts', () => {
  it('keeps static client and partner cards free of resting elevation', () => {
    const staticSurfaces = [
      source('src/components/client-detail/ClientDetailHeader.tsx'),
      source('src/components/client-detail/ClientStats.tsx'),
      source('src/app/(authenticated)/access-requests/[id]/edit/page.tsx'),
      source('src/components/affiliate/affiliate-ledger-table.tsx'),
      source('src/components/affiliate/affiliate-metric-card.tsx'),
      source('src/components/affiliate/affiliate-surface-card.tsx'),
      source('src/components/manual-invitation-modal.tsx'),
      source('src/app/(partner)/partners/page.tsx'),
    ].join('\n');

    expect(staticSurfaces).not.toMatch(/shadow-(?:sm|brutalist(?:-sm|-lg)?|xl|2xl)/);
    expect(staticSurfaces).not.toMatch(/hover:shadow-/);
  });

  it('keeps diagnostic and checkout surfaces on the documented tokens', () => {
    const tokenHealth = source('src/app/(authenticated)/token-health/page.tsx');
    const checkout = [
      source('src/app/checkout/success/page.tsx'),
      source('src/app/checkout/cancel/page.tsx'),
    ].join('\n');
    const redirect = source('src/app/settings/platforms/page.tsx');
    const clientLoading = source('src/app/(authenticated)/clients/[id]/loading.tsx');

    expect(tokenHealth).not.toMatch(/text-slate-|text-indigo-/);
    expect(checkout).not.toMatch(/from-(?:green|amber|orange)-|text-gray-|bg-gradient|shadow-xl|duration: 0\.5/);
    expect(redirect).not.toMatch(/indigo/);
    expect(clientLoading).not.toMatch(/slate-|shadow-sm|rounded-lg/);
  });

  it('keeps comparison colors and resting surfaces within the shared palette', () => {
    const comparison = source('src/components/programmatic/ComparisonPageTemplate.tsx');

    expect(comparison).not.toMatch(/#[0-9A-Fa-f]{3,8}/);
    expect(comparison).not.toMatch(/shadow-\[(?:0_|3px|4px)/);
    expect(comparison).not.toMatch(/text-\[#(?:4ECDC4|45B3A8|EA7A49|FF6B35)\]/);
  });

  it('keeps routine headings and refresh actions out of danger semantics', () => {
    const onboarding = source('src/components/onboarding/screens/agency-profile-screen.tsx');
    const tokenHealth = source('src/app/(authenticated)/token-health/page.tsx');
    const partner = source('src/app/(partner)/partners/page.tsx');

    expect(onboarding).not.toMatch(/formatOnboardingStepLabel\(1\)[\s\S]{0,80}text-danger-ink/);
    expect(tokenHealth).not.toMatch(/handleRefresh\(token\.id[\s\S]{0,120}text-danger-ink/);
    expect(partner).not.toMatch(/text-danger-ink">Partner Portal/);
  });

  it('uses sentence case for the remaining settings labels and actions', () => {
    const general = source('src/components/settings/general/agency-profile-card.tsx');
    const webhooks = source('src/components/settings/webhooks/webhook-settings-tab.tsx');

    expect(general).not.toMatch(/title="Agency Profile"|label="Agency Name"|label="Company Website"/);
    expect(webhooks).not.toMatch(/title="Webhook Endpoint"|Save Endpoint|Create Endpoint|title="Recent Deliveries"/);
  });
});
