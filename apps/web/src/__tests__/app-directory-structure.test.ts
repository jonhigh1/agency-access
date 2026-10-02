// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const webRoot = path.resolve(import.meta.dirname, '..', '..');
const rootAppDir = path.join(webRoot, 'app');
const srcAppDir = path.join(webRoot, 'src', 'app');

describe('web app directory structure', () => {
  it('does not define a root app directory when src/app owns routing', () => {
    const hasSrcAppDir = fs.existsSync(srcAppDir);

    expect(hasSrcAppDir).toBe(true);
    expect(fs.existsSync(rootAppDir)).toBe(false);
  });
});
