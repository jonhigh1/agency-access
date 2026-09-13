import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const webRoot = path.resolve(import.meta.dirname, '..', '..');
const srcRoot = path.join(webRoot, 'src');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(webRoot, relativePath), 'utf8');
}

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      collectSourceFiles(fullPath, acc);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
      acc.push(fullPath);
    }
  }
  return acc;
}

describe('shared user-agency cache', () => {
  const surfaces = [
    'src/app/(authenticated)/connections/page.tsx',
    'src/app/(authenticated)/access-requests/new/page.tsx',
    'src/components/settings/webhooks/webhook-settings-tab.tsx',
    'src/components/settings/agents/agents-settings-tab.tsx',
    'src/components/settings/general/agency-profile-card.tsx',
  ];

  it('uses useUserAgency on connections, settings, and the access-request wizard', () => {
    for (const relativePath of surfaces) {
      const source = read(relativePath);
      expect(source, relativePath).toContain("from '@/hooks/use-user-agency'");
      expect(source, relativePath).toContain('useUserAgency');
      expect(source, relativePath).not.toContain('settings-webhooks-agency');
      expect(source, relativePath).not.toContain('settings-agents-agency');
    }
  });

  it('does not issue a duplicate agencies lookup beside the shared hook', () => {
    for (const relativePath of surfaces) {
      const source = read(relativePath);
      expect(source, relativePath).not.toMatch(/authorizedApiFetch[\s\S]*\/api\/agencies\?clerkUserId=/);
    }
  });
});

describe('GTM placement', () => {
  it('does not inject GTM on the root or authenticated app layouts', () => {
    const rootLayout = read('src/app/layout.tsx');
    const authenticatedLayout = read('src/app/(authenticated)/layout.tsx');

    expect(rootLayout).not.toContain('GTM-KX7P9HTF');
    expect(rootLayout).not.toContain('googletagmanager.com');
    expect(authenticatedLayout).not.toContain('GTM-KX7P9HTF');
    expect(authenticatedLayout).not.toContain('googletagmanager.com');
  });

  it('injects GTM on marketing routes only', () => {
    const marketingLayout = read('src/app/(marketing)/layout.tsx');
    expect(marketingLayout).toContain('GoogleTagManager');
    expect(read('src/components/marketing/google-tag-manager.tsx')).toContain('GTM-KX7P9HTF');
  });
});

describe('third-party JS gating', () => {
  it('lazy-loads Sentry Replay instead of registering it at client init', () => {
    const source = fs.readFileSync(path.join(webRoot, 'sentry.client.config.ts'), 'utf8');
    expect(source).not.toMatch(/integrations:\s*\[Sentry\.replayIntegration\(\)\]/);
    expect(source).toContain("lazyLoadIntegration('replayIntegration')");
  });

  it('does not statically import posthog-js from feature modules', () => {
    const offenders = collectSourceFiles(srcRoot).filter((filePath) => {
      if (filePath.endsWith(`${path.sep}capture-posthog.ts`)) return false;
      const source = fs.readFileSync(filePath, 'utf8');
      return /import posthog from ['"]posthog-js['"]/.test(source);
    });

    expect(offenders.map((filePath) => path.relative(srcRoot, filePath))).toEqual([]);
  });

  it('keeps public SignIn/SignUp buttons on the lazy Clerk helper', () => {
    const publicCtas = [
      'src/components/marketing/marketing-nav.tsx',
      'src/components/marketing/hero-section.tsx',
      'src/components/marketing/cta-section.tsx',
      'src/components/marketing/how-it-works-section.tsx',
      'src/components/marketing/solution-section-new.tsx',
      'src/components/marketing/comparison-cta.tsx',
      'src/components/marketing/pricing/pricing-hero.tsx',
      'src/components/marketing/pricing/pricing-tier-card.tsx',
      'src/components/marketing/pricing/savings-calculator.tsx',
      'src/components/marketing/pricing/final-cta-section.tsx',
      'src/components/ui/integration-hero.tsx',
      'src/components/blog/blog-content.tsx',
      'src/components/programmatic/BlogPostTemplate.tsx',
    ];

    for (const relativePath of publicCtas) {
      const source = read(relativePath);
      expect(source, relativePath).not.toMatch(
        /import\s*\{[^}]*Sign(In|Up)Button[^}]*\}\s*from\s*['"]@clerk\/nextjs['"]/
      );
      expect(source, relativePath).toContain('lazy-clerk-auth-buttons');
    }
  });
});
