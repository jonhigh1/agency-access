// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('server sentry config', () => {
  it('does not register browser replay integrations in the server config', () => {
    const configPath = path.resolve(import.meta.dirname, '..', '..', 'sentry.server.config.ts');
    const source = fs.readFileSync(configPath, 'utf8');

    expect(source).not.toContain('replayIntegration(');
  });
});

describe('client sentry config', () => {
  it('lives in instrumentation-client.ts for Turbopack', () => {
    const webRoot = path.resolve(import.meta.dirname, '..', '..');
    const source = fs.readFileSync(path.join(webRoot, 'instrumentation-client.ts'), 'utf8');
    expect(source).toContain('Sentry.init(');
    expect(fs.existsSync(path.join(webRoot, 'sentry.client.config.ts'))).toBe(false);
  });
});
