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
