// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { resolveSentryRelease } from '@/lib/sentry-release';

describe('resolveSentryRelease (web)', () => {
  it('returns the first non-blank candidate', () => {
    expect(resolveSentryRelease(undefined, '  ', 'abc123', 'other')).toBe('abc123');
    expect(resolveSentryRelease('v1.2.3', 'abc123')).toBe('v1.2.3');
  });

  it('returns undefined when nothing usable is set', () => {
    expect(resolveSentryRelease()).toBeUndefined();
    expect(resolveSentryRelease('', '   ', undefined)).toBeUndefined();
  });
});

describe('client Sentry init lives in instrumentation-client (Turbopack-safe)', () => {
  const webRoot = path.resolve(import.meta.dirname, '..', '..', '..');

  it('initializes Sentry from instrumentation-client.ts', () => {
    const source = fs.readFileSync(path.join(webRoot, 'instrumentation-client.ts'), 'utf8');
    expect(source).toContain('Sentry.init(');
    expect(source).toContain('resolveSentryEnvironment(');
    expect(source).toContain('process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT');
    expect(source).toContain("lazyLoadIntegration('replayIntegration')");
    expect(source).toContain(
      'export const onRouterTransitionStart = Sentry.captureRouterTransitionStart'
    );
  });

  it('does not keep a separate sentry.client.config.ts (avoids double-init / Turbopack miss)', () => {
    expect(fs.existsSync(path.join(webRoot, 'sentry.client.config.ts'))).toBe(false);
  });
});

describe('withSentryConfig targets the live authhub/node project', () => {
  const webRoot = path.resolve(import.meta.dirname, '..', '..', '..');

  it('defaults org and project to the CLI-verified slugs', () => {
    const source = fs.readFileSync(path.join(webRoot, 'next.config.ts'), 'utf8');
    expect(source).toContain("process.env.SENTRY_ORG ?? 'authhub'");
    expect(source).toContain("process.env.SENTRY_PROJECT ?? 'node'");
    expect(source).not.toContain('agency-access-frontend');
  });
});
