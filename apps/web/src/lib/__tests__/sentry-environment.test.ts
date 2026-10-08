// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { resolveSentryEnvironment } from '@/lib/sentry-environment';

describe('resolveSentryEnvironment (web)', () => {
  it('keeps NODE_ENV when no Sentry environment is set (prod unchanged)', () => {
    expect(resolveSentryEnvironment(undefined, undefined, 'production')).toBe('production');
    expect(resolveSentryEnvironment('', '  ', 'production')).toBe('production');
  });

  it('prefers SENTRY_ENVIRONMENT, then NEXT_PUBLIC_SENTRY_ENVIRONMENT', () => {
    expect(resolveSentryEnvironment('staging', 'preview', 'production')).toBe('staging');
    expect(resolveSentryEnvironment(undefined, 'staging', 'production')).toBe('staging');
  });

  it('falls back to development', () => {
    expect(resolveSentryEnvironment()).toBe('development');
  });
});

describe('sentry configs use resolveSentryEnvironment', () => {
  const webRoot = path.resolve(import.meta.dirname, '..', '..', '..');

  it.each(['sentry.server.config.ts', 'sentry.edge.config.ts', 'sentry.client.config.ts'])(
    '%s no longer hard-codes NODE_ENV as the environment',
    (file) => {
      const source = fs.readFileSync(path.join(webRoot, file), 'utf8');
      expect(source).toContain('environment: resolveSentryEnvironment(');
      expect(source).not.toContain('environment: process.env.NODE_ENV');
    }
  );

  it('the browser config reads the NEXT_PUBLIC_ variable (only those are inlined)', () => {
    const source = fs.readFileSync(path.join(webRoot, 'sentry.client.config.ts'), 'utf8');
    expect(source).toContain('process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT');
  });
});
