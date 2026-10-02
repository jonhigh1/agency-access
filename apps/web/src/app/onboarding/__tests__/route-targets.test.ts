// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(relativePathFromWebRoot: string) {
  const absolutePath = path.resolve(process.cwd(), relativePathFromWebRoot);
  return fs.readFileSync(absolutePath, 'utf-8');
}

describe('Onboarding route targets', () => {
  it('uses unified onboarding after sign up', () => {
    const providersCode = readFile('src/app/root-providers.tsx');

    expect(providersCode).toContain('`/onboarding/unified?tier=${storedTier}`');
    expect(providersCode).toContain("return '/onboarding/unified'");
  });

  it('routes dashboard agency setup fallback to unified onboarding', () => {
    const dashboardCode = readFile('src/app/(authenticated)/dashboard/page.tsx');

    expect(dashboardCode).toContain('href="/onboarding/unified"');
    expect(dashboardCode).not.toContain('href="/onboarding/agency"');
  });

  it('routes connections agency setup fallback to unified onboarding', () => {
    const connectionsCode = readFile('src/app/(authenticated)/connections/page.tsx');

    expect(connectionsCode).toContain("router.push('/onboarding/unified')");
    expect(connectionsCode).not.toContain("router.push('/onboarding/agency')");
  });

  it('keeps legacy onboarding route as a redirect to unified onboarding', () => {
    const legacyPageCode = readFile('src/app/onboarding/agency/page.tsx');

    expect(legacyPageCode).toContain("redirect('/onboarding/unified')");
  });

  it('resolves agency in authenticated layout using orgId before userId', () => {
    const layoutCode = readFile('src/app/(authenticated)/layout.tsx');

    expect(layoutCode).toContain('const sharedPrincipalId = !isDevelopmentBypass ? (orgId || userId) : null');
    expect(layoutCode).toContain('principalClerkId: sharedPrincipalId');
    expect(layoutCode).toContain('clerkUserId=${encodeURIComponent(principalClerkId)}');
  });
});
