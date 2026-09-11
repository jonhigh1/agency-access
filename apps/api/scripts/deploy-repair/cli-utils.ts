/**
 * Shared CLI bootstrap helpers for this plan's `main()` entry points
 * (incident.ts, attempt-loop.ts). Each file's `main()` itself stays
 * separate — they are genuinely different CLI entry points for different
 * workflow jobs — but the GITHUB_OUTPUT writer and the "was this module
 * invoked directly" bootstrap were duplicated verbatim (simplify-pass
 * finding) and are pure, side-effect-identical utilities with no coupling
 * to either module's domain logic.
 */

import { promises as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Appends `key=value` lines to the GitHub Actions step-output file, if one is set. */
export async function writeGithubOutput(
  githubOutputPath: string | undefined,
  entries: Record<string, string>
): Promise<void> {
  if (!githubOutputPath) return;
  const lines = Object.entries(entries)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  await fs.appendFile(githubOutputPath, `${lines}\n`, 'utf-8');
}

/**
 * True when the current module was executed directly (`node foo.ts` /
 * `tsx foo.ts`), not merely imported. `importMetaUrl` is the caller's own
 * `import.meta.url` — this can't read that from here.
 */
export function isDirectRun(importMetaUrl: string): boolean {
  return (
    typeof process !== 'undefined' &&
    process.argv[1] !== undefined &&
    importMetaUrl === pathToFileURL(process.argv[1]).href
  );
}

/** Runs `main()` and exits with its returned code, only when this module was invoked directly. */
export function runCliIfDirect(importMetaUrl: string, main: () => Promise<number>, logPrefix: string): void {
  if (!isDirectRun(importMetaUrl)) return;
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(`${logPrefix} Fatal error:`, error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
