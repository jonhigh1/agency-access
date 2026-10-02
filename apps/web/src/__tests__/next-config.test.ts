// @vitest-environment node
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import nextConfig from '../../next.config';

describe('next config', () => {
  it('pins Turbopack root to the repository workspace root', () => {
    expect(nextConfig.turbopack?.root).toBe(path.resolve(import.meta.dirname, '..', '..', '..', '..'));
  });
});
