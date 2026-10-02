// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(process.cwd(), 'src');

const allowedFiles = new Set([
  'lib/api/api-env.ts',
  'lib/api/__tests__/api-env.test.ts',
  'lib/api/__tests__/authorized-api-fetch.test.ts',
  'lib/api/__tests__/api-url-usage.test.ts',
]);

const allowedPathFragments = [
  '/__tests__/',
  '.test.',
  'evidence/',
];

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = resolve(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return listFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

describe('API URL usage', () => {
  it('keeps NEXT_PUBLIC_API_URL reads inside the API environment helper or tests', () => {
    const offenders = listFiles(sourceRoot)
      .map((file) => relative(sourceRoot, file))
      .filter((file) => !allowedFiles.has(file))
      .filter((file) => !allowedPathFragments.some((fragment) => file.includes(fragment)))
      .filter((file) => readFileSync(resolve(sourceRoot, file), 'utf8').includes('NEXT_PUBLIC_API_URL'));

    expect(offenders).toEqual([]);
  });
});
